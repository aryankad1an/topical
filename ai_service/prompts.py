"""Prompt construction for every AI operation the editor exposes.

Kept apart from the route layer so wording can be tuned without touching HTTP
plumbing, and so the MDX and LaTeX variants of an operation stay side by side
where drift is easy to spot.
"""

from typing import Optional

FORMAT_RULES = {
    "mdx": (
        "Write in MDX (Markdown with optional JSX, no custom components). "
        "Use $...$ for inline math and $$...$$ for display math. No frontmatter."
    ),
    "latex": (
        "Write in LaTeX body syntax only — no \\documentclass, no \\begin{document}, "
        "no preamble. Use \\section/\\subsection for structure, itemize/enumerate for "
        "lists, and equation/align for display math."
    ),
}


def format_rules(fmt: str) -> str:
    return FORMAT_RULES.get(fmt, FORMAT_RULES["mdx"])


# ---------------------------------------------------------------------------
# Long-form generation
# ---------------------------------------------------------------------------
def _hierarchy_context(topic: str, hierarchy: str) -> str:
    if not hierarchy:
        return ""
    return (
        f"\nHere is the full topic hierarchy for context:\n<hierarchy>\n{hierarchy}\n</hierarchy>\n"
        f"Strictly focus ONLY on the topic '{topic}' and do not explain other topics from the "
        f"hierarchy to avoid redundant content."
    )


def mdx_content_prompt(topic: str, main_topic: str, context: str = "", hierarchy: str = "") -> str:
    ctx = f"\nUse this reference material:\n<context>\n{context}\n</context>\n" if context else ""
    return (
        f"You are an expert technical writer creating educational MDX content.\n\n"
        f"Generate comprehensive MDX content for: \"{topic}\"\n"
        f"Part of a lesson plan about: \"{main_topic}\"\n"
        f"{_hierarchy_context(topic, hierarchy)}\n"
        f"{ctx}\n"
        f"Requirements:\n"
        f"- MDX format (Markdown with optional JSX, no custom components)\n"
        f"- Start with # {topic}\n"
        f"- 3-5 sections with ## headings\n"
        f"- STRICTLY relevant to \"{topic}\". Do not overlap with or redundantly cover other subtopics in the hierarchy.\n"
        f"- Use bullet points, numbered lists, code blocks where appropriate\n"
        f"- Use $...$ / $$...$$ for any mathematics\n"
        f"- Educational, clear, well-structured\n"
        f"- 400-800 words\n"
        f"- No frontmatter\n"
        f"- Return ONLY the MDX content"
    )


def latex_content_prompt(topic: str, main_topic: str, context: str = "", hierarchy: str = "") -> str:
    ctx = f"\nUse this reference material:\n<context>\n{context}\n</context>\n" if context else ""
    return (
        f"You are an expert technical writer creating educational LaTeX content.\n\n"
        f"Generate comprehensive LaTeX content for: \"{topic}\"\n"
        f"Part of a document about: \"{main_topic}\"\n"
        f"{_hierarchy_context(topic, hierarchy)}\n"
        f"{ctx}\n"
        f"Requirements:\n"
        f"- Pure LaTeX format (NOT a full document — no \\documentclass, \\begin{{document}}, etc.)\n"
        f"- Start with \\section{{{topic}}}\n"
        f"- 3-5 subsections with \\subsection{{}}\n"
        f"- STRICTLY relevant to \"{topic}\". Do not overlap with or redundantly cover other subtopics.\n"
        f"- Use itemize/enumerate, equations, tables where appropriate\n"
        f"- Educational, clear, well-structured\n"
        f"- 400-800 words\n"
        f"- Return ONLY the LaTeX content (no preamble, no \\begin{{document}})\n"
    )


def topic_hierarchy_prompt(query: str) -> str:
    return (
        f'Generate a structured topic hierarchy for learning about "{query}".\n\n'
        f"Return ONLY valid JSON in this format:\n"
        f'[{{"topic": "Main topic", "subtopics": ["Sub 1", "Sub 2"]}}]\n\n'
        f"Rules: 4-6 main topics, 2-4 subtopics each, logical progression, clear names."
    )


def outline_from_document_prompt(document: str, fmt: str) -> str:
    """Reverse-engineer a working outline from a draft the user already has."""
    return (
        "Read this document and propose the outline it is reaching for — including "
        "the sections it is missing.\n\n"
        f"<document>\n{document[:12000]}\n</document>\n\n"
        "Return ONLY valid JSON in this format:\n"
        '[{"topic": "Main section", "subtopics": ["Sub 1", "Sub 2"]}]\n\n'
        "Rules: 3-6 main sections, 2-4 subtopics each, follow the document's own "
        "vocabulary, and keep names short enough to fit a sidebar."
    )


def refine_outline_prompt(outline: str, subject: str = "", instruction: str = "") -> str:
    """Reorganise an outline the writer has been editing, and say why.

    The reasoning is the point. A restructure that arrives as a finished list
    is one the writer has to reverse-engineer before they can trust it, so the
    model is asked to account for every row it touched — and to stay silent
    about the ones it left alone, or the explanation drowns in "kept as is".
    """
    about = f'The document is about "{subject}".\n' if subject else ""
    extra = f"\nThe author also asks: {instruction.strip()}\n" if instruction.strip() else ""
    return (
        "You are an editor restructuring the outline of a document.\n"
        f"{about}"
        "Here is the current outline, indented by depth:\n"
        f"<outline>\n{outline}\n</outline>\n"
        f"{extra}"
        "\nImprove the structure: fix the ordering so it builds logically, regroup "
        "topics that belong together, adjust depth where a heading is really a "
        "sub-point of its neighbour, split anything that covers two ideas, and add "
        "a section only where there is a real gap. Keep the author's wording unless "
        "it is genuinely unclear. Do not pad it out — a good outline can come back "
        "the same length or shorter.\n\n"
        "Return ONLY valid JSON, no code fence, in exactly this shape:\n"
        '{"summary": "one sentence on what you changed overall", '
        '"outline": [{"title": "Section name", "level": 1}], '
        '"changes": [{"title": "Section name", "kind": "moved", "reason": "why"}]}\n\n'
        "Rules:\n"
        "- `level` starts at 1 and never jumps by more than one between consecutive rows.\n"
        "- `kind` is one of: moved, renamed, added, removed, nested, split.\n"
        "- List a change for every row you altered, and for nothing you left alone.\n"
        "- Each `reason` is one short sentence naming the actual problem it fixes.\n"
        "- `title` in `changes` must match the row's new title (or the old one, if removed)."
    )


# ---------------------------------------------------------------------------
# Selection transforms — the editor's inline AI actions
# ---------------------------------------------------------------------------
# Each entry is (instruction, returns_replacement). Actions that return a
# replacement have their output swapped into the document; the rest are shown
# as an answer the writer reads and dismisses.
TRANSFORM_ACTIONS = {
    "improve":  ("Rewrite the passage so it reads more clearly and precisely. Keep the author's voice, meaning, and level of detail.", True),
    "expand":   ("Expand the passage with concrete detail, examples, and reasoning. Roughly double its length without padding.", True),
    "shorten":  ("Tighten the passage to about half its length. Keep every substantive point; cut hedging and repetition.", True),
    "grammar":  ("Fix spelling, grammar, and punctuation. Change nothing else — not word choice, not structure.", True),
    "simplify": ("Rewrite the passage in plain language a first-year student could follow. Keep it accurate; define jargon inline.", True),
    "academic": ("Rewrite the passage in a formal academic register: precise, impersonal, no contractions.", True),
    "bullets":  ("Restructure the passage as a tight bulleted list, one idea per bullet, preserving all information.", True),
    "table":    ("Restructure the information in the passage as a table with clear column headers.", True),
    "math":     ("Rewrite the passage with the mathematics set properly: real notation, display equations where they aid reading, and defined symbols.", True),
    "continue": ("Continue writing from where the passage stops. Match its voice, format, and depth. Return ONLY the new continuation, not the existing text.", True),
    "explain":  ("Explain the passage: what it says, why it matters, and anything it gets wrong or leaves out. Be specific and brief.", False),
    "custom":   ("", True),
}


def transform_prompt(
    action: str,
    fmt: str,
    selection: str,
    instruction: str = "",
    before: str = "",
    after: str = "",
    title: str = "",
) -> str:
    """Prompt for an inline edit of one passage, with its neighbours as context."""
    directive, replaces = TRANSFORM_ACTIONS.get(action, TRANSFORM_ACTIONS["custom"])
    if action == "custom" or not directive:
        directive = instruction.strip() or "Improve this passage."
    elif instruction.strip():
        directive = f"{directive}\nAdditional instruction from the author: {instruction.strip()}"

    doc_line = f'The document is titled "{title}".\n' if title else ""
    surroundings = ""
    if before.strip():
        surroundings += f"\nText immediately before the passage (do not rewrite it):\n<before>\n{before[-2000:]}\n</before>\n"
    if after.strip():
        surroundings += f"\nText immediately after the passage (do not rewrite it):\n<after>\n{after[:2000]}\n</after>\n"

    if replaces:
        tail = (
            f"{format_rules(fmt)}\n"
            "Return ONLY the replacement text. No preamble, no explanation, no code fence "
            "around the whole answer, no restating of the surrounding context."
        )
    else:
        tail = (
            "Answer in at most 150 words of plain prose. Do not return a rewritten "
            "version of the passage."
        )

    return (
        f"You are a meticulous writing collaborator working inside a document editor.\n"
        f"{doc_line}"
        f"{surroundings}\n"
        f"Passage to work on:\n<passage>\n{selection}\n</passage>\n\n"
        f"Task: {directive}\n\n"
        f"{tail}"
    )


def strip_fences(text: str, fmt: Optional[str] = None) -> str:
    """Drop a whole-answer code fence, which models add despite instructions."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if len(lines) < 2:
        return stripped
    # Only unwrap when the fence encloses the entire answer.
    if lines[-1].strip() != "```":
        return stripped
    return "\n".join(lines[1:-1]).strip()
