"""Logging setup, called once from the app factory."""

from __future__ import annotations

import logging

from .config import settings

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging() -> None:
    logging.basicConfig(level=settings.log_level.upper(), format=_FORMAT)
    # These two narrate every request at INFO and drown the app's own lines.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("LiteLLM").setLevel(logging.WARNING)
