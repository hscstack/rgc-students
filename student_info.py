import sys
import io
import re
import os
import json
import subprocess
import urllib.request
import urllib.parse
from html.parser import HTMLParser

BASE_URL = "https://rgc.eshiksaems.com"
ENDPOINT_URL = f"{BASE_URL}/controller_student_module.php"

DEFAULT_PHPSESSID = os.environ.get("PHPSESSID", "6u5qq9c9btltikmsrbcadig53u")
OUTPUT_FILE = "students.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": f"{BASE_URL}/Result-Enquiry-Center",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": BASE_URL,
}

from fetch_latest import normalize_name, load_dinajpur_school_map

SCHOOL_MAP = None

def get_school_map():
    global SCHOOL_MAP
    if SCHOOL_MAP is None:
        SCHOOL_MAP = load_dinajpur_school_map()
    return SCHOOL_MAP

def fetch_student_info(roll_number: str) -> dict:
    payload = urllib.parse.urlencode({
        "rootData": roll_number.strip(),
        "flagreq": "profileRollCheck"
    }).encode("utf-8")

    req = urllib.request.Request(ENDPOINT_URL, data=payload, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as response:
        html_content = response.read().decode("utf-8", errors="ignore")

    # Check if student info exists
    roll_match = re.search(r'id=["\']studentClassRoll["\']\s+value=["\']([^"\']+)["\']', html_content)
    if not roll_match or not roll_match.group(1):
        return None

    info = {"Roll": roll_number}

    # Extract student fields using regex
    patterns = {
        "Name": r'<label>\s*Name\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
        "Department": r'<label>\s*Department\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
        "Session": r'<label>\s*Session\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
        "Academic Year": r'<label>\s*Academic\s*Year\s*:\s*</label>\s*</div>\s*<div[^>]*>\s*<label>\s*([^<]+?)\s*</label>',
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info[key] = match.group(1).strip()

    # Previous School lookup
    student_name = info.get("Name", "")
    s_map = get_school_map()
    info["Previous_School"] = s_map.get(normalize_name(student_name), "") if s_map else ""

    return info

def load_existing_data(file_path: str) -> list[dict]:
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def save_data(file_path: str, data: list[dict]):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    # Also update students_data.js for instant offline/browser compatibility
    js_path = os.path.join(os.path.dirname(file_path) or ".", "students_data.js")
    try:
        with open(js_path, "w", encoding="utf-8") as f:
            f.write("window.INITIAL_STUDENTS_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
    except Exception:
        pass

def main():
    print("=" * 45)
    print(" RGC Student Info Lookup Tool (JSON Output)")
    print("=" * 45)
    
    session_input = input(f"Enter PHPSESSID (press Enter for default [{DEFAULT_PHPSESSID}]): ").strip()
    phpsessid = session_input if session_input else DEFAULT_PHPSESSID
    HEADERS["Cookie"] = f"PHPSESSID={phpsessid}"

    out_file_input = input(f"Enter output JSON filename (press Enter for [{OUTPUT_FILE}]): ").strip()
    output_file = out_file_input if out_file_input else OUTPUT_FILE

    students = load_existing_data(output_file)
    existing_rolls = {s.get("Roll") for s in students if isinstance(s, dict) and "Roll" in s}

    while True:
        start_input = input("\nEnter Start Roll (or 'q' to quit): ").strip()
        if not start_input or start_input.lower() == 'q':
            break

        end_input = input("Enter End Roll: ").strip()
        if not end_input or end_input.lower() == 'q':
            break

        try:
            start_roll = int(start_input)
            end_roll = int(end_input)
        except ValueError:
            print("[-] Invalid roll number format. Please enter valid integers.")
            continue

        if start_roll > end_roll:
            print("[-] Start roll must be less than or equal to End roll.")
            continue

        pad_len = len(start_input) if start_input.startswith("0") else 0
        total = end_roll - start_roll + 1

        print(f"\nProcessing {total} roll(s) from {start_roll} to {end_roll}...")
        saved_count = 0
        for current in range(start_roll, end_roll + 1):
            roll = str(current).zfill(pad_len) if pad_len else str(current)
            try:
                student = fetch_student_info(roll)
                if not student:
                    print(f"[-] Roll {roll}: No student found.")
                    continue

                # Update or append student data
                if roll in existing_rolls:
                    for idx, item in enumerate(students):
                        if item.get("Roll") == roll:
                            students[idx] = student
                            break
                else:
                    students.append(student)
                    existing_rolls.add(roll)

                saved_count += 1
                save_data(output_file, students)
                print(f"[+] Roll {roll}: Saved to {output_file}")

            except Exception as e:
                print(f"[-] Roll {roll} error: {e}")

        print(f"\nDone. Successfully saved/updated {saved_count} record(s) in {output_file}.")

if __name__ == "__main__":
    main()
