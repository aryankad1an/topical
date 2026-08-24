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
    #: The whole outline as indented text, for cross-section awareness.
    hierarchy: Optional[str] = None
    children: Optional[List[str]] = None
    level: int = 1


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


class RefineOutlineRequest(BaseModel):
    """Ask for a better-organised version of an outline, and why it changed."""

    outline: List[OutlineNodeIn]
    subject: Optional[str] = None
    instruction: Optional[str] = None
    format: str = "mdx"
