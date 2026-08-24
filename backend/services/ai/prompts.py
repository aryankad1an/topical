"""Prompt construction for every AI operation the editor exposes.

Kept apart from the route layer so wording can be tuned without touching HTTP
plumbing. Operations that exist in both output formats are written *once*: the
per-format differences live in `SECTION_FORMATS`, so a wording change cannot
land in MDX and be forgotten in LaTeX.
"""

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

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


LATEX_LEVEL_COMMANDS = ["section", "subsection", "subsubsection", "paragraph", "subparagraph"]


def _latex_command(level: int) -> str:
    return LATEX_LEVEL_COMMANDS[max(1, min(level, len(LATEX_LEVEL_COMMANDS))) - 1]


def _mdx_heading(topic: str, level: int) -> str:
    return "#" * max(1, min(level, 6)) + " " + topic


def _latex_heading(topic: str, level: int) -> str:
    return "\\" + _latex_command(level) + "{" + topic + "}"


def _leave_to_children(children: Optional[List[str]]) -> str:
    """The instruction that stops a parent from writing its children's sections.

    Without it, asking for "Photosynthesis" returns a whole article covering
    light reactions and the Calvin cycle — and then those sections get written
    again in their own passes, so the document says everything twice. The list
    is spelled out rather than described, because "don't cover the subsections"
    is not something a model can check itself against.
    """
    if not children:
        return ""
    listed = "\n".join("- " + child for child in children)
    return (
        "\nThese sub-sections sit directly below this text and are written "
        "separately, each in its own pass:\n"
        f"<subsections>\n{listed}\n</subsections>\n"
    )


@dataclass(frozen=True)
class _SectionFormat:
    """Everything the section prompt has to say differently per output format.

    MDX and LaTeX ask for the same document — same length, same structure, same
    prohibition on covering a child's material — in two notations. Holding the
    differences in one table keeps the shared instructions literally shared, so
    a wording fix cannot land in one format and be forgotten in the other.
    """

    name: str
    #: The bullet that pins down the notation itself.
    syntax_rule: str
    #: How this format spells a heading at a given depth.
    heading: Callable[[str, int], str]
    #: How it names the sub-headings a full section should contain.
    deeper_rule: Callable[[int], str]
    #: The structural devices worth reaching for.
    devices: str
    #: Rules that exist only in this format.
    extra_rules: Tuple[str, ...]
    #: The closing "return only ..." instruction.
    closing: str
    #: What an introduction must not contain.
    intro_ban: str


SECTION_FORMATS: Dict[str, _SectionFormat] = {
    "mdx": _SectionFormat(
        name="MDX",
        syntax_rule="MDX format (Markdown with optional JSX, no custom components)",
        heading=_mdx_heading,
        deeper_rule=lambda level: f"3-5 sub-headings one level deeper ({'#' * min(level + 1, 6)})",
        devices="Use bullet points, numbered lists, code blocks where appropriate",
        extra_rules=("Use $...$ / $$...$$ for any mathematics", "No frontmatter"),
        closing="Return ONLY the MDX content",
        intro_ban="No sub-headings, no lists, no code blocks.",
    ),
    "latex": _SectionFormat(
        name="LaTeX",
        syntax_rule="Pure LaTeX body syntax (NOT a full document — no \\documentclass, no \\begin{document})",
        heading=_latex_heading,
        deeper_rule=lambda level: f"3-5 subsections one level deeper (\\{_latex_command(level + 1)}{{}})",
        devices="Use itemize/enumerate, equations, tables where appropriate",
        extra_rules=(),
        closing="Return ONLY the LaTeX content (no preamble, no \\begin{document})",
        intro_ban="No further sectioning commands, no lists.",
    ),
}


def section_format(fmt: str) -> _SectionFormat:
    return SECTION_FORMATS.get(fmt, SECTION_FORMATS["mdx"])


def _rules_block(rules: List[str]) -> str:
    return "Requirements:\n" + "\n".join("- " + rule for rule in rules)


def section_prompt(
    fmt: str,
    topic: str,
    main_topic: str,
    context: str = "",
    hierarchy: str = "",
    children: Optional[List[str]] = None,
    level: int = 1,
) -> str:
    """Ask for one section of a document, in whichever notation it is written.

    A section with children gets an *introduction* — its sub-sections are
    written in their own passes, and a parent that explains them puts the same
    prose in the document twice.
    """
    spec = section_format(fmt)
    ctx = f"\nUse this reference material:\n<context>\n{context}\n</context>\n" if context else ""
    heading = spec.heading(topic, level)

    if children:
        return (
            "You are an expert technical writer working through a document one section at a time.\n\n"
            f'Write the OPENING of the section "{topic}" — its introduction, not the section itself.\n'
            f'Part of a document about: "{main_topic}"\n'
            f"{_hierarchy_context(topic, hierarchy)}\n"
            f"{_leave_to_children(children)}"
            f"{ctx}\n"
            + _rules_block([
                spec.syntax_rule,
                f"Start with {heading}",
                f"Then 80-150 words of plain prose. {spec.intro_ban}",
                "Orient the reader: what this section covers, why it matters, and how the "
                "sub-sections above relate to each other.",
                "Define any term the sub-sections will assume the reader already knows.",
                "Do NOT explain, summarise, or preview the sub-sections listed above, or anything "
                "nested beneath them. They are written separately, and covering them here puts the "
                "same material in the document twice.",
                *spec.extra_rules,
                spec.closing,
            ])
        )

    return (
        f"You are an expert technical writer creating educational {spec.name} content.\n\n"
        f'Generate comprehensive {spec.name} content for the section: "{topic}"\n'
        f'Part of a document about: "{main_topic}"\n'
        f"{_hierarchy_context(topic, hierarchy)}\n"
        f"{ctx}\n"
        + _rules_block([
            spec.syntax_rule,
            f"Start with {heading}",
            spec.deeper_rule(level),
            f'STRICTLY relevant to "{topic}". Do not overlap with or redundantly cover other '
            "sections in the outline — each of them is written separately.",
            spec.devices,
            *spec.extra_rules,
            "Educational, clear, well-structured",
            "400-800 words",
            spec.closing,
        ])
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
