"""Environment, read once at import and validated in one place.

The database is the one thing that is optional at boot: a missing
``DATABASE_URL`` leaves ``settings.database_url`` as None and the routes that
need it answer 503 (see ``backend.api.deps.require_db``), so the process still
starts for someone who only wants the frontend or the AI routes.

Authentication is in-house — accounts, passwords and sessions all live in this
application's own database — so there is no external identity provider to
configure, and no half-configured mode to degrade into.

Reading the environment anywhere else is what produced the drift this replaces
— the old server parsed ``DATABASE_URL`` in two files with two different
schemas, and ``AI_SERVICE_URL`` in a third that no longer exists at all.
"""

from __future__ import annotations

import logging
import os
from functools import cached_property
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Loaded here, not in the app factory: this module is the only reader of the
# environment, and it is imported by things that never build an app — Alembic's
# env.py among them, which is how migrations ended up seeing no DATABASE_URL.
load_dotenv()

#: Repository root — the directory holding ``backend/`` and ``frontend/``.
ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    """Everything the process needs from its environment."""

    host: str = "0.0.0.0"
    port: int = 3000
    #: Cookies are only marked Secure in production, so http://localhost works.
    environment: str = "development"

    database_url: Optional[str] = None

    #: How long a session survives without being used, in days.
    session_ttl_days: int = 14

    uploads_dir: Path = Field(default_factory=lambda: ROOT_DIR / "uploads")
    static_dir: Path = Field(default_factory=lambda: ROOT_DIR / "frontend" / "dist")

    log_level: str = "INFO"

    model_config = {"arbitrary_types_allowed": True}

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @cached_property
    def async_database_url(self) -> Optional[str]:
        """``database_url`` in the form SQLAlchemy's asyncpg driver accepts.

        Two translations, both of which silently broke the connection when they
        were missing: the ``postgresql://`` scheme has to name the driver, and
        asyncpg rejects libpq's ``sslmode`` query parameter outright rather
        than ignoring it — so a hosted-Postgres URL copied from a dashboard
        fails at connect time with an error that names neither.
        """
        if not self.database_url:
            return None

        parts = urlsplit(self.database_url)
        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+asyncpg"

        # Drop libpq-only parameters; TLS is negotiated by asyncpg itself.
        query = "&".join(
            param
            for param in parts.query.split("&")
            if param and not param.lower().startswith(("sslmode=", "channel_binding="))
        )
        return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


def load_settings() -> Settings:
    """Build settings from ``os.environ``, warning about what is switched off."""
    database_url = os.environ.get("DATABASE_URL") or None

    settings = Settings(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "3000")),
        environment=os.environ.get("ENVIRONMENT") or os.environ.get("NODE_ENV") or "development",
        database_url=database_url,
        session_ttl_days=int(os.environ.get("SESSION_TTL_DAYS", "14")),
        uploads_dir=Path(os.environ.get("UPLOADS_DIR") or (ROOT_DIR / "uploads")),
        static_dir=Path(os.environ.get("STATIC_DIR") or (ROOT_DIR / "frontend" / "dist")),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )

    if not settings.database_url:
        logger.warning(
            "DATABASE_URL is not configured. Database-backed routes will answer 503. "
            "Set DATABASE_URL in .env to enable them."
        )
    return settings


#: The single instance every module imports.
settings = load_settings()
