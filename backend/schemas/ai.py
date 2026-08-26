"""Request bodies for the AI routes.

These live with the other schemas rather than beside the prompt code, because
they describe the HTTP surface: the service layer underneath takes plain
arguments and knows nothing about FastAPI.
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class SearchTopicsRequest(BaseModel):
    query: str


class GenerateSectionRequest(BaseModel):
    """One section of a document, written in its own pass.

    ``source`` chooses what the model is grounded in — its own knowledge, a web
    search for the topic, or pages the writer named. That is the only thing
    that varied across the six endpoints this replaced; the prompt, the
    context, and the response were otherwise identical.

    ``children`` are the sub-sections written separately in their own passes. A
    parent that explains them produces the same prose twice, so it gets an
    introduction instead of an article.
    """

    topic: str
    main_topic: str
    format: str = "mdx"
    source: str = "llm"
    urls: List[str] = Field(default_factory=list)
    #: The whole outline as a numbered tree, marked with what is already
    #: written. A bare list of titles gave the model no way to tell which of
    #: its neighbours exist, so "do not repeat them" was unfollowable.
    hierarchy: Optional[str] = None
    children: Optional[List[str]] = None
    #: Headings this section is nested inside, outermost first.
    ancestors: Optional[List[str]] = None
    #: Its number in the outline — "2.3" — so the model knows where it sits.
    section_number: Optional[str] = None
    level: int = 1
    #: What the writer asked for on top of the section's title — "keep it under
    #: 300 words", "lead with a worked example". Distinct from ``topic``, which
    #: says what the section is *about*: this says how it should be written.
    instruction: Optional[str] = None


class TransformRequest(BaseModel):
    """An inline edit of one passage, with its neighbours for context."""

    action: str
    selection: str
    format: str = "mdx"
    instruction: Optional[str] = None
    before: Optional[str] = None
    after: Optional[str] = None
    title: Optional[str] = None


class OutlineFromDocumentRequest(BaseModel):
    document: str
    format: str = "mdx"


class OutlineNodeIn(BaseModel):
    """One row of an outline the writer has been editing by hand."""

    title: str
    level: int = 1
    #: Words already written under it. Moving a section carrying 900 words is
    #: not the same proposition as moving an empty heading, and a model shown
    #: only titles cannot weigh the difference.
    words: int = 0


class RefineOutlineRequest(BaseModel):
    """Ask for a better-organised version of an outline, and why it changed."""

    outline: List[OutlineNodeIn]
    subject: Optional[str] = None
    instruction: Optional[str] = None
    format: str = "mdx"
