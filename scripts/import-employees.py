#!/usr/bin/env python3
import json
import re
import struct
import sys
from pathlib import Path

END_OF_CHAIN = 0xFFFFFFFE
FREE_SECTOR = 0xFFFFFFFF
FAT_SECTOR = 0xFFFFFFFD

INPUT_DEFAULT = "/Users/khaduy/Downloads/Hộ chiếu nv.xls"
OUTPUT_EMPLOYEES = Path("data/employees.json")
OUTPUT_SUMMARY = Path("data/import-summary.json")


def u16(data, offset):
    return struct.unpack_from("<H", data, offset)[0]


def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def normalize_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).replace("\u00a0", " ").strip()


def normalize_email(value):
    email = normalize_text(value).replace(" ", "").lower()
    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return "", bool(email)
    return email, False


def ole_sector(data, sector_id, sector_size):
    start = (sector_id + 1) * sector_size
    return data[start:start + sector_size]


def ole_chain(fat, start):
    chain = []
    current = start
    seen = set()
    while current not in (END_OF_CHAIN, FREE_SECTOR) and current not in seen:
        seen.add(current)
        chain.append(current)
        current = fat[current]
    return chain


def extract_workbook_stream(path):
    data = Path(path).read_bytes()
    if data[:8] != bytes.fromhex("d0cf11e0a1b11ae1"):
        raise ValueError("Not an OLE Compound File .xls")

    sector_size = 1 << u16(data, 30)
    first_dir_sector = u32(data, 48)
    difat = [u32(data, 76 + i * 4) for i in range(109)]
    fat_sector_ids = [sid for sid in difat if sid not in (FREE_SECTOR, END_OF_CHAIN, FAT_SECTOR)]

    fat = []
    for sid in fat_sector_ids:
        sector = ole_sector(data, sid, sector_size)
        fat.extend(struct.unpack("<" + "I" * (sector_size // 4), sector))

    dir_bytes = b"".join(ole_sector(data, sid, sector_size) for sid in ole_chain(fat, first_dir_sector))
    streams = {}
    for offset in range(0, len(dir_bytes), 128):
        entry = dir_bytes[offset:offset + 128]
        if len(entry) < 128:
            continue
        name_len = u16(entry, 64)
        if name_len < 2:
            continue
        name = entry[:name_len - 2].decode("utf-16le", errors="ignore")
        entry_type = entry[66]
        start_sector = u32(entry, 116)
        size = u32(entry, 120)
        if entry_type == 2 and start_sector not in (FREE_SECTOR, END_OF_CHAIN):
            stream = b"".join(ole_sector(data, sid, sector_size) for sid in ole_chain(fat, start_sector))[:size]
            streams[name] = stream

    workbook = streams.get("Workbook") or streams.get("Book")
    if not workbook:
        raise ValueError("Workbook stream not found")
    return workbook


class SegmentedReader:
    def __init__(self, segments):
        self.segments = segments
        self.segment_index = 0
        self.offset = 0

    def read(self, size):
        out = bytearray()
        while size > 0 and self.segment_index < len(self.segments):
            segment = self.segments[self.segment_index]
            available = len(segment) - self.offset
            if available <= 0:
                self.segment_index += 1
                self.offset = 0
                continue
            take = min(size, available)
            out.extend(segment[self.offset:self.offset + take])
            self.offset += take
            size -= take
        return bytes(out)

    def read_string_chars(self, char_count, high_byte):
        parts = []
        remaining = char_count
        current_high = high_byte
        while remaining > 0 and self.segment_index < len(self.segments):
            segment = self.segments[self.segment_index]
            if self.offset >= len(segment):
                self.segment_index += 1
                self.offset = 0
                if self.segment_index < len(self.segments):
                    flags = self.read(1)
                    current_high = bool(flags and (flags[0] & 0x01))
                continue
            bytes_per_char = 2 if current_high else 1
            available_chars = (len(segment) - self.offset) // bytes_per_char
            if available_chars <= 0:
                self.segment_index += 1
                self.offset = 0
                if self.segment_index < len(self.segments):
                    flags = self.read(1)
                    current_high = bool(flags and (flags[0] & 0x01))
                continue
            take_chars = min(remaining, available_chars)
            raw = self.read(take_chars * bytes_per_char)
            parts.append(raw.decode("utf-16le" if current_high else "latin1", errors="replace"))
            remaining -= take_chars
        return "".join(parts)


def parse_sst(segments):
    reader = SegmentedReader(segments)
    reader.read(4)  # total strings
    unique_count = u32(reader.read(4), 0)
    strings = []
    for _ in range(unique_count):
        header = reader.read(3)
        if len(header) < 3:
            break
        char_count = u16(header, 0)
        flags = header[2]
        high_byte = bool(flags & 0x01)
        has_ext = bool(flags & 0x04)
        has_rich = bool(flags & 0x08)
        rich_runs = u16(reader.read(2), 0) if has_rich else 0
        ext_size = u32(reader.read(4), 0) if has_ext else 0
        value = reader.read_string_chars(char_count, high_byte)
        if rich_runs:
            reader.read(rich_runs * 4)
        if ext_size:
            reader.read(ext_size)
        strings.append(value)
    return strings


def decode_rk(raw):
    value = raw >> 2
    if raw & 0x02:
        if value & 0x20000000:
            value -= 0x40000000
        result = float(value)
    else:
        packed = struct.pack("<Q", (raw & 0xFFFFFFFC) << 32)
        result = struct.unpack("<d", packed)[0]
    if raw & 0x01:
        result /= 100
    return result


def read_records(workbook):
    offset = 0
    while offset + 4 <= len(workbook):
        record_type, length = struct.unpack_from("<HH", workbook, offset)
        offset += 4
        payload = workbook[offset:offset + length]
        yield offset - 4, record_type, payload
        offset += length


def sheet_name(payload):
    name_len = payload[6]
    flags = payload[7]
    raw = payload[8:8 + name_len * (2 if flags & 0x01 else 1)]
    return raw.decode("utf-16le" if flags & 0x01 else "latin1", errors="replace")


def parse_workbook(path, target_sheet="Total"):
    workbook = extract_workbook_stream(path)
    boundsheets = {}
    records = list(read_records(workbook))
    for offset, record_type, payload in records:
        if record_type == 0x0085:
            boundsheets[sheet_name(payload)] = u32(payload, 0)

    if target_sheet not in boundsheets:
        raise ValueError(f"Sheet {target_sheet!r} not found. Available: {list(boundsheets)}")

    sst_segments = []
    for index, (_offset, record_type, payload) in enumerate(records):
        if record_type == 0x00FC:
            sst_segments.append(payload)
            j = index + 1
            while j < len(records) and records[j][1] == 0x003C:
                sst_segments.append(records[j][2])
                j += 1
            break
    sst = parse_sst(sst_segments) if sst_segments else []

    start_offset = boundsheets[target_sheet]
    rows = {}
    in_sheet = False
    for offset, record_type, payload in records:
        if offset == start_offset and record_type == 0x0809:
            in_sheet = True
        elif in_sheet and record_type == 0x000A:
            break
        if not in_sheet:
            continue

        if record_type == 0x00FD and len(payload) >= 10:
            row, col = u16(payload, 0), u16(payload, 2)
            idx = u32(payload, 6)
            rows.setdefault(row, {})[col] = sst[idx] if idx < len(sst) else ""
        elif record_type == 0x0203 and len(payload) >= 14:
            row, col = u16(payload, 0), u16(payload, 2)
            rows.setdefault(row, {})[col] = struct.unpack_from("<d", payload, 6)[0]
        elif record_type == 0x027E and len(payload) >= 10:
            row, col = u16(payload, 0), u16(payload, 2)
            rows.setdefault(row, {})[col] = decode_rk(u32(payload, 6))
        elif record_type == 0x00BD and len(payload) >= 6:
            row, first_col = u16(payload, 0), u16(payload, 2)
            last_col = u16(payload, len(payload) - 2)
            pos = 4
            for col in range(first_col, last_col + 1):
                if pos + 6 > len(payload) - 2:
                    break
                rows.setdefault(row, {})[col] = decode_rk(u32(payload, pos + 2))
                pos += 6
        elif record_type == 0x0204 and len(payload) >= 8:
            row, col = u16(payload, 0), u16(payload, 2)
            text_len = u16(payload, 6)
            rows.setdefault(row, {})[col] = payload[8:8 + text_len].decode("latin1", errors="replace")

    max_row = max(rows) if rows else -1
    max_col = max((max(cols) for cols in rows.values() if cols), default=-1)
    matrix = []
    for row in range(max_row + 1):
        matrix.append([rows.get(row, {}).get(col, "") for col in range(max_col + 1)])
    return matrix


def cell(row, index):
    return normalize_text(row[index]) if index < len(row) else ""


def build_employees(matrix):
    employees = []
    for zero_based_index, row in enumerate(matrix[2:], start=3):
        full_name = cell(row, 1)
        if not full_name:
            continue
        original_no_text = cell(row, 0)
        try:
            original_no = int(float(original_no_text))
        except Exception:
            original_no = len(employees) + 1

        email, invalid_email = normalize_email(cell(row, 4))
        is_hr = full_name == "Nguyễn Thị Cẩm Thanh" or email == "thanh.ntc@kisvn.vn"
        employee = {
            "id": f"emp-{original_no:03d}",
            "originalNo": original_no,
            "fullName": full_name,
            "department": cell(row, 2),
            "position": cell(row, 3),
            "email": email,
            "role": "hr" if is_hr else "employee",
            "accountStatus": "active" if is_hr else "pendingActivation",
            "passwordResetRequired": False if is_hr else True,
            "certificateType": cell(row, 5),
            "leadershipTraining": cell(row, 6),
            "communicationTraining": cell(row, 7),
            "specializationCourses": {
                "basicOfSecurities": cell(row, 8),
                "lawOfSecurities": cell(row, 9),
                "analysisAndInvestmentSecurities": cell(row, 10),
                "brokerageAndInvestmentAdvisory": cell(row, 11),
                "analysisOfFinancialStatements": cell(row, 12),
                "financialAdvisoryAndUnderwriting": cell(row, 13),
                "assetsAndFundManagement": cell(row, 14),
                "derivativeSecurities": cell(row, 15),
            },
            "note": cell(row, 16),
            "sourceRow": zero_based_index,
        }
        if invalid_email:
            employee["dataIssue"] = "invalid_email"
        employees.append(employee)

    email_counts = {}
    for employee in employees:
        if employee["email"]:
            email_counts[employee["email"]] = email_counts.get(employee["email"], 0) + 1
    for employee in employees:
        if employee["email"] and email_counts.get(employee["email"], 0) > 1:
            employee["dataIssue"] = "duplicate_email"
            employee["accountStatus"] = "pendingReview"

    return employees


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else INPUT_DEFAULT
    matrix = parse_workbook(input_path, "Total")
    employees = build_employees(matrix)
    summary = {
        "totalRows": len(employees),
        "validEmployees": len(employees),
        "invalidEmails": sum(1 for employee in employees if employee.get("dataIssue") == "invalid_email"),
        "duplicateEmails": sum(1 for employee in employees if employee.get("dataIssue") == "duplicate_email"),
        "certificateHolders": sum(1 for employee in employees if employee.get("certificateType", "").strip()),
    }

    OUTPUT_EMPLOYEES.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_EMPLOYEES.write_text(json.dumps(employees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT_SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
