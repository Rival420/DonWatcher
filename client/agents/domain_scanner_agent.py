import asyncio
import json
import subprocess
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4

from agents.base_agent import BaseAgent
from models import Report, Finding, SecurityToolType, Agent, GroupMembership, MemberType

class DomainScannerAgent(BaseAgent):
    """Agent for scanning Active Directory domain information."""
    
    @property
    def agent_type(self) -> str:
        return "domain_scanner"
    
    async def collect_data(self) -> Optional[Report]:
        """Collect domain information using PowerShell/LDAP queries."""
        try:
            # Get domain information
            domain_info = await self._get_domain_info()
            
            # Get privileged group memberships
            group_memberships = await self._get_privileged_groups()
            
            # Create report
            report_id = str(uuid4())
            report = Report(
                id=report_id,
                tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                domain=domain_info.get('domain', self.config.domain),
                report_date=datetime.utcnow(),
                upload_date=datetime.utcnow(),
                domain_sid=domain_info.get('domain_sid', ''),
                domain_functional_level=domain_info.get('functional_level', ''),
                forest_functional_level=domain_info.get('forest_functional_level', ''),
                dc_count=domain_info.get('dc_count', 0),
                user_count=domain_info.get('user_count', 0),
                computer_count=domain_info.get('computer_count', 0),
                metadata={
                    'scan_type': 'domain_analysis',
                    'agent_name': self.config.name,
                    'collection_method': 'powershell_ldap'
                }
            )
            
            # Create findings from group memberships
            findings = []
            for group_name, members in group_memberships.items():
                finding = Finding(
                    id=str(uuid4()),
                    report_id=report_id,
                    tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                    category="DonScanner",
                    name=f"Group_{group_name.replace(' ', '_')}_Members",
                    score=self._calculate_group_risk_score(group_name, len(members)),
                    severity=self._determine_group_severity(group_name, len(members)),
                    description=f"Privileged group '{group_name}' has {len(members)} members",
                    recommendation=f"Review membership of privileged group '{group_name}' and ensure all members require administrative access",
                    metadata={
                        'group_name': group_name,
                        'member_count': len(members),
                        'members': [{'name': m['name'], 'sid': m['sid'], 'enabled': m.get('enabled', True)} for m in members]
                    }
                )
                findings.append(finding)
            
            report.findings = findings
            return report
            
        except Exception as e:
            self.logger.error(f"Domain scan failed: {e}")
            return None
    
    async def test_connection(self) -> bool:
        """Test if we can connect to the domain."""
        try:
            # Simple test - try to get domain name
            result = await self._run_powershell_command(
                "(Get-ADDomain).DNSRoot"
            )
            return bool(result and result.strip())
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False
    
    async def _get_domain_info(self) -> Dict[str, Any]:
        """Get basic domain information."""
        try:
            # Get domain information using PowerShell
            domain_script = """
            $domain = Get-ADDomain
            $forest = Get-ADForest
            $dcs = Get-ADDomainController -Filter *
            $users = (Get-ADUser -Filter * -ResultSetSize 1000 | Measure-Object).Count
            $computers = (Get-ADComputer -Filter * -ResultSetSize 1000 | Measure-Object).Count
            
            @{
                domain = $domain.DNSRoot
                domain_sid = $domain.DomainSID.Value
                functional_level = $domain.DomainMode
                forest_functional_level = $forest.ForestMode
                dc_count = $dcs.Count
                user_count = $users
                computer_count = $computers
            } | ConvertTo-Json
            """
            
            result = await self._run_powershell_command(domain_script)
            if result:
                return json.loads(result)
            
        except Exception as e:
            self.logger.error(f"Failed to get domain info: {e}")
        
        return {}
    
    async def _get_privileged_groups(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get members of privileged groups."""
        privileged_groups = [
            "Domain Admins",
            "Enterprise Admins", 
            "Schema Admins",
            "Administrators",
            "Account Operators",
            "Backup Operators",
            "Server Operators",
            "Print Operators"
        ]
        
        group_memberships = {}
        
        for group_name in privileged_groups:
            try:
                # PowerShell script to get group members
                group_script = f"""
                try {{
                    $members = Get-ADGroupMember -Identity '{group_name}' -Recursive | 
                               Get-ADObject -Properties Name, SID, ObjectClass, Enabled
                    
                    $memberList = @()
                    foreach ($member in $members) {{
                        $memberList += @{{
                            name = $member.Name
                            sid = $member.SID.Value
                            type = $member.ObjectClass
                            enabled = if ($member.Enabled -ne $null) {{ $member.Enabled }} else {{ $true }}
                        }}
                    }}
                    
                    $memberList | ConvertTo-Json
                }} catch {{
                    @() | ConvertTo-Json
                }}
                """
                
                result = await self._run_powershell_command(group_script)
                if result:
                    members_data = json.loads(result)
                    if isinstance(members_data, list):
                        group_memberships[group_name] = members_data
                    else:
                        group_memberships[group_name] = [members_data] if members_data else []
                else:
                    group_memberships[group_name] = []
                    
            except Exception as e:
                self.logger.warning(f"Failed to get members for group '{group_name}': {e}")
                group_memberships[group_name] = []
        
        return group_memberships
    
    async def _run_powershell_command(self, script: str) -> Optional[str]:
        """Run a PowerShell command and return the result."""
        try:
            # Create PowerShell command
            cmd = [
                "powershell.exe", 
                "-NoProfile", 
                "-ExecutionPolicy", "Bypass",
                "-Command", script
            ]
            
            # Run the command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                return stdout.decode('utf-8').strip()
            else:
                self.logger.error(f"PowerShell command failed: {stderr.decode('utf-8')}")
                return None
                
        except Exception as e:
            self.logger.error(f"Failed to run PowerShell command: {e}")
            return None
    
    def _calculate_group_risk_score(self, group_name: str, member_count: int) -> int:
        """Calculate risk score for a privileged group based on membership."""
        # Base scores for different group types
        group_scores = {
            "Domain Admins": 30,
            "Enterprise Admins": 35,
            "Schema Admins": 25,
            "Administrators": 20,
            "Account Operators": 15,
            "Backup Operators": 10,
            "Server Operators": 10,
            "Print Operators": 5
        }
        
        base_score = group_scores.get(group_name, 10)
        
        # Increase score based on member count
        if member_count > 10:
            base_score += 15
        elif member_count > 5:
            base_score += 10
        elif member_count > 2:
            base_score += 5
        
        return min(base_score, 50)  # Cap at 50
    
    def _determine_group_severity(self, group_name: str, member_count: int) -> str:
        """Determine severity based on group type and member count."""
        high_risk_groups = ["Domain Admins", "Enterprise Admins", "Schema Admins"]
        
        if group_name in high_risk_groups:
            if member_count > 5:
                return "high"
            elif member_count > 2:
                return "medium"
            else:
                return "low"
        else:
            if member_count > 10:
                return "medium"
            else:
                return "low"
