"""
DonWatcher Risk Integration Service
Phase 3 - Backend Service for Risk Score Management

This service integrates domain group risks with existing PingCastle scores
to provide comprehensive global risk assessment.

Enhanced with caching layer for improved performance.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from server.models import SecurityToolType, Report, ReportSummary
from server.risk_calculator import (
    RiskCalculator, 
    DomainRiskAssessment, 
    GlobalRiskScore,
    GroupRiskLevel
)
from server.cache_service import (
    get_risk_cache,
    invalidate_risk_cache_for_domain,
    invalidate_risk_cache_for_member_change
)


class RiskIntegrationService:
    """Service for integrating and managing risk scores"""
    
    def __init__(self, storage):
        self.storage = storage
        self.risk_calculator = RiskCalculator()
        self.logger = logging.getLogger(__name__)
    
    async def calculate_and_store_domain_risk(self, domain: str, force_recalculation: bool = False) -> DomainRiskAssessment:
        """
        Calculate domain risk assessment and store in database
        
        Args:
            domain: Domain name to assess
            force_recalculation: Force recalculation even if recent assessment exists
            
        Returns:
            DomainRiskAssessment object
        """
        try:
            # Check if recent assessment exists (within last 6 hours)
            if not force_recalculation:
                recent_assessment = self._get_recent_domain_assessment(domain, hours=6)
                if recent_assessment:
                    self.logger.info(f"Using recent domain risk assessment for {domain}")
                    return recent_assessment
            
            # Get domain group data from latest report
            group_data = await self._get_domain_group_data(domain)
            if not group_data:
                self.logger.warning(f"No domain group data found for {domain}")
                return self._create_empty_assessment(domain)
            
            # Calculate domain risk assessment
            assessment = self.risk_calculator.calculate_domain_risk(domain, group_data, self.storage)
            
            # Store assessment in database
            assessment_id = self._store_domain_assessment(assessment)
            self.logger.info(f"Stored domain risk assessment for {domain} with ID {assessment_id}")
            
            return assessment
            
        except Exception as e:
            self.logger.error(f"Failed to calculate domain risk for {domain}: {e}")
            raise
    
    async def calculate_and_store_global_risk(self, domain: str) -> GlobalRiskScore:
        """
        Calculate global risk score combining PingCastle, domain group risks, and Hoxhunt scores
        
        Args:
            domain: Domain name to assess
            
        Returns:
            GlobalRiskScore object
        """
        try:
            # Check cache first
            cache = get_risk_cache()
            cached_data = cache.get_global_risk(domain)
            if cached_data:
                self.logger.debug(f"Using cached global risk for {domain}")
                return GlobalRiskScore(**cached_data)
            
            # Get latest PingCastle score
            pingcastle_score = self._get_latest_pingcastle_score(domain)
            
            # Calculate or get domain group risk
            domain_assessment = await self.calculate_and_store_domain_risk(domain)
            domain_group_score = domain_assessment.domain_group_score
            
            # Get latest Hoxhunt security awareness score
            hoxhunt_score = self._get_latest_hoxhunt_score(domain)
            
            # Get historical scores for trend analysis
            historical_scores = self._get_historical_global_scores(domain, days=30)
            
            # Calculate global risk score (now includes Hoxhunt)
            global_risk = self.risk_calculator.calculate_global_risk(
                domain=domain,
                pingcastle_score=pingcastle_score,
                domain_group_score=domain_group_score,
                historical_scores=historical_scores,
                hoxhunt_score=hoxhunt_score
            )
            
            # Store global risk score
            global_risk_id = self._store_global_risk_score(global_risk, domain_assessment)
            self.logger.info(f"Stored global risk score for {domain} with ID {global_risk_id}")
            
            # Cache the result
            cache.set_global_risk(domain, {
                'domain': global_risk.domain,
                'assessment_date': global_risk.assessment_date,
                'pingcastle_score': global_risk.pingcastle_score,
                'domain_group_score': global_risk.domain_group_score,
                'hoxhunt_score': global_risk.hoxhunt_score,
                'global_score': global_risk.global_score,
                'pingcastle_contribution': global_risk.pingcastle_contribution,
                'domain_group_contribution': global_risk.domain_group_contribution,
                'hoxhunt_contribution': global_risk.hoxhunt_contribution,
                'trend_direction': global_risk.trend_direction,
                'trend_percentage': global_risk.trend_percentage
            })
            
            return global_risk
            
        except Exception as e:
            self.logger.error(f"Failed to calculate global risk for {domain}: {e}")
            raise
    
    async def update_risk_scores_for_member_change(self, domain: str, group_name: str) -> None:
        """
        Update risk scores when group membership changes
        
        Args:
            domain: Domain name
            group_name: Group that had membership changes
        """
        try:
            self.logger.info(f"Updating risk scores for {group_name} in {domain}")
            
            # Invalidate cache for this domain/group
            invalidated = invalidate_risk_cache_for_member_change(domain, group_name)
            self.logger.debug(f"Invalidated {invalidated} cache entries for member change")
            
            # Force recalculation of domain risk
            await self.calculate_and_store_domain_risk(domain, force_recalculation=True)
            
            # Recalculate global risk
            await self.calculate_and_store_global_risk(domain)
            
            # Log the calculation trigger
            self._log_risk_calculation(domain, 'member_change', f"Group: {group_name}")
            
        except Exception as e:
            self.logger.error(f"Failed to update risk scores for member change in {domain}: {e}")
            raise
    
    async def get_domain_risk_breakdown(self, domain: str) -> Dict[str, Any]:
        """
        Get detailed risk breakdown for a domain
        
        Args:
            domain: Domain name
            
        Returns:
            Dictionary with detailed risk information
        """
        try:
            # Get latest assessments
            domain_assessment = self._get_recent_domain_assessment(domain, hours=24)
            global_risk = self._get_recent_global_risk(domain, hours=24)
            
            if not domain_assessment:
                domain_assessment = await self.calculate_and_store_domain_risk(domain)
            
            if not global_risk:
                global_risk = await self.calculate_and_store_global_risk(domain)
            
            # Build comprehensive breakdown
            breakdown = {
                'domain': domain,
                'assessment_date': global_risk.assessment_date.isoformat(),
                
                # Global scores
                'global_score': float(global_risk.global_score),
                'trend_direction': global_risk.trend_direction,
                'trend_percentage': float(global_risk.trend_percentage),
                
                # Component scores
                'pingcastle_score': float(global_risk.pingcastle_score) if global_risk.pingcastle_score else None,
                'domain_group_score': float(global_risk.domain_group_score),
                
                # Score contributions
                'pingcastle_contribution': float(global_risk.pingcastle_contribution) if global_risk.pingcastle_contribution else None,
                'domain_group_contribution': float(global_risk.domain_group_contribution),
                
                # Domain group category breakdown
                'category_scores': {
                    'access_governance': float(domain_assessment.access_governance_score),
                    'privilege_escalation': float(domain_assessment.privilege_escalation_score),
                    'compliance_posture': float(domain_assessment.compliance_posture_score),
                    'operational_risk': float(domain_assessment.operational_risk_score)
                },
                
                # Group-level details
                'group_risks': [
                    {
                        'group_name': gr.group_name,
                        'risk_score': float(gr.risk_score),
                        'risk_level': gr.risk_level.value,
                        'total_members': gr.total_members,
                        'accepted_members': gr.accepted_members,
                        'unaccepted_members': gr.unaccepted_members,
                        'contributing_factors': gr.contributing_factors
                    }
                    for gr in domain_assessment.group_risks
                ],
                
                # Summary statistics
                'summary': domain_assessment.calculation_metadata
            }
            
            return breakdown
            
        except Exception as e:
            self.logger.error(f"Failed to get risk breakdown for {domain}: {e}")
            raise
    
    async def get_risk_comparison_across_domains(self) -> List[Dict[str, Any]]:
        """
        Get risk score comparison across all domains
        
        Returns:
            List of domain risk summaries for comparison
        """
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT 
                        domain,
                        global_score,
                        pingcastle_score,
                        domain_group_score,
                        trend_direction,
                        risk_level,
                        total_groups,
                        critical_groups,
                        high_risk_groups,
                        total_members,
                        total_unaccepted,
                        assessment_date
                    FROM risk_dashboard_summary
                    ORDER BY global_score DESC
                """)
                
                result = conn.execute(query)
                domains = []
                
                for row in result:
                    domains.append({
                        'domain': row.domain,
                        'global_score': float(row.global_score) if row.global_score else 0,
                        'pingcastle_score': float(row.pingcastle_score) if row.pingcastle_score else None,
                        'domain_group_score': float(row.domain_group_score) if row.domain_group_score else 0,
                        'trend_direction': row.trend_direction,
                        'risk_level': row.risk_level,
                        'total_groups': row.total_groups or 0,
                        'critical_groups': row.critical_groups or 0,
                        'high_risk_groups': row.high_risk_groups or 0,
                        'total_members': row.total_members or 0,
                        'total_unaccepted': row.total_unaccepted or 0,
                        'assessment_date': row.assessment_date.isoformat() if row.assessment_date else None
                    })
                
                return domains
                
        except Exception as e:
            self.logger.error(f"Failed to get domain risk comparison: {e}")
            raise
    
    async def get_risk_history(self, domain: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get historical risk scores for trending
        
        Args:
            domain: Domain name
            days: Number of days of history to retrieve
            
        Returns:
            List of historical risk scores
        """
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT 
                        assessment_date,
                        global_score,
                        pingcastle_score,
                        domain_group_score,
                        trend_direction
                    FROM global_risk_scores
                    WHERE domain = :domain
                      AND assessment_date >= NOW() - make_interval(days => :days)
                    ORDER BY assessment_date ASC
                """)
                
                result = conn.execute(query, {"domain": domain, "days": days})
                history = []
                
                for row in result:
                    history.append({
                        'date': row.assessment_date.isoformat(),
                        'global_score': float(row.global_score),
                        'pingcastle_score': float(row.pingcastle_score) if row.pingcastle_score else None,
                        'domain_group_score': float(row.domain_group_score),
                        'trend_direction': row.trend_direction
                    })
                
                return history
                
        except Exception as e:
            self.logger.error(f"Failed to get risk history for {domain}: {e}")
            raise
    
    def _get_recent_domain_assessment(self, domain: str, hours: int = 6) -> Optional[DomainRiskAssessment]:
        """Get recent domain risk assessment if available"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT 
                        id, domain, assessment_date,
                        access_governance_score, privilege_escalation_score,
                        compliance_posture_score, operational_risk_score,
                        domain_group_score, calculation_metadata
                    FROM domain_risk_assessments
                    WHERE domain = :domain
                      AND assessment_date >= NOW() - make_interval(hours => :hours)
                    ORDER BY assessment_date DESC
                    LIMIT 1
                """)
                
                result = conn.execute(query, {"domain": domain, "hours": hours})
                row = result.first()
                
                if not row:
                    return None
                
                # Get group risks for this assessment
                group_risks = self._get_group_risks_for_assessment(row.id)
                
                return DomainRiskAssessment(
                    domain=row.domain,
                    assessment_date=row.assessment_date,
                    access_governance_score=float(row.access_governance_score),
                    privilege_escalation_score=float(row.privilege_escalation_score),
                    compliance_posture_score=float(row.compliance_posture_score),
                    operational_risk_score=float(row.operational_risk_score),
                    domain_group_score=float(row.domain_group_score),
                    group_risks=group_risks,
                    calculation_metadata=row.calculation_metadata or {}
                )
                
        except Exception as e:
            self.logger.error(f"Failed to get recent domain assessment for {domain}: {e}")
            return None
    
    def _get_recent_global_risk(self, domain: str, hours: int = 6) -> Optional[GlobalRiskScore]:
        """Get recent global risk score if available"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT *
                    FROM global_risk_scores
                    WHERE domain = :domain
                      AND assessment_date >= NOW() - make_interval(hours => :hours)
                    ORDER BY assessment_date DESC
                    LIMIT 1
                """)
                
                result = conn.execute(query, {"domain": domain, "hours": hours})
                row = result.first()
                
                if not row:
                    return None
                
                return GlobalRiskScore(
                    domain=row.domain,
                    assessment_date=row.assessment_date,
                    pingcastle_score=float(row.pingcastle_score) if row.pingcastle_score else None,
                    domain_group_score=float(row.domain_group_score),
                    global_score=float(row.global_score),
                    pingcastle_contribution=float(row.pingcastle_contribution) if row.pingcastle_contribution else None,
                    domain_group_contribution=float(row.domain_group_contribution),
                    trend_direction=row.trend_direction,
                    trend_percentage=float(row.trend_percentage)
                )
                
        except Exception as e:
            self.logger.error(f"Failed to get recent global risk for {domain}: {e}")
            return None
    
    async def _get_domain_group_data(self, domain: str) -> List[Dict[str, Any]]:
        """Get domain group data for risk calculation"""
        try:
            # Use the existing API endpoint logic to get group data
            reports = self.storage.get_all_reports_summary()
            domain_reports = [r for r in reports if r.domain == domain and r.tool_type == SecurityToolType.DOMAIN_ANALYSIS]
            
            if not domain_reports:
                return []
            
            # Get the latest report
            latest_report = max(domain_reports, key=lambda r: r.report_date)
            report_detail = self.storage.get_report(latest_report.id)
            
            # Extract group data
            group_data = []
            for finding in report_detail.findings:
                if finding.category == "DonScanner" and finding.name.startswith("Group_"):
                    group_name = finding.metadata.get('group_name', '')
                    total_members = finding.metadata.get('member_count', 0)
                    
                    # Get accepted members count
                    accepted_members = self.storage.get_accepted_group_members(domain, group_name)
                    accepted_count = len(accepted_members)
                    
                    group_data.append({
                        'group_name': group_name,
                        'total_members': total_members,
                        'accepted_members': accepted_count,
                        'unaccepted_members': total_members - accepted_count,
                        'members': finding.metadata.get('members', [])
                    })
            
            return group_data
            
        except Exception as e:
            self.logger.error(f"Failed to get domain group data for {domain}: {e}")
            return []
    
    def _get_latest_pingcastle_score(self, domain: str) -> Optional[float]:
        """Get latest PingCastle global score for domain"""
        try:
            reports = self.storage.get_all_reports_summary()
            pingcastle_reports = [
                r for r in reports 
                if r.domain == domain and r.tool_type == SecurityToolType.PINGCASTLE
            ]
            
            if not pingcastle_reports:
                return None
            
            # Get the latest PingCastle report
            latest_report = max(pingcastle_reports, key=lambda r: r.report_date)
            return float(latest_report.global_score) if latest_report.global_score else None
            
        except Exception as e:
            self.logger.error(f"Failed to get PingCastle score for {domain}: {e}")
            return None
    
    def _get_latest_hoxhunt_score(self, domain: str) -> Optional[float]:
        """
        Get latest Hoxhunt security awareness score for domain
        
        Args:
            domain: Domain name
            
        Returns:
            Hoxhunt overall score (0-100) or None if not available
        """
        try:
            latest_score = self.storage.get_latest_hoxhunt_score(domain)
            
            if not latest_score:
                return None
            
            return float(latest_score.get('overall_score', 0))
            
        except Exception as e:
            self.logger.error(f"Failed to get Hoxhunt score for {domain}: {e}")
            return None
    
    def _get_historical_global_scores(self, domain: str, days: int = 30) -> List[Tuple[datetime, float]]:
        """Get historical global scores for trend analysis"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT assessment_date, global_score
                    FROM global_risk_scores
                    WHERE domain = :domain
                      AND assessment_date >= NOW() - make_interval(days => :days)
                    ORDER BY assessment_date ASC
                """)
                
                result = conn.execute(query, {"domain": domain, "days": days})
                return [(row.assessment_date, float(row.global_score)) for row in result]
                
        except Exception as e:
            self.logger.error(f"Failed to get historical scores for {domain}: {e}")
            return []
    
    def _store_domain_assessment(self, assessment: DomainRiskAssessment) -> str:
        """Store domain risk assessment in database"""
        try:
            with self.storage.get_connection() as conn:
                # Check if assessment exists for this domain today
                check_query = text("""
                    SELECT id FROM domain_risk_assessments 
                    WHERE domain = :domain AND DATE(assessment_date) = DATE(:assessment_date)
                """)
                existing = conn.execute(check_query, {
                    "domain": assessment.domain,
                    "assessment_date": assessment.assessment_date
                }).fetchone()
                
                if existing:
                    # Update existing assessment
                    assessment_query = text("""
                        UPDATE domain_risk_assessments SET
                            access_governance_score = :access_governance_score,
                            privilege_escalation_score = :privilege_escalation_score,
                            compliance_posture_score = :compliance_posture_score,
                            operational_risk_score = :operational_risk_score,
                            domain_group_score = :domain_group_score,
                            calculation_metadata = :calculation_metadata,
                            updated_at = NOW()
                        WHERE id = :id
                        RETURNING id
                    """)
                    result = conn.execute(assessment_query, {
                        "id": existing.id,
                        "access_governance_score": assessment.access_governance_score,
                        "privilege_escalation_score": assessment.privilege_escalation_score,
                        "compliance_posture_score": assessment.compliance_posture_score,
                        "operational_risk_score": assessment.operational_risk_score,
                        "domain_group_score": assessment.domain_group_score,
                        "calculation_metadata": assessment.calculation_metadata
                    })
                else:
                    # Insert new assessment
                    assessment_query = text("""
                        INSERT INTO domain_risk_assessments (
                            domain, assessment_date, access_governance_score,
                            privilege_escalation_score, compliance_posture_score,
                            operational_risk_score, domain_group_score, calculation_metadata
                        ) VALUES (
                            :domain, :assessment_date, :access_governance_score,
                            :privilege_escalation_score, :compliance_posture_score,
                            :operational_risk_score, :domain_group_score, :calculation_metadata
                        )
                        RETURNING id
                    """)
                    result = conn.execute(assessment_query, {
                        "domain": assessment.domain,
                        "assessment_date": assessment.assessment_date,
                        "access_governance_score": assessment.access_governance_score,
                        "privilege_escalation_score": assessment.privilege_escalation_score,
                        "compliance_posture_score": assessment.compliance_posture_score,
                        "operational_risk_score": assessment.operational_risk_score,
                        "domain_group_score": assessment.domain_group_score,
                        "calculation_metadata": assessment.calculation_metadata
                    })
                
                assessment_id = result.scalar()
                
                # Store individual group risks
                self._store_group_risks(assessment_id, assessment.group_risks, conn)
                
                conn.commit()
                return str(assessment_id)
                
        except Exception as e:
            self.logger.error(f"Failed to store domain assessment: {e}")
            raise
    
    def _store_group_risks(self, assessment_id: str, group_risks: List, conn) -> None:
        """Store individual group risk assessments"""
        try:
            # Delete existing group risks for this assessment
            delete_query = text("DELETE FROM group_risk_assessments WHERE domain_assessment_id = :assessment_id")
            conn.execute(delete_query, {"assessment_id": assessment_id})
            
            # Insert new group risks
            for group_risk in group_risks:
                group_query = text("""
                    INSERT INTO group_risk_assessments (
                        domain_assessment_id, group_name, total_members,
                        accepted_members, unaccepted_members, risk_score,
                        risk_level, contributing_factors
                    ) VALUES (
                        :assessment_id, :group_name, :total_members,
                        :accepted_members, :unaccepted_members, :risk_score,
                        :risk_level, :contributing_factors
                    )
                """)
                
                conn.execute(group_query, {
                    "assessment_id": assessment_id,
                    "group_name": group_risk.group_name,
                    "total_members": group_risk.total_members,
                    "accepted_members": group_risk.accepted_members,
                    "unaccepted_members": group_risk.unaccepted_members,
                    "risk_score": group_risk.risk_score,
                    "risk_level": group_risk.risk_level.value,
                    "contributing_factors": group_risk.contributing_factors
                })
                
        except Exception as e:
            self.logger.error(f"Failed to store group risks: {e}")
            raise
    
    def _store_global_risk_score(self, global_risk: GlobalRiskScore, domain_assessment: DomainRiskAssessment) -> str:
        """Store global risk score in database"""
        try:
            with self.storage.get_connection() as conn:
                # Get domain assessment ID
                domain_assessment_id = self._get_domain_assessment_id(domain_assessment.domain, domain_assessment.assessment_date)
                
                # Check if global risk score exists for this domain today
                check_query = text("""
                    SELECT id FROM global_risk_scores 
                    WHERE domain = :domain AND DATE(assessment_date) = DATE(:assessment_date)
                """)
                existing = conn.execute(check_query, {
                    "domain": global_risk.domain,
                    "assessment_date": global_risk.assessment_date
                }).fetchone()
                
                if existing:
                    # Update existing global risk score
                    query = text("""
                        UPDATE global_risk_scores SET
                            pingcastle_score = :pingcastle_score,
                            domain_group_score = :domain_group_score,
                            hoxhunt_score = :hoxhunt_score,
                            global_score = :global_score,
                            pingcastle_contribution = :pingcastle_contribution,
                            domain_group_contribution = :domain_group_contribution,
                            hoxhunt_contribution = :hoxhunt_contribution,
                            trend_direction = :trend_direction,
                            trend_percentage = :trend_percentage,
                            domain_assessment_id = :domain_assessment_id
                        WHERE id = :id
                        RETURNING id
                    """)
                    result = conn.execute(query, {
                        "id": existing.id,
                        "pingcastle_score": global_risk.pingcastle_score,
                        "domain_group_score": global_risk.domain_group_score,
                        "hoxhunt_score": global_risk.hoxhunt_score,
                        "global_score": global_risk.global_score,
                        "pingcastle_contribution": global_risk.pingcastle_contribution,
                        "domain_group_contribution": global_risk.domain_group_contribution,
                        "hoxhunt_contribution": global_risk.hoxhunt_contribution,
                        "trend_direction": global_risk.trend_direction,
                        "trend_percentage": global_risk.trend_percentage,
                        "domain_assessment_id": domain_assessment_id
                    })
                else:
                    # Insert new global risk score
                    query = text("""
                        INSERT INTO global_risk_scores (
                            domain, assessment_date, pingcastle_score, domain_group_score,
                            hoxhunt_score, global_score, pingcastle_contribution, 
                            domain_group_contribution, hoxhunt_contribution,
                            trend_direction, trend_percentage, domain_assessment_id
                        ) VALUES (
                            :domain, :assessment_date, :pingcastle_score, :domain_group_score,
                            :hoxhunt_score, :global_score, :pingcastle_contribution, 
                            :domain_group_contribution, :hoxhunt_contribution,
                            :trend_direction, :trend_percentage, :domain_assessment_id
                        )
                        RETURNING id
                    """)
                    result = conn.execute(query, {
                        "domain": global_risk.domain,
                        "assessment_date": global_risk.assessment_date,
                        "pingcastle_score": global_risk.pingcastle_score,
                        "domain_group_score": global_risk.domain_group_score,
                        "hoxhunt_score": global_risk.hoxhunt_score,
                        "global_score": global_risk.global_score,
                        "pingcastle_contribution": global_risk.pingcastle_contribution,
                        "domain_group_contribution": global_risk.domain_group_contribution,
                        "hoxhunt_contribution": global_risk.hoxhunt_contribution,
                        "trend_direction": global_risk.trend_direction,
                        "trend_percentage": global_risk.trend_percentage,
                        "domain_assessment_id": domain_assessment_id
                    })
                
                conn.commit()
                return str(result.scalar())
                
        except Exception as e:
            self.logger.error(f"Failed to store global risk score: {e}")
            raise
    
    def _get_domain_assessment_id(self, domain: str, assessment_date: datetime) -> Optional[str]:
        """Get domain assessment ID for linking"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT id FROM domain_risk_assessments
                    WHERE domain = :domain AND DATE(assessment_date) = DATE(:assessment_date)
                """)
                
                result = conn.execute(query, {"domain": domain, "assessment_date": assessment_date})
                row = result.first()
                return str(row.id) if row else None
                
        except Exception as e:
            self.logger.error(f"Failed to get domain assessment ID: {e}")
            return None
    
    def _get_group_risks_for_assessment(self, assessment_id: str) -> List:
        """Get group risks for a domain assessment"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    SELECT * FROM group_risk_assessments
                    WHERE domain_assessment_id = :assessment_id
                """)
                
                result = conn.execute(query, {"assessment_id": assessment_id})
                group_risks = []
                
                for row in result:
                    from server.risk_calculator import DomainGroupRisk, GroupRiskLevel
                    group_risks.append(DomainGroupRisk(
                        group_name=row.group_name,
                        total_members=row.total_members,
                        accepted_members=row.accepted_members,
                        unaccepted_members=row.unaccepted_members,
                        risk_score=float(row.risk_score),
                        risk_level=GroupRiskLevel(row.risk_level),
                        contributing_factors=row.contributing_factors or {}
                    ))
                
                return group_risks
                
        except Exception as e:
            self.logger.error(f"Failed to get group risks for assessment {assessment_id}: {e}")
            return []
    
    def _create_empty_assessment(self, domain: str) -> DomainRiskAssessment:
        """Create empty assessment when no data available"""
        return DomainRiskAssessment(
            domain=domain,
            assessment_date=datetime.utcnow(),
            access_governance_score=0.0,
            privilege_escalation_score=0.0,
            compliance_posture_score=0.0,
            operational_risk_score=0.0,
            domain_group_score=0.0,
            group_risks=[],
            calculation_metadata={
                'status': 'no_data',
                'message': 'No domain group data available for risk calculation'
            }
        )
    
    def _log_risk_calculation(self, domain: str, trigger: str, context: str = "") -> None:
        """Log risk calculation for audit trail"""
        try:
            with self.storage.get_connection() as conn:
                query = text("""
                    INSERT INTO risk_calculation_history (
                        domain, calculation_trigger, risk_scores
                    ) VALUES (
                        :domain, :trigger, :context
                    )
                """)
                
                conn.execute(query, {
                    "domain": domain,
                    "trigger": trigger,
                    "context": {"context": context, "timestamp": datetime.utcnow().isoformat()}
                })
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to log risk calculation: {e}")


# Global risk service instance
def get_risk_service(storage):
    """Factory function to get risk service instance"""
    return RiskIntegrationService(storage)
