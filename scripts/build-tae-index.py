"""Build the Sites index from the curated TAE source directory (bank.py and data/catalog.json).

    python scripts/build-tae-index.py --source "<concursos-tae-rs>" [--check]

The question IDs, natural order, search shards and offsets belong to the source
bank and its existing R2 objects. Apply editorial labels after determining them.
"""

import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import sys
import unicodedata


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "lib" / "tae" / "bank-index.json"
SEARCH_SHARD_BYTES = 768 * 1024
FACETS = ("institute", "role", "board", "year", "exam", "subject", "topic", "status")

# Keep the title and printedRole as source evidence. Merge only the study label.
# An explicitly designated clinical area and veterinary medicine have their own entries.
ROLE_ALIASES = {
    "Bibliotecário-Documentarista": "Bibliotecário-Documentalista",
    "Contador – geral": "Contador",
    "Médico Geral": "Médico",
    "Médico-área": "Médico",
    "Tradutor e Intérprete de Linguagem de Sinais": "Tradutor e Intérprete de Libras",
}
TOPIC_ALIASES = {
    "Decreto-lei nº 5.296/2004": "Decreto nº 5.296/2004",
    "Gestão de Projetos": "Gestão de projetos",
    "Projeto Político Pedagógico": "Projeto político-pedagógico",
    "Projeto Político – Pedagógico": "Projeto político-pedagógico",
    "Projeto Político-Pedagógico": "Projeto político-pedagógico",
    "Técnica Dietética": "Técnica dietética",
}
DUPLICATE_NOTICE = re.compile(
    r"^Edital\s+(?P<number>\d+\s*/\s*\d{4})\s*[-–—·:]\s*(?P<role>.+?)"
    r"\s*[-–—·]\s*(?P<notice>Edital\s+(?P=number))$", re.IGNORECASE
)


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def search_locations(bank, ids_by_exam):
    # Byte boundaries must match the existing packed texts, including their original labels.
    ordered = sorted(ids_by_exam, key=lambda k: (bank.exams[k]["institute"], -bank.exams[k]["year"], k))
    locations = {}
    shard, offset, size = 0, 0, 2
    for exam_id in ordered:
        texts = [bank.search[identifier] for identifier in ids_by_exam[exam_id]]
        length = len(compact(texts)) - 1
        if offset and size + length > SEARCH_SHARD_BYTES:
            shard, offset, size = shard + 1, 0, 2
        locations[exam_id] = [shard, offset]
        offset += len(texts)
        size += length
    return locations


def unicode_rules():
    """Use the same folding, decimal digits and combining marks as the private search files."""
    casefold, combining, digits = {}, [], []
    for code in range(sys.maxunicode + 1):
        char = chr(code)
        if len(char.casefold()) != 1 or char.casefold() != char.lower():
            casefold[char] = char.casefold()
        if unicodedata.combining(char):
            combining.append(r"\u{%x}" % code)
        if unicodedata.decimal(char, None) is not None:
            digits.append(char)
    return {"casefold": casefold, "combining": "".join(combining), "decimal": "".join(digits)}


def question_row(question, delimiter, codes):
    accepted = question["accepted"]
    first_answer = accepted[0] if accepted else None
    topic = TOPIC_ALIASES.get(question["topic"], question["topic"])
    row = [
        question["number"], codes[5][question["subject"]], codes[6][topic],
        codes[7][question["keyStatus"]], accepted if len(accepted) > 1 else first_answer or "",
        len(question["choices"]),
    ]
    standard_id = f"{question['examId']}{delimiter}{question['number']:02d}"
    if question.get("answer") != first_answer or question["id"] != standard_id:
        row.append(question.get("answer"))
    if question["id"] != standard_id:
        row.append(question["id"])
    return row


def build(source):
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source))
    from bank import Bank, STATUS_NAMES, folded

    bank = Bank(source / "data")
    ids_by_exam = defaultdict(list)
    for identifier in bank.order:
        ids_by_exam[bank.items[identifier]["examId"]].append(identifier)
    locations = search_locations(bank, ids_by_exam)

    exams = []
    for item in bank.exams.values():
        role = ROLE_ALIASES.get(item["role"], item["role"])
        title = DUPLICATE_NOTICE.sub(r"\g<role> — \g<notice>", item["title"])
        exams.append(dict(item, role=role, title=title))
    exam_codes = {exam["id"]: i for i, exam in enumerate(exams)}
    _, available = bank.practice({}, {}, set())
    available["role"] = {exam["role"] for exam in exams}
    available["topic"] = {TOPIC_ALIASES.get(value, value) for value in available["topic"]}
    available["topic"].add("")
    facets = [
        sorted(available[name], key=lambda value: (folded(value), value), reverse=(name == "year"))
        for name in FACETS
    ]
    codes = [{value: i for i, value in enumerate(facet)} for facet in facets]

    groups = []
    for exam_id, identifiers in ids_by_exam.items():
        index = exam_codes[exam_id]
        exam = exams[index]
        values = [exam["institute"], exam["role"], exam["board"], str(exam["year"]), exam_id]
        exam_facets = [codes[i][value] for i, value in enumerate(values)]
        delimiter = "-q" if identifiers[0].startswith(exam_id + "-q") else "-"
        rows = [question_row(bank.items[key], delimiter, codes) for key in identifiers]
        groups.append([index, *locations[exam_id], delimiter, exam_facets, rows])

    # Recount from questions so merged role and topic labels sum instead of overwriting.
    study_index = {}
    for question in bank.items.values():
        exam = exams[exam_codes[question["examId"]]]
        roles = study_index.setdefault(exam["institute"], {})
        subjects = roles.setdefault(exam["role"], {})
        topics = subjects.setdefault(question["subject"], {})
        topic = TOPIC_ALIASES.get(question["topic"], question["topic"])
        topics[topic] = topics.get(topic, 0) + 1

    for notice in bank.notices:
        for role in notice.get("roles", []):
            name = role.get("studyRole", role["name"])
            role["studyRole"] = ROLE_ALIASES.get(name, name)
    return {
        "catalog": {
            "summary": bank.summary, "exams": exams, "notices": bank.notices,
            "coverage": bank.coverage, "studyIndex": study_index, "keyLabels": STATUS_NAMES,
        },
        "facets": facets, "groups": groups, "unicode": unicode_rules(),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Curated TAE source directory")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, type=Path)
    parser.add_argument("--check", action="store_true", help="Compare the generated index without writing")
    args = parser.parse_args()
    source = args.source.resolve()
    if not (source / "bank.py").is_file() or not (source / "data" / "catalog.json").is_file():
        parser.error("--source must contain bank.py and data/catalog.json")
    index = build(source)
    encoded = compact(index)
    if args.check:
        if args.output.read_bytes() != encoded:
            sys.exit("O índice existente difere da geração do acervo.")
    else:
        args.output.write_bytes(encoded)
    print(json.dumps(index["catalog"]["summary"], ensure_ascii=False))
