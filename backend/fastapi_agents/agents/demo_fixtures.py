# -*- coding: utf-8 -*-
"""
demo_fixtures.py
================
Centralized Context-Aware Demo Mode fixture engine.
Uses intelligent domain classification (Healthcare, Banking, ERP, E-commerce,
Education, CRM, HRMS, Logistics, Manufacturing, Government, etc.) by analyzing
project name, description, uploaded documents, and existing requirements.
"""
import re
from typing import Any


def classify_domain(db, project_id: int) -> str:
    """Analyze project context to determine the closest business domain."""
    if not db or not project_id:
        return "general"
    try:
        from ..models import Project, Document, GeneratedArtifact
        project = db.get(Project, project_id)
        if not project:
            return "general"

        title = (project.name or "").lower()
        description = (project.description or "").lower()
        text_content = f"{title} {description}"

        # Append document file names
        docs = db.query(Document).filter(Document.project_id == project_id).all()
        for doc in docs:
            text_content += f" {doc.file_name.lower()}"

        # Append existing requirements artifact content
        req_art = db.query(GeneratedArtifact).filter(
            GeneratedArtifact.project_id == project_id,
            GeneratedArtifact.artifact_type == "requirements"
        ).first()
        if req_art and req_art.content:
            text_content += f" {req_art.content[:2000].lower()}"

        domains = {
            "healthcare": ["hospital", "clinic", "health", "patient", "medical", "doctor",
                           "ehr", "emr", "prescription", "pharmacy", "care", "diagnosis", "nurse"],
            "banking": ["bank", "banking", "finance", "payment", "card", "billing",
                        "checking", "savings", "transaction", "credit", "ledger", "loan", "deposit"],
            "erp": ["erp", "enterprise resource", "inventory", "supply chain", "purchasing",
                    "procurement", "asset", "warehouse", "stock", "supplier"],
            "ecommerce": ["shop", "ecommerce", "store", "market", "cart", "retail", "commerce",
                          "checkout", "stripe", "order", "catalog", "sales", "product"],
            "education": ["college", "school", "student", "university", "academic", "education",
                          "course", "grade", "transcript", "teacher", "registrar", "ferpa"],
            "crm": ["crm", "customer relationship", "lead", "deal", "pipeline", "salesforce",
                    "customer support", "contact", "account manager"],
            "hrms": ["hrms", "hr", "payroll", "employee", "hiring", "recruitment",
                     "attendance", "onboarding", "staff", "vacation"],
            "logistics": ["logistics", "fleet", "delivery", "route", "dispatch", "vehicle",
                          "shipment", "carrier", "tracking", "driver", "transport"],
            "manufacturing": ["manufacturing", "factory", "shop floor", "assembly", "production",
                              "mrp", "bill of materials", "bom", "quality control", "machinery"],
            "government": ["government", "citizen", "municipality", "public sector", "agency",
                           "regulation", "permit", "compliance", "tax", "license"],
        }

        scores = {dom: sum(text_content.count(kw) for kw in kws) for dom, kws in domains.items()}
        best_domain = max(scores, key=scores.get)
        return best_domain if scores[best_domain] > 0 else "general"
    except Exception as e:
        print("CLASSIFY DOMAIN ERROR:", e)
        import traceback
        traceback.print_exc()
        return "general"


def infer_domain_keywords(project_name: str) -> dict:
    """Extract meaningful subject keywords from a project name."""
    words = [w.strip() for w in re.split(r'\s+|_|-', project_name) if len(w) > 2]
    stop_words = {
        "management", "system", "platform", "portal", "erp", "software", "tool",
        "app", "application", "service", "utility", "manager", "builder", "generator",
        "autonomous", "the", "and", "for", "with"
    }
    keywords = [w for w in words if w.lower() not in stop_words]
    if not keywords:
        keywords = ["Project", "Record"]
    subject = " ".join(keywords)
    primary = keywords[-1].capitalize() if keywords else "System"
    secondary = keywords[-2].capitalize() if len(keywords) >= 2 else "Record"
    return {"subject": subject, "primary": primary, "secondary": secondary}


def get_project_name(db, project_id: int) -> str:
    if db and project_id:
        try:
            from ..models import Project
            p = db.get(Project, project_id)
            if p and p.name:
                return p.name
        except Exception:
            pass
    return "Autonomous Software Studio"


# ---------------------------------------------------------------------------
# 1. Requirements
# ---------------------------------------------------------------------------
def build_complete_requirements_payload(proj_name, domain, requirements, assumptions, risks):
    from datetime import datetime
    info = infer_domain_keywords(proj_name)
    subject = info.get("subject", "system parameters")
    primary = info.get("primary", "Record")
    secondary = info.get("secondary", "Workflow")
    
    # 1. Executive Summary
    overview = (
        f"This document represents the official Software Requirements Specification (SRS) for the {proj_name} system. "
        f"Operating in the {domain.capitalize()} workspace, this platform is designed to govern and automate the workflow of {subject}. "
        f"It establishes high-performance data checkpoints and secure system controls to reduce transaction cycle time, "
        f"mitigate compliance risks, and guarantee audit availability."
    )
    problem_statement = (
        f"The current operational flow for {proj_name} is hampered by manual coordination, data latency, and fragmented validation gates. "
        f"Without an integrated solution, stakeholders face administrative overhead, potential compliance infractions in the {domain.capitalize()} workspace, "
        f"and lack a central, immutable ledger of all state transitions."
    )
    proposed_solution = (
        f"The {proj_name} platform implements a cloud-native modular architecture comprising a React SPA frontend portal, "
        f"a secure API service layer, and a highly redundant persistence database. The platform automatically enforces validation rules "
        f"and authorization scopes to protect core write operations."
    )
    scope = {
        "in_scope": [
            f"Multi-factor authentication and role assignment rules in {proj_name}.",
            f"Automated verification of {primary} modifications and state updates.",
            f"Immutable audit trails and log search queries for {secondary} objects."
        ],
        "out_of_scope": [
            f"Legacy data cleansing or off-site synchronization outside the standard {domain.capitalize()} boundary.",
            f"Direct physical hosting configuration or hardware provisioning for {proj_name} servers."
        ]
    }
    business_objectives = [
        f"Reduce administrative validation errors in {primary} tracking by at least 95%.",
        f"Ensure 100% compliance with security regulations required in the {domain.capitalize()} workspace.",
        f"Improve data accessibility by offering real-time queries of all active {secondary} items.",
        f"Establish a secure, tamper-evident audit ledger for every write event."
    ]
    expected_outcome = (
        f"A robust, fully-auditable platform for {proj_name} that eliminates human error in {primary} validation "
        f"and guarantees continuous alignment with compliance standards."
    )
    
    # 2. Stakeholders
    stakeholders = [
        {"role": f"{domain.capitalize()} Director", "responsibility": f"Strategic planning, business validation, and document sign-off.", "approval_authority": True},
        {"role": f"{primary} Specialist", "responsibility": f"Daily data input, manual inspections, and log reviews.", "approval_authority": False},
        {"role": "Security Compliance Officer", "responsibility": f"Audit review, access control overrides validation, and compliance verification.", "approval_authority": True}
    ]
    
    # 3. User Roles
    user_roles = [
        {"name": f"{primary} Auditor", "description": f"Verifies compliance and audits transaction logs.", "permissions": [f"Read {primary}", "Export report"]},
        {"name": f"{secondary} Supervisor", "description": f"Configures operational parameters and system rules.", "permissions": [f"Edit {primary}", f"Update {secondary}", "Approve override"]}
    ]
    
    # 4. Traceability
    traceability = []
    for idx, r in enumerate(requirements):
        req_id = r.get("id", f"FR-{idx+1:03d}")
        traceability.append({
            "requirement_id": req_id,
            "business_goal": f"Serve goal: {business_objectives[idx % len(business_objectives)]}",
            "source": "Elicitation Workshops",
            "related_requirements": [requirements[(idx+1)%len(requirements)]["id"]] if len(requirements) > 1 else []
        })
        
    # 5. Error Scenarios
    error_scenarios = []
    for idx, r in enumerate(requirements[:3]):
        req_id = r.get("id", f"FR-{idx+1:03d}")
        error_scenarios.append({
            "requirement_id": req_id,
            "scenario": f"Database connection timeout during {req_id} execution.",
            "expected_behavior": "Roll back current database transaction, write an error log entry, and return a 503 response to the frontend client."
        })
        
    # 6. Revision History
    revision_history = [
        {"version": "1.0", "date": datetime.now().strftime("%B %d, %Y"), "description": "Initial Requirements Synthesis", "author": "EY Autonomous SDLC Studio"}
    ]
    
    # 7. Additional dependencies
    dependencies = [
        f"Active connection to standard cloud authentication gateways.",
        f"Configured SMTP server for email notifications on critical events."
    ]
    
    # 8. Constraints
    constraints = [
        "Database layer must run PostgreSQL 15 or higher.",
        "Strict adherence to SOC 2 Type II controls within the environment."
    ]
    
    return {
        "executive_summary": {
            "overview": overview,
            "problem_statement": problem_statement,
            "proposed_solution": proposed_solution,
            "scope": scope,
            "business_objectives": business_objectives,
            "expected_outcome": expected_outcome
        },
        "stakeholders": stakeholders,
        "assumptions": assumptions,
        "constraints": constraints,
        "requirements": requirements,
        "risks": risks,
        "dependencies": dependencies,
        "user_roles": user_roles,
        "traceability": traceability,
        "error_scenarios": error_scenarios,
        "revision_history": revision_history
    }


def get_requirements(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        reqs = [
            {
                "id": "FR-001",
                "title": "HIPAA-Compliant Patient Authentication Gateway",
                "description": "The platform MUST provide a secure registration and single sign-on authentication gateway for patients conforming to HIPAA and HITECH security standards. The system must enforce multi-factor authentication (MFA) via SMS or Email OTP, encrypt sensitive patient identifiers at rest using AES-256, and maintain immutable access logs for every login event. Accounts must automatically lock out after 5 consecutive invalid authentication attempts to prevent brute-force intrusion.",
                "category": "Functional",
                "priority": "Must",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Mandated by HIPAA Privacy & Security Rules to prevent unauthorized patient PHI access.",
                "business_value": "Regulatory Compliance & Risk Reduction",
                "source": "Clinical Compliance Workshop",
                "traceability_id": "FR-001-GOAL-01",
                "related_modules": ["Identity Service", "Patient Portal"],
                "acceptance_criteria": [{"given": "A new patient is on registration portal", "when": "they submit the HIPAA-compliant form with correct health data", "then": "the system registers their account and securely stores HIPAA authorization token."}]
            },
            {
                "id": "FR-002",
                "title": "Provider Clinical Schedule & Appointment Management",
                "description": "Attending physicians and clinical staff MUST be able to view, manage, and re-schedule patient appointments through a real-time interactive schedule dashboard. The system must dynamically cross-reference doctor availability, room allocations, and patient medical urgency scores to optimize scheduling throughput. Automatic conflict resolution rules must prevent double-booking of doctors or specialized medical equipment.",
                "category": "Functional",
                "priority": "Must",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Optimizes clinical staff utilization and reduces patient wait times.",
                "business_value": "Operational Efficiency & Quality of Care",
                "source": "Clinical Operations Team",
                "traceability_id": "FR-002-GOAL-02",
                "related_modules": ["Scheduling Engine", "Clinical Dashboard"],
                "acceptance_criteria": [{"given": "An authenticated physician is logged in", "when": "they open the scheduler tab", "then": "the system lists active daily appointments with real-time room assignments."}]
            },
            {
                "id": "FR-003",
                "title": "Patient Consultation Booking & Telehealth Reservation",
                "description": "Registered patients MUST be able to browse available medical specialist timeslots, book in-person or telehealth consultations, and receive automated SMS/Email reminders. The booking module must validate insurance coverage eligibility before finalizing appointment reservations. Patients can cancel or reschedule bookings up to 24 hours prior to the appointment without incurring cancellation penalties.",
                "category": "Functional",
                "priority": "Should",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Empowers patient self-service and reduces appointment no-show rates by 40%.",
                "business_value": "Patient Engagement & Revenue Retention",
                "source": "Patient Experience Group",
                "traceability_id": "FR-003-GOAL-03",
                "related_modules": ["Patient Portal", "Notification Gateway"],
                "acceptance_criteria": [{"given": "A patient selects a verified consultation timeslot", "when": "they confirm insurance details and submit", "then": "the system books the slot and sends an automated confirmation message."}]
            },
            {
                "id": "FR-004", "title": "Electronic E-Prescription & Pharmacy API Integration",
                "description": "Physicians MUST be able to construct, sign, and transmit electronic prescriptions directly to certified pharmacy partner networks via standardized SCRIPT/FHIR APIs. The module must perform real-time drug-drug interaction sweeps and allergy check warnings against the patient's electronic health record (EHR). Every prescription transmission must generate a tamper-evident audit receipt with a cryptographic signature.",
                "category": "Functional",
                "priority": "Should",
                "risk_level": "Medium",
                "status": "Approved",
                "business_justification": "Eliminates prescription transcription errors and enforces drug interaction safety protocols.",
                "business_value": "Patient Safety & E-Prescribing Compliance",
                "source": "Pharmacy Governance Board",
                "traceability_id": "FR-004-GOAL-04",
                "related_modules": ["EHR Service", "Pharmacy Gateway API"],
                "acceptance_criteria": [{"given": "A doctor finalizes a medication order", "when": "they sign the digital prescription form", "then": "the system validates allergy rules and securely transmits the order to pharmacy API."}]
            },
            {
                "id": "NFR-001",
                "title": "Clinical EHR Search Latency Target",
                "description": "Electronic Health Record (EHR) lookups and patient history queries MUST load within 1.0 second under standard operating load. Search queries must execute optimized database indexes and cache frequently accessed patient summaries in Redis to maintain peak responsiveness during emergency care shifts.",
                "category": "Non-Functional",
                "nfr_category": "Performance",
                "priority": "Should",
                "risk_level": "Low",
                "status": "Approved",
                "measurable_target": "P95 database lookup response time < 500ms at 2,000 concurrent RPS",
                "business_impact": "Slow lookups delay critical emergency medical decisions.",
                "verification_method": "Automated JMeter Performance Load Test Suite"
            },
            {
                "id": "NFR-002",
                "title": "Emergency Care Module Service Availability SLA",
                "description": "Critical emergency care and patient monitoring modules MUST maintain a 99.99% service uptime SLA (< 52 minutes downtime per year). The deployment infrastructure must utilize multi-AZ Kubernetes pods with automated health checks, automatic pod restarts, and cross-region database failover standby instances.",
                "category": "Non-Functional",
                "nfr_category": "Availability",
                "priority": "Must",
                "risk_level": "High",
                "status": "Approved",
                "measurable_target": "99.99% monthly uptime SLA verified via Prometheus telemetry",
                "business_impact": "Downtime during trauma care risks critical patient safety.",
                "verification_method": "Chaos Engineering Chaos Mesh Pod Disruption Drills"
            },
            {
                "id": "NFR-003",
                "title": "PHI End-to-End Encryption & Security Standard",
                "description": "All Protected Health Information (PHI) MUST be encrypted in transit using TLS 1.3 protocols and at rest using AES-256 encryption keys managed via AWS Secrets Manager. Database columns containing patient social security numbers, health diagnoses, and prescription logs must enforce field-level encryption with cryptographic key rotation.",
                "category": "Non-Functional",
                "nfr_category": "Security",
                "priority": "Must",
                "risk_level": "High",
                "status": "Approved",
                "measurable_target": "100% compliance with HIPAA Security Rule audit controls",
                "business_impact": "Data breach causes severe legal fines and loss of hospital license.",
                "verification_method": "Annual Independent SAST/DAST & External Penetration Test"
            },
        ]
        assumptions = ["Medical staff possess valid credentials", "Standard internet connectivity for pharmacy integrations"]
        risks = [
            {"id": "RISK-001", "description": "Risk of PHI exposure if SSL protocols are misconfigured.", "likelihood": "Low", "impact": "High", "mitigation": "Enforce TLS 1.3 only and run daily configuration security audit sweeps.", "owner": "Security Lead"},
            {"id": "RISK-002", "description": "System downtime during database migration updates.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Perform database migrations only during low-load hours with regional failover backups.", "owner": "DevOps Lead"}
        ]
        return build_complete_requirements_payload(proj_name, "healthcare", reqs, assumptions, risks)

    elif domain in ("banking", "erp"):
        reqs = [
            {
                "id": "FR-001",
                "title": "Secure Customer Authentication & Session Governance",
                "description": "The platform MUST provide a highly secure customer authentication service supporting multi-factor authentication (MFA) via SMS OTP, Email verification tokens, or hardware security keys. All password entries must be hashed using bcrypt with salt rounds >= 12 before persistence. Authenticated sessions must issue HttpOnly, Secure, SameSite=Strict session tokens with an idle expiration of 30 minutes to mitigate credential hijack attempts.",
                "category": "Functional",
                "priority": "Must",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Protects customer financial accounts from unauthorized access and meets PCI-DSS login standards.",
                "business_value": "Financial Risk Mitigation & Fraud Reduction",
                "source": "Banking Security Committee",
                "traceability_id": "FR-001-GOAL-01",
                "related_modules": ["Authentication Microservice", "Session Store"],
                "acceptance_criteria": [{"given": "A registered customer submits valid login credentials", "when": "they verify the 6-digit MFA token", "then": "the system issues a secure session token and redirects to dashboard."}]
            },
            {
                "id": "FR-002",
                "title": "Real-Time Account Balance & Ledger Telemetry Dashboard",
                "description": "Authenticated customers MUST be able to view consolidated real-time account balances, credit lines, and available funds across checking, savings, and loan portfolios. The dashboard must aggregate data from core ledger services using read-optimized database replicas. Balance figures must update dynamically upon transaction posting without requiring full page refreshes.",
                "category": "Functional",
                "priority": "Must",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Delivers real-time financial visibility to customers and reduces customer service call volumes.",
                "business_value": "Customer Experience & Self-Service Efficiency",
                "source": "Retail Banking Product Manager",
                "traceability_id": "FR-002-GOAL-02",
                "related_modules": ["Core Ledger Engine", "Customer Dashboard"],
                "acceptance_criteria": [{"given": "An authenticated user loads the dashboard", "when": "the component mounts", "then": "all linked accounts display live balances fetched from the ledger service within 200ms."}]
            },
            {
                "id": "FR-003",
                "title": "Paginated Transaction History & Advanced Statement Filtering",
                "description": "Customers MUST be able to search, filter, and export paginated transaction history records across custom date ranges, payment types, and merchant categories. The grid must support server-side pagination to render datasets exceeding 100,000 transaction records efficiently. Customers can download monthly bank statements in encrypted PDF or CSV file formats.",
                "category": "Functional",
                "priority": "Should",
                "risk_level": "Low",
                "status": "Approved",
                "business_justification": "Provides comprehensive transaction auditing and self-service statement generation.",
                "business_value": "Operational Cost Reduction",
                "source": "Digital Banking Operations",
                "traceability_id": "FR-003-GOAL-03",
                "related_modules": ["Statement Service", "Export Pipeline"],
                "acceptance_criteria": [{"given": "A customer sets date range filters on statement view", "when": "they click search", "then": "the system renders matching transactions in a paginated grid with download options."}]
            },
            {
                "id": "FR-004",
                "title": "Multi-Factor Funds Transfer & Clearing Pipeline",
                "description": "Customers MUST be able to initiate intra-bank transfers, external ACH transfers, and wire payments through a multi-step verification pipeline. The clearing engine must validate sufficient balance, check daily transaction limits, and trigger secondary MFA authorization for transfers exceeding $5,000. Every transfer must generate an immutable transaction ledger entry with a unique transaction reference code.",
                "category": "Functional",
                "priority": "Must",
                "risk_level": "High",
                "status": "Approved",
                "business_justification": "Core payment capability generating transaction revenue and facilitating money movement.",
                "business_value": "Core Revenue & Money Movement Governance",
                "source": "Payment Systems Product Owner",
                "traceability_id": "FR-004-GOAL-04",
                "related_modules": ["Payments Gateway", "Fraud Telemetry Engine"],
                "acceptance_criteria": [{"given": "A customer initiates a $6,000 wire transfer", "when": "they complete secondary OTP authorization", "then": "the system debits the account, logs ledger entry, and queues clearing job."}]
            },
            {
                "id": "NFR-001",
                "title": "Financial Transaction API Performance Target",
                "description": "Core transaction processing and balance inquiry endpoints MUST process requests with a P95 latency under 200 milliseconds under a nominal load of 5,000 concurrent user sessions. Database connections must use pgbouncer pooling to handle peak morning traffic bursts without query queue degradation.",
                "category": "Non-Functional",
                "nfr_category": "Performance",
                "priority": "Should",
                "risk_level": "Low",
                "status": "Approved",
                "measurable_target": "P95 latency < 200ms at 5,000 RPS",
                "business_impact": "Latency delays cause checkout timeouts and customer dissatisfaction.",
                "verification_method": "Automated Locust Performance Benchmark"
            },
            {
                "id": "NFR-002",
                "title": "PCI-DSS Data Protection & Encryption Compliance",
                "description": "All cardholder data, account numbers, and personal identifiers MUST be encrypted using AES-256 at rest and TLS 1.3 in transit. Primary account numbers (PAN) must be masked in log files and UI views, showing only the last 4 digits. Hardware Security Modules (HSM) must be used for transaction signing keys.",
                "category": "Non-Functional",
                "nfr_category": "Security",
                "priority": "Must",
                "risk_level": "High",
                "status": "Approved",
                "measurable_target": "100% compliance with PCI-DSS 4.0 Standard Audit Controls",
                "business_impact": "PCI non-compliance revokes payment processing privileges.",
                "verification_method": "Qualified Security Assessor (QSA) Annual Audit"
            },
        ]
        assumptions = ["Single-currency accounts only in v1 release", "Standard cloud infrastructure provisioned"]
        risks = [
            {"id": "RISK-001", "description": "No rate-limiting on login endpoint causing brute force vulnerability.", "likelihood": "Medium", "impact": "High", "mitigation": "Configure rate-limiting of 5 attempts/minute per IP address.", "owner": "Security Lead"},
            {"id": "RISK-002", "description": "Session token storage vulnerabilities on browser client.", "likelihood": "Low", "impact": "High", "mitigation": "Store session tokens in secure, HttpOnly, SameSite=Strict cookies.", "owner": "Frontend Architect"}
        ]
        return build_complete_requirements_payload(proj_name, domain, reqs, assumptions, risks)

    elif domain == "ecommerce":
        reqs = [
            {"id": "FR-001", "description": "Users must browse catalog items and add them to a shopping cart.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A visitor is on the product catalog", "when": "they click 'Add to Cart'", "then": "the system updates the shopping cart count and saves the item locally"}]},
            {"id": "FR-002", "description": "Checkout must integrate with Stripe/PayPal for secure payment.", "category": "Functional", "priority": "Must", "risk_level": "Medium",
             "acceptance_criteria": [{"given": "A customer is on the checkout page with a loaded cart", "when": "they finalize the payment form", "then": "the system invokes the payment API and creates a pending order record"}]},
            {"id": "FR-003", "description": "Customers can view order history and track shipping status.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "An authenticated customer is on the profile page", "when": "they select order history", "then": "the system lists their past orders with real-time delivery state updates"}]},
            {"id": "FR-004", "description": "Administrators can manage product catalogs, inventory levels, and prices.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "An admin is on the inventory manager dashboard", "when": "they update product stock count", "then": "the system persists the changes and updates the public catalog storefront"}]},
            {"id": "NFR-001", "description": "Catalog search must return results in under 500ms.", "category": "Non-Functional", "priority": "Should", "risk_level": "Low"},
            {"id": "NFR-002", "description": "PCI-DSS compliance for billing processes.", "category": "Non-Functional", "priority": "Must", "risk_level": "High"},
        ]
        assumptions = ["Inventory feeds updated every 5 minutes", "Third-party payment gateway is online"]
        risks = [
            {"id": "RISK-001", "description": "Risk of duplicate charges if double-clicks on checkout not prevented.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Disable the checkout submit button immediately upon execution and verify idempotency tokens."}
        ]
        return build_complete_requirements_payload(proj_name, "ecommerce", reqs, assumptions, risks)

    elif domain == "education":
        reqs = [
            {"id": "FR-001", "description": "Students must register for academic courses based on pre-requisites.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A student has logged in to the enrollment tab", "when": "they select a course where pre-requisites are satisfied", "then": "the system registers them and issues enrollment confirmation"}]},
            {"id": "FR-002", "description": "Faculty must submit course grades and attendance records.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A teacher is on the course sheet portal", "when": "they submit the final grades list", "then": "the system records the grades and locks editing access"}]},
            {"id": "FR-003", "description": "Registrars can view student transcripts and track degree audit progress.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A registrar is on a student record dashboard", "when": "they click degree audit", "then": "the system runs course pre-requisite verification checks and renders coverage metrics"}]},
            {"id": "FR-004", "description": "Online payment portal for student tuition fees.", "category": "Functional", "priority": "Should", "risk_level": "Medium",
             "acceptance_criteria": [{"given": "A student is in the billing dashboard", "when": "they process tuition payment", "then": "the system logs receipt and updates payment status to complete"}]},
            {"id": "NFR-001", "description": "FERPA compliance for student record access controls.", "category": "Non-Functional", "priority": "Must", "risk_level": "High"},
        ]
        assumptions = ["Class schedule finalized before registration opens"]
        risks = [
            {"id": "RISK-001", "description": "Risk of server crash if grade submissions bottleneck at end of semester.", "likelihood": "Low", "impact": "High", "mitigation": "Scale application containers horizontally during high load periods and implement task queues."}
        ]
        return build_complete_requirements_payload(proj_name, "education", reqs, assumptions, risks)

    elif domain == "crm":
        reqs = [
            {"id": "FR-001", "description": "Sales reps can create and manage customer leads in a pipeline view.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A sales rep is on the pipeline board", "when": "they drag a lead to qualified state", "then": "the system updates lead details and logs change history"}]},
            {"id": "FR-002", "description": "System must track all customer interactions and call logs.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A user finishes an interaction with a client", "when": "they fill and submit the call log", "then": "the system appends the log entry to the contact dashboard history"}]},
            {"id": "NFR-001", "description": "Dashboard must refresh lead status in real-time.", "category": "Non-Functional", "priority": "Should", "risk_level": "Low"},
        ]
        assumptions = ["Sales team uses CRM daily", "Email integration is configured"]
        risks = [
            {"id": "RISK-001", "description": "Data duplication if import validation is skipped.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Enforce strict email duplication validations and provide merge tools."}
        ]
        return build_complete_requirements_payload(proj_name, "crm", reqs, assumptions, risks)

    elif domain == "hrms":
        reqs = [
            {"id": "FR-001", "description": "HR managers can onboard employees and assign roles.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "An HR manager is on the onboarding dashboard", "when": "they save the employee form with role assignment", "then": "the system creates the employee record and generates credentials"}]},
            {"id": "FR-002", "description": "Employees can apply for leave and view payslips.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "An employee is logged in", "when": "they submit a leave request", "then": "the system saves the request and notifies their manager"}]},
            {"id": "NFR-001", "description": "Payroll calculations must be auditable and accurate.", "category": "Non-Functional", "priority": "Must", "risk_level": "High"},
        ]
        assumptions = ["Single company payroll", "Working hours tracked via timesheets"]
        risks = [
            {"id": "RISK-001", "description": "Payroll errors if overtime rules are misconfigured.", "likelihood": "Low", "impact": "High", "mitigation": "Enforce multi-step verification before execution and run test calculations."}
        ]
        return build_complete_requirements_payload(proj_name, "hrms", reqs, assumptions, risks)

    elif domain == "logistics":
        reqs = [
            {"id": "FR-001", "description": "Dispatchers can create delivery routes and assign drivers.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A dispatcher is on the logistics map view", "when": "they allocate a driver to a delivery route", "then": "the system assigns shipment status and updates routing metrics"}]},
            {"id": "FR-002", "description": "Customers can track shipment status in real-time.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A user has an active tracking ID", "when": "they query shipment details", "then": "the system shows the exact shipment coordinates and estimated delivery window"}]},
            {"id": "NFR-001", "description": "GPS tracking must update every 30 seconds.", "category": "Non-Functional", "priority": "Should", "risk_level": "Medium"},
        ]
        assumptions = ["Drivers have GPS-enabled devices", "Routes updated daily"]
        risks = [
            {"id": "RISK-001", "description": "Tracking gaps if driver device loses connectivity.", "likelihood": "Medium", "impact": "Medium", "mitigation": "Cache GPS data on mobile client and auto-resubmit when network connection returns."}
        ]
        return build_complete_requirements_payload(proj_name, "logistics", reqs, assumptions, risks)

    else:
        info = infer_domain_keywords(proj_name)
        reqs = [
            {"id": "FR-001", "description": f"Users must authenticate securely to access the {proj_name} system.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A user is on the login page", "when": "they submit credentials", "then": "the system authenticates them and opens dashboard"}]},
            {"id": "FR-002", "description": f"Authenticated users can configure and monitor {info['secondary']} profiles in the {info['primary']} workspace.", "category": "Functional", "priority": "Must", "risk_level": "Low",
             "acceptance_criteria": [{"given": "An admin is in the settings dashboard", "when": "they save changes to profiles", "then": "the system stores configurations and reloads active profiles"}]},
            {"id": "FR-003", "description": f"Provide search filters to display active {info['secondary']} records.", "category": "Functional", "priority": "Should", "risk_level": "Low",
             "acceptance_criteria": [{"given": "A user applies search filter inputs", "when": "they search", "then": "the system returns the filtered matches"}]},
            {"id": "FR-004", "description": f"System must log modification history on {info['secondary']} configurations for audit tracking.", "category": "Functional", "priority": "Should", "risk_level": "Medium",
             "acceptance_criteria": [{"given": "An edit operation is finalized", "when": "the save action completes", "then": "the system creates a record in history files"}]},
            {"id": "NFR-001", "description": f"Response time for {proj_name} dashboard must be under 2 seconds.", "category": "Non-Functional", "priority": "Should", "risk_level": "Low"},
            {"id": "NFR-002", "description": "SOC 2 compliance for all user credentials and database tables.", "category": "Non-Functional", "priority": "Must", "risk_level": "High"},
        ]
        assumptions = [f"Primary users understand the {info['subject']} domain workflow"]
        risks = [
            {"id": "RISK-001", "description": f"Risk of config mismatches if {info['secondary']} inputs are unvalidated.", "likelihood": "Medium", "impact": "High", "mitigation": "Validate inputs against data model parameters."}
        ]
        return build_complete_requirements_payload(proj_name, "general", reqs, assumptions, risks)


# ---------------------------------------------------------------------------
# 2. User Stories
# ---------------------------------------------------------------------------
def get_user_stories(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "epics": [
                {
                    "title": "Patient Registration & Care Portal",
                    "description": "Patient enrollment and medical history profiles.",
                    "stories": [
                        {"id": "US-101", "title": "Patient Registration", "role": "Patient",
                         "goal": "complete my online health history form",
                         "benefit": "my nurse can access it immediately",
                         "acceptance_criteria": ["All fields are verified.", "HIPAA consent required."]},
                        {"id": "US-102", "title": "Book Appointment", "role": "Patient",
                         "goal": "book a consultation with an available doctor",
                         "benefit": "I can receive care on time",
                         "acceptance_criteria": ["Available slots shown.", "Confirmation sent via email."]},
                    ]
                }
            ],
            "total_stories": 2,
        }
    elif domain in ("banking", "erp"):
        return {
            "epics": [
                {
                    "title": "User Authentication",
                    "description": "Login, session management and logout flows.",
                    "stories": [
                        {"id": "US-001", "title": "Email login", "role": "customer",
                         "goal": "authenticate securely with my email and password",
                         "benefit": "I can access my bank accounts dashboard",
                         "acceptance_criteria": ["Correct credentials redirect to dashboard.", "Invalid credentials show error."]},
                    ]
                },
                {
                    "title": "Account Overview",
                    "description": "View account balances and transactions.",
                    "stories": [
                        {"id": "US-002", "title": "View balances", "role": "customer",
                         "goal": "see all my account balances on one screen",
                         "benefit": "I can quickly check my financial status",
                         "acceptance_criteria": ["All linked accounts shown.", "Balances refresh on load."]},
                    ]
                }
            ],
            "total_stories": 2,
        }
    elif domain == "ecommerce":
        return {
            "epics": [
                {
                    "title": "Cart & Checkout",
                    "description": "Shopping cart and payment flow.",
                    "stories": [
                        {"id": "US-101", "title": "Add to Cart", "role": "Shopper",
                         "goal": "add a product to my cart from the catalog",
                         "benefit": "I can purchase it later",
                         "acceptance_criteria": ["Cart count updates.", "Item persists on page refresh."]},
                        {"id": "US-102", "title": "Checkout with Stripe", "role": "Shopper",
                         "goal": "submit card payment securely",
                         "benefit": "I can complete my purchase",
                         "acceptance_criteria": ["Stripe payment succeeds.", "Order status changes to Paid."]},
                    ]
                }
            ],
            "total_stories": 2,
        }
    elif domain == "education":
        return {
            "epics": [
                {
                    "title": "Course Registration",
                    "description": "Academic course enrollment.",
                    "stories": [
                        {"id": "US-101", "title": "Register for Course", "role": "Student",
                         "goal": "register for an available course",
                         "benefit": "I can lock my academic schedule",
                         "acceptance_criteria": ["Pre-requisites checked.", "Class capacity not exceeded."]},
                    ]
                }
            ],
            "total_stories": 1,
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "epics": [
                {
                    "title": f"{info['secondary']} Profile Management",
                    "description": f"CRUD interface for {info['secondary']} records.",
                    "stories": [
                        {"id": "US-101", "title": f"Create {info['secondary']} Profile", "role": "Coordinator",
                         "goal": f"create and save a new {info['secondary']} record",
                         "benefit": f"I can track it in the {info['primary']} dashboard",
                         "acceptance_criteria": ["Status defaults to Active.", "Saved record appears in list."]},
                        {"id": "US-102", "title": f"Edit {info['secondary']} Profile", "role": "Coordinator",
                         "goal": f"update an existing {info['secondary']} record",
                         "benefit": "I can keep information current",
                         "acceptance_criteria": ["Changes saved to database.", "Audit log entry created."]},
                    ]
                }
            ],
            "total_stories": 2,
        }


# ---------------------------------------------------------------------------
# 3. Solution Architecture
# ---------------------------------------------------------------------------
def get_architecture(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    diagrams_healthcare = (
        "+------------+     +--------------+     +-----------------+\n"
        "| React Web  | --> | Kong Gateway | --> | Patient Service |\n"
        "+------------+     +--------------+     +-----------------+"
    )
    diagrams_banking = (
        "+-----------+     +-----------------+     +-----------------+\n"
        "| SPA Shell | --> | Express Monolith| --> | PostgreSQL DB   |\n"
        "+-----------+     +-----------------+     +-----------------+"
    )
    diagrams_ecommerce = (
        "+-------------+     +-----------------+     +------------------+\n"
        "| Next.js App | --> | GraphQL Gateway | --> | Checkout Service |\n"
        "+-------------+     +-----------------+     +------------------+"
    )
    diagrams_education = (
        "+-------------+     +-------------------+     +------------------+\n"
        "| Angular Web | --> | Spring Gateway    | --> | Registry Service |\n"
        "+-------------+     +-------------------+     +------------------+"
    )

    if domain == "healthcare":
        return {
            "architecture_summary": "Hospital Management System - Layered SOA with HIPAA compliance focus.",
            "pattern": "Layered Microservices / Event-Driven Architecture",
            "microservices": ["Patient Ingest Service", "Clinical Appt Scheduler", "Billing Gateway", "Notification Router"],
            "components": ["Web Front-end", "Kong API Gateway", "Kafka Event Bus", "Secure Database Layer"],
            "tech_stack": {"Frontend": "React + TypeScript", "Backend": "FastAPI (Python)", "Database": "PostgreSQL"},
            "diagrams": [diagrams_healthcare],
        }
    elif domain in ("banking", "erp"):
        return {
            "architecture_summary": "Banking Portal - Modular monolith. Auth, Account and Transaction concerns separated.",
            "pattern": "Modular Monolith",
            "microservices": ["Auth Module", "Account Module", "Transaction Module"],
            "components": ["Express SPA shell", "Sequelize ORM layer", "PostgreSQL DB"],
            "tech_stack": {"Frontend": "React + Vite", "Backend": "Express Node.js", "Database": "PostgreSQL"},
            "diagrams": [diagrams_banking],
        }
    elif domain == "ecommerce":
        return {
            "architecture_summary": "E-commerce Platform - Scalable microservices for checkout concurrency.",
            "pattern": "CQRS Microservices",
            "microservices": ["Catalog Service", "Cart & Checkout Service", "Billing Hub"],
            "components": ["Next.js SSR Frontend", "GraphQL Gateway", "PostgreSQL DB"],
            "tech_stack": {"Frontend": "Next.js + Tailwind", "Backend": "NestJS (Node.js)", "Database": "PostgreSQL"},
            "diagrams": [diagrams_ecommerce],
        }
    elif domain == "education":
        return {
            "architecture_summary": "College ERP Architecture - Spring Cloud gateway integrating registry databases.",
            "pattern": "Service Oriented Architecture (SOA)",
            "microservices": ["Student Portal API", "Registry Scheduler", "Grading Engine"],
            "components": ["Angular Frontend", "Spring Cloud Gateway", "Oracle DB"],
            "tech_stack": {"Frontend": "Angular + RxJS", "Backend": "Java Spring Boot", "Database": "Oracle DB"},
            "diagrams": [diagrams_education],
        }
    else:
        info = infer_domain_keywords(proj_name)
        diagrams_generic = (
            "+-------------+     +-----------------+     +-------------------+\n"
            "| SPA Client  | --> | API Controller  | --> | PostgreSQL DB     |\n"
            "+-------------+     +-----------------+     +-------------------+"
        )
        return {
            "architecture_summary": f"Modular service layout for the {proj_name} platform.",
            "pattern": "Modular Service Architecture",
            "microservices": [f"{info['primary']} Web Portal", f"{info['secondary']} Manager Engine", "Audit Logger"],
            "components": ["Single Page Application", "API Gateway", "Relational Database"],
            "tech_stack": {
                "Frontend": "React + TypeScript + Vite",
                "Backend": "FastAPI (Python) + SQLAlchemy",
                "Database": "PostgreSQL",
                "Orchestrator": "Uvicorn",
            },
            "diagrams": [diagrams_generic],
        }


# ---------------------------------------------------------------------------
# 4. Database Schema
# ---------------------------------------------------------------------------
def get_database_schema(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        ddl = (
            "CREATE TABLE patients (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  medical_record_number VARCHAR(50) UNIQUE NOT NULL,\n"
            "  full_name VARCHAR(255) NOT NULL,\n"
            "  date_of_birth DATE,\n"
            "  gender VARCHAR(20),\n"
            "  created_at TIMESTAMPTZ DEFAULT NOW()\n"
            ");\n\n"
            "CREATE TABLE appointments (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  patient_id INT REFERENCES patients(id),\n"
            "  doctor_id INT NOT NULL,\n"
            "  scheduled_at TIMESTAMPTZ NOT NULL,\n"
            "  status VARCHAR(50) DEFAULT 'Scheduled'\n"
            ");"
        )
        return {
            "tables": [
                {"name": "patients", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "medical_record_number", "type": "VARCHAR(50)", "nullable": False},
                    {"name": "full_name", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "date_of_birth", "type": "DATE", "nullable": True},
                ]},
                {"name": "appointments", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "patient_id", "type": "INT", "nullable": False},
                    {"name": "doctor_id", "type": "INT", "nullable": False},
                    {"name": "scheduled_at", "type": "TIMESTAMPTZ", "nullable": False},
                    {"name": "status", "type": "VARCHAR(50)", "nullable": False},
                ]},
            ],
            "relationships": ["appointments.patient_id -> patients.id"],
            "ddl_script": ddl,
        }
    elif domain in ("banking", "erp"):
        ddl = (
            "CREATE TABLE customers (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  full_name VARCHAR(255) NOT NULL,\n"
            "  email VARCHAR(255) UNIQUE NOT NULL,\n"
            "  password_hash VARCHAR(255) NOT NULL,\n"
            "  created_at TIMESTAMPTZ DEFAULT NOW()\n"
            ");\n\n"
            "CREATE TABLE accounts (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  customer_id INT REFERENCES customers(id),\n"
            "  account_number VARCHAR(50) UNIQUE NOT NULL,\n"
            "  balance NUMERIC(15,2) DEFAULT 0.00,\n"
            "  currency VARCHAR(10) DEFAULT 'USD'\n"
            ");"
        )
        return {
            "tables": [
                {"name": "customers", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "full_name", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "email", "type": "VARCHAR(255)", "nullable": False},
                ]},
                {"name": "accounts", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "customer_id", "type": "INT", "nullable": False},
                    {"name": "balance", "type": "NUMERIC(15,2)", "nullable": False},
                ]},
            ],
            "relationships": ["accounts.customer_id -> customers.id"],
            "ddl_script": ddl,
        }
    elif domain == "ecommerce":
        ddl = (
            "CREATE TABLE products (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  sku VARCHAR(100) UNIQUE NOT NULL,\n"
            "  title VARCHAR(255) NOT NULL,\n"
            "  price NUMERIC(10,2) NOT NULL,\n"
            "  stock_qty INT DEFAULT 0\n"
            ");\n\n"
            "CREATE TABLE orders (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  customer_email VARCHAR(255) NOT NULL,\n"
            "  total NUMERIC(12,2) NOT NULL,\n"
            "  status VARCHAR(50) DEFAULT 'Pending',\n"
            "  created_at TIMESTAMPTZ DEFAULT NOW()\n"
            ");"
        )
        return {
            "tables": [
                {"name": "products", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "sku", "type": "VARCHAR(100)", "nullable": False},
                    {"name": "title", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "price", "type": "NUMERIC(10,2)", "nullable": False},
                ]},
                {"name": "orders", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "customer_email", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "total", "type": "NUMERIC(12,2)", "nullable": False},
                    {"name": "status", "type": "VARCHAR(50)", "nullable": False},
                ]},
            ],
            "relationships": [],
            "ddl_script": ddl,
        }
    elif domain == "education":
        ddl = (
            "CREATE TABLE students (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  student_id VARCHAR(50) UNIQUE NOT NULL,\n"
            "  full_name VARCHAR(255) NOT NULL,\n"
            "  email VARCHAR(255) UNIQUE NOT NULL\n"
            ");\n\n"
            "CREATE TABLE courses (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  course_code VARCHAR(20) UNIQUE NOT NULL,\n"
            "  title VARCHAR(255) NOT NULL,\n"
            "  credits INT NOT NULL,\n"
            "  capacity INT DEFAULT 30\n"
            ");"
        )
        return {
            "tables": [
                {"name": "students", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "student_id", "type": "VARCHAR(50)", "nullable": False},
                    {"name": "full_name", "type": "VARCHAR(255)", "nullable": False},
                ]},
                {"name": "courses", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "course_code", "type": "VARCHAR(20)", "nullable": False},
                    {"name": "title", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "credits", "type": "INT", "nullable": False},
                ]},
            ],
            "relationships": [],
            "ddl_script": ddl,
        }
    else:
        info = infer_domain_keywords(proj_name)
        tbl = f"{info['secondary'].lower()}s"
        ddl = (
            "CREATE TABLE users (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  email VARCHAR(255) UNIQUE NOT NULL,\n"
            "  password_hash VARCHAR(255) NOT NULL,\n"
            "  role VARCHAR(50) DEFAULT 'user',\n"
            "  created_at TIMESTAMPTZ DEFAULT NOW()\n"
            f");\n\nCREATE TABLE {tbl} (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  name VARCHAR(255) NOT NULL,\n"
            "  status VARCHAR(50) DEFAULT 'Active',\n"
            "  created_by INT REFERENCES users(id),\n"
            "  created_at TIMESTAMPTZ DEFAULT NOW()\n"
            ");"
        )
        return {
            "tables": [
                {"name": "users", "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "email", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "password_hash", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "role", "type": "VARCHAR(50)", "nullable": False},
                ]},
                {"name": tbl, "columns": [
                    {"name": "id", "type": "SERIAL", "nullable": False, "primary_key": True},
                    {"name": "name", "type": "VARCHAR(255)", "nullable": False},
                    {"name": "status", "type": "VARCHAR(50)", "nullable": False},
                ]},
            ],
            "relationships": [f"{tbl}.created_by -> users.id"],
            "ddl_script": ddl,
        }


# ---------------------------------------------------------------------------
# 5. UI/UX Design
# ---------------------------------------------------------------------------
def get_uiux(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "screens": ["Patient Admission Portal", "Clinical Appointments Calendar", "Prescription Manager"],
            "userFlows": ["Register patient -> schedule consultation -> receive prescription"],
            "wireframes": ["Grid list showing patient records and active doctor schedules."],
            "componentRecommendations": ["Secure patient profile cards", "Appointment calendar picker"],
            "uxRecommendations": ["Clear HIPAA consent warnings", "Color-coded appointment status"],
            "designSystem": {"colors": {"primary": "#0D9488", "secondary": "#0F766E"}, "typography": {"fontFamily": "Inter"}},
        }
    elif domain in ("banking", "erp"):
        return {
            "screens": ["Sign In", "Account Dashboard", "Transaction History", "Transfer Funds"],
            "userFlows": ["Authenticate -> view balances -> view transactions -> transfer"],
            "wireframes": ["Responsive shell with nav, balance cards, and transaction table."],
            "componentRecommendations": ["Balance summary cards", "Paginated transaction table", "Transfer dialog"],
            "uxRecommendations": ["Show session timeout warning 2 mins before expiry", "Error toasts for failed transfers"],
            "designSystem": {"colors": {"primary": "#1E3A5F", "secondary": "#2563EB"}, "typography": {"fontFamily": "Inter"}},
        }
    elif domain == "ecommerce":
        return {
            "screens": ["Product Catalog", "Product Detail", "Shopping Cart", "Checkout", "Order History"],
            "userFlows": ["Browse catalog -> add to cart -> checkout -> order confirmation"],
            "wireframes": ["Product grid with filter sidebar, cart drawer, checkout form."],
            "componentRecommendations": ["Product image carousel", "Cart quantity stepper", "Stripe payment element"],
            "uxRecommendations": ["Guest checkout flow", "Sticky cart summary on checkout"],
            "designSystem": {"colors": {"primary": "#EA580C", "secondary": "#F97316"}, "typography": {"fontFamily": "Inter"}},
        }
    elif domain == "education":
        return {
            "screens": ["Student Portal Hub", "Course Catalog", "Registration Wizard", "Grades Dashboard"],
            "userFlows": ["Login -> browse courses -> register -> view grades"],
            "wireframes": ["Course grid with prereq indicators, grade table, GPA calculator."],
            "componentRecommendations": ["Course prereq warning badge", "Semester calendar view"],
            "uxRecommendations": ["Mobile-friendly student records", "Conflict detection on schedule"],
            "designSystem": {"colors": {"primary": "#1E3A8A", "secondary": "#2563EB"}, "typography": {"fontFamily": "Inter"}},
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "screens": [f"{info['secondary']} Editor", f"{info['primary']} Dashboard", "User Management", "Audit Log"],
            "userFlows": [f"Login -> view {info['secondary']} list -> create/edit -> save"],
            "wireframes": [f"Dashboard with {info['secondary']} stats cards and data table."],
            "componentRecommendations": [f"Dynamic form for {info['secondary']} creation", "Search and filter toolbar"],
            "uxRecommendations": [f"Persist selected {info['secondary']} on page reload", "Inline validation on forms"],
            "designSystem": {"colors": {"primary": "#3B82F6", "secondary": "#1D4ED8"}, "typography": {"fontFamily": "Inter"}},
        }


# ---------------------------------------------------------------------------
# 6. Backend Plan
# ---------------------------------------------------------------------------
def get_backend_plan(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "framework": "FastAPI (Python)",
            "files": ["main.py", "models.py", "routers/patients.py", "routers/appointments.py"],
            "implementation": "HIPAA-compliant patient registration API with audit trail middleware.",
        }
    elif domain in ("banking", "erp"):
        return {
            "framework": "Express (Node.js)",
            "files": ["server.js", "routes/auth.js", "routes/accounts.js", "routes/transactions.js"],
            "implementation": "Secure JWT cookie auth, account ledger APIs, and transaction validation rules.",
        }
    elif domain == "ecommerce":
        return {
            "framework": "NestJS (Node.js)",
            "files": ["main.ts", "catalog/catalog.controller.ts", "checkout/stripe.service.ts", "orders/orders.service.ts"],
            "implementation": "Catalog browsing APIs, Stripe payment integration, and order lifecycle management.",
        }
    elif domain == "education":
        return {
            "framework": "Spring Boot (Java)",
            "files": ["Application.java", "controller/StudentController.java", "service/RegistrarService.java", "repository/CourseRepository.java"],
            "implementation": "Course schedule registration with pre-requisite conflict checks and grade submission.",
        }
    else:
        info = infer_domain_keywords(proj_name)
        subj_snake = info["subject"].lower().replace(" ", "_")
        return {
            "framework": "FastAPI (Python)",
            "files": ["main.py", "models.py", f"routers/{subj_snake}.py", "auth.py"],
            "implementation": f"REST API for {proj_name} handling CRUD operations on {info['secondary']} records with JWT auth.",
        }


# ---------------------------------------------------------------------------
# 7. API Design
# ---------------------------------------------------------------------------
def get_api_design(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "endpoints": [
                {"path": "/api/patients", "method": "POST", "description": "Create patient record (HIPAA Audit Logged)"},
                {"path": "/api/patients/{id}", "method": "GET", "description": "Retrieve patient profile"},
                {"path": "/api/appointments", "method": "POST", "description": "Book appointment"},
                {"path": "/api/appointments/{id}", "method": "PATCH", "description": "Update appointment status"},
            ]
        }
    elif domain in ("banking", "erp"):
        return {
            "endpoints": [
                {"path": "/api/auth/login", "method": "POST", "description": "Exchange credentials for session cookie"},
                {"path": "/api/accounts/summary", "method": "GET", "description": "Fetch account summaries"},
                {"path": "/api/transactions", "method": "GET", "description": "List paginated transactions"},
                {"path": "/api/transfers", "method": "POST", "description": "Initiate fund transfer"},
            ]
        }
    elif domain == "ecommerce":
        return {
            "endpoints": [
                {"path": "/api/products", "method": "GET", "description": "Browse catalog list"},
                {"path": "/api/cart", "method": "POST", "description": "Add item to cart"},
                {"path": "/api/checkout", "method": "POST", "description": "Process payment via Stripe"},
                {"path": "/api/orders", "method": "GET", "description": "List customer orders"},
            ]
        }
    elif domain == "education":
        return {
            "endpoints": [
                {"path": "/api/courses", "method": "GET", "description": "List available courses"},
                {"path": "/api/students/register", "method": "POST", "description": "Enroll student in course"},
                {"path": "/api/grades/submit", "method": "POST", "description": "Submit final grades"},
                {"path": "/api/transcripts/{student_id}", "method": "GET", "description": "Fetch student transcript"},
            ]
        }
    else:
        info = infer_domain_keywords(proj_name)
        subj_snake = info["subject"].lower().replace(" ", "_")
        return {
            "endpoints": [
                {"path": "/api/auth/login", "method": "POST", "description": "Authenticate and receive JWT"},
                {"path": f"/api/{subj_snake}", "method": "GET", "description": f"List {info['secondary']} records"},
                {"path": f"/api/{subj_snake}", "method": "POST", "description": f"Create {info['secondary']} record"},
                {"path": f"/api/{subj_snake}/{{id}}", "method": "PUT", "description": f"Update {info['secondary']} record"},
                {"path": f"/api/{subj_snake}/{{id}}", "method": "DELETE", "description": f"Delete {info['secondary']} record"},
            ]
        }


# ---------------------------------------------------------------------------
# 8. Frontend Plan
# ---------------------------------------------------------------------------
def get_frontend_plan(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "framework": "React + TypeScript + Vite",
            "files": ["src/App.tsx", "src/components/PatientForm.tsx", "src/components/AppointmentCalendar.tsx"],
            "implementation": "Patient summary dashboards and appointment calendar with real-time status updates.",
        }
    elif domain in ("banking", "erp"):
        return {
            "framework": "React + TypeScript",
            "files": ["src/App.tsx", "src/components/AccountList.tsx", "src/components/TransactionTable.tsx"],
            "implementation": "Customer portal showing account balances and paginated transaction history.",
        }
    elif domain == "ecommerce":
        return {
            "framework": "React + TailwindCSS",
            "files": ["src/App.tsx", "src/pages/Catalog.tsx", "src/components/CartDrawer.tsx", "src/pages/Checkout.tsx"],
            "implementation": "Product grid with cart drawer overlay and Stripe Elements checkout form.",
        }
    elif domain == "education":
        return {
            "framework": "Angular + RxJS",
            "files": ["src/app/portal.component.ts", "src/app/register.component.ts", "src/app/grades.component.ts"],
            "implementation": "Angular workspace with course scheduler, grade viewer, and registrar tools.",
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "framework": "React + TypeScript + TailwindCSS",
            "files": ["src/App.tsx", f"src/pages/{info['primary']}Dashboard.tsx", f"src/components/{info['secondary']}Form.tsx", "src/components/DataTable.tsx"],
            "implementation": f"Responsive SPA to manage {info['secondary']} records with data tables and inline forms.",
        }


# ---------------------------------------------------------------------------
# 9. Testing Plan
# ---------------------------------------------------------------------------
def get_testing_plan(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "testSuites": [
                {"name": "Patient Validation Unit Tests", "description": "Verify DOB checks and MRN format validation."},
                {"name": "HIPAA Logging Integration Tests", "description": "Confirm PHI reads/writes generate audit records."},
                {"name": "Appointment Conflict Tests", "description": "Ensure double-booking is prevented for doctors."},
            ]
        }
    elif domain in ("banking", "erp"):
        return {
            "testSuites": [
                {"name": "Auth API Tests", "description": "Verify JWT issuance, expiry, and rate limiting."},
                {"name": "Account Balance Tests", "description": "Validate balance updates and overdraft prevention."},
                {"name": "Transaction Integrity Tests", "description": "Confirm debit/credit atomicity."},
            ]
        }
    elif domain == "ecommerce":
        return {
            "testSuites": [
                {"name": "Cart Logic Tests", "description": "Verify price totals and inventory deduction."},
                {"name": "Stripe Integration Tests", "description": "Confirm card charge and order status transitions."},
                {"name": "Catalog Search Tests", "description": "Test filter accuracy and edge case empty results."},
            ]
        }
    elif domain == "education":
        return {
            "testSuites": [
                {"name": "Course Pre-req Tests", "description": "Verify enrollment blocks students lacking requirements."},
                {"name": "FERPA Access Tests", "description": "Confirm grades blocked for unauthorized access."},
                {"name": "Grade Submission Tests", "description": "Validate grade entry and transcript updates."},
            ]
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "testSuites": [
                {"name": f"{info['secondary']} CRUD Tests", "description": f"Verify create, read, update, delete for {info['secondary']} entities."},
                {"name": "Auth & RBAC Tests", "description": "Confirm role-based permissions enforce correctly."},
                {"name": "API Integration Tests", "description": "End-to-end validation of all REST endpoints."},
            ]
        }


# ---------------------------------------------------------------------------
# 10. Compliance
# ---------------------------------------------------------------------------
def get_compliance(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "complianceAssessment": {"standards": ["HIPAA", "SOC 2"], "gaps": ["PHI encryption at rest verification"], "recommendations": ["Implement database-level field encryption"]},
            "governanceControls": ["Staff access approval gates", "Immutable PHI audit logs"],
            "auditRequirements": ["Log identity and accessed patient records on every clinical API call"],
            "dataRetentionPolicies": ["Retain medical records for 6 years per state regulations"],
            "riskAssessment": ["Confirm patient consent forms are digitally signed and stored"],
        }
    elif domain in ("banking", "erp"):
        return {
            "complianceAssessment": {"standards": ["SOC 2 Type II", "PCI-DSS"], "gaps": ["Encryption at rest verification"], "recommendations": ["Configure automated KMS key rotation"]},
            "governanceControls": ["Human approval checkpoints", "Immutable audit log database"],
            "auditRequirements": ["Audit transaction status codes, amounts, and reference IDs"],
            "dataRetentionPolicies": ["Retain financial records for 7 years"],
            "riskAssessment": ["Review payment gateway credentials quarterly"],
        }
    elif domain == "ecommerce":
        return {
            "complianceAssessment": {"standards": ["PCI-DSS v4.0", "GDPR"], "gaps": ["Payment log tokenization"], "recommendations": ["Never log raw card details"]},
            "governanceControls": ["Payment gateway access segregation", "Automated billing audit reports"],
            "auditRequirements": ["Audit transaction codes, customer emails, and payment references"],
            "dataRetentionPolicies": ["Retain order records for 7 years"],
            "riskAssessment": ["Review gateway credentials regularly"],
        }
    elif domain == "education":
        return {
            "complianceAssessment": {"standards": ["FERPA", "SOC 2"], "gaps": ["Grade record access tracking"], "recommendations": ["Restrict grade edits strictly to course instructors"]},
            "governanceControls": ["Registrar change approvals", "Student credential ACLs"],
            "auditRequirements": ["Audit grade modifications, tuition invoices, and login events"],
            "dataRetentionPolicies": ["Permanent retention for academic transcripts"],
            "riskAssessment": ["Verify sync endpoints are properly firewalled"],
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "complianceAssessment": {"standards": ["SOC 2 Type II", "GDPR"], "gaps": ["Log retention policy review"], "recommendations": ["Configure log rotation and archiving"]},
            "governanceControls": ["Production build approval gates", "Read-only DB user groups"],
            "auditRequirements": [f"Record all configuration changes in {proj_name}"],
            "dataRetentionPolicies": ["Retain application access records for 1 year"],
            "riskAssessment": ["Scan third-party dependencies for vulnerabilities regularly"],
        }


# ---------------------------------------------------------------------------
# 11. Security
# ---------------------------------------------------------------------------
def get_security(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "securityArchitecture": {"layers": ["WAF", "API Gateway", "Encrypted DB Layer"], "controls": ["TLS 1.3", "HIPAA Auth", "RBAC", "Field Encryption"], "patterns": ["Least Privilege", "Audit Trails"]},
            "threatModel": ["Unauthorized PHI access", "CSRF mutations", "SQL injection"],
            "authentication": {"strategy": "JWT + MFA", "providers": ["Medical SSO"], "mfa": True, "sessionManagement": "Auto-expire after 15 minutes"},
            "authorization": {"model": "RBAC", "roles": ["Doctor", "Nurse", "Registrar", "Admin"], "permissions": ["Read PHI", "Write Prescription", "Edit Appointment"], "policies": ["Departmental access boundaries"]},
            "securityControls": ["Input validation", "SQL parameterization", "Access logging", "Key rotation"],
            "securityChecklist": ["HIPAA review", "OWASP pen test", "SAST scan", "DAST scan"],
        }
    elif domain in ("banking", "erp"):
        return {
            "securityArchitecture": {"layers": ["WAF", "App Layer", "Secure DB"], "controls": ["TLS 1.3", "JWT cookies", "RBAC", "Bcrypt passwords"], "patterns": ["Least Privilege", "Defense in Depth"]},
            "threatModel": ["Credential stuffing", "Broken access control", "SQL injection", "Session hijacking"],
            "authentication": {"strategy": "Short-lived JWT session cookies", "providers": ["Local"], "mfa": True, "sessionManagement": "Rotating refresh tokens"},
            "authorization": {"model": "RBAC", "roles": ["admin", "developer", "approver", "viewer"], "permissions": ["read", "generate", "approve", "administer"], "policies": ["Project-scoped access"]},
            "securityControls": ["Input validation", "Rate limiting on auth", "Audit trail", "Secret encryption"],
            "securityChecklist": ["OWASP Top 10 review", "Dependency scan", "SAST", "DAST"],
        }
    elif domain == "ecommerce":
        return {
            "securityArchitecture": {"layers": ["Cloudflare WAF", "API Gateway", "Tokenized DB"], "controls": ["TLS 1.3", "JWT Auth", "Secure Cookies", "Data masking"], "patterns": ["Defense in Depth", "Payment Tokenization"]},
            "threatModel": ["Cart price manipulation", "SQL injection on search", "Payment bypass"],
            "authentication": {"strategy": "OAuth2 + JWT", "providers": ["Email", "Google SSO"], "mfa": False, "sessionManagement": "Persistent login with refresh"},
            "authorization": {"model": "RBAC", "roles": ["Customer", "Merchant", "Support", "InventoryManager"], "permissions": ["Create Order", "Modify Catalog", "Process Refund"], "policies": ["Cardholder data separation"]},
            "securityControls": ["Stripe Elements validation", "Search input escaping", "API rate limiting"],
            "securityChecklist": ["PCI compliance audit", "Dynamic security tests", "Package scanning"],
        }
    elif domain == "education":
        return {
            "securityArchitecture": {"layers": ["Intranet Firewall", "Spring Gateway", "Oracle SSL Bridge"], "controls": ["TLS 1.3", "LDAP Auth", "ACL lists", "VLAN segmentation"], "patterns": ["Least Privilege", "DMZ"]},
            "threatModel": ["Grade tampering", "Student record leaks", "DoS on registration"],
            "authentication": {"strategy": "LDAP SSO", "providers": ["University SSO"], "mfa": True, "sessionManagement": "Single session per user"},
            "authorization": {"model": "RBAC", "roles": ["Student", "Instructor", "Registrar", "Advisor"], "permissions": ["Register Course", "Submit Grade", "Edit Transcript"], "policies": ["FERPA access controls"]},
            "securityControls": ["Pre-req checking triggers", "Grade entry auditing", "Access control validation"],
            "securityChecklist": ["University compliance assessment", "DB penetration testing", "FERPA audit"],
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "securityArchitecture": {"layers": ["Application Edge", "API Layer", "Database Layer"], "controls": ["TLS 1.3", "JWT Cookies", "RBAC", "Bcrypt"], "patterns": ["Secure Defaults", "Separation of Concerns"]},
            "threatModel": [f"Unauthorized {info['secondary']} editing", "Brute force logins", "SQL injection"],
            "authentication": {"strategy": "Short-lived JWT tokens", "providers": ["Email"], "mfa": False, "sessionManagement": "Token refresh rotation"},
            "authorization": {"model": "RBAC", "roles": ["Administrator", "StandardUser", "Viewer"], "permissions": ["Read", "Write", "Administer"], "policies": [f"{proj_name} workspace boundaries"]},
            "securityControls": ["Auth rate limiting", "ORM query binding", "CSRF tokens"],
            "securityChecklist": ["OWASP Top 10 assessment", "Dependency scanning", "Audit log checks"],
        }


# ---------------------------------------------------------------------------
# 12. Documentation
# ---------------------------------------------------------------------------
def get_documentation(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    domain_module = {
        "healthcare": "- **Patients**: HIPAA-compliant PHI registry.\n- **Appointments**: Real-time scheduling system.\n- **Prescriptions**: Electronic pharmacy integration.",
        "banking": "- **Accounts**: Secure banking portal.\n- **Transactions**: Ledger and transfer APIs.\n- **Auth**: JWT session management.",
        "erp": "- **Inventory**: Stock and procurement tracking.\n- **Suppliers**: Vendor relationship management.\n- **Reports**: Operational dashboards.",
        "ecommerce": "- **Catalog**: High-performance product grid.\n- **Checkout**: Stripe payment gateway.\n- **Orders**: Order lifecycle management.",
        "education": "- **Registration**: Academic course scheduler.\n- **Grading**: Faculty transcript portal.\n- **Students**: FERPA-compliant records.",
    }.get(domain, f"- **{infer_domain_keywords(proj_name)['primary']} Workspace**: Managing custom records.\n- **Dashboard**: General monitoring portal.")

    readme = (
        f"# {proj_name}\n\n"
        f"Enterprise software platform for **{proj_name}**.\n\n"
        "## Setup\n"
        "1. Copy `.env.example` to `.env` and configure values.\n"
        "2. Install dependencies: `pip install -r requirements.txt`\n"
        "3. Run migrations: `python db_setup.py`\n"
        "4. Start server: `uvicorn main:app --reload`\n\n"
        "## Modules\n"
        f"{domain_module}\n"
    )
    return {
        "readme": readme,
        "setup_script": "#!/bin/bash\ncp .env.example .env\npip install -r requirements.txt\npython db_setup.py\nuvicorn main:app --reload\n",
        "api_spec": {
            "swagger": "2.0",
            "info": {"title": proj_name, "version": "1.0.0"},
            "paths": {},
        },
    }


# ---------------------------------------------------------------------------
# 13. Presentation
# ---------------------------------------------------------------------------
def get_presentation(proj_name_or_db: Any, project_id: int = None) -> dict:
    db = proj_name_or_db if not isinstance(proj_name_or_db, str) else None
    proj_name = get_project_name(db, project_id) if db else (
        proj_name_or_db if isinstance(proj_name_or_db, str) else "Autonomous Software Studio"
    )
    domain = classify_domain(db, project_id) if db else "general"

    if domain == "healthcare":
        return {
            "title": f"{proj_name} - Executive Overview",
            "slides": [
                {"title": "Patient Care Portal", "content": "Autonomous health record management with HIPAA compliance.", "speaker_notes": "Introduce patient dashboard and EHR integration goals."},
                {"title": "Clinical Dashboard", "content": "Doctor scheduler and electronic prescription delivery.", "speaker_notes": "Show clinical schedule conflict resolution logic."},
                {"title": "Security & Compliance", "content": "HIPAA, SOC 2 controls with immutable audit trails.", "speaker_notes": "Highlight encryption and access control measures."},
            ],
        }
    elif domain in ("banking", "erp"):
        return {
            "title": f"{proj_name} - Executive Overview",
            "slides": [
                {"title": "Secure Client Portal", "content": "Dynamic balance overview and transaction ledger.", "speaker_notes": "Walk through account audit capabilities."},
                {"title": "Compliance & Security", "content": "SOC 2 Type II and PCI-DSS controls.", "speaker_notes": "Explain JWT rotation and rate limiting."},
            ],
        }
    elif domain == "ecommerce":
        return {
            "title": f"{proj_name} - Product Briefing",
            "slides": [
                {"title": "Catalog Showcase", "content": "High-performance product browsing with infinite scroll.", "speaker_notes": "Discuss cache invalidation strategy."},
                {"title": "Checkout & Payment", "content": "PCI-DSS checkout with Stripe Elements.", "speaker_notes": "Explain tokenization flow."},
            ],
        }
    elif domain == "education":
        return {
            "title": f"{proj_name} - Platform Overview",
            "slides": [
                {"title": "Class Registry Portal", "content": "Course selection with pre-requisite validation.", "speaker_notes": "Detail the Spring Cloud gateway integration."},
                {"title": "Academic Records", "content": "FERPA-secured transcripts and grade management.", "speaker_notes": "Highlight audit trail on grade entries."},
            ],
        }
    else:
        info = infer_domain_keywords(proj_name)
        return {
            "title": f"{proj_name} - Pitch Deck",
            "slides": [
                {"title": f"Introducing {proj_name}", "content": f"AI-orchestrated platform to streamline {info['subject']} operations.", "speaker_notes": "Present main goals and key requirements."},
                {"title": "Architecture Overview", "content": "Secure SPA with RESTful API and PostgreSQL backend.", "speaker_notes": "Walk through request lifecycle from UI to database."},
                {"title": "Security & Compliance", "content": "SOC 2 Type II controls with RBAC and audit logging.", "speaker_notes": "Discuss RBAC roles and access boundaries."},
            ],
        }
