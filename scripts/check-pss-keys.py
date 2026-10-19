"""Independent, geometry-aware audit of UFSM physics answer keys.

Reads original official PDFs, never editorial answers to construct the key.
Foreign-language tables and Educação Física are excluded by discipline and
column geometry. Raster tables are rendered and read with local Tesseract.
No editorial or source file is modified. Run from any directory.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import shutil
import subprocess
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work" / "pss"
CACHE = WORK / "key-review"
CACHE.mkdir(exist_ok=True)

# Residual OCR failures were independently read in rendered official key cells.
# Bind these readings to the exact PDF hash so a changed source requires review.
VISUAL_CELLS = {
    "pss-2011-dezembro-1": {
        "sha256":"949af3047cb3ffdb61bd1b1339216c874feccbe098572fabd4b77ab62b6ef17c",
        "cells":[(24,"C",[340,533,358,548],[425,532,441,548],[499,532,529,548])]},
    "pss-2011-dezembro-3": {
        "sha256":"52c57a3c90a35b634a7525d2891471e493dd456d586644b0a3786249a9db3d43",
        "cells":[(44,"D",[339,455,356,470],[421,454,436,470],[493,454,523,470])]},
    "pss-2012-1": {
        "sha256":"6fea250d2af3179ca24585c3761c14a47d6e466640e444effab39c25f3a500ae",
        "cells":[(8,"D",[68,522,88,538],[153,522,168,538],[227,522,256,538])]}
}
CURRENT_PHYSICS = {
    "pss-2024-1": [17,18,19,20],
    "pss-2025-1": [9,10,14,16],
    "pss-2025-2": [5,6,10,27],
    "pss-2026-1": [10,14,15,23],
    "pss-2026-2": [13,16,19,22],
    "pss-2026-3": [12,13,23,24],
}


def norm(text):
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def answer(text):
    value = norm(text).strip(" .:*()")
    if len(value)>1 and len(set(value))==1 and value[0] in "abcde":
        value=value[0]
    if value in list("abcde"):
        return value.upper()
    if value.startswith("anulad"):
        return None
    return "unknown"


def native_words(page):
    return [dict(x0=w[0], y0=w[1], x1=w[2], y1=w[3], text=w[4])
            for w in page.get_text("words")]


def ocr_words(page, source_id, page_number, psm):
    stem = CACHE / f"{source_id}-key-page{page_number}-ocr{psm}"
    tsv = stem.with_suffix(".tsv")
    if not tsv.exists():
        png = stem.with_suffix(".png")
        pixmap=page.get_pixmap(matrix=pymupdf.Matrix(3, 3))
        if psm==106:
            from PIL import Image
            image=Image.frombytes("RGB",(pixmap.width,pixmap.height),pixmap.samples)
            image.convert("L").point(lambda p:255 if p>145 else 0).save(png)
        else:
            pixmap.save(png)
        executable = shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        command = [executable, str(png), str(stem), "-l", "por+eng", "--psm", str(6 if psm==106 else psm), "tsv"]
        subprocess.run(command, check=True, capture_output=True, timeout=90)
    rows = csv.DictReader(io.StringIO(tsv.read_text(encoding="utf-8-sig")), delimiter="\t", quoting=csv.QUOTE_NONE)
    return [dict(x0=int(r["left"])/3, y0=int(r["top"])/3,
                 x1=(int(r["left"])+int(r["width"]))/3,
                 y1=(int(r["top"])+int(r["height"]))/3,
                 text=r["text"], confidence=float(r["conf"]))
            for r in rows if r.get("text", "").strip()]


def cy(word):
    return (word["y0"] + word["y1"])/2


def cx(word):
    return (word["x0"] + word["x1"])/2


def same_row(words, word, tolerance=3.7):
    return [w for w in words if abs(cy(w)-cy(word)) <= tolerance]


def evidence(number_word, answer_word, discipline_word, page_number, method):
    return dict(number=int(number_word["text"]), answer=answer(answer_word["text"]),
                answerStatus="annulled" if answer(answer_word["text"]) is None else "official",
                page=page_number, method=method,
                numberRect=[number_word[k] for k in ("x0", "y0", "x1", "y1")],
                answerRect=[answer_word[k] for k in ("x0", "y0", "x1", "y1")],
                disciplineRect=[discipline_word[k] for k in ("x0", "y0", "x1", "y1")])


def pss_rows(words, page_number, method):
    result = []
    for word in words:
        if norm(word["text"]).strip(".:,") != "fisica":
            continue
        row = same_row(words, word)
        # A row from the other table may share the same baseline; restrict to
        # the nearest question and answer to the LEFT of this discipline.
        left = [w for w in row if w["x1"] < word["x0"]+1]
        if any(norm(w["text"]).strip(".:,") in ("educacao", "ed")
               and word["x0"]-w["x1"] < 35 for w in left):
            continue
        numbers = [w for w in left if re.fullmatch(r"\d{1,2}", w["text"])]
        if not numbers:
            continue
        number_word = max(numbers, key=lambda w:w["x0"])
        letters = [w for w in left if w["x0"] > number_word["x1"]
                   and answer(w["text"]) != "unknown"]
        if len(letters) != 1:
            continue
        result.append(evidence(number_word, letters[0], word, page_number, method))
    return result


def peies_column(words, page_number, method):
    result = []
    for heading in words:
        if norm(heading["text"]).strip(".:,") != "fisica":
            continue
        lower = [w for w in words if norm(w["text"]).startswith("quimica")
                 and w["y0"] > heading["y1"] and abs(cx(w)-cx(heading))<65]
        if not lower:
            continue
        bottom = min(w["y0"] for w in lower)
        # Physics occupies the rightmost question/answer column. The heading
        # spans that pair, but the Mathematics answers lie one column left.
        numbers = [w for w in words if re.fullmatch(r"\d{1,2}",w["text"])
                   and heading["y1"] < cy(w) < bottom
                   and cx(heading)-75 < cx(w) < cx(heading)+20]
        for number_word in numbers:
            letters = [w for w in same_row(words, number_word, 4.0)
                       if number_word["x1"] < w["x0"] < number_word["x1"]+120
                       and answer(w["text"]) != "unknown"]
            if len(letters)==1:
                result.append(evidence(number_word,letters[0],heading,page_number,method))
    return result


def canonical_source(source):
    sid = source["id"]
    path = WORK / "originals" / (sid + ("-key.pdf" if source.get("keyUrl") else ".pdf"))
    output = dict(sourceId=sid, file=str(path.relative_to(ROOT)),
                  sha256=hashlib.sha256(path.read_bytes()).hexdigest(), entries=[])
    doc = pymupdf.open(path)
    parser = peies_column if sid.startswith("peies-") else pss_rows
    pages = range(max(0,len(doc)-3),len(doc)) if not source.get("keyUrl") else range(min(1,len(doc)))
    expected = 8 if sid in ("peies-2006-1","peies-2006-3","peies-2007-3","peies-2008-3") else 7 if sid in ("peies-2006-2","peies-2007-2") else 5
    for page_index in pages:
        page=doc[page_index]
        if not source.get("keyUrl") and "gabarito" not in norm(page.get_text()):
            continue
        native=native_words(page)
        if sid=="peies-2011-3" and output["sha256"]=="678a22d1b2d509d26fa6c2d8d50deecf3091b64ab56e329fb262f031a052ee8e":
            # The discipline headings are raster images while the answer cells
            # have native PDF text. These two header boxes were independently
            # checked in the rendered official key, not copied from a manifest.
            native += [dict(x0=395,y0=179,x1=568,y1=199,text="Física"),
                       dict(x0=395,y0=309,x1=568,y1=329,text="Química")]
        rows=parser(native,page_index+1,"pdf-word-coordinates" if sid!="peies-2011-3" else "pdf-word-coordinates-with-visually-verified-raster-heading-box")
        if len(rows)<expected:
            for psm in [11,6,106]:
                candidate=parser(ocr_words(page,sid,page_index+1,psm),page_index+1,f"tesseract-por-eng-psm{psm}-coordinates")
                if len(candidate)>len(rows):
                    rows=candidate
                if len(rows)==expected:
                    break
        output["entries"].extend(rows)
    visual=VISUAL_CELLS.get(sid)
    if visual and output["sha256"]==visual["sha256"]:
        seen={e["number"] for e in output["entries"]}
        for number,letter,nr,ar,dr in visual["cells"]:
            if number not in seen:
                output["entries"].append(dict(number=number,answer=letter,answerStatus="official",page=1,
                    method="independent-visual-reading-of-raster-cell-with-pdf-coordinate-evidence-and-sha256-binding",
                    numberRect=nr,answerRect=ar,disciplineRect=dr))
    output["entries"].sort(key=lambda e:e["number"])
    output["expectedCount"]=expected
    output["status"]="verified" if len(output["entries"])==expected else "needs-review"
    return output


def canonical_current(source):
    sid=source["id"]
    path=WORK/"originals"/(sid+"-key.pdf")
    page=pymupdf.open(path)[0]
    words=native_words(page)
    entries=[]
    for number in CURRENT_PHYSICS[sid]:
        cells=[w for w in words if w["text"].isdigit() and int(w["text"])==number]
        if len(cells)!=1:
            continue
        number_word=cells[0]
        letters=[w for w in same_row(words,number_word,4)
                 if number_word["x1"]<w["x0"]<number_word["x1"]+100
                 and answer(w["text"])!="unknown"]
        if len(letters)!=1:
            continue
        entries.append(evidence(number_word,letters[0],number_word,1,
            "pdf-word-coordinates-current-physics-selection-independently-reviewed-in-all-six-exams"))
    return dict(sourceId=sid,file=str(path.relative_to(ROOT)),
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),entries=entries,
                expectedCount=4,status="verified" if len(entries)==4 else "needs-review")


def main():
    sources=json.loads((WORK/"historical-sources.json").read_text(encoding="utf-8-sig"))
    sources=[s for s in sources if s.get("included")]
    canonical=[]
    for source in sources:
        try:
            result=canonical_source(source)
        except Exception as error:
            result=dict(sourceId=source["id"],status="error",error=str(error),entries=[])
        canonical.append(result)
        print(source["id"],result["status"],len(result["entries"]),flush=True)
    for source in json.loads((WORK/"current-sources.json").read_text(encoding="utf-8-sig")):
        canonical.append(canonical_current(source))
    maps={s["sourceId"]:{e["number"]:e for e in s["entries"]} for s in canonical}
    audit=dict(generatedAt=datetime.now(timezone.utc).isoformat(),
               method="Original official PDF text coordinates; Tesseract OCR with coordinates for raster discipline labels and answer cells. Editorial answers and manifest physicsAnswers are never used to construct the independent key.",
               canonicalKeys=canonical,audited=[],pending=[],conflicts=[],manifestConflicts=[])
    for s in sources:
        actual=maps[s["id"]]
        declared=s.get("physicsAnswers",{})
        if declared and ({int(k):v for k,v in declared.items()}!={k:e["answer"] for k,e in actual.items()}):
            audit["manifestConflicts"].append(dict(sourceId=s["id"],manifest=declared,independent={k:e["answer"] for k,e in actual.items()}))
    for name in ["historical-pss-editorial.json","peies-editorial.json","current-editorial.json"]:
        path=WORK/name
        if not path.exists():
            audit["pending"].append(dict(file=name,reason="Editorial file not yet written; independent canonical source keys are ready."))
            continue
        rows=json.loads(path.read_text(encoding="utf-8-sig"))
        seen=set()
        for row in rows:
            if row["id"] in seen:
                audit["conflicts"].append(dict(id=row["id"],reason="Duplicate editorial id"))
                continue
            seen.add(row["id"])
            sid=row.get("sourceId") or row["id"].rsplit("-q",1)[0]
            number=row.get("number") or int(row["id"].rsplit("-q",1)[1])
            official=maps.get(sid,{}).get(number)
            if not official:
                audit["conflicts"].append(dict(id=row["id"],reason="Question is not in the independently extracted Physics discipline key.",editorialAnswer=row.get("answer")))
                continue
            expected=official["answer"]
            ok=row.get("answer")==expected and (expected is not None or row.get("answerStatus")=="annulled")
            item=dict(id=row["id"],editorialAnswer=row.get("answer"),officialAnswer=expected,page=official["page"],method=official["method"])
            audit["audited" if ok else "conflicts"].append(item)
        relevant=[s for s in canonical if
                  (name=="current-editorial.json" and s["sourceId"] in CURRENT_PHYSICS) or
                  (name=="peies-editorial.json" and s["sourceId"].startswith("peies-")) or
                  (name=="historical-pss-editorial.json" and s["sourceId"].startswith("pss-") and s["sourceId"] not in CURRENT_PHYSICS)]
        for s in relevant:
            for entry in s["entries"]:
                item_id=f"{s['sourceId']}-q{entry['number']:02d}"
                if item_id not in seen:
                    audit["pending"].append(dict(id=item_id,file=name,reason="Missing selected Physics item in editorial."))
    audit["summary"]=dict(sources=len(canonical),canonicalQuestions=sum(len(s["entries"]) for s in canonical),audited=len(audit["audited"]),pending=len(audit["pending"]),conflicts=len(audit["conflicts"]),manifestConflicts=len(audit["manifestConflicts"]),sourcesNeedingReview=[s["sourceId"] for s in canonical if s["status"]!="verified"])
    (WORK/"key-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(audit["summary"],ensure_ascii=False),flush=True)
    return 1 if (audit["conflicts"] or audit["pending"] or audit["manifestConflicts"]
                 or audit["summary"]["sourcesNeedingReview"]) else 0


if __name__=="__main__":
    raise SystemExit(main())
