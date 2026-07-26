"""
agents/ba/copilot_agent.py
===========================
Processes user prompts for Business Analyst Copilot, generating added, modified,
and deleted user stories while preserving the enterprise-grade workspace schema.
"""
from __future__ import annotations

import json
from typing import Any
from ...logging_config import get_logger
from ..llm_service import LLMService

logger = get_logger(__name__)

BA_COPILOT_SYSTEM_PROMPT = """
You are the Business Analyst Copilot, an expert Lead Business Analyst and Agile Product Owner.
Your task is to analyze the user's instructions and the current BA Workspace (user stories, epics, personas, BRD), and propose mutations (Additions, Modifications, Deletions) to the user stories and epics.

You must output a strictly structured JSON object conforming to the following schema:
{
  "message": "Detailed explanation of the proposed BA changes.",
  "summary": "Reasoning summary of the changes.",
  "added_stories": [
    {
      "id": "STORY-080",
      "epic_id": "EPIC-01",
      "title": "Clear user story title",
      "user_persona": "Customer / Administrator",
      "user_action": "action to perform",
      "business_benefit": "expected value",
      "priority": "Must",
      "acceptance_criteria": [
        "Given context, When action occurs, Then expected behavior"
      ],
      "estimated_story_points": 5,
      "risk_level": "Low"
    }
  ],
  "modified_stories": [],
  "deleted_story_ids": [],
  "warnings": [],
  "impact_analysis": {
    "what_changed": "Summary of changes made.",
    "why_it_changed": "Business rationale.",
    "affected_epics": ["EPIC-01"],
    "affected_stories": ["STORY-080"],
    "downstream_impact": "Impact on solution architecture and UI/UX design."
  }
}
"""

class BACopilotAgent:
    def __init__(self, db=None, project_id: int | None = None):
        self.db = db
        self.project_id = project_id
        self.llm = LLMService(db=db, project_id=project_id, role="business_analyst")

    def process_prompt(self, current_doc: dict[str, Any], prompt: str) -> dict[str, Any]:
        from ...models import DEMO_MODE

        # Smart mock logic for demo mode or LLM fallback
        p_lower = prompt.lower()
        
        if DEMO_MODE or not getattr(self.llm, "is_configured", True):
            if "acceptance" in p_lower or "criteria" in p_lower or "improve" in p_lower:
                return {
                    "message": "Improved acceptance criteria for all user stories with Given-When-Then formal validation syntax.",
                    "summary": "Refined acceptance criteria to follow Gherkin BDD standards for automated QA test generation.",
                    "added_stories": [
                        {
                            "id": "STORY-101",
                            "epic_id": "EPIC-01",
                            "title": "Enhanced Biometric & OTP Verification",
                            "user_persona": "Mobile App User",
                            "user_action": "authenticate using FaceID or 6-digit OTP",
                            "business_benefit": "prevent fraudulent transactions and reduce sign-in friction",
                            "priority": "Must",
                            "acceptance_criteria": [
                                "Given a registered mobile user on the login screen, When they scan FaceID or enter a valid 6-digit OTP, Then access is granted within 800ms.",
                                "Given 3 consecutive invalid OTP attempts, When the user tries again, Then the account is locked for 15 minutes and security is alerted."
                            ],
                            "estimated_story_points": 5,
                            "risk_level": "Medium"
                        }
                    ],
                    "modified_stories": [
                        {
                            "id": "STORY-001",
                            "epic_id": "EPIC-01",
                            "title": "User Registration & Identity Verification",
                            "acceptance_criteria": [
                                "Given a new user on the registration page, When valid email and password are submitted, Then a verification link is dispatched immediately.",
                                "Given an unverified email address, When the user logs in, Then a verification prompt blocks access to financial transactions."
                            ]
                        }
                    ],
                    "deleted_story_ids": [],
                    "warnings": ["Enhanced security validation requires SMS API vendor integration."],
                    "impact_analysis": {
                        "what_changed": "Refined acceptance criteria and added 1 high-priority security story.",
                        "why_it_changed": "Align user story specifications with enterprise BDD guidelines.",
                        "affected_epics": ["EPIC-01"],
                        "affected_stories": ["STORY-001", "STORY-101"],
                        "downstream_impact": "Enables direct import into automated Cucumber test suite."
                    }
                }
            elif "ieee" in p_lower or "convert" in p_lower or "format" in p_lower:
                return {
                    "message": "Converted user stories and functional specifications to standard IEEE 830 / ISO 29148 format.",
                    "summary": "Formatted user story statements, priority metrics, and boundary constraints into IEEE standard notation.",
                    "added_stories": [
                        {
                            "id": "STORY-102",
                            "epic_id": "EPIC-02",
                            "title": "IEEE 830 Standard Audit Logging & Compliance",
                            "user_persona": "Compliance Officer",
                            "user_action": "export immutable system audit logs in PDF/CSV format",
                            "business_benefit": "satisfy regulatory audit trails and ISO 27001 data governance",
                            "priority": "Must",
                            "acceptance_criteria": [
                                "Given an authorized compliance auditor, When an audit log report is requested for a date range, Then a cryptographically signed CSV is generated within 3 seconds."
                            ],
                            "estimated_story_points": 8,
                            "risk_level": "Low"
                        }
                    ],
                    "modified_stories": [],
                    "deleted_story_ids": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": "Converted 100% of user story specifications to IEEE 830 compliant structure.",
                        "why_it_changed": "Standardize specification artifacts for regulatory sign-off.",
                        "affected_epics": ["EPIC-02"],
                        "affected_stories": ["STORY-102"],
                        "downstream_impact": "Streamlines BRD PDF and SRS PDF compilation."
                    }
                }
            else:
                return {
                    "message": f"Processed BA Copilot instruction: '{prompt}'. Proposed additions and modifications ready for review.",
                    "summary": "Analyzed user stories and updated acceptance criteria and story point estimates.",
                    "added_stories": [
                        {
                            "id": "STORY-103",
                            "epic_id": "EPIC-01",
                            "title": "Automated Notification System",
                            "user_persona": "System Admin",
                            "user_action": "configure real-time email and push notifications",
                            "business_benefit": "keep users informed of critical status updates",
                            "priority": "Should",
                            "acceptance_criteria": [
                                "Given a status event trigger, When threshold is exceeded, Then notification is sent within 5 seconds."
                            ],
                            "estimated_story_points": 3,
                            "risk_level": "Low"
                        }
                    ],
                    "modified_stories": [],
                    "deleted_story_ids": [],
                    "warnings": [],
                    "impact_analysis": {
                        "what_changed": "Added 1 story for automated notification delivery.",
                        "why_it_changed": "Fulfill user request.",
                        "affected_epics": ["EPIC-01"],
                        "affected_stories": ["STORY-103"],
                        "downstream_impact": "Requires SMTP server configuration."
                    }
                }

        # Live LLM execution when API key is configured
        try:
            raw_response = self.llm.generate_json(
                system_prompt=BA_COPILOT_SYSTEM_PROMPT,
                prompt=f"Current BA Artifact:\n{json.dumps(current_doc, indent=2)}\n\nUser Instruction:\n{prompt}"
            )
            return raw_response
        except Exception as e:
            logger.error(f"Error executing BA Copilot LLM: {e}")
            return {
                "message": f"Processed request: '{prompt}'",
                "summary": "Proposed enhancements ready.",
                "added_stories": [],
                "modified_stories": [],
                "deleted_story_ids": [],
                "warnings": [f"LLM call fallback: {e}"],
                "impact_analysis": {
                    "what_changed": "No structural changes.",
                    "why_it_changed": "Fallback response.",
                    "affected_epics": [],
                    "affected_stories": [],
                    "downstream_impact": "None"
                }
            }
