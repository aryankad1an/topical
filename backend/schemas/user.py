"""Profiles: what a caller may change, and what anyone may see."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from ..core.validation import MAX_BIO_LENGTH
from .common import ORMModel, UtcDatetime


class ProfileUpdate(BaseModel):
    """Any subset of the three editable fields; anything absent is left alone.

    Every field is optional *and* nullable, and those mean different things: an
    absent ``bio`` leaves the existing one, a null ``bio`` clears it. The
    sentinel below is what tells them apart, since pydantic cannot.
    """

    username: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=MAX_BIO_LENGTH)
    avatarUrl: Optional[str] = None  # noqa: N815 - matches the existing client

    model_config = {"extra": "ignore"}


class PublicUser(ORMModel):
    """The columns a profile card needs — no email, no password, no session.

    Written out once: the browse list and the single-profile lookup return the
    same person, and had two copies of this list, so a column added to one was
    missing from the other.
    """

    id: str
    username: Optional[str] = None
    givenName: Optional[str] = Field(default=None, validation_alias="given_name")  # noqa: N815
    familyName: Optional[str] = Field(default=None, validation_alias="family_name")  # noqa: N815
    bio: Optional[str] = None
    avatarUrl: Optional[str] = Field(default=None, validation_alias="avatar_url")  # noqa: N815
    createdAt: Optional[UtcDatetime] = Field(default=None, validation_alias="created_at")  # noqa: N815

    model_config = {"from_attributes": True, "populate_by_name": True}


class Byline(BaseModel):
    """Only what an attribution line needs, for someone else's work."""

    id: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class UsernameMatch(BaseModel):
    """One row of the co-author picker's autocomplete."""

    id: str
    username: Optional[str] = None
    givenName: Optional[str] = None  # noqa: N815


class PublishedDoc(BaseModel):
    """A document on someone's public profile."""

    id: int
    name: str
    mainTopic: str  # noqa: N815
    createdAt: Optional[UtcDatetime] = None  # noqa: N815
    updatedAt: Optional[datetime] = None  # noqa: N815


class PersonProfile(BaseModel):
    person: PublicUser
    published: List[PublishedDoc]
