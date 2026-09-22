#!/usr/bin/env python3
"""
RGC Student Directory — Incremental Live Fetcher
Fetches latest registered students from Rangpur Govt College portal (rgc.eshiksaems.com).
Automatically enriches Previous School on 100% exact unique match from Dinajpur Board SSC database.
Automatically continues from (highest recorded roll + 1) and stops after consecutive empty rolls.
"""

import sys
import os
import re
import json
import time
import argparse
from pathlib import Path
import urllib.request
import urllib.parse

BASE_URL = "https://rgc.eshiksaems.com"
ENDPOINT_URL = f"{BASE_URL}/controller_student_module.php"
DEFAULT_JSON_FILE = "students.json"
DEFAULT_JS_FILE = "students_data.js"
DEFAULT_PHPSESSID = os.environ.get("PHPSESSID", "6u5qq9c9btltikmsrbcadig53u")

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE_URL}/Result-Enquiry-Center",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": BASE_URL,
}

POSSIBLE_LEADERBOARD_PATHS = [
    Path(os.environ.get("DINAJPUR_LEADERBOARD_PATH", "")) if os.environ.get("DINAJPUR_LEADERBOARD_PATH") else None,
    Path("/home/tajim/Projects/ssc2026-dinajpur-leaderboard/data/leaderboard.json"),
    Path(__file__).parent.parent / "ssc2026-dinajpur-leaderboard" / "data" / "leaderboard.json",
    Path("/home/tajim/Projects/html/dinajpur/data/leaderboard.json"),
    Path(__file__).parent.parent / "dinajpur" / "data" / "leaderboard.json",
    Path(__file__).parent.parent.parent / "Projects" / "html" / "dinajpur" / "data" / "leaderboard.json",
]


def normalize_name(name: str) -> str:
    """Normalize student name by removing special characters, punctuation, and extra spaces."""
    if not name:
        return ""
    name = str(name).upper().strip()
    name = re.sub(r"[^A-Z0-9\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def format_school_name(raw_name: str) -> str:
    """Format all-caps school names into clean, readable title casing preserving acronyms and initials."""
    if not raw_name:
        return ""
    raw_name = raw_name.replace("&amp;", "&").replace("&039;", "'").replace("&#039;", "'")
    words = raw_name.split()
    formatted_words = []

    lower_words = {"AND", "&", "OF", "THE", "IN", "AT", "FOR"}
    known_acronyms = {
        "CPSCR", "CPSC", "II", "III", "IV", "V", "BGB", "PSC", "JSC", "SSC", "HSC",
        "IGS", "NGO", "BRAC", "BL", "ML", "AU", "SS", "MR", "NS", "BMPBL", "AK", "CPSCP"
    }

    for i, word in enumerate(words):
        clean_word = word.rstrip(",")
        has_comma = word.endswith(",")
        upper_clean = clean_word.upper()

        if upper_clean in known_acronyms or re.match(r"^([A-Z]\.)+$", upper_clean):
            formatted = upper_clean
        elif upper_clean in lower_words and i > 0:
            formatted = clean_word.lower()
        else:
            parts = clean_word.split("-")
            formatted = "-".join(p.capitalize() for p in parts)

        if has_comma:
            formatted += ","
        formatted_words.append(formatted)

    return " ".join(formatted_words)


def load_dinajpur_school_map(custom_path: str | None = None) -> dict[str, str]:
    """
    Load Dinajpur SSC leaderboard dataset and construct a 100% exact unique name -> school map.
    Only names with exactly 1 student record across the entire board dataset are mapped.
    """
    target_path = None
    if custom_path:
        p = Path(custom_path)
        if p.exists():
            target_path = p

    if not target_path:
        for p in POSSIBLE_LEADERBOARD_PATHS:
            if p and p.exists():
                target_path = p
                break

    if not target_path:
        print("[-] Notice: Dinajpur board leaderboard.json not found. School enrichment skipped.")
        return {}

    try:
        print(f"[*] Loading Dinajpur Board SSC database from {target_path}...")
        with open(target_path, "r", encoding="utf-8") as f:
            board = json.load(f)

        schools = board.get("schools", [])
        students = board.get("students", [])

        exact_map: dict[str, list[list]] = {}
        for s in students:
            norm = normalize_name(s[1])
            if norm:
                exact_map.setdefault(norm, []).append(s)

        unique_school_map: dict[str, str] = {
            norm: format_school_name(schools[records[0][2]])
            for norm, records in exact_map.items()
            if len(records) == 1 and 0 <= records[0][2] < len(schools)
        }

        print(f"[✓] Indexed {len(unique_school_map):,} unique 100% exact match records from Dinajpur board.")
        return unique_school_map
    except Exception as e:
        print(f"[-] Warning: Failed to load Dinajpur database: {e}")
        return {}


def load_students(file_path: str) -> list[dict]:
    """Load existing students from JSON file."""
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            print(f"[-] Warning: Failed to read {file_path}: {e}")
    return []


def save_students(json_file: str, js_file: str, students: list[dict]):
    """Save sorted students list to both students.json and students_data.js."""
    # Sort strictly by Roll number string/int
    sorted_students = sorted(
        students,
        key=lambda x: int(x["Roll"]) if str(x.get("Roll", "")).isdigit() else str(x.get("Roll", ""))
    )

    # 1. Save JSON
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(sorted_students, f, indent=4, ensure_ascii=False)

    # 2. Save JavaScript bundle fallback
    if js_file:
        try:
            with open(js_file, "w", encoding="utf-8") as f:
                f.write("// Auto-generated student dataset fallback\n")
                f.write("window.INITIAL_STUDENTS_DATA = " + json.dumps(sorted_students, ensure_ascii=False) + ";\n")
        except Exception as e:
            print(f"[-] Warning: Failed to write {js_file}: {e}")


def fetch_student_record(roll_number: str, phpsessid: str, school_map: dict[str, str] | None = None) -> dict | None:
    """Fetch profile data for a specific roll number from the RGC portal and enrich previous school."""
    headers = dict(DEFAULT_HEADERS)
    if phpsessid:
        headers["Cookie"] = f"PHPSESSID={phpsessid.strip()}"

    payload = urllib.parse.urlencode({
        "rootData": str(roll_number).strip(),
        "flagreq": "profileRollCheck"
    }).encode("utf-8")

    req = urllib.request.Request(ENDPOINT_URL, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            html_content = response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  [!] Network error for roll {roll_number}: {e}")
        return None

    # Check if student record exists
    roll_match = re.search(r'id=["\']studentClassRoll["\']\s+value=["\']([^"\']+)["\']', html_content)
    name_match = re.search(r'<label>\s*Name\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>', html_content, re.IGNORECASE)

    if not name_match and not roll_match:
        return None

    student_name = name_match.group(1).strip() if name_match else ""
    if not student_name:
        return None

    info = {
        "Roll": str(roll_number).strip(),
        "Name": student_name
    }

    # Extract optional details
    patterns = {
        "Department": r'<label>\s*Department\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
        "Session": r'<label>\s*Session\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
        "Academic Year": r'<label>\s*Academic\s*Year\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
    }

    for key, pattern in patterns.items():
        m = re.search(pattern, html_content, re.IGNORECASE)
        if m:
            info[key] = m.group(1).strip()

    # Default session fallback if missing
    if "Session" not in info or not info["Session"]:
        info["Session"] = "2026-2027"

    # Enrich Previous School on 100% unique exact name match
    norm_name = normalize_name(student_name)
    info["Previous_School"] = school_map.get(norm_name, "") if school_map else ""

    return info


def backfill_previous_schools(students: list[dict], school_map: dict[str, str]) -> tuple[list[dict], int]:
    """Backfill and update Previous_School for all students using 100% exact unique match."""
    if not school_map:
        return students, 0

    matched_count = 0
    for s in students:
        norm = normalize_name(s.get("Name", ""))
        school = school_map.get(norm, "")
        s["Previous_School"] = school
        if school:
            matched_count += 1

    return students, matched_count


def git_commit_and_push(files: list[str], count: int, total: int):
    """Automatically commit and push updated student files to GitHub."""
    try:
        import subprocess
        # Check if git repo exists
        subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Add files
        subprocess.run(["git", "add"] + files, check=True)
        
        # Check if there are staged changes
        res = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if res.returncode == 0:
            print("[*] No staged changes to commit in git.")
            return

        commit_msg = f"data(update): auto-sync {count} new student record(s) (total: {total})"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True)
        print(f"[+] Git committed: '{commit_msg}'")

        print("[*] Pushing latest data to GitHub (origin main)...")
        push_res = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
        if push_res.returncode == 0:
            print("[✓] Successfully pushed to GitHub!")
        else:
            print(f"[-] Warning: Git push exited with code {push_res.returncode}: {push_res.stderr.strip()}")
    except Exception as e:
        print(f"[-] Auto-git error: {e}")


def run_incremental_fetch(
    json_file: str = DEFAULT_JSON_FILE,
    js_file: str = DEFAULT_JS_FILE,
    phpsessid: str = DEFAULT_PHPSESSID,
    start_roll: int | None = None,
    max_consecutive_misses: int = 5,
    delay: float = 0.25,
    fill_gaps: bool = False,
    auto_push: bool = True,
    dinajpur_db: str | None = None,
    backfill: bool = False
):
    print("=" * 60)
    print("  RGC Students Directory — Incremental Fetcher")
    print("=" * 60)

    school_map = load_dinajpur_school_map(dinajpur_db)
    students = load_students(json_file)

    if backfill and school_map:
        print("\n[*] Running school backfill across existing dataset...")
        students, matched = backfill_previous_schools(students, school_map)
        save_students(json_file, js_file, students)
        print(f"[✓] Backfilled school for {matched}/{len(students)} students ({(matched/len(students))*100:.1f}%).")

    existing_rolls_set = {str(s.get("Roll", "")).strip() for s in students if "Roll" in s}
    numeric_rolls = [int(r) for r in existing_rolls_set if r.isdigit()]

    print(f"[*] Currently recorded: {len(students)} students in {json_file}")

    if numeric_rolls:
        min_roll = min(numeric_rolls)
        max_roll = max(numeric_rolls)
        print(f"[*] Roll Range: {min_roll} → {max_roll}")
    else:
        min_roll = 1262701001
        max_roll = 1262701000
        print("[*] No existing records found. Starting from baseline roll 1262701001")

    # 1. Fill internal gaps if requested
    if fill_gaps and numeric_rolls:
        missing_in_range = [r for r in range(min_roll, max_roll + 1) if str(r) not in existing_rolls_set]
        if missing_in_range:
            print(f"\n[+] Checking {len(missing_in_range)} missing roll numbers inside recorded range...")
            for roll in missing_in_range:
                time.sleep(delay)
                rec = fetch_student_record(str(roll), phpsessid, school_map)
                if rec:
                    print(f"  [+] Found missing roll {roll}: {rec['Name']} ({rec.get('Previous_School') or 'No School Matched'})")
                    students.append(rec)
                    existing_rolls_set.add(str(roll))
                    save_students(json_file, js_file, students)
                else:
                    print(f"  [-] Roll {roll}: unassigned/empty")

    # 2. Fetch new registrations starting from (max_roll + 1)
    if start_roll is None:
        current_roll = max_roll + 1
    else:
        current_roll = start_roll

    print(f"\n[*] Scanning for newly registered students starting from Roll {current_roll}...")
    print(f"[*] Will stop automatically after {max_consecutive_misses} consecutive unassigned rolls.\n")

    consecutive_misses = 0
    new_found_count = 0

    while consecutive_misses < max_consecutive_misses:
        roll_str = str(current_roll)
        time.sleep(delay)

        student = fetch_student_record(roll_str, phpsessid, school_map)

        if student:
            consecutive_misses = 0
            new_found_count += 1
            sch_label = f" | School: {student['Previous_School']}" if student.get('Previous_School') else ""
            print(f"  [+] Found Roll {roll_str}: {student['Name']} ({student.get('Department', 'N/A')}){sch_label}")

            # Update or append
            if roll_str in existing_rolls_set:
                for idx, item in enumerate(students):
                    if str(item.get("Roll")) == roll_str:
                        students[idx] = student
                        break
            else:
                students.append(student)
                existing_rolls_set.add(roll_str)

            # Save immediately so progress is never lost
            save_students(json_file, js_file, students)
        else:
            consecutive_misses += 1
            print(f"  [-] Roll {roll_str}: No record (miss {consecutive_misses}/{max_consecutive_misses})")

        current_roll += 1

    print("\n" + "=" * 60)
    print(f"[✓] Completed! Found and added {new_found_count} new student(s).")
    print(f"[✓] Total recorded students: {len(students)}")
    print(f"[✓] Updated {json_file} and {js_file}")

    # Auto commit and push if new students were found
    if new_found_count > 0 and auto_push:
        print("\n[*] Auto-push enabled. Syncing to GitHub...")
        files_to_commit = [json_file]
        if js_file:
            files_to_commit.append(js_file)
        git_commit_and_push(files_to_commit, new_found_count, len(students))
    elif new_found_count == 0:
        print("[*] No new records to commit. Repository is up-to-date.")

    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch latest registered students from Rangpur Govt College portal and auto-push to GitHub."
    )
    parser.add_argument(
        "-s", "--session",
        default=DEFAULT_PHPSESSID,
        help="PHPSESSID session cookie from rgc.eshiksaems.com (or set PHPSESSID env var)"
    )
    parser.add_argument(
        "--start",
        type=int,
        default=None,
        help="Custom start roll number (default: highest recorded roll + 1)"
    )
    parser.add_argument(
        "--max-misses",
        type=int,
        default=5,
        help="Number of consecutive empty rolls before stopping (default: 5)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.25,
        help="Delay in seconds between requests (default: 0.25s)"
    )
    parser.add_argument(
        "--fill-gaps",
        action="store_true",
        help="Also re-check missing roll numbers within the existing minimum and maximum range"
    )
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Re-enrich and backfill Previous School for all existing records"
    )
    parser.add_argument(
        "--dinajpur-db",
        default=None,
        help="Custom path to Dinajpur leaderboard.json dataset"
    )
    parser.add_argument(
        "--no-push",
        action="store_true",
        help="Do not automatically commit and push new data to GitHub"
    )
    parser.add_argument(
        "--json",
        default=DEFAULT_JSON_FILE,
        help=f"Path to output JSON file (default: {DEFAULT_JSON_FILE})"
    )
    parser.add_argument(
        "--js",
        default=DEFAULT_JS_FILE,
        help=f"Path to output JS file (default: {DEFAULT_JS_FILE})"
    )

    args = parser.parse_args()

    run_incremental_fetch(
        json_file=args.json,
        js_file=args.js,
        phpsessid=args.session,
        start_roll=args.start,
        max_consecutive_misses=args.max_misses,
        delay=args.delay,
        fill_gaps=args.fill_gaps,
        auto_push=not args.no_push,
        dinajpur_db=args.dinajpur_db,
        backfill=args.backfill
    )


if __name__ == "__main__":
    main()
