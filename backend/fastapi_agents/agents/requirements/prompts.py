"""
Prompts for the Requirements Agent.

The system prompt is composed from individual per-section text files under
``prompt_sections/`` so each feature area can be edited in isolation:

    prompt_sections/
        00_base_system.txt         -- role, JSON-only contract, mandatory coverage, per-requirement detail spec
        01_functional.txt          -- Feature 1: Functional requirements
        02_non_functional.txt      -- Feature 2: Non-Functional requirements
        03_risk.txt                -- Feature 3: Risks
        04_dependencies.txt        -- Feature 4: Dependencies
        05_acceptance_criteria.txt -- Feature 5: Acceptance Criteria
        06_role_traceability.txt   -- Feature 6: User Roles & Traceability
        99_output_format.txt       -- exact JSON output shape

Files are concatenated in ascending filename order to build
``REQUIREMENTS_SYSTEM_PROMPT``. Individual sections are also exposed via
``SECTION_PROMPTS`` for callers that want a single section.
"""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Load section prompt files
# ---------------------------------------------------------------------------
_SECTIONS_DIR = Path(__file__).parent / "prompt_sections"


def _load_sections() -> dict[str, str]:
    """Read every ``*.txt`` file in ``prompt_sections/`` keyed by filename stem."""
    sections: dict[str, str] = {}
    for path in sorted(_SECTIONS_DIR.glob("*.txt")):
        sections[path.stem] = path.read_text(encoding="utf-8").strip()
    return sections


# Mapping of section stem -> prompt text (e.g. SECTION_PROMPTS["03_risk"]).
SECTION_PROMPTS: dict[str, str] = _load_sections()

# Full system prompt = all sections concatenated in ascending filename order.
REQUIREMENTS_SYSTEM_PROMPT: str = "\n\n".join(
    SECTION_PROMPTS[key] for key in sorted(SECTION_PROMPTS)
)
