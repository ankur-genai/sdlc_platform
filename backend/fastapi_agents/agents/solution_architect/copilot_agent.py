"""
agents/solution_architect/copilot_agent.py
============================================
Processes natural language user instructions for the Architecture Copilot,
modifying, refining, or generating architecture-related content and updating
all affected diagrams, tech stacks, component lists, and design decisions.
"""
from __future__ import annotations

import json
import re
from typing import Any
from ...logging_config import get_logger
from ..llm_service import LLMService

logger = get_logger(__name__)

ARCHITECTURE_COPILOT_SYSTEM_PROMPT = """
You are the Architecture Copilot, an expert Principal Solutions Architect and Enterprise Systems Engineer.
Your task is to analyze the user's natural language instructions and the current Architecture Workspace, and propose modifications to the architecture.

You must handle natural language requests such as:
- System Architecture modifications (e.g. "Replace Microservices with Modular Monolith", "Change to Event-Driven Architecture")
- Infrastructure & Component additions (e.g. "Add Redis caching", "Add API Gateway", "Introduce Kafka for event-driven communication", "Add Load Balancer", "Add CDN layer", "Add Authentication Service")
- Database & Storage replacements (e.g. "Replace PostgreSQL with MongoDB")
- Deployment strategy updates (e.g. "Add Kubernetes deployment", "Modify deployment architecture")
- Technology Stack updates (e.g. "Update technology stack to FastAPI and React 18")
- Quality & Non-functional improvements (e.g. "Improve scalability", "Improve security architecture", "Remove unnecessary components")
- Explanations & Rationale (e.g. "Explain architecture decisions")

You must output a strictly valid JSON object without markdown code fences:
{
  "message": "Clear explanation of what was changed in the architecture and the technical rationale.",
  "summary": "Reasoning summary of the architectural changes.",
  "updated_architecture": {
    "architecture_summary": "Updated executive architecture summary",
    "pattern": "Updated pattern e.g. Modular Monolith, CQRS Microservices, Event-Driven Architecture",
    "microservices": ["list of microservices or core modules"],
    "components": [
      {"name": "Component Name", "type": "frontend|backend|database|cache|gateway|broker", "technology": "Tech Name"}
    ],
    "tech_stack": {
      "Frontend": "Frontend tech...",
      "Backend": "Backend tech...",
      "Database": "Database tech...",
      "Cache": "Cache tech...",
      "MessageBroker": "Message broker tech...",
      "Gateway": "Gateway tech...",
      "Deployment": "Deployment tech..."
    },
    "architecture_decisions": [
      {
        "decision": "Title of decision",
        "rationale": "Why this decision was made",
        "consequences": "Tradeoffs or impacts"
      }
    ]
  },
  "affected_sections": ["tech_stack", "components", "pattern", "decisions", "diagrams"]
}
"""

class ArchitectureCopilotAgent:
    def __init__(self, db=None, project_id: int | None = None):
        self.db = db
        self.project_id = project_id
        self.llm = LLMService(db=db, project_id=project_id, role="architect")

    def process_prompt(self, current_arch: dict[str, Any], prompt: str) -> dict[str, Any]:
        prompt_text = (
            f"Current Architecture:\n"
            f"{json.dumps(current_arch, indent=2)}\n\n"
            f"User Instruction:\n"
            f"{prompt}\n\n"
            f"Modify and refine the relevant sections of the architecture based on the user instruction. Return the JSON object as specified."
        )

        try:
            raw_response = self.llm.generate_text(
                system=ARCHITECTURE_COPILOT_SYSTEM_PROMPT,
                prompt=prompt_text
            )
            
            cleaned = raw_response.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            if isinstance(data, dict) and "updated_architecture" in data:
                return data
        except Exception as exc:
            logger.warning("[ArchitectureCopilot] LLM invocation failed or non-JSON returned: %s", exc)

        return self._fallback_mutate(current_arch, prompt)

    def _fallback_mutate(self, current_arch: dict[str, Any], prompt: str) -> dict[str, Any]:
        p_lower = prompt.lower()
        arch = dict(current_arch)

        # Normalize tech_stack
        tech = dict(arch.get("tech_stack") or {})

        # Normalize decisions
        decisions = list(arch.get("architecture_decisions") or [])

        # Normalize components
        raw_components = list(arch.get("components") or [])
        components = []
        for c in raw_components:
            if isinstance(c, dict):
                components.append(c)
            elif isinstance(c, str):
                components.append({"name": c, "type": "service", "technology": c})

        affected = ["tech_stack", "components"]
        msg = f"Updated architecture according to instruction: '{prompt}'."

        if "redis" in p_lower or "cache" in p_lower:
            tech["Cache"] = "Redis 7 (In-memory caching & session store)"
            if not any(c.get("name", "").lower() == "redis cache" for c in components):
                components.append({"name": "Redis Cache", "type": "cache", "technology": "Redis 7"})
            decisions.append({
                "decision": "Added Redis in-memory caching tier",
                "rationale": "Absorbs database read load and reduces p95 API response latencies.",
                "consequences": "Requires cache invalidation management and Redis cluster health monitoring."
            })
            msg = "Added Redis in-memory caching tier to Technology Stack, Component list, and Architecture Decisions."

        elif "monolith" in p_lower or "modular" in p_lower:
            arch["pattern"] = "Modular Monolith"
            arch["architecture_summary"] = "Modular Monolith architecture with clean domain boundaries."
            decisions.append({
                "decision": "Adopted Modular Monolith pattern",
                "rationale": "Simplifies operational deployment while maintaining clear module separation.",
                "consequences": "Single deployment unit; requires discipline to maintain module isolation."
            })
            msg = "Replaced Microservices architecture with Modular Monolith pattern."

        elif "kubernetes" in p_lower or "k8s" in p_lower:
            tech["Deployment"] = "Kubernetes (AKS / EKS with Helm charts)"
            decisions.append({
                "decision": "Adopted Kubernetes container orchestration",
                "rationale": "Provides automated scaling, self-healing, and multi-node HA infrastructure.",
                "consequences": "Increases cluster management complexity and DevOps overhead."
            })
            msg = "Updated deployment strategy to Kubernetes (k8s) container orchestration."

        elif "gateway" in p_lower or "api gateway" in p_lower:
            tech["Gateway"] = "Kong API Gateway / Nginx Ingress"
            if not any("gateway" in c.get("name", "").lower() for c in components):
                components.append({"name": "API Gateway", "type": "gateway", "technology": "Kong Gateway"})
            msg = "Integrated API Gateway for routing, rate limiting, and centralized authentication."

        elif "kafka" in p_lower or "event" in p_lower:
            tech["MessageBroker"] = "Apache Kafka (Event Bus)"
            decisions.append({
                "decision": "Introduced Apache Kafka event bus",
                "rationale": "Enables asynchronous event-driven messaging and microservice decoupling.",
                "consequences": "Requires schema registry and Kafka broker cluster monitoring."
            })
            msg = "Introduced Apache Kafka for event-driven asynchronous communication."

        elif "mongodb" in p_lower:
            tech["Database"] = "MongoDB (NoSQL Document Store)"
            decisions.append({
                "decision": "Replaced relational DB with MongoDB document store",
                "rationale": "Provides flexible document schema support and high write throughput.",
                "consequences": "Replaces relational JOINs with document embedding or application-level joins."
            })
            msg = "Replaced relational database with MongoDB document store."

        elif "auth" in p_lower or "authentication" in p_lower:
            tech["Authentication"] = "OAuth 2.0 / OpenID Connect + JWT"
            if not any("auth" in c.get("name", "").lower() for c in components):
                components.append({"name": "Auth Service", "type": "security", "technology": "OAuth2 / OIDC"})
            msg = "Added centralized Authentication & Authorization Service."

        elif "cdn" in p_lower or "load balancer" in p_lower:
            tech["CDN"] = "Cloudflare / AWS CloudFront"
            tech["LoadBalancer"] = "Application Load Balancer (ALB)"
            msg = "Added Cloudflare CDN and Application Load Balancer (ALB) infrastructure layers."

        arch["tech_stack"] = tech
        arch["components"] = components
        arch["architecture_decisions"] = decisions

        return {
            "message": msg,
            "summary": f"Mutated architecture in response to: '{prompt}'.",
            "updated_architecture": arch,
            "affected_sections": affected
        }
