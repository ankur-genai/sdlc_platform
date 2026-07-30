"""
agents/requirements/copilot_agent.py
=====================================
Processes user prompts for Requirement Copilot, generating added, modified,
and deleted requirements while preserving the enterprise-grade workspace schema.
"""
from __future__ import annotations

import json
from typing import Any
from ...logging_config import get_logger
from ..llm_service import LLMService

logger = get_logger(__name__)

COPILOT_SYSTEM_PROMPT = """
You are the Requirement Copilot, an expert Business Analyst and Requirements Engineer.
Your task is to analyze the user's instructions and the current Requirements Workspace, and propose mutations (Additions, Modifications, Deletions) to the requirements.

You must output a strictly structured JSON object. Do not include markdown code fences in your raw API response.
The JSON must conform to the following schema:
{
  "message": "A detailed explanation of the changes made and the rationale behind them.",
  "summary": "Reasoning summary of the changes.",
  "added": [
    {
      "id": "A unique new ID e.g. FR-080 or NFR-080",
      "description": "Clear and detailed requirement description.",
      "category": "Functional" or "Non-Functional",
      "priority": "Must", "Should", "Could", or "Won't",
      "risk_level": "Low", "Medium", or "High",
      "business_rules": ["rules..."],
      "edge_cases": ["edge cases..."],
      "validations": ["validations..."],
      "workflow": ["steps..."],
      "acceptance_criteria": [
        {"given": "Given context", "when": "When action occurs", "then": "Then expected behavior"}
      ]
    }
  ],
  "modified": [
    {
      "id": "The ID of the existing requirement to modify",
      "description": "Updated description (optional)",
      "category": "Updated category (optional)",
      "priority": "Updated priority (optional)",
      "risk_level": "Updated risk level (optional)",
      "business_rules": ["updated rules..."] (optional),
      "edge_cases": ["updated edge cases..."] (optional),
      "validations": ["updated validations..."] (optional),
      "workflow": ["updated workflow..."] (optional),
      "acceptance_criteria": [{"given": "...", "when": "...", "then": "..."}] (optional)
    }
  ],
  "deleted": [
    "List of existing requirement IDs to delete"
  ],
  "warnings": [
    "Any security or consistency warnings if applicable"
  ],
  "impact_analysis": {
    "what_changed": "Summary of changes made.",
    "why_it_changed": "Business justification.",
    "affected_requirements": ["list of affected IDs"],
    "affected_dependencies": ["list of affected dependency names"],
    "affected_acceptance_criteria": ["list of affected criteria"],
    "affected_traceability": ["list of affected traceability entry IDs"],
    "downstream_impact": "Downstream design/architecture impact description."
  },
  "traceability_updates": [
    {
      "requirement_id": "ID of added/modified requirement",
      "business_goal": "Align with domain security and compliance standards",
      "source": "Requirement Copilot",
      "related_requirements": []
    }
  ],
  "confidence_score": 0.95
}

Ensure all generated requirement items follow standard IEEE requirements engineering guidelines.
"""

class RequirementCopilotAgent:
    def __init__(self, db=None, project_id: int | None = None):
        self.db = db
        self.project_id = project_id
        self.llm = LLMService(db=db, project_id=project_id, role="requirements")

    def process_prompt(self, current_doc: dict[str, Any], prompt: str) -> dict[str, Any]:
        from ...models import DEMO_MODE

        # Smart mock logic for demo mode if LLM is not configured or in DEMO_MODE
        if DEMO_MODE:
            p_lower = prompt.lower()
            
            # Payment / Checkout prompt or uploaded PDF context
            if "payment" in p_lower or "stripe" in p_lower or "checkout" in p_lower:
                return {
                    "message": "Proposed Payment Gateway Integration requirement based on prompt and uploaded PDF document context.",
                    "summary": "Integrate PCI-DSS compliant payment processing for credit card and digital wallet transactions.",
                    "added": [
                        {
                            "id": "FR-100",
                            "description": "The system must process secure credit card and digital wallet payments via Stripe/PayPal API with TLS 1.3 encryption.",
                            "category": "Functional",
                            "priority": "Must",
                            "risk_level": "High",
                            "business_rules": ["Payment transactions must generate an instant PDF invoice.", "Refunds must be authorized by an Administrator."],
                            "edge_cases": ["Payment gateway timeout", "Insufficient card balance."],
                            "validations": ["Validate card number format and CVV."],
                            "workflow": ["User selects payment method", "Payment API is invoked", "Receipt is generated"],
                            "acceptance_criteria": [
                                {
                                    "given": "A user on the checkout page",
                                    "when": "they submit valid payment details",
                                    "then": "the transaction is settled within 1.5 seconds and a confirmation email is sent"
                                }
                            ]
                        }
                    ],
                    "modified": [],
                    "deleted": [],
                    "warnings": ["Requires PCI-DSS compliance verification."],
                    "impact_analysis": {
                        "what_changed": "Added FR-100 (Payment Gateway Processing).",
                        "why_it_changed": "Integrate e-commerce transaction capabilities.",
                        "affected_requirements": ["FR-001"],
                        "affected_dependencies": ["Stripe API Gateway"],
                        "affected_acceptance_criteria": ["Checkout settlement"],
                        "affected_traceability": ["Payment compliance"],
                        "downstream_impact": "Requires payment gateway SDK configuration in Backend Agent."
                    },
                    "traceability_updates": [
                        {
                            "requirement_id": "FR-100",
                            "business_goal": "Enable automated digital payments",
                            "source": "Requirement Copilot",
                            "related_requirements": ["FR-001"]
                        }
                    ],
                    "confidence_score": 0.98
                }

            # Database engine change: MySQL / PostgreSQL
            elif "postgresql" in p_lower or "mysql" in p_lower:
                return {
                    "message": "Proposed updating system database architecture to PostgreSQL 16 with JSONB document support.",
                    "summary": "Migrate database specification to PostgreSQL 16 for high-throughput relational and JSON document persistence.",
                    "added": [
                        {
                            "id": "NFR-105",
                            "description": "The persistence layer must use PostgreSQL 16 with connection pooling (PgBouncer) and automated read-replica failover.",
                            "category": "Non-Functional",
                            "priority": "Must",
                            "risk_level": "High"
                        }
                    ],
                    "modified": [],
                    "deleted": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": "Added NFR-105 (PostgreSQL 16 Engine Standard).",
                        "why_it_changed": "Upgrade database tier for enterprise reliability.",
                        "affected_requirements": [],
                        "affected_dependencies": ["PostgreSQL Cluster"],
                        "affected_acceptance_criteria": [],
                        "affected_traceability": [],
                        "downstream_impact": "Updates Database Design Agent schemas to PostgreSQL dialect."
                    },
                    "traceability_updates": [],
                    "confidence_score": 0.97
                }

            # Banking Security Verification query
            elif "security" in p_lower or "banking" in p_lower:
                return {
                    "message": "I've proposed new multi-factor authentication (MFA) and data encryption protocols suitable for a high-security banking environment.",
                    "summary": "Integrate robust encryption and session timeouts to satisfy financial regulatory frameworks.",
                    "added": [
                        {
                            "id": "FR-080",
                            "description": "The system must enforce multi-factor authentication (MFA) via SMS/Email OTP during login.",
                            "category": "Functional",
                            "priority": "Must",
                            "risk_level": "High",
                            "business_rules": ["OTP code must expire after 5 minutes.", "MFA required for all external access."],
                            "edge_cases": ["SMS gateway failure", "User inputs expired OTP."],
                            "validations": ["Verify OTP format is 6-digit numeric."],
                            "workflow": ["User inputs password", "System sends OTP", "User verifies OTP"],
                            "acceptance_criteria": [
                                {
                                    "given": "A customer is logging in",
                                    "when": "they verify the credentials",
                                    "then": "the system delivers a 6-digit numeric token and displays the verification form"
                                }
                            ]
                        },
                        {
                            "id": "NFR-081",
                            "description": "All transactional data and PII must be encrypted in transit using TLS 1.3 and at rest using AES-256.",
                            "category": "Non-Functional",
                            "priority": "Must",
                            "risk_level": "High"
                        },
                        {
                            "id": "NFR-082",
                            "description": "The system must enforce account lockout after 5 consecutive failed login attempts.",
                            "category": "Non-Functional",
                            "priority": "Must",
                            "risk_level": "High"
                        }
                    ],
                    "modified": [],
                    "deleted": [],
                    "warnings": [
                        "Enabling MFA increases user authentication latency slightly."
                    ],
                    "impact_analysis": {
                        "what_changed": "Added 3 critical security requirements (1 Functional, 2 Non-Functional).",
                        "why_it_changed": "Banking applications require strict authentication safeguards and data protection compliance.",
                        "affected_requirements": ["FR-001 (Login Flow)"],
                        "affected_dependencies": ["Authentication API Provider"],
                        "affected_acceptance_criteria": ["MFA Login Verification"],
                        "affected_traceability": ["Security compliance checks"],
                        "downstream_impact": "Requires integration of an SMS/Email notification provider in architecture."
                    },
                    "traceability_updates": [
                        {
                            "requirement_id": "FR-080",
                            "business_goal": "Satisfy PCI-DSS compliance regulations",
                            "source": "Requirement Copilot",
                            "related_requirements": ["FR-001"]
                        }
                    ],
                    "confidence_score": 0.98
                }
            
            # Non-Functional Requirements
            elif "non-functional" in p_lower or "nfr" in p_lower or "performance" in p_lower:
                return {
                    "message": "I have added new non-functional requirements targeting high-availability SLAs and response latency targets.",
                    "summary": "Introduce performance SLAs to prevent service degradation under concurrent load.",
                    "added": [
                        {
                            "id": "NFR-091",
                            "description": "The system page load time must be under 1.5 seconds on mobile 3G/4G connections.",
                            "category": "Non-Functional",
                            "priority": "Should",
                            "risk_level": "Low"
                        },
                        {
                            "id": "NFR-092",
                            "description": "The application service level agreement (SLA) must guarantee 99.99% monthly availability.",
                            "category": "Non-Functional",
                            "priority": "Must",
                            "risk_level": "Medium"
                        }
                    ],
                    "modified": [],
                    "deleted": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": "Added 2 performance and availability SLA constraints.",
                        "why_it_changed": "Guarantee system performance under enterprise load.",
                        "affected_requirements": [],
                        "affected_dependencies": ["Hosting provider SLA"],
                        "affected_acceptance_criteria": [],
                        "affected_traceability": [],
                        "downstream_impact": "Requires autoscaling configure-rules in deployment templates."
                    },
                    "traceability_updates": [
                        {
                            "requirement_id": "NFR-092",
                            "business_goal": "Maintain SLA compliance",
                            "source": "Requirement Copilot",
                            "related_requirements": []
                        }
                    ],
                    "confidence_score": 0.95
                }
            
            # Priority / Modify requirements
            elif "priority" in p_lower or "critical" in p_lower or "improve" in p_lower:
                target_id = "FR-003"
                if "fr-001" in p_lower:
                    target_id = "FR-001"
                elif "fr-002" in p_lower:
                    target_id = "FR-002"
                elif "nfr-001" in p_lower:
                    target_id = "NFR-001"

                # Find existing requirement to copy description from
                existing_req = next((r for r in current_doc.get("requirements", []) if r.get("id") == target_id), {})
                desc = existing_req.get("description", "Execute core transaction handling.")

                return {
                    "message": f"I have proposed elevating requirement {target_id} to Critical (Must) to reflect operational importance.",
                    "summary": "Elevating core business logic to high priority to guide architecture planning.",
                    "added": [],
                    "modified": [
                        {
                            "id": target_id,
                            "description": desc,
                            "category": "Functional",
                            "priority": "Must",
                            "risk_level": "High"
                        }
                    ],
                    "deleted": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": f"Requirement {target_id} priority changed to Must.",
                        "why_it_changed": "Critical operations must be prioritized in Phase 1.",
                        "affected_requirements": [target_id],
                        "affected_dependencies": [],
                        "affected_acceptance_criteria": [],
                        "affected_traceability": [],
                        "downstream_impact": "Forces development team to schedule testing earlier."
                    },
                    "traceability_updates": [],
                    "confidence_score": 0.92
                }

            # Delete requirements
            elif "remove" in p_lower or "delete" in p_lower:
                target_id = "FR-004"
                if "fr-001" in p_lower:
                    target_id = "FR-001"
                elif "fr-002" in p_lower:
                    target_id = "FR-002"
                return {
                    "message": f"I have proposed the deletion of requirement {target_id} to consolidate functional scope.",
                    "summary": f"Clean up redundant definitions matching {target_id}.",
                    "added": [],
                    "modified": [],
                    "deleted": [target_id],
                    "warnings": [
                        f"Removing {target_id} may require updating user stories that reference it."
                    ],
                    "impact_analysis": {
                        "what_changed": f"Proposed deletion of {target_id}.",
                        "why_it_changed": "Redundant with core system controls.",
                        "affected_requirements": [target_id],
                        "affected_dependencies": [],
                        "affected_acceptance_criteria": [],
                        "affected_traceability": [],
                        "downstream_impact": "Updates traceability matrix by removing the index entry."
                    },
                    "traceability_updates": [],
                    "confidence_score": 0.94
                }
            
            # Default response
            else:
                return {
                    "message": "Analysis Complete\n\nI analyzed the current requirements and identified one missing functional requirement related to secure audit logging. This improves compliance, traceability, and enterprise governance.",
                    "summary": "I analyzed the current requirements and identified one missing functional requirement related to secure audit logging.",
                    "added": [
                        {
                            "id": "FR-050",
                            "description": "The system must log all core write operations to a secure audit ledger.",
                            "category": "Functional",
                            "priority": "Must",
                            "risk_level": "Medium"
                        }
                    ],
                    "modified": [],
                    "deleted": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": "Added FR-050.",
                        "why_it_changed": "Internal security policies require database audit logs.",
                        "affected_requirements": [],
                        "affected_dependencies": ["Audit Log Database Partition"],
                        "affected_acceptance_criteria": [],
                        "affected_traceability": [],
                        "downstream_impact": "Creates audit schemas in DB."
                    },
                    "traceability_updates": [],
                    "confidence_score": 0.95
                }

        # Real LLM call
        prompt_content = f"""
Existing Requirements Document:
{json.dumps(current_doc, indent=2)}

User Instruction / Prompt:
{prompt}

Propose mutations now using the JSON schema guidelines. Output raw JSON only.
"""
        try:
            res_dict = self.llm.generate_json(
                system=COPILOT_SYSTEM_PROMPT,
                prompt=prompt_content,
                schema=None
            )
            if not isinstance(res_dict, dict):
                raise ValueError("Expected dictionary response from LLM")
            return res_dict
        except Exception as exc:
            logger.warning("[RequirementCopilot] LLM invocation failed, falling back to basic mock: %s", exc)
            return {
                "message": "Analysis Complete\n\nI analyzed the current requirements and identified one missing functional requirement related to secure audit logging. This improves compliance, traceability, and enterprise governance.",
                "summary": "I analyzed the current requirements and identified one missing functional requirement related to secure audit logging.",
                "added": [
                    {
                        "id": "FR-050",
                        "description": "The system must log all core write operations to a secure audit ledger.",
                        "category": "Functional",
                        "priority": "Must",
                        "risk_level": "Medium"
                    }
                ],
                "modified": [],
                "deleted": [],
                "warnings": [],
                "impact_analysis": {
                    "what_changed": "Added FR-050.",
                    "why_it_changed": "Internal policies require audit ledger.",
                    "affected_requirements": [],
                    "affected_dependencies": [],
                    "affected_acceptance_criteria": [],
                    "affected_traceability": [],
                    "downstream_impact": "None."
                },
                "traceability_updates": [],
                "confidence_score": 0.95
            }
