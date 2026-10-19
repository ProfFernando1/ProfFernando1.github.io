"""Consolidate reviewed UFSM items and render faithful crops (no network writes).

Usage: python scripts/build-pss-bank.py --workspace work/pss
The workspace contains preserved source PDFs, source manifests, and human-readable
editorial JSON. Keep that workspace when updating this collection.
"""
import argparse, collections, csv, hashlib, io, json
from pathlib import Path
import pymupdf as fitz
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--workspace',default='work/pss')
args=parser.parse_args()
workspace=Path(args.workspace)
output=Path('public/pss-data'); (output/'images').mkdir(parents=True,exist_ok=True)
source_files=['current-sources.json','historical-sources.json']
canonical=Path('data/pss/curation.json')
sources={s['id']:s for name in source_files for s in json.loads((workspace/name).read_text(encoding='utf-8-sig'))} if not canonical.exists() else {s['id']:s for s in json.loads((output/'sources.json').read_text(encoding='utf-8-sig'))}
base_items={s['id']:s for s in json.loads((workspace/'current-items.json').read_text(encoding='utf-8-sig'))} if not canonical.exists() else {}
questions=[]; reviewed=[]; render_manifest=[]
editorials=['current-editorial.json','historical-pss-editorial.json','peies-editorial.json']
if canonical.exists(): reviewed=json.loads(canonical.read_text(encoding='utf-8-sig'))
else:
    for name in editorials:
        reviewed.extend(json.loads((workspace/name).read_text(encoding='utf-8-sig')))
assert len({q['id'] for q in reviewed})==len(reviewed),'Duplicate item'
for entry in reviewed:
    q={**base_items.get(entry['id'],{}),**entry}
    sid=q.get('sourceId') or q['id'].rsplit('-q',1)[0]
    s=sources[sid]
    assert s.get('included',True),f'Excluded source {sid}'
    doc=fitz.open(workspace/'originals'/f'{sid}.pdf')
    if not s.get('keyUrl'):
        key_pages=[i+1 for i,p in enumerate(doc) if 'GABARITO' in p.get_text().upper()]
        s['keyPage']=key_pages[-1] if key_pages else len(doc)
    images=[]
    for i,region in enumerate(q['regions'],1):
        page=doc[region['page']-1]; rect=fitz.Rect(region['rect'])
        assert rect in page.rect and rect.width>10 and rect.height>10,(q['id'],region)
        pix=page.get_pixmap(matrix=fitz.Matrix(2.5,2.5),clip=rect,alpha=False)
        im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        path=output/'images'/f"{q['id']}-{i}.webp"
        im.save(path,'WEBP',quality=90,method=6)
        images.append('/pss-data/images/'+path.name)
        render_manifest.append(dict(questionId=q['id'],path=str(path),page=region['page'],rect=region['rect'],width=im.width,height=im.height,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    answer=q.get('answer')
    status=q.get('answerStatus') or ('valid' if answer in list('ABCDE') else 'annulled' if str(answer).lower() in ['anulada','anulado','*','x'] else 'unavailable')
    assert status!='valid' or answer in list('ABCDE'),q['id']
    text=q.get('text','').replace('\u00ad\n','').replace('\u00ad','')
    assert not any(ord(c)<32 and c not in '\n\r\t' for c in text),f'Broken text {q["id"]}'
    topic_map={'Cinemática':'Mecânica','Dinâmica':'Mecânica','Trabalho e energia':'Mecânica','Quantidade de movimento':'Mecânica','Gravitação':'Mecânica','Estática':'Mecânica','Fluidos':'Hidrostática e fluidos','Termodinâmica':'Termologia e termodinâmica','Termologia':'Termologia e termodinâmica','Ondulatória':'Oscilações e ondas','Eletricidade':'Eletrodinâmica'}
    q['topic']=topic_map.get(q['topic'],q['topic'])
    questions.append(dict(id=q['id'],sourceId=sid,year=s['year'],stage=s['stage'],program=s['program'],era='atual' if s['year']>=2024 else 'historico',editionLabel=s['editionLabel'],number=q['number'],topic=q['topic'],subtopic=q['subtopic'],difficulty=q['difficulty'],text=text,contextText=q.get('contextText',''),images=images,answer=answer if status=='valid' else None,answerStatus=status,explanation=q.get('explanation',''),sourceUrl=s['sourceUrl'],keyUrl=s.get('keyUrl') or s['sourceUrl'],sourcePages=sorted(set(r['page'] for r in q['regions'])),keyStatus=s['keyStatus']))
    questions[-1]['textReview']=q.get('textReview','extracted')
    if not s.get('keyUrl'): questions[-1]['keyUrl']=s['sourceUrl']+'#page='+str(s['keyPage'])
    for optional in ['reviewNote','duplicateOf','equivalentGroup','explanationReference']:
        if q.get(optional): questions[-1][optional]=q[optional]
used={q['sourceId'] for q in questions}
for sid,s in sources.items():
    s['questionCount']=sum(q['sourceId']==sid for q in questions)
    p=workspace/'originals'/f'{sid}.pdf'
    s['examSha256']=hashlib.sha256(p.read_bytes()).hexdigest()
    kp=workspace/'originals'/f'{sid}-key.pdf'
    if kp.exists(): s['keySha256']=hashlib.sha256(kp.read_bytes()).hexdigest()
    assert not s.get('included',True) or sid in used,f'Source without curated physics: {sid}'
questions.sort(key=lambda q:(-q['year'],q['stage'],q['sourceId'],q['number']))
coverage=dict(startYear=min(q['year'] for q in questions),endYear=max(q['year'] for q in questions),sourceCount=len(used),questionCount=len(questions),knownRepeatedItems=sum(bool(q.get('duplicateOf')) for q in questions),checkedAt='2026-10-19',note='PSS atual: 2024 (etapa 1), 2025 (etapas 1 e 2), 2026 (etapas 1, 2 e 3). O acervo histórico inclui o PSS de 2011–2016 e o PEIES de 2006–2011, nas etapas efetivamente disponíveis nas fontes oficiais consultadas. Cinco questões reaparecem nos dois cadernos da etapa 3 de 2015, com numeração diferente; ambas as aplicações foram preservadas. Não houve inclusão de provas exclusivas da seleção Único. O ano é o da edição, não o ano de ingresso nem o início do ciclo. A coleção não afirma cobrir toda a história da seleção.',difficultyNote='Dificuldade editorial: Fácil para aplicação direta de um conceito; Média para interpretação ou combinação de etapas; Difícil para articulação de vários conceitos e representações. Não representa estatística de acerto nem classificação oficial da UFSM.')
bank=dict(schemaVersion=1,coverage=coverage,questions=questions)
(output/'questions.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(output/'sources.json').write_text(json.dumps(list(sources.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(workspace/'render-manifest.json').write_text(json.dumps(render_manifest,ensure_ascii=False,indent=2),encoding='utf-8')
canonical.parent.mkdir(parents=True,exist_ok=True)
canonical.write_text(json.dumps([{**base_items.get(q['id'],{}),**q} for q in reviewed],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (output/'inventory.csv').open('w',encoding='utf-8-sig',newline='') as f:
    cols=['id','year','stage','program','editionLabel','number','topic','subtopic','difficulty','answer','answerStatus','sourceUrl','keyUrl']
    writer=csv.DictWriter(f,fieldnames=cols,extrasaction='ignore');writer.writeheader();writer.writerows(questions)
print(json.dumps(dict(questions=len(questions),sources=len(used),images=len(render_manifest),byStage=dict(collections.Counter(q['stage'] for q in questions)),byProgram=dict(collections.Counter(q['program'] for q in questions)),answerStatus=dict(collections.Counter(q['answerStatus'] for q in questions))),ensure_ascii=False))
