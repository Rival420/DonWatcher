from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Optional
from server.models import Report, Finding, SecurityToolType

class BaseSecurityParser(ABC):
    """Base class for all security tool parsers."""
    
    @property
    @abstractmethod
    def tool_type(self) -> SecurityToolType:
        """Return the tool type this parser handles."""
        pass
    
    @property
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """Return list of supported file extensions (e.g., ['.xml', '.json'])."""
        pass
    
    @abstractmethod
    def can_parse(self, file_path: Path) -> bool:
        """Check if this parser can handle the given file."""
        pass
    
    @abstractmethod
    def parse_report(self, file_path: Path) -> Report:
        """Parse a security report file and return a Report object."""
        pass
    
    def validate_file(self, file_path: Path) -> bool:
        """Basic file validation - can be overridden by subclasses."""
        if not file_path.exists():
            return False
        
        if file_path.suffix.lower() not in self.supported_extensions:
            return False
            
        return True

class ParserRegistry:
    """Registry for managing security tool parsers."""
    
    def __init__(self):
        self._parsers: Dict[SecurityToolType, BaseSecurityParser] = {}
        self._extension_map: Dict[str, List[BaseSecurityParser]] = {}
    
    def register_parser(self, parser: BaseSecurityParser):
        """Register a parser for a specific tool type."""
        self._parsers[parser.tool_type] = parser
        
        # Map extensions to parsers
        for ext in parser.supported_extensions:
            if ext not in self._extension_map:
                self._extension_map[ext] = []
            self._extension_map[ext].append(parser)
    
    def get_parser(self, tool_type: SecurityToolType) -> Optional[BaseSecurityParser]:
        """Get parser for a specific tool type."""
        return self._parsers.get(tool_type)
    
    def find_parser_for_file(self, file_path: Path) -> Optional[BaseSecurityParser]:
        """Find the appropriate parser for a given file."""
        extension = file_path.suffix.lower()
        
        if extension not in self._extension_map:
            return None
        
        # Try each parser that supports this extension
        for parser in self._extension_map[extension]:
            if parser.can_parse(file_path):
                return parser
        
        return None
    
    def get_all_parsers(self) -> Dict[SecurityToolType, BaseSecurityParser]:
        """Get all registered parsers."""
        return self._parsers.copy()

# Global parser registry
parser_registry = ParserRegistry()
