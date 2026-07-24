"""
agents/frontend/agent.py
==========================
Frontend Agent — produces a complete, implementation-ready frontend build
plan AND the actual runnable source files (components/pages/hooks/services)
for the project. Owns its own prompt (prompts.py) and schema (schemas.py);
the pipeline orchestrator only ever calls `.generate(...)`.
"""
from __future__ import annotations

import json
import re
from ...logging_config import get_logger
from typing import Any

from ..llm_service import LLMService
from .prompts import FRONTEND_SYSTEM_PROMPT
from .schemas import FrontendPlanOutput

logger = get_logger(__name__)


# ---------------------------------
# Demo-mode fixture — only used when DEMO_MODE is explicitly enabled, never
# as a failure fallback (see generate() below).
# ---------------------------------
FRONTEND_DEMO_PLAN = {
    "framework": "React + TypeScript",
    "files": [],
    "implementation": "Typed project dashboard with authenticated API access, pipeline status, and artifact rendering.",
}


def _pascal(name: str) -> str:
    """"Login Screen" -> "LoginScreen"; safe component/file base name."""
    parts = re.findall(r"[A-Za-z0-9]+", name or "")
    base = "".join(p[:1].upper() + p[1:] for p in parts) or "Screen"
    if base[0].isdigit():
        base = "Screen" + base
    return base


def _screen_key(name: str) -> str:
    """Normalized match key: drops 'screen'/'page' and non-alphanumerics."""
    return re.sub(r"[^a-z0-9]", "", re.sub(r"screen|page", "", (name or "").lower()))


def _load_ui_screens(db, project_id: int) -> tuple[list[dict], str]:
    """Return (screens, style_summary) from the selected design or uiux_design.
    Each screen is {name, purpose, type, components}. style_summary is a short
    palette/typography hint so generated pages match the chosen look."""
    from ...models import GeneratedArtifact, ArtifactType

    for art_type in ("selected_ui_style", ArtifactType.UIUX_DESIGN.value):
        art = (
            db.query(GeneratedArtifact)
            .filter(GeneratedArtifact.project_id == project_id,
                    GeneratedArtifact.artifact_type == art_type)
            .order_by(GeneratedArtifact.created_at.desc())
            .first()
        )
        if not art:
            continue
        try:
            data = json.loads(art.content)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(data, dict):
            continue
        raw = data.get("screens") or []
        screens = [
            {
                "name": (s.get("name") or "").strip(),
                "purpose": (s.get("purpose") or "").strip(),
                "type": (s.get("type") or "page").strip(),
                "components": [c for c in (s.get("components") or []) if isinstance(c, str)],
            }
            for s in raw if isinstance(s, dict) and (s.get("name") or "").strip()
        ]
        if not screens:
            continue
        ds = data.get("designSystem") or {}
        palette = (ds.get("colorPalette") or {}) if isinstance(ds, dict) else {}

        def _hexes(key):
            return ", ".join(
                c.get("hex", "") for c in (palette.get(key) or []) if isinstance(c, dict) and c.get("hex")
            )

        typ = (ds.get("typography") or {}) if isinstance(ds, dict) else {}
        font = typ.get("fontFamily") if isinstance(typ, dict) else None
        summary = (
            f"Primary colors: {_hexes('primary') or '(none)'}; "
            f"Neutral colors: {_hexes('neutral') or '(none)'}; "
            f"Font: {font or 'Inter, system-ui, sans-serif'}."
        )
        return screens, summary
    return [], ""


_SCREEN_FILE_SYSTEM = (
    "You are a Principal Frontend Engineer. You output ONE complete, runnable "
    "React functional component file (JSX) and NOTHING else — no markdown "
    "fences, no prose, no explanation. Use ONLY React (useState/useEffect); no "
    "other imports. Every JSX element carries an inline style={{...}} using the "
    "given palette/font. Provide a default export."
)


def _build_screen_file_prompt(screen: dict, style_summary: str, project_name: str) -> str:
    comps = ", ".join(screen.get("components") or []) or "(infer sensible components)"
    comp = _pascal(screen["name"])
    return f"""Project: {project_name}

Write a COMPLETE React page component for ONE screen.

Screen name: {screen['name']}
Purpose: {screen.get('purpose') or '(infer from the name)'}
Type: {screen.get('type') or 'page'}
Components to render: {comps}

Design system to apply verbatim: {style_summary}

Rules:
- Export default a function component named `{comp}`.
- Only `import React, {{ useState }} from 'react';` — no other imports.
- Render this screen's real components with real, controlled inputs, buttons
  with onClick handlers, and inline style on EVERY element using the palette
  hex values and font above, plus a clear primary action button.
- Fully working, not a stub. No "// TODO", no lorem ipsum.
- Output ONLY the JSX file content."""


def _extract_code(text: str) -> str:
    """Strip markdown fences from an LLM code response."""
    if not text:
        return ""
    t = re.sub(r"^```(?:jsx?|tsx?|react|javascript)?", "", text.strip(), flags=re.I)
    t = re.sub(r"```$", "", t.strip())
    return t.strip()


class FrontendAgent:
    def __init__(self, llm: LLMService | None = None, *, db=None, project_id: int | None = None):
        self.llm = llm or LLMService(db=db, project_id=project_id, role="architect")

    def run(self, context: str) -> FrontendPlanOutput:
        if not context.strip():
            raise ValueError("Frontend context cannot be empty")
        return self.llm.generate_json(FRONTEND_SYSTEM_PROMPT, context, schema=FrontendPlanOutput)

    @classmethod
    def generate(cls, db, project_id: int, context: str) -> dict[str, Any]:
        """Orchestrator-facing entrypoint: `FrontendAgent.generate(db, project_id, context)`.
        On any failure (every provider exhausted, or the LLM response fails
        schema validation), raises AIGenerationError instead of returning a
        placeholder — a stage that didn't produce real files must be recorded
        as Failed, never as Completed with empty output."""
        from ...models import DEMO_MODE
        from ...ai_service import AIGenerationError

        if DEMO_MODE:
            return FRONTEND_DEMO_PLAN

        framework = cls._resolve_framework(db, project_id)
        context = cls._apply_framework_directive(context, framework)
        try:
            llm = LLMService(db=db, project_id=project_id, role="architect", timeout=170)
            result = llm.generate_json(FRONTEND_SYSTEM_PROMPT, context, schema=FrontendPlanOutput)
            # The per-screen file-fill helper only emits React (.jsx) pages, so
            # it must not run for a non-React target — otherwise it would inject
            # React files into an Angular build.
            if framework == "react":
                cls._ensure_screen_files(llm, db, project_id, result)
            return result.model_dump()
        except Exception as exc:
            logger.error("[FrontendAgent] generate failed: %s", exc)
            raise AIGenerationError(f"Frontend generation failed: {exc}") from exc

    @staticmethod
    def _resolve_framework(db, project_id: int) -> str:
        """Return the normalized target framework ('react' | 'angular') for the
        project, defaulting to React."""
        try:
            from ...models import Project
            project = db.get(Project, project_id)
            raw = (getattr(project, "frontend_framework", None) or "").strip().lower()
        except Exception:  # noqa: BLE001
            raw = ""
        return "angular" if raw.startswith("angular") else "react"

    @staticmethod
    def _apply_framework_directive(context: str, framework: str) -> str:
        """Prepend an explicit, unambiguous target-framework directive to the
        generation context. The FRONTEND_SYSTEM_PROMPT already honours a
        framework specified in the context ('follow it exactly'), so this is
        what actually steers React vs Angular output."""
        if framework == "angular":
            directive = (
                "TARGET FRONTEND FRAMEWORK (MANDATORY): Angular (TypeScript). "
                "Generate Angular standalone components (*.component.ts with an "
                "inline `template` and `styles`), TypeScript services for API "
                "calls, and an app bootstrap/router. Use ONLY Angular core "
                "features; do not emit React/JSX. File extensions must be .ts / "
                ".component.ts. The `framework` field in the JSON must be "
                "'Angular + TypeScript'."
            )
        else:
            directive = (
                "TARGET FRONTEND FRAMEWORK (MANDATORY): React (with hooks). "
                "The `framework` field in the JSON must be 'React + TypeScript'."
            )
        return f"{directive}\n\n{context}"

    @staticmethod
    def _ensure_screen_files(llm: LLMService, db, project_id: int, result: FrontendPlanOutput) -> None:
        """Guarantee one page file per UI/UX screen. The model routinely merges
        several screens into fewer files; this fills any missing screen with a
        focused single-screen page-file generation so the file set matches the
        mockup screens. Best-effort — a failure on one screen never aborts the
        whole generation."""
        try:
            screens, style_summary = _load_ui_screens(db, project_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[FrontendAgent] could not load UI screens for fill: %s", exc)
            return
        if not screens:
            return

        from .schemas import CodeFileSpec

        project = None
        try:
            from ...models import Project
            project = db.get(Project, project_id)
        except Exception:  # noqa: BLE001
            project = None
        project_name = getattr(project, "name", "") or "the app"

        def _has_file(key: str) -> bool:
            if len(key) < 3:
                return False
            for f in result.files or []:
                hay = re.sub(r"[^a-z0-9]", "", f"{f.path or ''}{f.name or ''}".lower())
                if key in hay:
                    return True
            return False

        for screen in screens[:12]:
            key = _screen_key(screen["name"])
            if _has_file(key):
                continue
            try:
                raw = llm.generate_text(
                    system=_SCREEN_FILE_SYSTEM,
                    prompt=_build_screen_file_prompt(screen, style_summary, project_name),
                    temperature=0.3,
                )
                code = _extract_code(raw)
                if not code or "return" not in code:
                    continue
                comp = _pascal(screen["name"])
                result.files.append(CodeFileSpec(
                    path=f"src/pages/{comp}.jsx",
                    name=f"{comp}.jsx",
                    content=code,
                    language="jsx",
                ))
                logger.info("[FrontendAgent] filled missing page file for screen '%s'", screen["name"])
            except Exception as exc:  # noqa: BLE001
                logger.warning("[FrontendAgent] screen file fill failed for '%s': %s",
                               screen["name"], exc)
