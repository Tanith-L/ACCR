"""Render editable SVG teaching diagrams and matching JPEGs from reviewed text.

Run with Python and Pillow installed. Does not alter source photographs or PDFs.
Clinical content and source mappings live in assisted-input/lesson-diagrams.json.
"""
import json
from html import escape
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/psa'


def font(size, bold=False):
    names = ['C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',
             'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf']
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    raise RuntimeError('Install Arial or DejaVu Sans to render lesson diagrams.')


def render(spec):
    width, height = 1100, 300 + 180 * len(spec['cards'])
    im = Image.new('RGB', (width, height), '#f4f8fa')
    draw = ImageDraw.Draw(im)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
           f'<title>{escape(spec["title"])}</title><desc>{escape(spec["alt_text"])}</desc>',
           f'<rect width="{width}" height="{height}" fill="#f4f8fa"/>']

    def rect(box, fill, radius=0):
        draw.rounded_rectangle(box, radius=radius, fill=fill)
        x,y,x2,y2=box
        svg.append(f'<rect x="{x}" y="{y}" width="{x2-x}" height="{y2-y}" rx="{radius}" fill="{fill}"/>')

    def text(x,y,value,size=30,bold=False,color='#17364a',max_width=980):
        face=font(size,bold)
        if draw.textlength(value,font=face)>max_width:
            raise ValueError(f'Diagram line too wide: {value}')
        draw.text((x,y),value,font=face,fill=color)
        svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(value)}</text>')

    rect((0,0,width,12),'#087f83')
    text(50,42,spec['title'],46,True)
    text(50,108,spec['subtitle'],27,color='#526777')
    for i,(heading,body) in enumerate(spec['cards']):
        y=180+i*180
        rect((50,y,1050,y+145),'#ffffff',18)
        rect((50,y,60,y+145),'#087f83',4)
        text(85,y+22,heading,34,True)
        text(85,y+83,body,27,max_width=930)
    text(50,height-76,spec['footer'],25,color='#315669')
    out=BASE/'chapter/media'
    out.mkdir(parents=True,exist_ok=True)
    im.save(out/(spec['slug']+'.jpg'),quality=92,optimize=True)
    svg.append('</svg>')
    editable=BASE/'assisted-input/diagrams'
    editable.mkdir(parents=True,exist_ok=True)
    (editable/(spec['slug']+'.svg')).write_text('\n'.join(svg)+'\n',encoding='utf-8')


if __name__ == '__main__':
    specs=json.loads((BASE/'assisted-input/lesson-diagrams.json').read_text(encoding='utf-8'))
    for spec in specs:
        render(spec)
    print(f'Rendered {len(specs)} lesson diagrams (SVG and JPEG).')
