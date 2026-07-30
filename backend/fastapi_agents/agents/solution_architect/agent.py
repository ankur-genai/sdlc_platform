"""
agents/solution_architect/agent.py
===================================
Solution Architect Agent — produces the enterprise implementation blueprint
(architecture summary, pattern, components, diagrams, architecture
decisions, scalability/security/performance/deployment strategy, and the
two mandatory local/cloud tech-stack recommendations). Owns its own prompt
(prompts.py) and schema (schemas.py); the pipeline orchestrator only ever
calls `.generate(...)`.
"""
from __future__ import annotations

from ...logging_config import get_logger
from typing import Any

from ..llm_service import LLMService
from .prompts import SOLUTION_ARCHITECT_SYSTEM_PROMPT
from .schemas import ArchitectAgentOutput

logger = get_logger(__name__)


# ---------------------------------
# Demo-mode fixture (returned only when the deployment-wide DEMO_MODE flag
# is on — see ai_service.py's module docstring for the contract).
# ---------------------------------
def get_mock_architecture_for_project(context: str = "") -> dict[str, Any]:
    """Generates project-tailored architecture blueprint based on project context."""
    c_lower = (context or "").lower()
    
    proj_name = "Enterprise Solution"
    for line in (context or "").split('\n'):
        if any(k in line.lower() for k in ['project', 'title', 'name', 'system']):
            parts = line.split(':')
            if len(parts) > 1:
                candidate = parts[1].strip()
                if candidate and len(candidate) > 2 and not candidate.startswith('{'):
                    proj_name = candidate
                    break

    # E-Commerce Domain
    if any(k in c_lower for k in ["shop", "commerce", "cart", "checkout", "store", "retail", "catalog", "order"]):
        title = proj_name if "commerce" in proj_name.lower() or "store" in proj_name.lower() else "E-Commerce Platform"
        return {
            "architecture_summary": f"Decoupled microservices architecture for catalog browsing, shopping cart state management, checkout transaction processing, and order fulfillment.",
            "pattern": "Event-Driven Microservices",
            "microservices": [
                {"name": "catalog-service", "responsibility": "Manages product catalog, inventory stock levels, and search indexes", "technology": "FastAPI / Python", "port": 8001},
                {"name": "cart-service", "responsibility": "Handles active user shopping sessions and cart items", "technology": "Node.js / Redis", "port": 8002},
                {"name": "checkout-service", "responsibility": "Orchestrates payment processing and transaction settlement", "technology": "Go / gRPC", "port": 8003},
                {"name": "order-service", "responsibility": "Manages order fulfillment lifecycle and invoice tracking", "technology": "FastAPI / Python", "port": 8004},
            ],
            "components": [
                {"name": "Storefront UI", "type": "frontend", "technology": "Next.js 14 + React + TypeScript", "responsibility": "Renders product catalog, cart, and checkout pages for end users"},
                {"name": "API Gateway", "type": "gateway", "technology": "Kong / Nginx Ingress", "responsibility": "Routes all client requests, enforces rate limiting and JWT validation"},
                {"name": "Catalog Service", "type": "backend", "technology": "FastAPI (Python 3.12)", "responsibility": "Manages product inventory, stock levels, and search indexes"},
                {"name": "Checkout Engine", "type": "backend", "technology": "Go / gRPC Worker", "responsibility": "Orchestrates payment processing and order transaction settlement"},
                {"name": "Order Database", "type": "database", "technology": "PostgreSQL 15", "responsibility": "Persists order records, product catalog data, and invoice history"},
                {"name": "Cart Cache", "type": "cache", "technology": "Redis 7 Cluster", "responsibility": "Maintains active shopping session state with sub-millisecond reads"},
            ],
            "diagrams": [
                {"type": "system_context", "content": f"graph TD\n  User-->|HTTPS|Store[\"E-Commerce Storefront\"]\n  Store-->|REST|Gateway[\"API Gateway\"]\n  Gateway-->|Route|Catalog[\"Catalog Service\"]\n  Gateway-->|Route|Checkout[\"Checkout Service\"]\n  Catalog-->Cache[(Redis Cart Cache)]\n  Checkout-->DB[(PostgreSQL Order DB)]"},
                {"type": "sequence", "content": f"sequenceDiagram\n  User->>Storefront: Place Order Request\n  Storefront->>API Gateway: POST /api/v1/orders/checkout\n  API Gateway->>Cart Service: Fetch & Validate Cart Items\n  Cart Service->>Catalog Service: Lock Inventory Units\n  API Gateway->>Checkout Service: Process Payment Transaction\n  Checkout Service->>PostgreSQL DB: Commit Order Record\n  Checkout Service-->>Storefront: HTTP 200 Order Confirmed"},
            ],
            "tech_stack": {
                "frontend": "Next.js 14, React 18, TypeScript, TailwindCSS",
                "backend": "FastAPI (Python 3.12), Go Microservices",
                "database": "PostgreSQL 15",
                "cache": "Redis 7",
                "auth": "OAuth2 / OIDC, Bearer JWT, TLS 1.3",
                "deployment": "Kubernetes (EKS/AKS)",
            },
            "architecture_decisions": [
                {"decision": f"Event-driven CQRS separation for order processing",
                 "rationale": f"Isolates read-heavy product catalog traffic from transactional checkout processing to prevent database contention.",
                 "alternatives_considered": "Single monolithic database schema.",
                 "consequences": "Requires asynchronous inventory reconciliation via Redis pub/sub."},
            ],
            "design_principles": [
                f"Stateless checkout services allowing horizontal scaling.",
                f"Redis caching layer for product catalog queries."
            ],
            "scalability_strategy": f"Horizontal pod scaling for catalog and cart services behind load balancers.",
            "security_considerations": f"Payment tokenization via external gateway; TLS 1.3 encryption across endpoints.",
            "performance_strategy": f"Next.js SSR and Redis caching for product catalog requests.",
            "deployment_strategy": f"Docker containers orchestrated via Kubernetes with rolling updates.",
            "communication_flow": f"Storefront requests pass through API Gateway to Catalog and Cart services, committing final orders to PostgreSQL.",
            "module_responsibilities": [
                {"module": "catalog-service", "responsibility": f"Product inventory and search indexing", "owns_data": "products, inventory", "communicates_with": ["cart-service"]},
                {"module": "checkout-service", "responsibility": f"Payment processing and order confirmation", "owns_data": "orders, invoices", "communicates_with": ["catalog-service"]},
            ]
        }

    # Banking / Financial Domain
    elif any(k in c_lower for k in ["bank", "banking", "finance", "ledger", "deposit", "credit", "loan", "checking"]):
        title = proj_name if "bank" in proj_name.lower() or "financial" in proj_name.lower() else "Banking Portal"
        return {
            "architecture_summary": f"Financial application architecture utilizing isolated auth services, double-entry transaction ledgers, and multi-region database persistence.",
            "pattern": "Financial Microservices Architecture",
            "microservices": [
                {"name": "identity-auth-service", "responsibility": "OAuth2 authentication and role-based access validation", "technology": "FastAPI / Python", "port": 8001},
                {"name": "account-management-service", "responsibility": "Manages customer accounts and balance lifecycle", "technology": "Java Spring Boot", "port": 8002},
                {"name": "ledger-transaction-service", "responsibility": "Executes double-entry financial journal postings", "technology": "Go / gRPC", "port": 8003},
                {"name": "fraud-detection-worker", "responsibility": "Asynchronous stream processing for anomaly evaluation", "technology": "Python / Celery", "port": 8004},
            ],
            "components": [
                {"name": "Banking Web Console", "type": "frontend", "technology": "React 18 + TypeScript + Vite", "responsibility": "Customer-facing web interface for account viewing and transfers"},
                {"name": "Secure API Gateway", "type": "gateway", "technology": "Nginx / Envoy WAF", "responsibility": "Terminates TLS, enforces WAF rules, and routes to backend services"},
                {"name": "Auth & Identity Service", "type": "backend", "technology": "FastAPI (Python 3.12)", "responsibility": "OAuth2 authentication, JWT issuance, and role-based access validation"},
                {"name": "Ledger Processing Engine", "type": "backend", "technology": "Go / gRPC Worker", "responsibility": "Executes double-entry journal postings and balance reconciliation"},
                {"name": "Core Ledger Database", "type": "database", "technology": "PostgreSQL 15", "responsibility": "Persists account balances, transaction journals, and customer records"},
                {"name": "Key Management Vault", "type": "security", "technology": "AWS KMS / Azure Key Vault", "responsibility": "Stores and rotates encryption keys for field-level data security"},
            ],
            "diagrams": [
                {"type": "system_context", "content": f"graph TD\n  User-->|HTTPS|Portal[\"Banking Console\"]\n  Portal-->|REST|Gateway[\"Secure Gateway\"]\n  Gateway-->|Route|Auth[\"Auth Service\"]\n  Gateway-->|Route|Ledger[\"Ledger Service\"]\n  Auth-->Vault[(Key Vault)]\n  Ledger-->DB[(PostgreSQL Core DB)]"},
                {"type": "sequence", "content": f"sequenceDiagram\n  User->>Portal: Initiate Funds Transfer\n  Portal->>Secure Gateway: POST /api/v1/transfers\n  Secure Gateway->>Auth Service: Validate Bearer Token & MFA\n  Auth Service-->>Secure Gateway: Token Validated\n  Secure Gateway->>Ledger Service: Execute Double-Entry Posting\n  Ledger Service->>PostgreSQL Core DB: BEGIN TRANSACTION; UPDATE balances; COMMIT;\n  Ledger Service-->>Portal: HTTP 200 Transfer Complete"},
            ],
            "tech_stack": {
                "frontend": "React 18, Vite, TypeScript, TailwindCSS",
                "backend": "FastAPI (Python 3.12), Java Spring Boot, Go",
                "database": "PostgreSQL 15",
                "security": "KMS, mTLS, OAuth2 / OIDC, TLS 1.3",
                "auth": "OAuth2 / OIDC, Hardware MFA, Bearer JWT",
                "deployment": "Kubernetes (AKS/EKS)",
            },
            "architecture_decisions": [
                {"decision": f"Double-entry bookkeeping journal structure",
                 "rationale": f"Ensures mathematical balance consistency across debit and credit entries.",
                 "alternatives_considered": "Single-entry record updates.",
                 "consequences": "Requires serializable database transactions."},
            ],
            "design_principles": [
                f"mTLS verification for internal service-to-service communication.",
                f"Append-only journal entries for financial operations."
            ],
            "scalability_strategy": f"Read-replica splitting for query traffic; stateless API gateways.",
            "security_considerations": f"Field-level encryption for sensitive account identifiers; short-lived bearer tokens.",
            "performance_strategy": f"Indexed ledger queries for fast retrieval.",
            "deployment_strategy": f"Automated container deployments with health-check validation.",
            "communication_flow": f"Transactions pass through Secure API Gateway, validate via Auth Service, and update balances in PostgreSQL.",
            "module_responsibilities": [
                {"module": "identity-service", "responsibility": f"Authentication and token verification", "owns_data": "users, sessions", "communicates_with": ["ledger-transaction-service"]},
                {"module": "ledger-transaction-service", "responsibility": f"Financial transaction execution and balance tracking", "owns_data": "accounts, transactions", "communicates_with": ["identity-service"]},
            ]
        }

    # Cloud Storage Domain
    elif any(k in c_lower for k in ["storage", "cloud", "drive", "file", "bucket", "blob", "object"]):
        title = proj_name if "storage" in proj_name.lower() or "drive" in proj_name.lower() else "Enterprise Cloud Storage Platform"
        return {
            "architecture_summary": f"Distributed object storage architecture with decoupled metadata indexing and chunked file transfer pipelines.",
            "pattern": "Distributed Microservices & Object Storage",
            "microservices": [
                {"name": "gateway-service", "responsibility": "API rate limiting and token validation", "technology": "Nginx / Envoy", "port": 8000},
                {"name": "metadata-service", "responsibility": "Manages file metadata, folder hierarchies, and ACL permissions", "technology": "FastAPI / Python", "port": 8001},
                {"name": "transfer-service", "responsibility": "Handles multipart file uploads, chunk encryption, and storage streaming", "technology": "Go / gRPC", "port": 8002},
            ],
            "components": [
                {"name": "Storage Web Console", "type": "frontend", "technology": "React 18 + Vite + TypeScript", "responsibility": "Web UI for file browsing, upload, download, and sharing controls"},
                {"name": "Storage API Gateway", "type": "gateway", "technology": "Nginx / AWS ALB", "responsibility": "Ingress routing, TLS termination, rate limiting, and token validation"},
                {"name": "Metadata Service", "type": "backend", "technology": "FastAPI (Python 3.12)", "responsibility": "Manages file metadata, folder hierarchies, and ACL permissions"},
                {"name": "Transfer Engine", "type": "backend", "technology": "Go / gRPC Worker", "responsibility": "Handles multipart file uploads, chunk encryption, and storage streaming"},
                {"name": "Metadata Database", "type": "database", "technology": "PostgreSQL 15", "responsibility": "Persists file index records, folder structures, and access control lists"},
                {"name": "Object Storage Engine", "type": "storage", "technology": "Ceph / AWS S3 Cluster", "responsibility": "Durable block-level storage for uploaded file payloads and chunks"},
            ],
            "diagrams": [
                {"type": "system_context", "content": f"graph TD\n  User-->|HTTPS|Console[\"Web Console\"]\n  Console-->|REST|Gateway[\"Storage Gateway\"]\n  Gateway-->|Route|Meta[\"Metadata Service\"]\n  Gateway-->|Route|Transfer[\"Transfer Service\"]\n  Meta-->DB[(PostgreSQL DB)]\n  Transfer-->Storage[(Object Storage)]"},
                {"type": "sequence", "content": f"sequenceDiagram\n  User->>Console: Select File Upload\n  Console->>Storage Gateway: POST /api/v1/files/upload\n  Storage Gateway->>Metadata Service: Create File Record\n  Metadata Service->>PostgreSQL DB: INSERT file_metadata\n  Storage Gateway->>Transfer Service: Stream Payload Chunks\n  Transfer Service->>Object Storage: Write Block Payload\n  Storage Gateway-->>User: HTTP 201 Created (File ID)"},
            ],
            "tech_stack": {
                "frontend": "React 18, Vite, TypeScript, TailwindCSS",
                "backend": "FastAPI (Python 3.12), Go microservices",
                "database": "PostgreSQL 15",
                "storage": "S3 / Ceph Object Storage Cluster",
                "auth": "OAuth2 / OIDC, Bearer JWT, TLS 1.3",
                "deployment": "Kubernetes (AKS/EKS)",
            },
            "architecture_decisions": [
                {"decision": f"Decoupled metadata indexing from blob storage engine",
                 "rationale": f"Metadata queries require relational indexing, while file payloads stream to object storage. Decoupling avoids database disk bloat.",
                 "alternatives_considered": "Single relational database storing blobs as BYTEA.",
                 "consequences": "Requires dual-write handling between metadata and storage nodes."},
            ],
            "design_principles": [
                f"Stateless transfer workers streaming file chunks directly to object storage.",
                f"Relational metadata index for folder and file ACL queries."
            ],
            "scalability_strategy": f"Horizontal scaling of transfer workers; primary-replica read splitting for PostgreSQL metadata.",
            "security_considerations": f"OAuth2 token authentication; TLS 1.3 encryption in transit.",
            "performance_strategy": f"Multipart chunking for parallel file transfers.",
            "deployment_strategy": f"Containerized workloads deployed via Kubernetes.",
            "communication_flow": f"Upload requests route metadata to Metadata Service and stream file chunks through Transfer Service to Object Storage.",
            "module_responsibilities": [
                {"module": "gateway-service", "responsibility": f"Ingress routing and token verification", "owns_data": "none", "communicates_with": ["metadata-service", "transfer-service"]},
                {"module": "metadata-service", "responsibility": f"File index and ACL management", "owns_data": "file_metadata", "communicates_with": ["transfer-service"]},
                {"module": "transfer-service", "responsibility": f"Chunk upload streaming and object storage integration", "owns_data": "storage_chunks", "communicates_with": ["metadata-service"]},
            ]
        }

    # Generic Fallback (Dynamically Uses proj_name)
    else:
        title = proj_name
        return {
            "architecture_summary": f"{title} — Modular enterprise solution designed for high availability, domain isolation, and horizontal cloud scalability.",
            "pattern": "Modular Enterprise Architecture",
            "microservices": [
                {"name": f"{title.lower().replace(' ', '-')}-gateway", "responsibility": f"API routing and ingress security for {title}", "technology": "FastAPI / Nginx", "port": 8000},
                {"name": f"{title.lower().replace(' ', '-')}-engine", "responsibility": f"Core domain business logic and workflow execution for {title}", "technology": "FastAPI / Python", "port": 8001},
                {"name": f"{title.lower().replace(' ', '-')}-store", "responsibility": f"Data persistence and query optimization for {title}", "technology": "PostgreSQL 15", "port": 8002},
            ],
            "components": [
                {"name": f"{title} Web UI", "type": "frontend", "technology": "React 18 + Vite + TypeScript", "responsibility": f"Provides the user interface for {title} workflows and interactions"},
                {"name": f"{title} API Gateway", "type": "gateway", "technology": "Nginx / FastAPI Gateway", "responsibility": f"Routes all external requests into {title} backend services with auth and rate control"},
                {"name": f"{title} Core Engine", "type": "backend", "technology": "FastAPI (Python 3.12)", "responsibility": f"Executes core domain business logic and orchestrates {title} workflows"},
                {"name": f"{title} Relational DB", "type": "database", "technology": "PostgreSQL 15", "responsibility": f"Persists all domain entities, transactional records, and audit logs for {title}"},
            ],
            "diagrams": [
                {"type": "system_context", "content": f"graph TD\n  User-->|HTTPS|UI[\"{title} Web UI\"]\n  UI-->|REST|Gateway[\"API Gateway\"]\n  Gateway-->|Route|Core[\"Core Engine\"]\n  Core-->DB[(PostgreSQL DB)]"},
                {"type": "sequence", "content": f"sequenceDiagram\n  User->>UI: Submit Action\n  UI->>API Gateway: POST /api/v1/action\n  API Gateway->>Core Engine: Validate & Process Request\n  Core Engine->>PostgreSQL DB: Execute Transactional Query\n  PostgreSQL DB-->>Core Engine: Confirm Commit\n  Core Engine-->>API Gateway: Structured Response\n  API Gateway-->>User: HTTP 200 OK"},
            ],
            "tech_stack": {
                "frontend": "React 18, Vite, TypeScript, TailwindCSS",
                "backend": "FastAPI (Python 3.12)",
                "database": "PostgreSQL 15",
                "auth": "OAuth2 / OIDC, Bearer JWT, TLS 1.3",
                "deployment": "Docker Compose / Cloud Container Deployment",
            },
            "architecture_decisions": [
                {"decision": f"Domain-driven modular service separation for {title}",
                 "rationale": f"Enforces clean boundaries between presentation, core logic, and persistence layers in {title}.",
                 "alternatives_considered": "Tightly coupled monolithic design; rejected due to maintenance overhead.",
                 "consequences": "Clear code organization and simplified testing."},
            ],
            "design_principles": [
                f"Stateless application tier enabling horizontal scaling for {title}.",
                f"Single source of truth per domain entity in {title}."
            ],
            "scalability_strategy": f"Stateless application services scale horizontally behind cloud load balancers for {title}.",
            "security_considerations": f"All API traffic encrypted with TLS 1.3; OAuth2 token verification enforced at API Gateway for {title}.",
            "performance_strategy": f"Sub-50ms API latency target supported by index-optimized database queries for {title}.",
            "deployment_strategy": f"Automated containerized release pipelines with zero-downtime rolling updates for {title}.",
            "communication_flow": f"User requests enter through API Gateway, are processed by Core Engine, and persisted in PostgreSQL DB for {title}.",
            "module_responsibilities": [
                {"module": f"{title.lower().replace(' ', '-')}-gateway", "responsibility": f"Ingress traffic management for {title}", "owns_data": "none", "communicates_with": ["core-engine"]},
                {"module": f"{title.lower().replace(' ', '-')}-engine", "responsibility": f"Domain business logic processing for {title}", "owns_data": "domain_entities", "communicates_with": ["gateway"]},
            ]
        }


# Dynamic property compatibility alias
class _MockArchitectureProxy(dict):
    def __getitem__(self, item):
        return get_mock_architecture_for_project().get(item)

    def get(self, key, default=None):
        return get_mock_architecture_for_project().get(key, default)

    def keys(self):
        return get_mock_architecture_for_project().keys()

    def values(self):
        return get_mock_architecture_for_project().values()

    def items(self):
        return get_mock_architecture_for_project().items()


MOCK_ARCHITECTURE = _MockArchitectureProxy()


def build_architecture_prompt(context: str) -> str:
    return f"""
Project Context:
{context}

Generate the architecture output now.
"""


class ArchitectAgent:
    def __init__(self, llm: LLMService | None = None, *, db=None, project_id: int | None = None):
        self.llm = llm or LLMService(db=db, project_id=project_id, role="architect")

    def run(self, context: str) -> ArchitectAgentOutput:
        if not context.strip():
            raise ValueError("Architecture context cannot be empty")

        result = self.llm.generate_json(
            system=SOLUTION_ARCHITECT_SYSTEM_PROMPT,
            prompt=build_architecture_prompt(context),
            schema=ArchitectAgentOutput,
        )

        if not result or not result.architecture_summary:
            raise ValueError("No architecture generated")

        return result

    @classmethod
    def generate(cls, db, project_id: int, context: str) -> dict[str, Any]:
        """Orchestrator-facing entrypoint: `ArchitectAgent.generate(db, project_id, context)`.
        Preserves the exact contract/behavior previously implemented inline in
        ai_service.generate_architecture."""
        from ...models import DEMO_MODE
        from ...ai_service import AIGenerationError

        if DEMO_MODE:
            return get_mock_architecture_for_project(context)
        try:
            # The enterprise blueprint schema (architecture decisions, two full
            # tech-stack options, module responsibilities, etc.) is intentionally
            # large — give it a generous timeout instead of the 60s default so it
            # doesn't spuriously fall back to the mock on a heavy local model.
            # This runs as a background pipeline task, not on the request thread,
            # so the longer timeout doesn't block the UI.
            agent = cls(llm=LLMService(db=db, project_id=project_id, role="architect", timeout=170))
            result = agent.run(context)
            return result.model_dump() if hasattr(result, "model_dump") else result
        except Exception as exc:
            logger.error("[ArchitectAgent] generate failed: %s", exc)
            raise AIGenerationError(f"Architecture generation failed: {exc}") from exc
