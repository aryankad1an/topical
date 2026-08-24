"""Profiles: your own, someone else's, and the directory of them."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ...core.errors import NotFound
from ...schemas.user import (
    Byline,
    PersonProfile,
    ProfileUpdate,
    PublicUser,
    PublishedDoc,
    UsernameMatch,
)
from ...services import users as users_service
from ..deps import CurrentUser, Db, RowId  # noqa: F401

router = APIRouter(tags=["users"])

#: ``users_service.update_profile`` distinguishes an absent field from a null
#: one; this is how an unset pydantic field is passed through as "absent".
_ABSENT = users_service._ABSENT


@router.patch("/profile")
async def update_profile(payload: ProfileUpdate, db: Db, user: CurrentUser) -> dict:
    """Change any subset of username, bio and avatar.

    ``model_fields_set`` is what separates "leave the bio alone" from "clear
    the bio" — both arrive as None otherwise, and the edit form relies on being
    able to express each.
    """
    sent = payload.model_fields_set
    updated = await users_service.update_profile(
        db,
        user,
        username=payload.username if "username" in sent else _ABSENT,
        bio=payload.bio if "bio" in sent else _ABSENT,
        avatar_url=payload.avatarUrl if "avatarUrl" in sent else _ABSENT,
    )
    return {
        "success": True,
        "user": {
            "username": updated.username,
            "bio": updated.bio,
            "avatarUrl": updated.avatar_url,
        },
    }


@router.get("/user/{user_id}")
async def user_by_id(user_id: str, db: Db) -> dict:
    """One user, for attribution on someone else's work.

    Only what a byline needs — no email, no bio, and certainly no session.
    """
    user = await users_service.by_id(db, user_id)
    if user is None:
        raise NotFound("User not found")
    return {
        "user": Byline(
            id=user.id,
            given_name=user.given_name,
            family_name=user.family_name,
            username=user.username,
            avatar_url=user.avatar_url,
        )
    }


@router.get("/search/username")
async def search_username(db: Db, user: CurrentUser, q: str = Query(default="")) -> dict:
    """Username autocomplete, for the co-author picker."""
    matches = await users_service.search_usernames(db, q)
    return {
        "users": [
            UsernameMatch(id=match.id, username=match.username, givenName=match.given_name)
            for match in matches
        ]
    }


@router.get("/people")
async def browse_people(db: Db, q: str = Query(default="")) -> dict:
    people = await users_service.browse(db, q)
    return {"people": [PublicUser.model_validate(person) for person in people]}


@router.get("/people/{username}", response_model=PersonProfile)
async def person_profile(username: str, db: Db) -> PersonProfile:
    """One public profile, and the work published under it."""
    person, published = await users_service.profile_for(db, username)
    return PersonProfile(
        person=PublicUser.model_validate(person),
        published=[
            PublishedDoc(
                id=doc.id,
                name=doc.name,
                mainTopic=doc.main_topic,
                createdAt=doc.created_at,
                updatedAt=doc.updated_at,
            )
            for doc in published
        ],
    )
