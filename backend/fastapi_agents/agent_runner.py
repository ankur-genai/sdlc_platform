"""
agent_runner.py
===============
Pure pipeline orchestration: sequencing, approval gates, checkpoint-resume,
and dispatch. No agent-specific generation logic lives here — every
capability is implemented by its own agent class under agents/<name>/ and
looked up polymorphically via agents.registry.AgentFactory. This module
never imports ai_service or any individual agent module directly; it only
knows AgentName values and the AgentFactory/AgentRegistry contract.
"""
from __future__ import annotations

import asyncio
import json
import time
import traceback
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from .agents.developer_studio.agent import DeveloperStudioAgent
from .agents.llm_service import LLMService
from .agents.registry import AgentFactory
from .logging_config import get_logger

from .models import (
    AgentName,
    AgentRun,
    Approval,
    ApprovalStatus,
    ArtifactType,
    GeneratedArtifact,
    Project,
    RunStatus,
    TimelineEvent,
    get_db,
)
from .ws_manager import manager

logger = get_logger(__name__)


PIPELINE: list[str] = [
    AgentName.MEMORY_AGENT.value,
    AgentName.REQUIREMENT_AGENT.value,
    AgentName.BUSINESS_ANALYST_AGENT.value,
    AgentName.SOLUTION_ARCHITECT_AGENT.value,
    AgentName.DATABASE_AGENT.value,
    AgentName.UIUX_AGENT.value,
    AgentName.SECURITY_AGENT.value,
    AgentName.COMPLIANCE_AGENT.value,
    AgentName.FRONTEND_AGENT.value,
    AgentName.BACKEND_AGENT.value,
    AgentName.TESTING_AGENT.value,
    AgentName.DOCUMENTATION_AGENT.value,
    AgentName.PRESENTATION_VIDEO_AGENT.value,
]


_AGENT_CONFIG: dict[str, dict[str, Any]] = {
    AgentName.MEMORY_AGENT.value: {
        "generate": None,
        "artifact_type": None,
        "approval": False,
        "stage": "Memory Preparation",
    },
    AgentName.REQUIREMENT_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.REQUIREMENTS_DOC.value,
        "approval": True,
        "stage": "Requirements",
    },
    AgentName.BUSINESS_ANALYST_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.USER_STORIES.value,
        "approval": True,
        "stage": "Business Analysis",
    },
    AgentName.SOLUTION_ARCHITECT_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.ARCHITECTURE_DIAGRAM.value,
        "approval": True,
        "stage": "Solution Architecture",
    },
    AgentName.DATABASE_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.SQL_SCHEMA.value,
        "approval": True,
        "stage": "Database Design",
    },
    AgentName.UIUX_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.UIUX_DESIGN.value,
        "approval": False,
        "stage": "UI/UX Design",
    },
    AgentName.SECURITY_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.SECURITY_REPORT.value,
        "approval": False,
        "stage": "Security Architecture",
    },
    AgentName.COMPLIANCE_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.COMPLIANCE_REPORT.value,
        "approval": True,
        "stage": "Compliance",
    },
    AgentName.PRESENTATION_VIDEO_AGENT.value: {
        "generate": True,
        "artifact_type": ArtifactType.PRESENTATION.value,
        "approval": False,
        "stage": "Presentation & Video Generation",
    },
    AgentName.FRONTEND_AGENT.value: {
        "generate": True, "artifact_type": ArtifactType.REACT_CODE.value,
        "approval": False, "stage": "Frontend Development",
    },
    AgentName.BACKEND_AGENT.value: {
        "generate": True, "artifact_type": ArtifactType.BACKEND_CODE.value,
        "approval": False, "stage": "Backend Development",
    },
    AgentName.TESTING_AGENT.value: {
        "generate": True, "artifact_type": ArtifactType.TEST_REPORT.value,
        "approval": False, "stage": "Testing",
    },
    AgentName.DOCUMENTATION_AGENT.value: {
        "generate": True, "artifact_type": ArtifactType.DOCUMENTATION.value,
        "approval": False, "stage": "Documentation",
    },
}


# Direct upstream dependencies for each pipeline stage. Used to expand a
# user's chosen (visible) agents into the full set that must actually run:
# a selected agent's dependencies still execute — as hidden background
# stages — so its inputs exist, even though they aren't shown on the
# dashboard. Memory is always included as the bootstrap stage.
_AGENT_DEPENDENCIES: dict[str, list[str]] = {
    AgentName.MEMORY_AGENT.value: [],
    AgentName.REQUIREMENT_AGENT.value: [AgentName.MEMORY_AGENT.value],
    AgentName.BUSINESS_ANALYST_AGENT.value: [AgentName.REQUIREMENT_AGENT.value],
    AgentName.SOLUTION_ARCHITECT_AGENT.value: [AgentName.BUSINESS_ANALYST_AGENT.value],
    AgentName.DATABASE_AGENT.value: [AgentName.SOLUTION_ARCHITECT_AGENT.value],
    AgentName.UIUX_AGENT.value: [AgentName.BUSINESS_ANALYST_AGENT.value],
    AgentName.SECURITY_AGENT.value: [AgentName.SOLUTION_ARCHITECT_AGENT.value],
    AgentName.COMPLIANCE_AGENT.value: [AgentName.SECURITY_AGENT.value],
    AgentName.PRESENTATION_VIDEO_AGENT.value: [
        AgentName.SOLUTION_ARCHITECT_AGENT.value,
        AgentName.DATABASE_AGENT.value,
        AgentName.UIUX_AGENT.value,
    ],
    AgentName.FRONTEND_AGENT.value: [
        AgentName.UIUX_AGENT.value,
        AgentName.DATABASE_AGENT.value,
        AgentName.SOLUTION_ARCHITECT_AGENT.value,
    ],
    AgentName.BACKEND_AGENT.value: [
        AgentName.DATABASE_AGENT.value,
        AgentName.SOLUTION_ARCHITECT_AGENT.value,
        AgentName.UIUX_AGENT.value,
    ],
    AgentName.TESTING_AGENT.value: [
        AgentName.FRONTEND_AGENT.value,
        AgentName.BACKEND_AGENT.value,
    ],
    AgentName.DOCUMENTATION_AGENT.value: [
        AgentName.SOLUTION_ARCHITECT_AGENT.value,
        AgentName.DATABASE_AGENT.value,
        AgentName.FRONTEND_AGENT.value,
        AgentName.BACKEND_AGENT.value,
    ],
}

_PIPELINE_SET = set(PIPELINE)


def compute_agent_sets(project) -> tuple[set[str], set[str]]:
    """Return ``(run_set, visible_set)`` for a project.

    ``visible_set`` is the set of agents the user chose to run AND display on
    the dashboard (``project.selected_agents``). A null/empty selection means
    "everything" — the legacy full-pipeline behaviour, so pre-existing
    projects are completely unaffected.

    ``run_set`` is ``visible_set`` plus the transitive upstream dependencies
    each visible agent needs (which execute as hidden background stages),
    plus the Memory bootstrap stage. Only real pipeline stages are ever
    returned."""
    selected = [
        a for a in (getattr(project, "selected_agents", None) or [])
        if a in _PIPELINE_SET
    ]
    if not selected:
        return set(_PIPELINE_SET), set(_PIPELINE_SET)

    visible = set(selected)
    run = set(visible)
    run.add(AgentName.MEMORY_AGENT.value)
    stack = list(run)
    while stack:
        current = stack.pop()
        for dep in _AGENT_DEPENDENCIES.get(current, []):
            if dep not in run:
                run.add(dep)
                stack.append(dep)

    run &= _PIPELINE_SET
    visible &= _PIPELINE_SET
    return run, visible


def _strip_mockups(content: str) -> str:
    """Remove bulky mockupSvg strings from a uiux_design/selected_ui_style JSON
    blob so the real screen list/structure survives the per-artifact context
    truncation instead of being pushed out by large inline SVG data. The code
    generators need the screen names/purpose/components/navigation, not the
    visual mockups."""
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return content

    def _clean(screens):
        for s in screens or []:
            if isinstance(s, dict) and s.get("mockupSvg"):
                s["mockupSvg"] = ""

    if isinstance(data, dict):
        _clean(data.get("screens"))
        for opt in data.get("styleOptions") or []:
            if isinstance(opt, dict):
                _clean(opt.get("screens"))
        try:
            return json.dumps(data, ensure_ascii=False)
        except (TypeError, ValueError):
            return content
    return content


def _screen_inventory(db: Session, project_id: int) -> str:
    """A compact, mockup-free list of every UI/UX screen (name/type/purpose/
    components) so BOTH the Frontend and Backend agents build code for exactly
    the screens the UI/UX agent defined. Prefers the user's selected design,
    falling back to the generated uiux_design."""
    for art_type in ("selected_ui_style", ArtifactType.UIUX_DESIGN.value):
        art = (
            db.query(GeneratedArtifact)
            .filter(
                GeneratedArtifact.project_id == project_id,
                GeneratedArtifact.artifact_type == art_type,
            )
            .order_by(GeneratedArtifact.created_at.desc())
            .first()
        )
        if not art:
            continue
        try:
            data = json.loads(art.content)
        except (json.JSONDecodeError, TypeError):
            continue
        screens = data.get("screens") if isinstance(data, dict) else None
        if not screens:
            continue
        lines: list[str] = []
        for s in screens:
            if not isinstance(s, dict):
                continue
            name = (s.get("name") or "").strip()
            if not name:
                continue
            typ = (s.get("type") or "page").strip()
            purpose = (s.get("purpose") or "").strip()
            comps = ", ".join(c for c in (s.get("components") or []) if isinstance(c, str))
            line = f"- {name} [{typ}]"
            if purpose:
                line += f" — {purpose}"
            if comps:
                line += f" | components: {comps}"
            lines.append(line)
        if lines:
            return "\n".join(lines)
    return ""


def _build_context(db: Session, project: Project, agent_name: str) -> str:
    base = f"Project: {project.name}\nDescription: {project.description or ''}\n\n"
    prior_types: list[str] = []
    if agent_name == AgentName.REQUIREMENT_AGENT.value:
        prior_types = []
    elif agent_name == AgentName.BUSINESS_ANALYST_AGENT.value:
        prior_types = [ArtifactType.REQUIREMENTS_DOC.value]
    elif agent_name == AgentName.SOLUTION_ARCHITECT_AGENT.value:
        prior_types = [ArtifactType.REQUIREMENTS_DOC.value, ArtifactType.USER_STORIES.value]
    elif agent_name == AgentName.DATABASE_AGENT.value:
        prior_types = [ArtifactType.ARCHITECTURE_DIAGRAM.value]
    elif agent_name in (AgentName.UIUX_AGENT.value, AgentName.SECURITY_AGENT.value):
        prior_types = [ArtifactType.ARCHITECTURE_DIAGRAM.value, ArtifactType.SQL_SCHEMA.value]
    elif agent_name == AgentName.COMPLIANCE_AGENT.value:
        prior_types = [
            ArtifactType.ARCHITECTURE_DIAGRAM.value,
            ArtifactType.SQL_SCHEMA.value,
            ArtifactType.API_DESIGN.value,
        ]
    elif agent_name == AgentName.FRONTEND_AGENT.value:
        # Previously empty — Frontend generation had zero visibility into
        # what the project actually needs (requirements/user stories) or its
        # architecture/UI/UX design, and could never actually build the
        # described features or follow the project's own tech stack/style.
        prior_types = [
            ArtifactType.REQUIREMENTS_DOC.value,
            ArtifactType.USER_STORIES.value,
            ArtifactType.ARCHITECTURE_DIAGRAM.value,
            ArtifactType.UIUX_DESIGN.value,
            "selected_ui_style",
        ]
    elif agent_name == AgentName.BACKEND_AGENT.value:
        prior_types = [
            ArtifactType.REQUIREMENTS_DOC.value,
            ArtifactType.USER_STORIES.value,
            ArtifactType.ARCHITECTURE_DIAGRAM.value,
            ArtifactType.SQL_SCHEMA.value,
            ArtifactType.UIUX_DESIGN.value,
            "selected_ui_style",
        ]
    else:
        prior_types = []

    # Groq's free-tier tokens-per-minute budget is easily blown once several
    # artifacts (especially uiux_design, which carries a full style-option
    # set) are concatenated — same failure class the presentation pipeline
    # hit (see LLMService.has_generous_context_path). Cap harder unless a
    # genuinely large-context provider is actually available.
    generous = LLMService(db=db, project_id=project.id).has_generous_context_path()
    per_artifact_limit = 6000 if generous else 3000
    # selected_ui_style now carries a COMPLETE chosen design (its own
    # screens/navigation/componentRecommendations/dataVisualizations, not
    # just a theme) — it's the Frontend Agent's primary build spec, so it
    # gets a larger budget than the generic per-artifact cap above rather
    # than being truncated down to theme-only fidelity.
    per_artifact_limit_overrides = {
        "selected_ui_style": (14000 if generous else 9000),
    }

    for art_type in prior_types:
        artifact = (
            db.query(GeneratedArtifact)
            .filter(
                GeneratedArtifact.project_id == project.id,
                GeneratedArtifact.artifact_type == art_type,
            )
            .order_by(GeneratedArtifact.created_at.desc())
            .first()
        )
        if artifact:
            limit = per_artifact_limit_overrides.get(art_type, per_artifact_limit)
            raw = artifact.content
            # Drop the heavy mockupSvg blobs so the screen list itself isn't
            # truncated away by inline SVG data — the code generators need the
            # screen structure, not the visual mockups.
            if art_type in (ArtifactType.UIUX_DESIGN.value, "selected_ui_style"):
                raw = _strip_mockups(raw)
            content = raw[:limit] if len(raw) > limit else raw
            base += f"--- {art_type} ---\n{content}\n\n"

    # Both code generators must build for EXACTLY the screens the UI/UX agent
    # defined — the Frontend as routes/pages, the Backend as the endpoints and
    # data those screens need. A compact, mockup-free inventory guarantees the
    # full screen set is present even if the design blob above got truncated.
    if agent_name in (AgentName.FRONTEND_AGENT.value, AgentName.BACKEND_AGENT.value):
        inventory = _screen_inventory(db, project.id)
        if inventory:
            base += (
                "--- ui_screens (build for EXACTLY these UI/UX screens \u2014 same "
                "names; do not invent, drop, merge, or rename them) ---\n"
                f"{inventory}\n\n"
            )
    return base.strip()


def dispatch(agent_name: str, db: Session, project_id: int, context: str) -> Any:
    """The single place that turns an AgentName into a real generation
    call. Looks up the agent class via AgentFactory (polymorphism) and
    calls its `.generate(...)` — replaces the old
    `getattr(ai_service, generate_name)` string-based dispatch entirely.
    Raises AttributeError if `agent_name` has no registered agent, mirroring
    the old getattr-miss behavior so _execute_agent's error handling is
    unchanged."""
    agent = AgentFactory.create(agent_name, db=db, project_id=project_id)
    if agent is None:
        raise AttributeError(f"No agent registered for '{agent_name}'")
    return agent.generate(db, project_id, context)


async def _execute_agent(db: Session, run: AgentRun, project: Project) -> None:
    cfg = _AGENT_CONFIG.get(run.agent_name)
    if cfg is None:
        raise ValueError(f"No configuration found for agent: {run.agent_name}")

    run.status = RunStatus.RUNNING.value
    run.start_time = datetime.now(timezone.utc)
    db.commit()
    logger.info(
        "Agent started | project_id=%s agent=%s stage=%s",
        project.id, run.agent_name, cfg["stage"],
    )
    await manager.agent_started(project.id, {"agent_name": run.agent_name, "run_id": run.id})

    artifact_id: int | None = None
    content: str | None = None
    approval_id: int | None = None
    should_generate = cfg.get("generate")
    artifact_type = cfg.get("artifact_type")

    if should_generate and artifact_type:
        context = _build_context(db, project, run.agent_name)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: dispatch(run.agent_name, db, project.id, context))
        content = json.dumps(result, ensure_ascii=False)

        artifact = GeneratedArtifact(
            project_id=project.id,
            artifact_type=artifact_type,
            content=content,
        )
        db.add(artifact)
        db.flush()
        artifact_id = artifact.id

        # Live "streaming" code generation for the Development Studio: the
        # file content is already fully generated at this point — this just
        # re-broadcasts it over the existing per-project WebSocket in small,
        # paced chunks so the UI can render it as if it were streaming in.
        # Only frontend/backend agents produce a `files` array; anything
        # else is a no-op. Never raises — a streaming hiccup must never
        # fail code generation itself.
        if artifact_type in (ArtifactType.REACT_CODE.value, ArtifactType.BACKEND_CODE.value):
            files = result.get("files") if isinstance(result, dict) else None
            if files:
                agent_type = "frontend" if artifact_type == ArtifactType.REACT_CODE.value else "backend"
                await DeveloperStudioAgent.stream_generated_files(project.id, agent_type, files)

    if cfg["approval"]:
        if not artifact_type:
            raise ValueError(f"Approval requested but no artifact_type configured for {run.agent_name}")
        approval = Approval(
            project_id=project.id,
            artifact_type=artifact_type,
            status=ApprovalStatus.PENDING_APPROVAL.value,
        )
        db.add(approval)
        db.flush()
        approval_id = approval.id

    db.add(TimelineEvent(
        project_id=project.id,
        stage=cfg["stage"],
        status=RunStatus.COMPLETED.value,
    ))

    run.status = RunStatus.COMPLETED.value
    run.end_time = datetime.now(timezone.utc)
    run.output_url = None  # clear any stale error from a prior failed attempt on this same run
    db.commit()

    if artifact_id is not None and artifact_type is not None:
        await manager.artifact_generated(project.id, {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type,
            "agent_name": run.agent_name,
        })

    if approval_id is not None and artifact_type is not None:
        await manager.approval_requested(project.id, {
            "approval_id": approval_id,
            "artifact_type": artifact_type,
        })

    await manager.agent_completed(project.id, {
        "agent_name": run.agent_name,
        "run_id": run.id,
        "status": RunStatus.COMPLETED.value,
        "artifact_id": artifact_id,
    })


async def _safe_execute(db: Session, run: AgentRun, project: Project) -> None:
    cfg = _AGENT_CONFIG.get(run.agent_name, {})
    stage = cfg.get("stage", run.agent_name)
    start = time.monotonic()
    try:
        await _execute_agent(db, run, project)
        elapsed = time.monotonic() - start
        logger.info(
            "Agent completed | project_id=%s agent=%s stage=%s duration=%.2fs",
            project.id, run.agent_name, stage, elapsed,
        )
    except Exception as exc:
        elapsed = time.monotonic() - start
        tb = traceback.format_exc()
        logger.error(
            "Agent failed | project_id=%s agent=%s stage=%s duration=%.2fs error=%s\n%s",
            project.id, run.agent_name, stage, elapsed, exc, tb,
        )
        try:
            run.status = RunStatus.FAILED.value
            run.end_time = datetime.now(timezone.utc)
            run.output_url = json.dumps({"error": str(exc)})
            db.commit()
        except Exception:
            db.rollback()
        await manager.agent_completed(project.id, {
            "agent_name": run.agent_name,
            "run_id": run.id,
            "status": RunStatus.FAILED.value,
            "error": str(exc),
        })


async def run_agent(project_id: int, run_id: int) -> None:
    db: Session = next(get_db())
    try:
        run = db.get(AgentRun, run_id)
        if run is None or run.project_id != project_id:
            logger.warning("[agent_runner] run %s not found for project %s", run_id, project_id)
            return
        if run.status == RunStatus.RUNNING.value:
            return
        project = db.get(Project, project_id)
        if project is None:
            return
        await _safe_execute(db, run, project)
    finally:
        db.close()


def _approval_is_approved(db: Session, project_id: int, artifact_type: str) -> bool:
    a = (
        db.query(Approval)
        .filter(
            Approval.project_id == project_id,
            Approval.artifact_type == artifact_type,
        )
        .order_by(Approval.id.desc())
        .first()
    )
    return a is not None and a.status == ApprovalStatus.APPROVED.value


async def _augment_architecture_diagrams(db: Session, project_id: int, project_name: str) -> None:
    """Regenerate the full deterministic diagram set (high-level, component,
    sequence, class, ER, deployment, dataflow, …) from the architecture and DB
    schema artifacts and merge it onto the latest architecture artifact. The ER
    diagram in particular needs the generated schema, so this runs after the
    Database stage — making every diagram appear automatically in the pipeline
    with no manual 'regenerate diagrams' click. Never raises: a diagram hiccup
    must not fail the pipeline."""
    try:
        from .diagram_generator import build_all_diagrams

        arch_art = (
            db.query(GeneratedArtifact)
            .filter(
                GeneratedArtifact.project_id == project_id,
                GeneratedArtifact.artifact_type == ArtifactType.ARCHITECTURE_DIAGRAM.value,
            )
            .order_by(GeneratedArtifact.created_at.desc())
            .first()
        )
        if arch_art is None:
            return
        try:
            arch_data = json.loads(arch_art.content)
        except (json.JSONDecodeError, TypeError):
            return

        schema_art = (
            db.query(GeneratedArtifact)
            .filter(
                GeneratedArtifact.project_id == project_id,
                GeneratedArtifact.artifact_type == ArtifactType.SQL_SCHEMA.value,
            )
            .order_by(GeneratedArtifact.created_at.desc())
            .first()
        )
        schema_data: dict = {}
        if schema_art:
            try:
                schema_data = json.loads(schema_art.content)
            except (json.JSONDecodeError, TypeError):
                schema_data = {}

        arch_data["diagrams"] = build_all_diagrams(arch_data, schema_data, project_name)
        arch_art.content = json.dumps(arch_data, ensure_ascii=False)
        db.add(arch_art)
        db.commit()
        await manager.artifact_generated(project_id, {
            "artifact_id": arch_art.id,
            "artifact_type": ArtifactType.ARCHITECTURE_DIAGRAM.value,
        })
    except Exception as exc:
        logger.warning("[agent_runner] diagram augmentation failed for project %s: %s", project_id, exc)


class PipelineExecutor:
    """Owns the stage sequence, approval gates, checkpoint-reuse-on-resume
    logic, and the non-blocking Presentation-agent handling. `run(project_id)`
    is the only entrypoint — everything else on this class is a private
    helper. Contains no generation logic itself; every stage's actual work
    happens inside `dispatch()` -> AgentFactory -> the owning agent's
    `.generate(...)`."""

    async def run(self, project_id: int) -> None:
        db: Session = next(get_db())
        start = time.monotonic()
        logger.info("Pipeline started | project_id=%s", project_id)
        try:
            project = db.get(Project, project_id)
            if project is None:
                logger.warning("Pipeline aborted | project_id=%s reason=project_not_found", project_id)
                return

            existing: dict[str, AgentRun] = {
                r.agent_name: r
                for r in db.query(AgentRun).filter(AgentRun.project_id == project_id).all()
            }

            # Which agents actually run (run_set) and which of those are shown
            # on the dashboard (visible_set). Everything in run_set - visible_set
            # is a hidden background dependency.
            run_set, visible_set = compute_agent_sets(project)

            def _get_or_create_run(agent_name: str) -> AgentRun:
                is_visible = agent_name in visible_set
                run = existing.get(agent_name)
                if run is not None:
                    if run.visible != is_visible:
                        run.visible = is_visible
                        db.commit()
                    return run
                run = AgentRun(
                    project_id=project_id,
                    agent_name=agent_name,
                    status=RunStatus.PENDING.value,
                    visible=is_visible,
                )
                db.add(run)
                db.commit()
                db.refresh(run)
                existing[agent_name] = run
                return run

            def _create_approval(artifact_type: str) -> None:
                existing_approval = (
                    db.query(Approval)
                    .filter(
                        Approval.project_id == project_id,
                        Approval.artifact_type == artifact_type,
                    )
                    .first()
                )
                if existing_approval is None:
                    approval = Approval(
                        project_id=project_id,
                        artifact_type=artifact_type,
                        status=ApprovalStatus.PENDING_APPROVAL.value,
                    )
                    db.add(approval)
                    db.commit()

            def _auto_approve(artifact_type: str) -> None:
                """Mark a checkpoint approved without human interaction — used
                for review gates that are only running as a hidden background
                dependency, so the pipeline never hangs waiting on a review the
                user never chose to see."""
                approval = (
                    db.query(Approval)
                    .filter(
                        Approval.project_id == project_id,
                        Approval.artifact_type == artifact_type,
                    )
                    .order_by(Approval.id.desc())
                    .first()
                )
                if approval is None:
                    db.add(Approval(
                        project_id=project_id,
                        artifact_type=artifact_type,
                        status=ApprovalStatus.APPROVED.value,
                    ))
                    db.commit()
                elif approval.status != ApprovalStatus.APPROVED.value:
                    approval.status = ApprovalStatus.APPROVED.value
                    db.commit()


            async def _run_stage(run: AgentRun) -> bool:
                """Runs `run` if it isn't already completed, and returns True iff
                it's completed afterward (so callers just do `if not await
                _run_stage(run): return`).

                Checkpoint-recovery: if this run previously FAILED but already
                has a persisted GeneratedArtifact (e.g. the LLM call itself
                succeeded and was saved, but a later step — a WS broadcast, a
                commit — threw), reuse that artifact instead of paying for a
                fresh LLM call. This is what makes Resume (re-invoking
                run_pipeline) idempotent: it never regenerates a stage that
                already produced output, only stages that never did. Explicit
                single-agent reruns go through run_agent() instead, which always
                regenerates — that function is untouched by this helper."""
                if run.status == RunStatus.COMPLETED.value:
                    return True

                cfg = _AGENT_CONFIG.get(run.agent_name, {})
                artifact_type = cfg.get("artifact_type")
                if run.status == RunStatus.FAILED.value and artifact_type:
                    existing_artifact = (
                        db.query(GeneratedArtifact)
                        .filter(
                            GeneratedArtifact.project_id == project.id,
                            GeneratedArtifact.artifact_type == artifact_type,
                        )
                        .order_by(GeneratedArtifact.created_at.desc())
                        .first()
                    )
                    if existing_artifact is not None:
                        logger.info(
                            "[agent_runner] %s already produced artifact #%s — reusing on resume instead of regenerating",
                            run.agent_name, existing_artifact.id,
                        )
                        run.status = RunStatus.COMPLETED.value
                        run.end_time = datetime.now(timezone.utc)
                        run.output_url = None
                        db.commit()
                        await manager.agent_completed(project.id, {
                            "agent_name": run.agent_name, "run_id": run.id,
                            "status": RunStatus.COMPLETED.value, "artifact_id": existing_artifact.id,
                        })
                        return True

                await _safe_execute(db, run, project)
                db.refresh(run)
                return run.status == RunStatus.COMPLETED.value

            async def _stage(agent_name: str) -> bool:
                """Run a single stage if it is part of this build's run_set;
                otherwise skip it entirely (no AgentRun row is created).
                Returns True when the pipeline may continue."""
                if agent_name not in run_set:
                    return True
                run = _get_or_create_run(agent_name)
                return await _run_stage(run)

            # Memory (bootstrap — always runs)
            if not await _stage(AgentName.MEMORY_AGENT.value):
                return

            # Requirements
            if not await _stage(AgentName.REQUIREMENT_AGENT.value):
                return
            if AgentName.REQUIREMENT_AGENT.value in visible_set:
                _create_approval(ArtifactType.REQUIREMENTS_DOC.value)

            # Business Analysis
            if not await _stage(AgentName.BUSINESS_ANALYST_AGENT.value):
                return
            if AgentName.BUSINESS_ANALYST_AGENT.value in visible_set:
                _create_approval(ArtifactType.USER_STORIES.value)

            # Solution Architecture
            if not await _stage(AgentName.SOLUTION_ARCHITECT_AGENT.value):
                return
            if AgentName.SOLUTION_ARCHITECT_AGENT.value in visible_set:
                _create_approval(ArtifactType.ARCHITECTURE_DIAGRAM.value)
            # Build the deterministic diagram set now (ER fills in once the DB
            # schema exists below); runs automatically, no manual trigger.
            if AgentName.SOLUTION_ARCHITECT_AGENT.value in run_set:
                await _augment_architecture_diagrams(db, project_id, project.name)

            # Database Design
            if not await _stage(AgentName.DATABASE_AGENT.value):
                return
            if AgentName.DATABASE_AGENT.value in visible_set:
                _create_approval(ArtifactType.SQL_SCHEMA.value)
            # Re-augment so the ER diagram reflects the freshly generated schema.
            if AgentName.DATABASE_AGENT.value in run_set:
                await _augment_architecture_diagrams(db, project_id, project.name)

            # UI/UX + Security (either may be skipped independently)
            uiux_ok = await _stage(AgentName.UIUX_AGENT.value)
            security_ok = await _stage(AgentName.SECURITY_AGENT.value)
            if not uiux_ok or not security_ok:
                return

            # Compliance
            if not await _stage(AgentName.COMPLIANCE_AGENT.value):
                return
            if AgentName.COMPLIANCE_AGENT.value in visible_set:
                _create_approval(ArtifactType.COMPLIANCE_REPORT.value)

            # Presentation & Video — optional/non-blocking: a failure here must
            # never stop the pipeline from completing. It runs as the final
            # stage (after Documentation), so the deck/video reflects the fully
            # generated frontend, backend, tests and docs.
            async def _run_presentation() -> None:
                if AgentName.PRESENTATION_VIDEO_AGENT.value not in run_set:
                    return
                run = _get_or_create_run(AgentName.PRESENTATION_VIDEO_AGENT.value)
                if not await _run_stage(run):
                    logger.warning(
                        "[agent_runner] Presentation & Video failed for project %s — "
                        "continuing pipeline (non-blocking)", project_id,
                    )

            # Style selection is auto-approved so the entire pipeline runs
            # autonomously end-to-end — Frontend/Backend/Testing/Documentation
            # all generate without waiting on a manual UI-style pick in a
            # workspace.
            if AgentName.FRONTEND_AGENT.value in run_set:
                _auto_approve("ui_style_selection")

            # Development, testing, documentation
            for agent_name in (
                AgentName.FRONTEND_AGENT.value,
                AgentName.BACKEND_AGENT.value,
                AgentName.TESTING_AGENT.value,
                AgentName.DOCUMENTATION_AGENT.value,
            ):
                if not await _stage(agent_name):
                    return

            # Presentation & Video runs as the final pipeline stage.
            await _run_presentation()

            project.status = "completed"
            db.commit()
            elapsed = time.monotonic() - start
            logger.info("Pipeline completed | project_id=%s duration=%.2fs", project_id, elapsed)
        except Exception as exc:
            elapsed = time.monotonic() - start
            tb = traceback.format_exc()
            logger.error(
                "Pipeline failed | project_id=%s duration=%.2fs error=%s\n%s",
                project_id, elapsed, exc, tb,
            )
            raise
        finally:
            db.close()


async def run_pipeline(project_id: int) -> None:
    """Thin wrapper preserving the existing module-level call signature
    (`agent_runner.run_pipeline(project_id)`) used throughout main.py /
    main_extension.py — delegates to PipelineExecutor."""
    await PipelineExecutor().run(project_id)


def ensure_agent_runs_exist(db: Session, project_id: int) -> list[AgentRun]:
    project = db.get(Project, project_id)
    run_set, visible_set = (
        compute_agent_sets(project) if project is not None else (set(PIPELINE), set(PIPELINE))
    )
    existing = {
        r.agent_name: r
        for r in db.query(AgentRun).filter(AgentRun.project_id == project_id).all()
    }
    for agent_name in PIPELINE:
        if agent_name not in run_set:
            continue
        is_visible = agent_name in visible_set
        run = existing.get(agent_name)
        if run is None:
            db.add(AgentRun(
                project_id=project_id,
                agent_name=agent_name,
                status=RunStatus.PENDING.value,
                visible=is_visible,
            ))
        elif run.visible != is_visible:
            run.visible = is_visible
    db.commit()
    return (
        db.query(AgentRun)
        .filter(AgentRun.project_id == project_id)
        .order_by(AgentRun.id.asc())
        .all()
    )
