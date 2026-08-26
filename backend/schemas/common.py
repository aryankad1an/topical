"""Response conventions shared across the API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer


class ORMModel(BaseModel):
    """A response model read straight off a SQLAlchemy row."""

    model_config = ConfigDict(from_attributes=True)


def _stamp_utc(value: datetime) -> str:
    """Serialise a stored timestamp with its offset stated.

    Every ``created_at``/``updated_at`` in this database is naive UTC — the
    columns are ``timestamp without time zone`` and the defaults are
    ``utcnow()``. Pydantic serialised them verbatim, so the API emitted
    ``2026-08-25T15:54:09`` with nothing saying which zone that is.

    JavaScript reads a date-time string with no offset as **local** time. In
    UTC+5:30 that made every timestamp in the product read five and a half
    hours old: a post made a moment ago said "5h ago", and a document saved
    just now was "last edited" before lunch. Stating the offset fixes every
    date in the application at once, and needs no migration.
    """
    return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).isoformat()


#: A timestamp that says what zone it is in. Use for every column read off a
#: naive UTC ``DateTime`` — which is all of them.
UtcDatetime = Annotated[datetime, PlainSerializer(_stamp_utc, return_type=str)]
