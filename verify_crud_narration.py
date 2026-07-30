import os
import sys
import json
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(r"C:\Users\USER\Documents\sdlc_platform\backend")
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi_agents.models import GeneratedArtifact, ArtifactType

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:qwerty@localhost:5432/ey_sdlc_studio")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def verify_narration_crud():
    print("=== STARTING FULL NARRATION CRUD VERIFICATION ===")
    
    # 1. Fetch or create a test presentation artifact
    artifact = (
        db.query(GeneratedArtifact)
        .filter(GeneratedArtifact.artifact_type.in_(["presentation", "presentation_pptx"]))
        .order_by(GeneratedArtifact.created_at.desc())
        .first()
    )

    if not artifact:
        print("ERROR: No presentation artifact found in DB!")
        sys.exit(1)

    print(f"Artifact ID: {artifact.id}, Project ID: {artifact.project_id}")
    data = json.loads(artifact.content)
    slides = data.get("slides", [])
    if not slides:
        print("ERROR: No slides in artifact!")
        sys.exit(1)

    print(f"Original Slide 1 speaker_notes: '{slides[0].get('speaker_notes')}'")

    # --- TEST 1: REPLACE ENTIRE NARRATION ---
    new_text_replace = "Welcome to our enterprise AI platform, delivering autonomous SDLC capabilities from end to end."
    slides[0]["speaker_notes"] = new_text_replace
    data["slides"] = slides
    data["speaker_notes"] = [{"slide_number": i + 1, "notes": s.get("speaker_notes", "")} for i, s in enumerate(slides)]
    artifact.content = json.dumps(data, ensure_ascii=False)
    db.commit()

    # Re-query DB to verify persistence
    db.expire_all()
    art_check = db.get(GeneratedArtifact, artifact.id)
    check_data = json.loads(art_check.content)
    reloaded_notes_1 = check_data["slides"][0]["speaker_notes"]
    assert reloaded_notes_1 == new_text_replace, f"Mismatch: {reloaded_notes_1} != {new_text_replace}"
    print(f"[PASS] TEST 1 (Replace Entire): Persisted '{reloaded_notes_1}'")

    # --- TEST 2: DELETE HALF NARRATION ---
    new_text_half = "Welcome to our enterprise AI platform."
    slides[0]["speaker_notes"] = new_text_half
    data["slides"] = slides
    data["speaker_notes"] = [{"slide_number": i + 1, "notes": s.get("speaker_notes", "")} for i, s in enumerate(slides)]
    artifact.content = json.dumps(data, ensure_ascii=False)
    db.commit()

    db.expire_all()
    art_check = db.get(GeneratedArtifact, artifact.id)
    check_data = json.loads(art_check.content)
    reloaded_notes_2 = check_data["slides"][0]["speaker_notes"]
    assert reloaded_notes_2 == new_text_half, f"Mismatch: {reloaded_notes_2} != {new_text_half}"
    print(f"[PASS] TEST 2 (Delete Half): Persisted '{reloaded_notes_2}'")

    # --- TEST 3: CLEAR COMPLETE NARRATION (EMPTY STRING) ---
    new_text_clear = ""
    slides[0]["speaker_notes"] = new_text_clear
    data["slides"] = slides
    data["speaker_notes"] = [{"slide_number": i + 1, "notes": s.get("speaker_notes", "")} for i, s in enumerate(slides)]
    artifact.content = json.dumps(data, ensure_ascii=False)
    db.commit()

    db.expire_all()
    art_check = db.get(GeneratedArtifact, artifact.id)
    check_data = json.loads(art_check.content)
    reloaded_notes_3 = check_data["slides"][0]["speaker_notes"]
    assert reloaded_notes_3 == "", f"Mismatch: '{reloaded_notes_3}' != ''"
    print(f"[PASS] TEST 3 (Clear Complete): Persisted empty string ''")

    # --- TEST 4: ADD COMPLETELY NEW NARRATION ---
    new_text_add = "This is a freshly added voice-over narration for the enterprise presentation video."
    slides[0]["speaker_notes"] = new_text_add
    data["slides"] = slides
    data["speaker_notes"] = [{"slide_number": i + 1, "notes": s.get("speaker_notes", "")} for i, s in enumerate(slides)]
    artifact.content = json.dumps(data, ensure_ascii=False)
    db.commit()

    db.expire_all()
    art_check = db.get(GeneratedArtifact, artifact.id)
    check_data = json.loads(art_check.content)
    reloaded_notes_4 = check_data["slides"][0]["speaker_notes"]
    assert reloaded_notes_4 == new_text_add, f"Mismatch: '{reloaded_notes_4}' != '{new_text_add}'"
    print(f"[PASS] TEST 4 (Add New): Persisted '{reloaded_notes_4}'")

    # --- TEST 5: PIPELINE RESOLUTION SIMULATION ---
    # Test presentation_routes.py DB sync logic
    db_slides_by_index = {}
    for idx, s in enumerate(check_data["slides"]):
        sn = s.get("speaker_notes") if "speaker_notes" in s else (s.get("narration") or "")
        db_slides_by_index[idx] = (sn or "").strip()

    test_slide = {"title": "Test Title", "speaker_notes": "Old default"}
    if 0 in db_slides_by_index:
        test_slide["speaker_notes"] = db_slides_by_index[0]
        test_slide["narration"] = db_slides_by_index[0]

    assert test_slide["speaker_notes"] == new_text_add, f"Pipeline sync mismatch: '{test_slide['speaker_notes']}'"
    print(f"[PASS] TEST 5 (Pipeline Resolution Sync): Resolved '{test_slide['speaker_notes']}'")

    print("\nALL 5 CRUD NARRATION VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    verify_narration_crud()
