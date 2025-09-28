# Parser framework for multiple security tools
from .base_parser import parser_registry
from .domain_analysis_parser import DomainAnalysisParser
from .locksmith_parser import LocksmithParser

# Register parsers
parser_registry.register_parser(DomainAnalysisParser())
parser_registry.register_parser(LocksmithParser())

__all__ = ['parser_registry']
