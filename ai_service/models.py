"""Request bodies for the AI service."""

from typing import List, Optional

from pydantic import BaseModel


class SearchTopicsRequest(BaseModel):
    query: str
    limit: Optional[int] = None


class GenerateMdxRequest(BaseModel):
    selected_topic: str
    main_topic: str
    topic: Optional[str] = None
    num_results: Optional[int] = None
    hierarchy: Optional[str] = None


class UrlsMdxRequest(BaseModel):
    urls: List[str]
    selected_topic: str
    main_topic: str
    topic: Optional[str] = None
    use_llm_knowledge: Optional[bool] = None
    hierarchy: Optional[str] = None


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
