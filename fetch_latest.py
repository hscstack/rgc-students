#!/usr/bin/env python3
"""
RGC Student Directory — Incremental Live Fetcher
Fetches latest registered students from Rangpur Govt College portal (rgc.eshiksaems.com).
Automatically continues from (highest recorded roll + 1) and stops after consecutive empty rolls.
"""

import sys
import os
import re
import json
import time
import argparse
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


def fetch_student_record(roll_number: str, phpsessid: str) -> dict | None:
    """Fetch profile data for a specific roll number from the RGC portal."""
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

    # Extract image src
    img_match = re.search(r'id=["\']studentImg["\'][^>]*src=["\']([^"\']+)["\']', html_content)
    if not img_match:
        img_match = re.search(r'src=["\']([^"\']+)["\'][^>]*id=["\']studentImg["\']', html_content)

    if img_match and img_match.group(1).strip():
        img_src = img_match.group(1).strip()
        info["Image_URL"] = urllib.parse.urljoin(BASE_URL + "/", img_src)
    else:
        info["Image_URL"] = ""

    return info


def run_incremental_fetch(
    json_file: str = DEFAULT_JSON_FILE,
    js_file: str = DEFAULT_JS_FILE,
    phpsessid: str = DEFAULT_PHPSESSID,
    start_roll: int | None = None,
    max_consecutive_misses: int = 5,
    delay: float = 0.25,
    fill_gaps: bool = False
):
    print("=" * 60)
    print("  RGC Students Directory — Incremental Fetcher")
    print("=" * 60)

    students = load_students(json_file)
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
                rec = fetch_student_record(str(roll), phpsessid)
                if rec:
                    print(f"  [+] Found missing roll {roll}: {rec['Name']}")
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

        student = fetch_student_record(roll_str, phpsessid)

        if student:
            consecutive_misses = 0
            new_found_count += 1
            print(f"  [+] Found Roll {roll_str}: {student['Name']} ({student.get('Department', 'N/A')})")

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
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch latest registered students from Rangpur Govt College portal."
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
        fill_gaps=args.fill_gaps
    )


if __name__ == "__main__":
    main()
