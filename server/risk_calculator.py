"""
DonWatcher Risk Calculation Engine
Phase 3 - Complementary Risk Score Integration

This module provides risk calculation services that complement PingCastle
scores without interfering with existing risk assessments.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from server.models import SecurityToolType, Finding, Report


class RiskCategory(str, Enum):
    """Risk categories for domain group assessment"""
    ACCESS_GOVERNANCE = "access_governance"
    PRIVILEGE_ESCALATION = "privilege_escalation"  
    COMPLIANCE_POSTURE = "compliance_posture"
    OPERATIONAL_RISK = "operational_risk"


class GroupRiskLevel(str, Enum):
    """Group risk classification levels"""
    CRITICAL = "critical"    # Domain/Enterprise/Schema Admins
    HIGH = "high"           # Administrators, Account Operators
    MEDIUM = "medium"       # Backup/Server Operators
    LOW = "low"            # Print Operators, custom groups


@dataclass
class GroupRiskProfile:
    """Risk profile configuration for different group types"""
    name: str
    risk_level: GroupRiskLevel
    base_weight: float
    max_acceptable_members: int
    escalation_multiplier: float


@dataclass
class DomainGroupRisk:
    """Individual group risk assessment"""
    group_name: str
    total_members: int
    accepted_members: int
    unaccepted_members: int
    risk_score: float
    risk_level: GroupRiskLevel
    contributing_factors: Dict[str, float]


@dataclass
class DomainRiskAssessment:
    """Complete domain risk assessment"""
    domain: str
    assessment_date: datetime
    
    # Category scores (0-100)
    access_governance_score: float
    privilege_escalation_score: float
    compliance_posture_score: float
    operational_risk_score: float
    
    # Overall domain group risk score (0-100)
    domain_group_score: float
    
    # Individual group assessments
    group_risks: List[DomainGroupRisk]
    
    # Risk calculation metadata
    calculation_metadata: Dict[str, any]


@dataclass
class GlobalRiskScore:
    """Combined global risk assessment"""
    domain: str
    assessment_date: datetime
    
    # Component scores
    pingcastle_score: Optional[float]
    domain_group_score: float
    hoxhunt_score: Optional[float] = None  # Hoxhunt awareness score (0-100, higher = better)
    
    # Combined score
    global_score: float = 0.0
    
    # Score breakdown (percentages showing contribution to global score)
    pingcastle_contribution: Optional[float] = None
    domain_group_contribution: float = 0.0
    hoxhunt_contribution: Optional[float] = None  # Risk contribution from Hoxhunt (inverted)
    
    # Risk trend
    trend_direction: str = "stable"  # "improving", "stable", "degrading"
    trend_percentage: float = 0.0


class RiskCalculator:
    """Main risk calculation engine"""
    
    # Group risk profiles - configurable weights and thresholds
    GROUP_PROFILES = {
        'Domain Admins': GroupRiskProfile(
            name='Domain Admins',
            risk_level=GroupRiskLevel.CRITICAL,
            base_weight=3.0,
            max_acceptable_members=2,
            escalation_multiplier=2.0
        ),
        'Enterprise Admins': GroupRiskProfile(
            name='Enterprise Admins', 
            risk_level=GroupRiskLevel.CRITICAL,
            base_weight=3.0,
            max_acceptable_members=1,
            escalation_multiplier=2.5
        ),
        'Schema Admins': GroupRiskProfile(
            name='Schema Admins',
            risk_level=GroupRiskLevel.CRITICAL,
            base_weight=2.5,
            max_acceptable_members=1,
            escalation_multiplier=2.0
        ),
        'Administrators': GroupRiskProfile(
            name='Administrators',
            risk_level=GroupRiskLevel.HIGH,
            base_weight=2.0,
            max_acceptable_members=5,
            escalation_multiplier=1.5
        ),
        'Account Operators': GroupRiskProfile(
            name='Account Operators',
            risk_level=GroupRiskLevel.HIGH,
            base_weight=1.8,
            max_acceptable_members=3,
            escalation_multiplier=1.5
        ),
        'Backup Operators': GroupRiskProfile(
            name='Backup Operators',
            risk_level=GroupRiskLevel.MEDIUM,
            base_weight=1.2,
            max_acceptable_members=5,
            escalation_multiplier=1.2
        ),
        'Server Operators': GroupRiskProfile(
            name='Server Operators',
            risk_level=GroupRiskLevel.MEDIUM,
            base_weight=1.2,
            max_acceptable_members=3,
            escalation_multiplier=1.2
        ),
        'Print Operators': GroupRiskProfile(
            name='Print Operators',
            risk_level=GroupRiskLevel.LOW,
            base_weight=1.0,
            max_acceptable_members=8,
            escalation_multiplier=1.0
        )
    }
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def calculate_group_risk(self, group_name: str, total_members: int, 
                           accepted_members: int, accepted_member_details: List[Dict] = None) -> DomainGroupRisk:
        """
        Calculate risk score for an individual group
        
        Args:
            group_name: Name of the AD group
            total_members: Total number of members in group
            accepted_members: Number of accepted/approved members
            accepted_member_details: Optional details about accepted members
            
        Returns:
            DomainGroupRisk object with calculated risk assessment
        """
        unaccepted_members = total_members - accepted_members
        
        # Get group profile or create default
        profile = self.GROUP_PROFILES.get(group_name, GroupRiskProfile(
            name=group_name,
            risk_level=GroupRiskLevel.LOW,
            base_weight=1.0,
            max_acceptable_members=10,
            escalation_multiplier=1.0
        ))
        
        # Calculate base risk from unaccepted members
        if total_members == 0:
            base_risk = 0.0
        else:
            unaccepted_ratio = unaccepted_members / total_members
            base_risk = min(unaccepted_ratio * 100, 100)
        
        # Risk factors
        contributing_factors = {}
        
        # Factor 1: Unaccepted member ratio
        contributing_factors['unaccepted_ratio'] = base_risk
        
        # Factor 2: Absolute number of unaccepted members
        if unaccepted_members > profile.max_acceptable_members:
            excess_members = unaccepted_members - profile.max_acceptable_members
            excess_risk = min(excess_members * 10, 50)  # Cap at 50 points
            contributing_factors['excess_members'] = excess_risk
        else:
            contributing_factors['excess_members'] = 0.0
        
        # Factor 3: Group criticality multiplier
        criticality_multiplier = profile.escalation_multiplier
        contributing_factors['criticality_multiplier'] = criticality_multiplier
        
        # Factor 4: Zero acceptance penalty for critical groups
        if (profile.risk_level == GroupRiskLevel.CRITICAL and 
            accepted_members == 0 and total_members > 0):
            contributing_factors['zero_acceptance_penalty'] = 25.0
        else:
            contributing_factors['zero_acceptance_penalty'] = 0.0
        
        # Calculate final risk score
        raw_risk = (
            contributing_factors['unaccepted_ratio'] + 
            contributing_factors['excess_members'] +
            contributing_factors['zero_acceptance_penalty']
        ) * criticality_multiplier
        
        final_risk = min(raw_risk, 100.0)
        
        return DomainGroupRisk(
            group_name=group_name,
            total_members=total_members,
            accepted_members=accepted_members,
            unaccepted_members=unaccepted_members,
            risk_score=final_risk,
            risk_level=profile.risk_level,
            contributing_factors=contributing_factors
        )
    
    def calculate_domain_risk(self, domain: str, group_data: List[Dict], 
                            storage=None) -> DomainRiskAssessment:
        """
        Calculate overall domain risk assessment from group data
        
        Args:
            domain: Domain name
            group_data: List of group dictionaries with member information
            storage: Optional storage instance for accepted member lookup
            
        Returns:
            DomainRiskAssessment with complete domain risk analysis
        """
        assessment_date = datetime.utcnow()
        group_risks = []
        
        # Calculate individual group risks
        for group_info in group_data:
            group_name = group_info.get('group_name', '')
            total_members = group_info.get('total_members', 0)
            accepted_members = group_info.get('accepted_members', 0)
            
            group_risk = self.calculate_group_risk(
                group_name=group_name,
                total_members=total_members,
                accepted_members=accepted_members
            )
            group_risks.append(group_risk)
        
        # Calculate category scores
        access_governance = self._calculate_access_governance_score(group_risks)
        privilege_escalation = self._calculate_privilege_escalation_score(group_risks)
        compliance_posture = self._calculate_compliance_posture_score(group_risks)
        operational_risk = self._calculate_operational_risk_score(group_risks)
        
        # Calculate overall domain group score (weighted average)
        domain_group_score = (
            access_governance * 0.3 +
            privilege_escalation * 0.4 +  # Higher weight for privilege escalation
            compliance_posture * 0.2 +
            operational_risk * 0.1
        )
        
        return DomainRiskAssessment(
            domain=domain,
            assessment_date=assessment_date,
            access_governance_score=access_governance,
            privilege_escalation_score=privilege_escalation,
            compliance_posture_score=compliance_posture,
            operational_risk_score=operational_risk,
            domain_group_score=domain_group_score,
            group_risks=group_risks,
            calculation_metadata={
                'calculation_method': 'weighted_group_aggregation',
                'group_count': len(group_risks),
                'critical_groups': len([g for g in group_risks if g.risk_level == GroupRiskLevel.CRITICAL]),
                'high_risk_groups': len([g for g in group_risks if g.risk_score > 50]),
                'total_members': sum(g.total_members for g in group_risks),
                'total_unaccepted': sum(g.unaccepted_members for g in group_risks),
                'calculation_timestamp': assessment_date.isoformat()
            }
        )
    
    def calculate_global_risk(self, domain: str, pingcastle_score: Optional[float],
                            domain_group_score: float,
                            historical_scores: List[Tuple[datetime, float]] = None,
                            hoxhunt_score: Optional[float] = None) -> GlobalRiskScore:
        """
        Calculate combined global risk score from PingCastle, Domain Group, and Hoxhunt scores

        Args:
            domain: Domain name
            pingcastle_score: PingCastle global score (0-100) or None if unavailable
            domain_group_score: Domain group risk score (0-100)
            historical_scores: Optional historical global scores for trend analysis
            hoxhunt_score: Hoxhunt security awareness score (0-100, higher = better)
                          Note: This is converted to risk contribution internally

        Returns:
            GlobalRiskScore with combined assessment
        """
        assessment_date = datetime.utcnow()

        # Base risk combination weights
        # These are adjusted dynamically based on data availability
        BASE_PINGCASTLE_WEIGHT = 0.55  # Infrastructure and configuration security
        BASE_DOMAIN_GROUP_WEIGHT = 0.30  # Access governance and privilege management
        BASE_HOXHUNT_WEIGHT = 0.15  # User security awareness (contributes inversely)

        # Convert Hoxhunt awareness score to risk contribution
        # Higher awareness = lower risk, so we invert it
        hoxhunt_risk = (100 - hoxhunt_score) if hoxhunt_score is not None else None
        
        # Determine which data sources are available
        has_pingcastle = pingcastle_score is not None
        has_hoxhunt = hoxhunt_risk is not None
        
        # Calculate weights based on available data
        if has_pingcastle and has_hoxhunt:
            # All three data sources available
            pingcastle_weight = BASE_PINGCASTLE_WEIGHT
            domain_group_weight = BASE_DOMAIN_GROUP_WEIGHT
            hoxhunt_weight = BASE_HOXHUNT_WEIGHT
        elif has_pingcastle and not has_hoxhunt:
            # PingCastle + Domain Groups only (original behavior)
            pingcastle_weight = 0.70
            domain_group_weight = 0.30
            hoxhunt_weight = 0.0
        elif not has_pingcastle and has_hoxhunt:
            # Domain Groups + Hoxhunt only
            pingcastle_weight = 0.0
            domain_group_weight = 0.65
            hoxhunt_weight = 0.35
        else:
            # Only Domain Groups available
            pingcastle_weight = 0.0
            domain_group_weight = 1.0
            hoxhunt_weight = 0.0
        
        # Calculate global score
        global_score = 0.0
        if has_pingcastle:
            global_score += pingcastle_score * pingcastle_weight
        global_score += domain_group_score * domain_group_weight
        if has_hoxhunt:
            global_score += hoxhunt_risk * hoxhunt_weight
        
        # Calculate contribution percentages
        if global_score > 0:
            pingcastle_contribution = ((pingcastle_score * pingcastle_weight) / global_score * 100) if has_pingcastle else None
            domain_group_contribution = (domain_group_score * domain_group_weight) / global_score * 100
            hoxhunt_contribution = ((hoxhunt_risk * hoxhunt_weight) / global_score * 100) if has_hoxhunt else None
        else:
            pingcastle_contribution = None
            domain_group_contribution = 100.0
            hoxhunt_contribution = None

        # Calculate trend
        trend_direction = "stable"
        trend_percentage = 0.0

        if historical_scores and len(historical_scores) >= 2:
            # Compare with previous score
            previous_score = historical_scores[-2][1]
            current_score = global_score

            change = current_score - previous_score
            trend_percentage = abs(change)

            if change > 5:  # Threshold for significant change
                trend_direction = "degrading"
            elif change < -5:
                trend_direction = "improving"
            else:
                trend_direction = "stable"

        return GlobalRiskScore(
            domain=domain,
            assessment_date=assessment_date,
            pingcastle_score=pingcastle_score,
            domain_group_score=domain_group_score,
            hoxhunt_score=hoxhunt_score,
            global_score=round(global_score, 2),
            pingcastle_contribution=round(pingcastle_contribution, 2) if pingcastle_contribution else None,
            domain_group_contribution=round(domain_group_contribution, 2),
            hoxhunt_contribution=round(hoxhunt_contribution, 2) if hoxhunt_contribution else None,
            trend_direction=trend_direction,
            trend_percentage=round(trend_percentage, 2)
        )
    
    def _calculate_access_governance_score(self, group_risks: List[DomainGroupRisk]) -> float:
        """Calculate access governance risk score (0-100)"""
        if not group_risks:
            return 0.0
        
        # Weighted average based on group importance
        total_weighted_risk = 0.0
        total_weight = 0.0
        
        for group_risk in group_risks:
            profile = self.GROUP_PROFILES.get(group_risk.group_name)
            weight = profile.base_weight if profile else 1.0
            
            # Focus on acceptance rates
            if group_risk.total_members > 0:
                unaccepted_ratio = group_risk.unaccepted_members / group_risk.total_members
                governance_risk = unaccepted_ratio * 100
            else:
                governance_risk = 0.0
            
            total_weighted_risk += governance_risk * weight
            total_weight += weight
        
        return min(total_weighted_risk / total_weight if total_weight > 0 else 0, 100.0)
    
    def _calculate_privilege_escalation_score(self, group_risks: List[DomainGroupRisk]) -> float:
        """Calculate privilege escalation risk score (0-100)"""
        # Focus on critical and high-privilege groups
        critical_risks = [g for g in group_risks if g.risk_level in [GroupRiskLevel.CRITICAL, GroupRiskLevel.HIGH]]
        
        if not critical_risks:
            return 0.0
        
        # Higher penalty for unaccepted members in privileged groups
        total_risk = 0.0
        for group_risk in critical_risks:
            escalation_risk = group_risk.risk_score
            
            # Additional penalty for critical groups
            if group_risk.risk_level == GroupRiskLevel.CRITICAL:
                escalation_risk *= 1.5
            
            total_risk += escalation_risk
        
        # Average and cap at 100
        return min(total_risk / len(critical_risks), 100.0)
    
    def _calculate_compliance_posture_score(self, group_risks: List[DomainGroupRisk]) -> float:
        """Calculate compliance posture risk score (0-100)"""
        if not group_risks:
            return 0.0
        
        # Overall acceptance rate across all groups
        total_members = sum(g.total_members for g in group_risks)
        total_unaccepted = sum(g.unaccepted_members for g in group_risks)
        
        if total_members == 0:
            return 0.0
        
        # Compliance risk based on overall unaccepted ratio
        unaccepted_ratio = total_unaccepted / total_members
        compliance_risk = unaccepted_ratio * 100
        
        # Penalty for groups with zero acceptance
        zero_acceptance_groups = len([g for g in group_risks if g.accepted_members == 0 and g.total_members > 0])
        if zero_acceptance_groups > 0:
            compliance_risk += zero_acceptance_groups * 10  # 10 points per unmanaged group
        
        return min(compliance_risk, 100.0)
    
    def _calculate_operational_risk_score(self, group_risks: List[DomainGroupRisk]) -> float:
        """Calculate operational risk score (0-100)"""
        if not group_risks:
            return 0.0
        
        # Risk from operational inefficiency and management gaps
        operational_factors = []
        
        # Factor 1: Number of groups with mixed acceptance status
        mixed_groups = len([g for g in group_risks if 0 < g.accepted_members < g.total_members])
        mixed_ratio = mixed_groups / len(group_risks) if group_risks else 0
        operational_factors.append(mixed_ratio * 50)  # Up to 50 points
        
        # Factor 2: Groups with excessive members
        oversized_groups = 0
        for group_risk in group_risks:
            profile = self.GROUP_PROFILES.get(group_risk.group_name)
            if profile and group_risk.total_members > (profile.max_acceptable_members * 2):
                oversized_groups += 1
        
        if group_risks:
            oversized_ratio = oversized_groups / len(group_risks)
            operational_factors.append(oversized_ratio * 30)  # Up to 30 points
        
        # Factor 3: Unmanaged groups (no accepted members)
        unmanaged_groups = len([g for g in group_risks if g.accepted_members == 0 and g.total_members > 0])
        if group_risks:
            unmanaged_ratio = unmanaged_groups / len(group_risks)
            operational_factors.append(unmanaged_ratio * 40)  # Up to 40 points
        
        return min(sum(operational_factors), 100.0)


# Global risk calculator instance
risk_calculator = RiskCalculator()
