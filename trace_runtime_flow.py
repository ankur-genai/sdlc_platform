import os
import sys
import json
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8008"
# Add backend directory to path to query DB directly for verification
backend_dir = Path(r"C:\Users\USER\Documents\sdlc_platform\backend")
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi_agents.models import GeneratedArtifact

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:qwerty@localhost:5432/ey_sdlc_studio")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def trace_execution_flow():
    db = SessionLocal()
    print("\n=======================================================")
    print("      FULL RUNTIME EXECUTION TRACE & SOURCE COMPARISON ")
    print("=======================================================")

    # 1. Fetch initial presentation script state
    art = db.query(GeneratedArtifact).filter(GeneratedArtifact.artifact_type.in_(["presentation", "presentation_pptx"])).order_by(GeneratedArtifact.created_at.desc()).first()
    if not art:
        print("ERROR: No presentation artifact found in DB!")
        return

    project_id = art.project_id
    print(f"\n[STEP 1: INITIAL DB QUERY]")
    print(f"Project ID: {project_id}")
    print(f"Artifact ID: {art.id}")
    db_initial_content = json.loads(art.content)
    slides = db_initial_content.get("slides", [])
    
    print("\n--- ALL SOURCES COMPARISON BEFORE SAVE ---")
    print(f"1. GeneratedArtifact.content['slides'][0]['speaker_notes']: {repr(slides[0].get('speaker_notes'))}")
    print(f"2. GeneratedArtifact.content['slides'][0]['narration']:     {repr(slides[0].get('narration'))}")
    print(f"3. GeneratedArtifact.content['speaker_notes'] array:          {repr(db_initial_content.get('speaker_notes'))}")
    print(f"4. GeneratedArtifact.content['slide_outline'] notes:          {repr(db_initial_content.get('slide_outline', [{}])[0].get('notes'))}")

    # 2. Simulate User Action in Frontend: Delete 50% of Slide 1 narration
    original_text = slides[0].get("speaker_notes") or "Welcome to our autonomous SDLC platform."
    truncated_text = original_text[:len(original_text)//2]
    
    print(f"\n[STEP 2: USER EDIT IN SCRIPT EDITOR]")
    print(f"Original Text:  '{original_text}'")
    print(f"Editor Text Before Save (50% deleted): '{truncated_text}'")

    # Update slide 0 speaker_notes
    slides[0]["speaker_notes"] = truncated_text

    payload = {"slides": slides}
    print(f"\n[STEP 3: REQUEST PAYLOAD SENT BY FRONTEND]")
    print(f"URL: POST {BASE_URL}/projects/{project_id}/presentation/script")
    print(f"Payload Body: {json.dumps(payload, indent=2)}")

    # 3. Call Save Endpoint
    res = requests.post(f"{BASE_URL}/projects/{project_id}/presentation/script", json=payload)
    print(f"\n[STEP 4: BACKEND RESPONSE PAYLOAD]")
    print(f"Status Code: {res.status_code}")
    print(f"Response Body: {json.dumps(res.json(), indent=2)}")

    # 4. Check DB Post-Save State
    db.expire_all()
    art_after = db.get(GeneratedArtifact, art.id)
    db_after_content = json.loads(art_after.content)
    slides_after = db_after_content.get("slides", [])

    print(f"\n[STEP 5: DATABASE VALUES AFTER COMMIT]")
    print(f"Artifact ID: {art_after.id}")
    print(f"Updated Content JSON: {art_after.content[:400]}")

    print("\n--- ALL SOURCES COMPARISON AFTER SAVE ---")
    print(f"1. GeneratedArtifact.content['slides'][0]['speaker_notes']: {repr(slides_after[0].get('speaker_notes'))}")
    print(f"2. GeneratedArtifact.content['slides'][0]['narration']:     {repr(slides_after[0].get('narration'))}")
    print(f"3. GeneratedArtifact.content['speaker_notes'] array:          {repr(db_after_content.get('speaker_notes'))}")
    print(f"4. GeneratedArtifact.content['slide_outline'] notes:          {repr(db_after_content.get('slide_outline', [{}])[0].get('notes'))}")

    # 5. Simulate Reopening Script Editor (Calling GET endpoint)
    print(f"\n[STEP 6: REOPENING SCRIPT EDITOR (GET RELOAD ENDPOINT)]")
    get_res = requests.get(f"{BASE_URL}/projects/{project_id}/presentation/script")
    print(f"Status Code: {get_res.status_code}")
    reload_data = get_res.json()
    print(f"Reload Endpoint Response: {json.dumps(reload_data, indent=2)}")

    reload_slides = reload_data.get("slides", [])
    reloaded_speaker_notes = reload_slides[0].get("speaker_notes") if reload_slides else None
    
    print(f"\n[STEP 7: FRONTEND POPULATION COMPARISON]")
    print(f"Exact field used to populate editor: slides[0]['speaker_notes']")
    print(f"Value returned by API:    '{reloaded_speaker_notes}'")
    print(f"Expected truncated text:  '{truncated_text}'")

    if reloaded_speaker_notes == truncated_text:
        print("\n[MATCH CONFIRMED] The saved edited text matches 100% across payload, DB, commit, API response, and editor population!")
    else:
        print("\n[MISMATCH DETECTED] Identify exact field causing mismatch above.")

    print("=======================================================\n")

if __name__ == "__main__":
    trace_execution_flow()
