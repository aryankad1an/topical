"""Documents, as they travel over the wire.

"Lesson plan" is the storage name for what the rest of the app calls a
document. The client sends and receives camelCase, and the columns are
snake_case, so each field states its alias once here rather than being
translated by hand in every handler.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .common import ORMModel


class SavedLessonTopic(BaseModel):
    """One generated section, as stored inside a document's ``topics`` array.

    The single definition of that shape: the column's contents, the request
    validation and the client's own type all describe this object, and it used
    to be written out separately in each of the three.
    """

    topic: str = Field(min_length=1)
    mdxContent: str = ""  # noqa: N815
    isSubtopic: bool = False  # noqa: N815
    parentTopic: Optional[str] = None  # noqa: N815
    mainTopic: Optional[str] = None  # noqa: N815


class LessonPlanInput(BaseModel):
    """What a client may send when creating or replacing a document.

    ``userId`` is deliberately absent — the owner comes from the session, never
    from the body.
    """

    name: str = Field(min_length=1, description="Lesson plan name must not be empty")
    mainTopic: str = Field(min_length=1, description="Main topic must not be empty")  # noqa: N815
    topics: List[SavedLessonTopic] = Field(default_factory=list)
    coAuthors: List[str] = Field(default_factory=list)  # noqa: N815
    isPublic: bool = False  # noqa: N815


class LessonPlanOut(ORMModel):
    """A stored document, with the names its collaborators are known by."""

    id: int
    userId: str = Field(validation_alias="user_id")  # noqa: N815
    name: str
    mainTopic: str = Field(validation_alias="main_topic")  # noqa: N815
    topics: List[SavedLessonTopic] = Field(default_factory=list)
    coAuthors: List[str] = Field(default_factory=list, validation_alias="co_authors")  # noqa: N815
    isPublic: bool = Field(default=False, validation_alias="is_public")  # noqa: N815
    createdAt: Optional[datetime] = Field(default=None, validation_alias="created_at")  # noqa: N815
    updatedAt: Optional[datetime] = Field(default=None, validation_alias="updated_at")  # noqa: N815

    #: Resolved from the user table, not stored on the row.
    authorUsername: Optional[str] = None  # noqa: N815
    coAuthorUsernames: List[str] = Field(default_factory=list)  # noqa: N815

    model_config = {"from_attributes": True, "populate_by_name": True}


class LessonPlanList(BaseModel):
    lessonPlans: List[LessonPlanOut]  # noqa: N815
