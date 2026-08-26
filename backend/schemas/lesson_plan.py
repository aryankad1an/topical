"""Documents, as they travel over the wire.

"Lesson plan" is the storage name for what the rest of the app calls a
document. The client sends and receives camelCase, and the columns are
snake_case, so each field states its alias once here rather than being
translated by hand in every handler.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from .common import ORMModel, UtcDatetime


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
    #: Tri-state, for the same reason ``isPublic`` below is, and it was missed
    #: when that one was fixed. A PUT writes every column it is handed, so a
    #: caller that said nothing about co-authors had an empty list written over
    #: them: the publish toggle on the projects page sends name, topics and
    #: ``isPublic`` and nothing else, so publishing a document deleted every
    #: collaborator on it. ``None`` means "leave them as they are".
    coAuthors: Optional[List[str]] = None  # noqa: N815
    #: Tri-state on purpose. ``False`` was the default, and because a PUT
    #: writes every column, any client that did not send the field silently
    #: unpublished the document — which the editor never sent, so autosaving a
    #: published document (or adding a co-author) took it off the community
    #: library on the next keystroke. ``None`` means "leave it as it is".
    isPublic: Optional[bool] = None  # noqa: N815


class LessonPlanOut(ORMModel):
    """A stored document, with the names its collaborators are known by."""

    id: int
    userId: str = Field(validation_alias="user_id")  # noqa: N815
    name: str
    mainTopic: str = Field(validation_alias="main_topic")  # noqa: N815
    topics: List[SavedLessonTopic] = Field(default_factory=list)
    coAuthors: List[str] = Field(default_factory=list, validation_alias="co_authors")  # noqa: N815
    isPublic: bool = Field(default=False, validation_alias="is_public")  # noqa: N815
    createdAt: Optional[UtcDatetime] = Field(default=None, validation_alias="created_at")  # noqa: N815
    updatedAt: Optional[UtcDatetime] = Field(default=None, validation_alias="updated_at")  # noqa: N815

    #: Resolved from the user table, not stored on the row.
    authorUsername: Optional[str] = None  # noqa: N815
    #: One entry per co-author, in the same order as ``coAuthors``, and null
    #: where that person has not set a username. Positional rather than
    #: filtered: a collaborator with no handle is still a collaborator, and
    #: dropping them here would make the two lists disagree.
    coAuthorUsernames: List[Optional[str]] = Field(default_factory=list)  # noqa: N815

    model_config = {"from_attributes": True, "populate_by_name": True}


class SharedLessonPlan(BaseModel):
    """A document reached by its link, and what the viewer may do with it.

    The access verdict travels *with* the document rather than being inferred
    by the client from which of several fetches happened to succeed — the
    client cannot tell "not yours" from "not there" that way, and it had to
    guess at whether to open the editor or the reader.
    """

    plan: LessonPlanOut
    access: Literal["owner", "co-author", "reader"]


class LessonPlanList(BaseModel):
    lessonPlans: List[LessonPlanOut]  # noqa: N815
