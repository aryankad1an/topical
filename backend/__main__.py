"""``python -m backend`` — run the server.

Kept next to the app rather than in a script, so the entrypoint and the
settings it reads are the same import.
"""

from __future__ import annotations

import uvicorn

from .core.config import settings


def main() -> None:
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=not settings.is_production,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
