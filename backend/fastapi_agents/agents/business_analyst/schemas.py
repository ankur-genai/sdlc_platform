"""
Schemas for the Business Analyst Agent. Relocated verbatim from
agents/ba_agent.py as part of the agents/<name>/ architectural refactor.

Field names and keys are unchanged (so every downstream consumer that reads the
`model_dump()` shape keeps working). The models now additionally NORMALIZE a few
LLM-provided values (MoSCoW priority, story points, risk likelihood/impact) so
that minor, common model deviations — e.g. "must"/"MUST", points returned as a
string, "med"/"crit" — are coerced into the canonical values the prompt asks for
instead of failing validation. This makes real runs more robust, not stricter.
"""
from __future__ import annotations

from pydantic import BaseModel, field_validator


# Canonical MoSCoW priorities and the loose synonyms we accept from the model.
_MOSCOW_CANONICAL = {"must": "Must", "should": "Should", "could": "Could", "won't": "Won't"}
_MOSCOW_ALIASES = {
    "must have": "Must", "musthave": "Must", "m": "Must",
    "should have": "Should", "shouldhave": "Should", "s": "Should",
    "could have": "Could", "couldhave": "Could", "c": "Could",
    "wont": "Won't", "won't have": "Won't", "wont have": "Won't",
    "would": "Won't", "w": "Won't",
}
_LIKELIHOOD_CANONICAL = {"low", "medium", "high"}
_LIKELIHOOD_ALIASES = {"med": "medium", "moderate": "medium", "l": "low", "h": "high", "m": "medium"}
_IMPACT_CANONICAL = {"low", "medium", "high", "critical"}
_IMPACT_ALIASES = {
    "med": "medium", "moderate": "medium", "crit": "critical", "severe": "critical",
    "l": "low", "m": "medium", "h": "high", "c": "critical",
}


class AcceptanceCriterion(BaseModel):
    given: str
    when: str
    then: str


class UserStory(BaseModel):
    id: str
    epic: str
    title: str
    role: str
    goal: str
    benefit: str
    acceptance_criteria: list[AcceptanceCriterion]
    moscow: str
    points: int

    @field_validator("moscow", mode="before")
    @classmethod
    def _normalize_moscow(cls, value: object) -> str:
        """Coerce common MoSCoW variants into Must/Should/Could/Won't."""
        if not isinstance(value, str):
            return "Should"
        key = value.strip().lower()
        if key in _MOSCOW_CANONICAL:
            return _MOSCOW_CANONICAL[key]
        if key in _MOSCOW_ALIASES:
            return _MOSCOW_ALIASES[key]
        return "Should"

    @field_validator("points", mode="before")
    @classmethod
    def _clamp_points(cls, value: object) -> int:
        """Accept ints/strings, then clamp to the valid 1..13 estimate range."""
        try:
            points = int(float(str(value).strip()))
        except (TypeError, ValueError):
            return 3
        return max(1, min(13, points))


class EpicOut(BaseModel):
    title: str
    description: str
    stories: list[UserStory]


class Persona(BaseModel):
    name: str
    role: str = ""
    goals: list[str] = []
    pain_points: list[str] = []
    demographics: str = ""


class ProcessFlow(BaseModel):
    name: str
    steps: list[str] = []
    diagram: str = ""  # Mermaid flowchart/sequence source


class RiskItem(BaseModel):
    risk: str
    likelihood: str = "medium"  # low, medium, high
    impact: str = "medium"      # low, medium, high, critical
    mitigation: str = ""

    @field_validator("likelihood", mode="before")
    @classmethod
    def _normalize_likelihood(cls, value: object) -> str:
        if not isinstance(value, str):
            return "medium"
        key = value.strip().lower()
        if key in _LIKELIHOOD_CANONICAL:
            return key
        return _LIKELIHOOD_ALIASES.get(key, "medium")

    @field_validator("impact", mode="before")
    @classmethod
    def _normalize_impact(cls, value: object) -> str:
        if not isinstance(value, str):
            return "medium"
        key = value.strip().lower()
        if key in _IMPACT_CANONICAL:
            return key
        return _IMPACT_ALIASES.get(key, "medium")


class SuccessMetric(BaseModel):
    metric: str
    target: str = ""
    measurement_method: str = ""


class BusinessAnalystOutput(BaseModel):
    epics: list[EpicOut]
    detailed_brd: str = ""
    srs: str = ""
    personas: list[Persona] = []
    process_flows: list[ProcessFlow] = []
    business_workflows: list[str] = []
    validation_rules: list[str] = []
    exception_handling: list[str] = []
    risk_analysis: list[RiskItem] = []
    success_metrics: list[SuccessMetric] = []

