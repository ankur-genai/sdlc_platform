import sys
import requests

# Enforce UTF-8 stdout encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8008"

def test_split_script_endpoint():
    print("=== TESTING PASTE COMPLETE SCRIPT AI SPLITTING ENDPOINT ===")
    
    test_slides = [
        {"id": "0", "title": "SDLC Platform Overview", "content": "Autonomous platform with 15 AI agents"},
        {"id": "1", "title": "System Architecture", "content": "React 18 SPA + FastAPI + PostgreSQL"},
        {"id": "2", "title": "Business ROI & Impact", "content": "85% faster delivery and 99.4% security pass rate"}
    ]
    
    raw_script_explicit = """
Slide 1: Welcome to our autonomous SDLC platform overview. Today we present how 15 specialized agents drive software delivery.

Slide 2: In our technical architecture, a React single page application communicates asynchronously with FastAPI and PostgreSQL.

Slide 3: Finally, the business impact is clear with an 85 percent reduction in lead time and exceptional security compliance.
"""

    payload = {
        "raw_script": raw_script_explicit,
        "slides": test_slides
    }
    
    try:
        res = requests.post(f"{BASE_URL}/projects/187/presentation/split-script", json=payload)
        print("API Status Code:", res.status_code)
        data = res.json()
        print("API Response Data:", data)
        
        assert res.status_code == 200
        assert data.get("success") is True
        assert "0" in data.get("mapped_notes", {})
        assert "1" in data.get("mapped_notes", {})
        assert "2" in data.get("mapped_notes", {})
        assert "Welcome to our autonomous SDLC platform" in data["mapped_notes"]["0"]
        assert "React single page application" in data["mapped_notes"]["1"]
        assert "business impact is clear" in data["mapped_notes"]["2"]
        print("SUCCESS: TEST 1 PASSED: Explicit Slide Headers mapped correctly into text blocks!")
    except Exception as e:
        print("FAILURE: TEST 1 FAILED:", e)

    # Test 2: Unstructured Paragraphs matching by keywords
    raw_script_keywords = """
Welcome everyone. Our autonomous SDLC platform leverages 15 agents to transform software development end to end.

Looking at system architecture, our React 18 frontend connects to FastAPI and PostgreSQL as the single source of truth.

In terms of business ROI, we deliver an 85% speed improvement and 99.4% pass rate across security audits.
"""
    
    payload_kw = {
        "raw_script": raw_script_keywords,
        "slides": test_slides
    }
    
    try:
        res2 = requests.post(f"{BASE_URL}/projects/187/presentation/split-script", json=payload_kw)
        data2 = res2.json()
        print("Keyword Test Response:", data2)
        assert res2.status_code == 200
        assert data2.get("success") is True
        assert len(data2.get("mapped_notes", {})) == 3
        print("SUCCESS: TEST 2 PASSED: Paragraph & keyword mapping resolved correctly!")
    except Exception as e:
        print("FAILURE: TEST 2 FAILED:", e)

if __name__ == "__main__":
    test_split_script_endpoint()
