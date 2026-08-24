"""AI content generation: prompts, providers, crawling, and the operations
built from them.

The browser used to reach this through a second process and an HTTP proxy hop.
It is a package now — same code, one process, and a stack trace that crosses
the boundary intact.
"""

from .providers import AiCredentials, build_credentials

__all__ = ["AiCredentials", "build_credentials"]
