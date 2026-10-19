"""Download canonical official UFSM sources and verify their preserved hashes.

No changes to the editorial bank or official websites. Existing originals are
verified and never overwritten. Refuse a changed remote file until reviewed.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, json, urllib.request

root=Path(__file__).resolve().parents[1]
sources=json.loads((root/'public/pss-data/sources.json').read_text(encoding='utf-8'))
dest=root/'work/pss/originals'; dest.mkdir(parents=True,exist_ok=True)
tasks=[]
for s in sources:
    tasks.append((s['id']+'.pdf',s['sourceUrl'],s['examSha256']))
    if s.get('keyUrl') and s.get('keySha256'):
        tasks.append((s['id']+'-key.pdf',s['keyUrl'],s['keySha256']))

def fetch(task):
    filename,url,expected=task
    path=dest/filename
    if path.exists(): body=path.read_bytes()
    else:
        with urllib.request.urlopen(url,timeout=120) as response: body=response.read()
    assert body.startswith(b'%PDF'),filename
    assert hashlib.sha256(body).hexdigest()==expected,f'Official source changed; review before replacing: {filename}'
    if not path.exists(): path.write_bytes(body)
    return filename

verified=list(ThreadPoolExecutor(6).map(fetch,tasks))
print(f'{len(verified)} original files verified in {dest}')
