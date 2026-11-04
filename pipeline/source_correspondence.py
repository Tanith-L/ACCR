"""Editorial source correspondence, separate from clinical claim verification."""
from collections import Counter
import hashlib
from html import escape
import json
from pathlib import Path
from urllib.parse import quote


def review_data(root):
    return json.loads((root / 'data/psa/assisted-input/source-review.json').read_text(encoding='utf-8'))


def validate_correspondence(root, authored, registry):
    base = root / 'data/psa/originals'
    audit = review_data(root)
    actual = {p.relative_to(base).as_posix() for p in base.rglob('*') if p.is_file()}
    records = audit['files']
    if len({r['file'] for r in records}) != len(records) or {r['file'] for r in records} != actual:
        raise ValueError('Source review must account for every original file exactly once')
    lesson_ids = {l['id'] for l in authored['lessons']}
    used = {sid for l in authored['lessons'] for sid in l['source_ids']}
    audited_used = set()
    for record in records:
        path = (base / record['file']).resolve()
        if not path.is_relative_to(base.resolve()):
            raise ValueError('Source review path escapes originals')
        if hashlib.sha256(path.read_bytes()).hexdigest() != record['sha256']:
            raise ValueError('Source review is stale: ' + record['file'])
        if not record['decision'] or not record['review_scope']:
            raise ValueError('Every original needs a disposition and review scope')
        if not set(record['candidate_lessons']) <= lesson_ids:
            raise ValueError('Unknown candidate lesson in source review')
        if record['status'] == 'lesson_source':
            sid = record['source_id']
            if sid not in used or (root / registry[sid]['local_file']).resolve() != path:
                raise ValueError('Source review use disagrees with lesson references: ' + record['file'])
            audited_used.add(sid)
    if audited_used != used:
        raise ValueError('A used lesson source is missing from the source review')
    media = {m['id']: m for m in authored['media']}
    for lesson in authored['lessons']:
        rows = lesson.get('source_usage', [])
        if len({r['source_id'] for r in rows}) != len(rows) or {r['source_id'] for r in rows} != set(lesson['source_ids']):
            raise ValueError('Every lesson source needs one located use: ' + lesson['id'])
        for row in rows:
            if row['kind'] not in {'text', 'image', 'text_and_image'}:
                raise ValueError('Unknown source use kind')
            if not row['pages'] or not set(row['pages']) <= set(range(1, len(lesson['pages']) + 1)):
                raise ValueError('Invalid lesson page in source use')
            if not all(row[k].strip() for k in ('locator', 'contribution', 'limits')):
                raise ValueError('Incomplete source locator or use explanation')
            displayed = [im for im in lesson.get('images', []) if media[im['media_id']]['source_id'] == row['source_id']]
            if ('image' in row['kind']) != bool(displayed):
                raise ValueError('Source use disagrees with displayed images: ' + lesson['id'])
            if any(im['page'] not in row['pages'] for im in displayed):
                raise ValueError('Image page absent from source use')


def lesson_source_rows(root, lesson, registry):
    result = []
    for usage in lesson['source_usage']:
        record = registry[usage['source_id']]
        relative = Path(record['local_file']).relative_to('data/psa').as_posix()
        result.append({**usage, 'title': record['title'], 'pages': ', '.join(map(str, usage['pages'])),
                       'href': '../' + quote(relative, safe='/'), 'lesson_href': '../../../' + quote(relative, safe='/')})
    return result


def review_documents(root, authored, registry):
    audit = review_data(root)
    lessons = authored['lessons']
    counts = Counter(r['status'] for r in audit['files'])
    summary = f"{len(audit['files'])} original files accounted for; {len(lessons)} lessons with located source uses."
    md = ['# Original files and lesson correspondence', '', summary, '', audit['scope'], '',
          'Text use does not require embedding the entire original image. Background candidates below are not counted as used evidence.', '',
          '## Every original file', '', '| Original | Disposition | Used by lesson(s) | Decision / review scope |', '|---|---|---|---|']
    body = ['<h1>Original files and lesson correspondence</h1>', '<p><a href="overview.html">Back to course preview</a></p>',
            '<p>'+escape(summary)+'</p>', '<p>'+escape(audit['scope'])+'</p>',
            '<p>Text references, displayed images and unused background files are distinguished below. This is an editorial review, not clinical approval.</p>',
            '<h2>Every original file</h2><div class="table"><table><thead><tr><th>Original</th><th>Disposition</th><th>Lessons</th><th>Decision and review scope</th></tr></thead><tbody>']
    for r in audit['files']:
        uses = [l for l in lessons if r['source_id'] in l['source_ids']]
        href = '../originals/' + quote(r['file'], safe='/')
        lids = ', '.join(l['id'] for l in uses) or 'None'
        note = r['decision'] + ' Review scope: ' + r['review_scope']
        if r['candidate_lessons']:
            note += ' Considered only (not used): ' + ', '.join(r['candidate_lessons']) + '.'
        md.append(f"| [{r['file']}]({href}) | {r['status']} | {lids} | {note} |")
        links = ', '.join('<a href="#'+escape(l['id'])+'">'+escape(l['id'])+'</a>' for l in uses) or 'None'
        body.append('<tr><td><a href="'+escape(href,quote=True)+'">'+escape(r['file'])+'</a></td><td>'+escape(r['status'])+'</td><td>'+links+'</td><td>'+escape(note)+'</td></tr>')
    body.append('</tbody></table></div><h2>Each lesson: source portions actually used</h2>')
    md += ['', '## Each lesson', '']
    for l in lessons:
        md += ['### '+l['id']+' - '+l['title'], '', '[Open lesson](overview.html#lesson='+l['id']+')', '']
        body += ['<section id="'+l['id']+'"><h3>'+escape(l['title'])+'</h3><p><a href="overview.html#lesson='+l['id']+'">Open '+l['id']+'</a></p><ul>']
        for r in lesson_source_rows(root, l, registry):
            detail = f"Pages {r['pages']}; {r['kind']}. Source location: {r['locator']}. Use: {r['contribution']} Limits: {r['limits']}"
            md.append(f"- [{r['title']}]({r['href']}): {detail}")
            body.append('<li><a href="'+escape(r['href'],quote=True)+'">'+escape(r['title'])+'</a>: '+escape(detail)+'</li>')
        md += ['', 'External references supplement these originals:', '']
        body.append('</ul><p>External references supplement these originals:</p><ul>')
        for rid in l['references']:
            ref = authored['references'][rid]
            md.append(f"- [{ref['title']}]({ref['url']})")
            body.append('<li><a href="'+escape(ref['url'],quote=True)+'">'+escape(ref['title'])+'</a></li>')
        md.append('')
        body.append('</ul></section>')
    md += ['## File disposition counts', '', *[f'- {k}: {v}' for k,v in sorted(counts.items())], '']
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PsA source review</title><style>body{font-family:system-ui,sans-serif;max-width:1200px;margin:auto;padding:24px;color:#12304c;line-height:1.6}a{color:#006d70}.table{overflow:auto}table{border-collapse:collapse;font-size:.9rem}td,th{padding:10px;border:1px solid #cbd9df;text-align:left;vertical-align:top}section{border-top:1px solid #cbd9df;margin-top:30px}li{margin:12px 0}</style><body>'+'\n'.join(body)+'</body></html>\n'
    return {'source-review.md':'\n'.join(md).rstrip()+'\n','source-review.html':html}
