"""Response conventions shared across the API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """A response model read straight off a SQLAlchemy row."""

    model_config = ConfigDict(from_attributes=True)
