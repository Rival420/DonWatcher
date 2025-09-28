from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
import logging
from models import Report, Agent

class BaseAgent(ABC):
    """Base class for all data collection agents."""
    
    def __init__(self, agent_config: Agent):
        self.config = agent_config
        self.logger = logging.getLogger(f"agent.{agent_config.name}")
        self.is_running = False
        self._last_run = None
    
    @property
    @abstractmethod
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        pass
    
    @abstractmethod
    async def collect_data(self) -> Optional[Report]:
        """Collect data and return a Report object, or None if no data."""
        pass
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test if the agent can connect to its data source."""
        pass
    
    async def run_collection(self) -> Optional[Report]:
        """Run data collection with error handling."""
        if not self.config.is_active:
            self.logger.info("Agent is inactive, skipping collection")
            return None
        
        try:
            self.logger.info("Starting data collection")
            self.is_running = True
            self._last_run = datetime.utcnow()
            
            report = await self.collect_data()
            
            if report:
                self.logger.info(f"Successfully collected data: {len(report.findings)} findings")
            else:
                self.logger.info("No new data collected")
            
            return report
            
        except Exception as e:
            self.logger.error(f"Data collection failed: {e}")
            raise
        finally:
            self.is_running = False
    
    def get_status(self) -> Dict[str, Any]:
        """Get agent status information."""
        return {
            'name': self.config.name,
            'type': self.agent_type,
            'is_active': self.config.is_active,
            'is_running': self.is_running,
            'last_run': self._last_run.isoformat() if self._last_run else None,
            'domain': self.config.domain,
            'endpoint': self.config.endpoint_url
        }

class AgentManager:
    """Manager for all data collection agents."""
    
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
        self.logger = logging.getLogger("agent_manager")
    
    def register_agent(self, agent: BaseAgent):
        """Register an agent."""
        self._agents[agent.config.name] = agent
        self.logger.info(f"Registered agent: {agent.config.name} ({agent.agent_type})")
    
    def unregister_agent(self, agent_name: str):
        """Unregister an agent."""
        if agent_name in self._agents:
            del self._agents[agent_name]
            self.logger.info(f"Unregistered agent: {agent_name}")
    
    def get_agent(self, agent_name: str) -> Optional[BaseAgent]:
        """Get an agent by name."""
        return self._agents.get(agent_name)
    
    def get_all_agents(self) -> Dict[str, BaseAgent]:
        """Get all registered agents."""
        return self._agents.copy()
    
    async def run_agent(self, agent_name: str) -> Optional[Report]:
        """Run a specific agent."""
        agent = self.get_agent(agent_name)
        if not agent:
            raise ValueError(f"Agent '{agent_name}' not found")
        
        return await agent.run_collection()
    
    async def run_all_agents(self) -> List[Report]:
        """Run all active agents."""
        reports = []
        
        for agent_name, agent in self._agents.items():
            if agent.config.is_active:
                try:
                    report = await agent.run_collection()
                    if report:
                        reports.append(report)
                except Exception as e:
                    self.logger.error(f"Agent {agent_name} failed: {e}")
        
        return reports
    
    async def test_all_connections(self) -> Dict[str, bool]:
        """Test connections for all agents."""
        results = {}
        
        for agent_name, agent in self._agents.items():
            try:
                results[agent_name] = await agent.test_connection()
            except Exception as e:
                self.logger.error(f"Connection test failed for {agent_name}: {e}")
                results[agent_name] = False
        
        return results
    
    def get_agent_statuses(self) -> Dict[str, Dict[str, Any]]:
        """Get status for all agents."""
        return {name: agent.get_status() for name, agent in self._agents.items()}

# Global agent manager
agent_manager = AgentManager()
