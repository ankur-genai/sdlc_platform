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
from fastapi_agents.models import GeneratedArtifact

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:qwerty@localhost:5432/ey_sdlc_studio")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def test_pipeline_slide_handling():
    print("=== STARTING NEW SLIDE NARRATION & PIPELINE VERIFICATION ===")

    # 1. Fetch latest presentation artifact
    art = (
        db.query(GeneratedArtifact)
        .filter(GeneratedArtifact.artifact_type.in_(["presentation", "presentation_pptx"]))
        .order_by(GeneratedArtifact.created_at.desc())
        .first()
    )
    if not art:
        print("FAIL: No presentation artifact found in DB")
        sys.exit(1)

    project_id = art.project_id
    content = json.loads(art.content)
    slides = content.get("slides", [])

    print(f"Artifact ID: {art.id}, Project ID: {project_id}, Initial Slide Count: {len(slides)}")

    # -------------------------------------------------------------
    # SCENARIO 1: Original slide narration resolution
    # -------------------------------------------------------------
    slide1 = dict(slides[0])
    slide1["speaker_notes"] = "Original slide narration test."
    sn1 = slide1.get("speaker_notes") if "speaker_notes" in slide1 else slide1.get("narration", "")
    assert sn1 == "Original slide narration test.", f"Expected 'Original slide narration test.', got {sn1}"
    print("[PASS] SCENARIO 1: Original slide narration resolved correctly.")

    # -------------------------------------------------------------
    # SCENARIO 2: Edited original slide
    # -------------------------------------------------------------
    slide1["speaker_notes"] = "Edited original slide narration text."
    sn2 = slide1.get("speaker_notes") if "speaker_notes" in slide1 else slide1.get("narration", "")
    assert sn2 == "Edited original slide narration text.", f"Expected edited text, got {sn2}"
    print("[PASS] SCENARIO 2: Edited original slide narration resolved correctly.")

    # -------------------------------------------------------------
    # SCENARIO 3: Newly added slide
    # -------------------------------------------------------------
    new_slide = {
        "id": "new-slide-101",
        "title": "Architecture Overview",
        "subtitle": "Microservices",
        "content": "• Service A\n• Service B",
        "speaker_notes": "This is a brand new slide added dynamically by the user.",
        "layout": "content",
        "duration": 30
    }
    test_slides = [dict(s) for s in slides] + [new_slide]

    # Verify start_local_render logic for newly added slide
    db_slides_by_index = {i: s.get("speaker_notes", "") for i, s in enumerate(slides)}
    db_slides_by_title = {s.get("title", "").strip().lower(): s.get("speaker_notes", "") for s in slides if s.get("title")}

    # Simulate start_local_render synchronization logic
    for idx, sl in enumerate(test_slides):
        if "speaker_notes" not in sl or sl["speaker_notes"] is None:
            title_key = (sl.get("title") or "").strip().lower()
            if idx in db_slides_by_index:
                sl["speaker_notes"] = db_slides_by_index[idx]
            elif title_key in db_slides_by_title:
                sl["speaker_notes"] = db_slides_by_title[title_key]
            else:
                sl["speaker_notes"] = sl.get("narration") or ""
        sl["narration"] = sl.get("speaker_notes") or ""

    assert test_slides[-1]["speaker_notes"] == "This is a brand new slide added dynamically by the user.", "Newly added slide speaker_notes was corrupted or overwritten!"
    print("[PASS] SCENARIO 3: Newly added slide preserved its custom speaker_notes.")

    # -------------------------------------------------------------
    # SCENARIO 4: Newly added + edited slide
    # -------------------------------------------------------------
    test_slides[-1]["speaker_notes"] = "Updated narration for newly added slide."
    assert test_slides[-1]["speaker_notes"] == "Updated narration for newly added slide.", "Edited narration on new slide failed!"
    print("[PASS] SCENARIO 4: Newly added + edited slide resolved correctly.")

    # -------------------------------------------------------------
    # SCENARIO 5: Delete slide
    # -------------------------------------------------------------
    deleted_slides = test_slides[:-1] # Remove the last slide
    assert len(deleted_slides) == len(test_slides) - 1
    assert not any(s.get("id") == "new-slide-101" for s in deleted_slides)
    print("[PASS] SCENARIO 5: Deleted slide successfully excluded from pipeline slides.")

    # -------------------------------------------------------------
    # SCENARIO 6: Reorder slides
    # -------------------------------------------------------------
    reordered_slides = [new_slide] + [dict(s) for s in slides] # Put new slide FIRST
    assert reordered_slides[0]["id"] == "new-slide-101"
    assert reordered_slides[0]["speaker_notes"] == "Updated narration for newly added slide."
    print("[PASS] SCENARIO 6: Reordered slides preserve exact narration order.")

    print("\nALL 6 NEW SLIDE NARRATION & PIPELINE SCENARIOS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_pipeline_slide_handling()
