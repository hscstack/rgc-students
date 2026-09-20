#!/usr/bin/env python3
"""
SSC Data Enricher for Rangpur Govt College Student Directory.
Matches RGC students against Dinajpur Education Board SSC results database
to extract SSC Total Marks, SSC GPA, Previous School, and SSC Roll number.
"""

import os
import re
import json
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
STUDENTS_JSON = BASE_DIR / "students.json"
STUDENTS_JS = BASE_DIR / "students_data.js"

POSSIBLE_LEADERBOARD_PATHS = [
    Path("/home/tajim/Projects/html/dinajpur/data/leaderboard.json"),
    BASE_DIR.parent / "dinajpur" / "data" / "leaderboard.json",
]


def normalize_name(name: str) -> str:
    """Normalize student name by removing special characters, punctuation, and extra spaces while preserving full prefixes."""
    if not name:
        return ""
    name = str(name).upper().strip()
    name = re.sub(r"[^A-Z0-9\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def format_school_name(raw_name: str) -> str:
    """Format all-caps school names into clean, readable title casing preserving acronyms."""
    if not raw_name:
        return ""
    raw_name = raw_name.replace("&amp;", "&").replace("&039;", "'").replace("&#039;", "'")
    words = raw_name.split()
    formatted_words = []
    
    acronyms = {
        "A.U.", "A.", "U.", "N.S.", "S.S.", "B.L.", "M.R.", "BL.", "MR.", "SS.", "AU.", "NS.",
        "CPSCR", "CPSC", "II", "III", "IV", "V", "BGB", "PSC", "JSC", "SSC", "HSC", "IGS"
    }
    
    for i, word in enumerate(words):
        upper_word = word.upper().strip(",")
        has_comma = word.endswith(",")
        
        if upper_word in acronyms:
            formatted = upper_word
        elif upper_word in {"AND", "&", "OF", "THE", "IN", "AT", "FOR"}:
            formatted = word.lower() if i > 0 else word.capitalize()
        else:
            # Check hyphenated parts like AMENA-BAKI or AL-HASANAH
            parts = word.split("-")
            formatted = "-".join(p.capitalize() for p in parts)
            
        if has_comma and not formatted.endswith(","):
            formatted += ","
        formatted_words.append(formatted)
        
    return " ".join(formatted_words)


def load_dinajpur_leaderboard():
    """Locate and load the Dinajpur board SSC leaderboard JSON dataset."""
    for p in POSSIBLE_LEADERBOARD_PATHS:
        if p.exists():
            try:
                print(f"[+] Loading Dinajpur SSC database from: {p}")
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[-] Failed to load {p}: {e}")
    print("[-] Warning: Dinajpur leaderboard.json not found in candidate paths.")
    return None


def enrich_student_record(student: dict, exact_map: dict, schools: list[str]) -> dict:
    """Enrich a single student record with SSC details only on 100% strictly exact unique match."""
    r_name = student.get("Name", "")
    r_norm = normalize_name(r_name)
    
    candidate = None
    # Strictly single unique 100% exact full name match across the entire board
    if r_norm and r_norm in exact_map and len(exact_map[r_norm]) == 1:
        candidate = exact_map[r_norm][0]
            
    if candidate:
        # candidate: [id, name, school_idx, upz_idx, dist_idx, grp_idx, gpa, mark, globalRank, is_passed, roll]
        sch_idx = candidate[2]
        raw_school = schools[sch_idx] if 0 <= sch_idx < len(schools) else ""
        student["SSC_Marks"] = int(candidate[7]) if candidate[7] is not None else None
        student["SSC_GPA"] = float(candidate[6]) if candidate[6] is not None else None
        student["Previous_School"] = format_school_name(raw_school)
        student["SSC_Roll"] = str(candidate[10]) if len(candidate) > 10 and candidate[10] else ""
    else:
        student["SSC_Marks"] = None
        student["SSC_GPA"] = None
        student["Previous_School"] = ""
        student["SSC_Roll"] = ""
        
    return student


def enrich_all_students(save: bool = True):
    """Load, enrich, and save all student records."""
    leaderboard = load_dinajpur_leaderboard()
    if not leaderboard:
        return
        
    schools = leaderboard.get("schools", [])
    d_students = leaderboard.get("students", [])
    
    print(f"[*] Building 100% exact lookup index over {len(d_students):,} SSC student records...")
    exact_map = {}
    
    for s in d_students:
        s_name = s[1]
        norm = normalize_name(s_name)
        if norm:
            if norm not in exact_map:
                exact_map[norm] = []
            exact_map[norm].append(s)
            
    if not STUDENTS_JSON.exists():
        print(f"[-] {STUDENTS_JSON} not found.")
        return
        
    with open(STUDENTS_JSON, "r", encoding="utf-8") as f:
        students = json.load(f)
        
    matched_count = 0
    for student in students:
        enrich_student_record(student, exact_map, schools)
        if student.get("SSC_Marks") is not None:
            matched_count += 1
            
    print(f"[✓] Successfully enriched {matched_count} of {len(students)} students ({(matched_count/len(students))*100:.1f}%) with 100% strictly exact matches.")
    
    if save:
        # Sort by Roll number
        sorted_students = sorted(
            students,
            key=lambda x: int(x["Roll"]) if str(x.get("Roll", "")).isdigit() else str(x.get("Roll", ""))
        )
        
        with open(STUDENTS_JSON, "w", encoding="utf-8") as f:
            json.dump(sorted_students, f, indent=4, ensure_ascii=False)
        print(f"[+] Updated {STUDENTS_JSON}")
        
        if STUDENTS_JS.exists() or True:
            with open(STUDENTS_JS, "w", encoding="utf-8") as f:
                f.write("// Auto-generated student dataset fallback\n")
                f.write("window.INITIAL_STUDENTS_DATA = " + json.dumps(sorted_students, ensure_ascii=False) + ";\n")
            print(f"[+] Updated {STUDENTS_JS}")


if __name__ == "__main__":
    enrich_all_students(save=True)
