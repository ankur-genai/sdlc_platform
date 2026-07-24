"""
Prompts for the Business Analyst agent.

The single, monolithic system prompt has been decomposed into detailed,
independently-editable section files under ``prompt_sections/`` (one file per
artifact the BA package produces: BRD, SRS, personas, process flows, etc.).
This module loads those sections IN ORDER and assembles them into the exact same
public symbol the rest of the codebase imports:

    from .prompts import BUSINESS_ANALYST_SYSTEM_PROMPT

The assembled string is behaviourally equivalent to (and a more detailed superset
of) the previous inline prompt, and the required output JSON shape/keys are
unchanged — so downstream schema validation keeps working flawlessly.

To tune the BA behaviour, edit the ``.txt`` files in ``prompt_sections/``; no
Python changes are required. If you add a new section file, register it in
``_SECTION_ORDER`` below.
"""
from __future__ import annotations

from pathlib import Path

# Directory holding the ordered prompt section files.
_SECTIONS_DIR = Path(__file__).resolve().parent / "prompt_sections"

# The assembly order of the system prompt. Editing a file changes the prompt;
# reordering this list reorders the sections.
_SECTION_ORDER: tuple[str, ...] = (
    "system_role.txt",
    "epics_user_stories.txt",
    "detailed_brd.txt",
    "srs.txt",
    "persona.txt",
    "process_flows.txt",
    "business_workflows.txt",
    "validation_rules.txt",
    "exception_handling.txt",
    "risk_analysis.txt",
    "success_metrics.txt",
    "output_schema.txt",
)


def _load_section(filename: str) -> str:
    """Read one prompt section file, returning its stripped text."""
    return (_SECTIONS_DIR / filename).read_text(encoding="utf-8").strip()


def build_business_analyst_system_prompt() -> str:
    """Assemble the full BA system prompt from the ordered section files.

    Sections are joined with a blank-line separator so each remains a clearly
    delimited block in the final prompt.
    """
    sections = [_load_section(name) for name in _SECTION_ORDER]
    return "\n\n".join(sections)


# Public symbol imported across the codebase — keep this name stable.
BUSINESS_ANALYST_SYSTEM_PROMPT = build_business_analyst_system_prompt()

