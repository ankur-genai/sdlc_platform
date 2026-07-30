"""
ai_service.py
=============
LLM-infrastructure-only module: the shared exception type every agent's
`.generate(...)` raises on failure, the DEMO_MODE flag, the supported
provider list, and provider-connectivity testing (test_provider). No
generation logic lives here — every AI capability (requirements, user
stories, architecture, database, UI/UX, security, compliance, frontend,
backend, testing, documentation, review, presentation) is implemented by
its own agent class under agents/<name>/ and reached via
agents.registry.AgentFactory (from the pipeline) or called directly (from
main_extension.py's /generate/* and /reviews/* routes).

Only when the deployment-wide DEMO_MODE flag is explicitly turned on (it is
off by default — see backend/.env.example) do agents return rich,
deterministic mock payloads immediately, without calling an LLM at all — an
explicit, admin-controlled "run this whole platform in demo mode" switch,
not a silent per-request fallback.

Outside of DEMO_MODE, if a real LLM call fails or returns unusable output,
the owning agent raises AIGenerationError instead of substituting mock
content. Fabricating a "successful" response would be indistinguishable
from a real AI-generated artefact in the UI, so failures are surfaced as
real errors: agent_runner.py's _safe_execute marks the agent_run FAILED and
broadcasts the error over the websocket, and routes called directly
(outside the pipeline) convert AIGenerationError into an HTTP 502 with the
failure detail.
"""
from __future__ import annotations

import time
from typing import Any

from .agents.llm_service import LLMService, build_cloud_config
from .models import DEMO_MODE

SUPPORTED_PROVIDERS = ["openai", "azure_openai", "gemini", "groq", "openrouter", "vllm", "lmstudio", "anthropic", "aws_bedrock", "openai_compatible", "ollama",
                       "d_id", "openai_image", "google_imagen", "stability"]


class AIGenerationError(RuntimeError):
    """Raised when a real AI generation call fails for an implemented agent.

    Every agent's `.generate(...)`/`.review(...)` must never substitute
    fabricated content for a genuine failure — callers are expected to
    surface this as a real error (HTTP 502 from routes that call generation
    directly, or a FAILED agent_run from agent_runner.py's _safe_execute,
    which already handles any raised exception correctly).
    """


def test_provider(
    provider_name: str,
    api_key: str | None,
    *,
    base_url: str | None = None,
    model: str | None = None,
    api_version: str | None = None,
) -> dict[str, Any]:
    """Ping the provider to verify the key works. Exercises the exact call
    path production generation uses (LLMService._call_chat_completions /
    OllamaClient), so this can never silently drift from what real calls do."""
    start = time.monotonic()
    try:
        if provider_name == "d_id":
            from .agents.avatar_provider import DIDAvatarProvider
            if not api_key:
                return {"reachable": False, "latency_ms": 0, "model_tested": "n/a",
                        "message": "No D-ID credential configured (expected 'email:api_key')."}
            DIDAvatarProvider(api_key).get_credits()
            latency = int((time.monotonic() - start) * 1000)
            return {"reachable": True, "latency_ms": latency, "model_tested": "d-id", "message": "Connection successful (0 credits used)"}
        if provider_name in ("openai_image", "google_imagen", "stability"):
            if not api_key:
                return {"reachable": False, "latency_ms": 0, "model_tested": "n/a",
                        "message": "No API key configured for this image provider."}
            if provider_name == "stability":
                import urllib.request
                req = urllib.request.Request(
                    "https://api.stability.ai/v1/user/balance",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp.read()
                latency = int((time.monotonic() - start) * 1000)
                return {"reachable": True, "latency_ms": latency, "model_tested": provider_name,
                        "message": "Connection successful (balance check, 0 images generated)"}
            return {"reachable": True, "latency_ms": 0, "model_tested": provider_name,
                    "message": "Key configured — not verified against the API to avoid generating "
                               "a billed image just to test the connection."}
        if provider_name == "ollama":
            LLMService(role="test", timeout=15).test_ollama()
        else:
            effective_key = api_key or ("local-key" if provider_name in ("lmstudio", "vllm") else "")
            cfg = build_cloud_config(
                provider_name, effective_key, base_url=base_url, model=model, api_version=api_version
            )
            if not cfg:
                return {"reachable": False, "latency_ms": 0, "model_tested": "n/a", "message": "No valid API key/endpoint configured for this provider."}
            LLMService(timeout=15).test_connection(cfg)
        latency = int((time.monotonic() - start) * 1000)
        return {"reachable": True, "latency_ms": latency, "model_tested": model or "auto", "message": "Connection successful"}
    except Exception as exc:
        return {"reachable": False, "latency_ms": int((time.monotonic() - start) * 1000), "model_tested": model or "n/a", "message": str(exc)}
