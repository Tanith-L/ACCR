"""Standalone course -> topic -> lesson preview with real image hotspots."""
import json


def render_preview(data):
    return TEMPLATE.replace("__PAYLOAD__", json.dumps(data, ensure_ascii=False).replace("<", "\\u003c"))


TEMPLATE = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PsA learning overview</title>
<style>
:root{font-family:system-ui,sans-serif;color:#12304c;background:#f7faf9}*{box-sizing:border-box}body{margin:0}
header,main{max-width:1000px;margin:auto;padding:18px 24px}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:1.25rem;margin:0 auto 0 0}.notice{font-size:.85rem;color:#66533a;background:#fff3df;padding:10px 20px;text-align:center;margin:0}
button,select{font:inherit;padding:10px;border:1px solid #abc8d0;border-radius:8px;background:white;color:inherit;cursor:pointer;max-width:100%}
a{color:#006d70}a:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid #e19d32;outline-offset:3px}
.map{position:relative;max-width:700px;margin:18px auto}.map img{width:100%;height:auto;display:block;border-radius:12px}
.map svg{position:absolute;inset:0;width:100%;height:100%}.map rect,.map polygon{fill:transparent;stroke:transparent;stroke-width:3}
.map a:hover rect,.map a:focus rect,.map a:hover polygon,.map a:focus polygon{fill:#0b9c9920;stroke:#007f80}
.debug .map rect,.debug .map polygon{fill:#ff775820;stroke:#e95438;stroke-dasharray:8 4}
.lessons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.lessons a{display:block;background:white;border:1px solid #bdd6dc;padding:16px;border-radius:10px;text-decoration:none;color:inherit}
.lessons a small{display:block;color:#526778;margin-top:6px}.caption{font-size:.85rem;color:#526778}
article{max-width:740px;margin:12px auto;background:white;padding:28px;border-radius:12px;font-size:1.1rem;line-height:1.7}article h2{line-height:1.3}article h3{font-size:1rem;color:#007c7c}
figure{margin:20px 0}figure img{display:block;width:100%;max-width:500px;height:auto;border-radius:10px;margin:auto}figcaption{font-size:.95rem;margin:10px auto;max-width:500px}
@media(max-width:600px){header,main{padding:12px}article{padding:18px}.lessons{grid-template-columns:1fr}.map{width:100%}}
</style></head><body>
<p class="notice">Draft preview for review. Clinical approval is pending.</p>
<header><h1>PsA learning library</h1><button id="home">All 6 topics</button><select id="topic" aria-label="Choose a topic"><option value="home">Course overview</option></select>
<label><input id="debug" type="checkbox"> Show click regions</label></header>
<p style="max-width:1000px;margin:auto;padding:0 24px"><a href="source-review.html">Original sources and lesson correspondence (review)</a></p>
<main id="main"></main><script id="content" type="application/json">__PAYLOAD__</script>
<script>
const data=JSON.parse(document.getElementById('content').textContent);
const selector=document.getElementById('topic'),main=document.getElementById('main');
const lessons=new Map(data.lessons.map(l=>[l.id,l])),media=new Map(data.media.map(m=>[m.id,m]));
const el=(name,text)=>{const e=document.createElement(name);if(text!==undefined)e.textContent=text;return e};
const link=(kind,id,label)=>{const a=el('a',label);a.href='#'+kind+'='+encodeURIComponent(id);return a};
for(const t of data.topics){const o=el('option',t.name);o.value=t.id;selector.append(o)}
function drawMap(m,kind,title){
 const asset=media.get(m.media_id),box=el('div');box.className='map';
 const img=el('img');img.src=asset.file;img.alt=asset.alt_text;img.width=m.image_width;img.height=m.image_height;box.append(img);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${m.image_width} ${m.image_height}`);svg.setAttribute('aria-label',title);
 for(const h of m.hotspots){
  const a=document.createElementNS(ns,'a');a.setAttribute('href','#'+kind+'='+encodeURIComponent(h[kind+'_id']));a.setAttribute('aria-label',h.label);a.setAttribute('tabindex','0');
  const label=document.createElementNS(ns,'title');label.textContent=h.label;a.append(label);
  const shape=document.createElementNS(ns,h.shape==='rect'?'rect':'polygon');
  if(h.shape==='rect'){for(const [k,v]of Object.entries(h.bounds))shape.setAttribute(k,v*(['x','width'].includes(k)?m.image_width:m.image_height))}
  else shape.setAttribute('points',h.points.map(p=>`${p.x*m.image_width},${p.y*m.image_height}`).join(' '));
  a.append(shape);svg.append(a);
 }
 box.append(svg);main.append(box);
 const full=el('a','Open full-size image');full.href=asset.file;full.target='_blank';full.rel='noopener';main.append(full);
}
function showHome(){
 selector.value='home';main.replaceChildren(el('h2','Course overview'),el('p','Choose one of the six topics. Each topic contains short lessons.'));
 if(data.course_map)drawMap(data.course_map,'topic','Six course topics');
 const list=el('nav');list.className='lessons';list.setAttribute('aria-label','All course topics');
 for(const t of data.topics){const a=link('topic',t.id,t.name),count=t.subtopics.reduce((n,s)=>n+s.lesson_ids.length,0);a.append(el('small',count+' lessons'));list.append(a)}main.append(list);
}
function showTopic(id){
 const t=data.topics.find(t=>t.id===id);if(!t){showHome();return}selector.value=t.id;main.replaceChildren(el('h2',t.name));
 if(t.image_map){main.append(el('p','Select a body-area card for symptom details. The statement below the image title opens related health and changes over time.'));drawMap(t.image_map,'lesson',t.name+' lesson links')}
 const list=el('nav');list.className='lessons';list.setAttribute('aria-label','Lessons in this topic');
 for(const sub of t.subtopics)for(const id of sub.lesson_ids){const l=lessons.get(id),a=link('lesson',id,l.title);a.append(el('small','About '+l.est_minutes+' minute(s)'));list.append(a)}main.append(list);
}
function showLesson(id){
 const lesson=lessons.get(id);if(!lesson){main.replaceChildren(el('p','Lesson not found.'));return}
 selector.value=lesson.topic_id;main.replaceChildren();const article=el('article');
 const back=el('button','Back to topic');back.onclick=()=>{location.hash='topic='+lesson.topic_id};article.append(back,el('h2',lesson.title),el('p',`About ${lesson.est_minutes} minute(s)`));
 for(const page of lesson.pages){
  article.append(el('h3','Page '+page.order),el('p',page.body));
  for(const item of lesson.images||[])if(item.page===page.order){
   const asset=media.get(item.media_id),figure=el('figure'),a=el('a'),img=el('img');a.href=asset.file;a.target='_blank';a.rel='noopener';img.src=asset.file;img.alt=asset.alt_text;img.loading='lazy';a.append(img);
   figure.append(a,el('figcaption',asset.alt_text));const credit=el('p',asset.credit);credit.className='caption';figure.append(credit);article.append(figure);
  }
 }
 article.append(el('h3','Key takeaways'));const ul=el('ul');for(const s of lesson.key_takeaways)ul.append(el('li',s));article.append(ul);
 const rows=data.editorial_sources?.[id]||[];
 if(rows.length){const notes=el('details');notes.className='source-notes';notes.append(el('summary','Source notes for editorial review'));const list=el('ul');for(const r of rows){const item=el('li'),a=el('a',r.title);a.href=r.href;a.target='_blank';a.rel='noopener';item.append(a,el('p',`Pages ${r.pages}; ${r.kind}. ${r.locator}. ${r.contribution}`),el('p','Limits: '+r.limits));list.append(item)}notes.append(list);article.append(notes)}
 const topic=data.topics.find(t=>t.id===lesson.topic_id),ids=topic.subtopics.flatMap(s=>s.lesson_ids),next=ids[ids.indexOf(id)+1];article.append(next?link('lesson',next,'Next lesson'):link('topic',lesson.topic_id,'Back to topic'));main.append(article);
}
function route(){const p=new URLSearchParams(location.hash.slice(1));if(p.has('lesson'))showLesson(p.get('lesson'));else if(p.has('topic'))showTopic(p.get('topic'));else showHome();window.scrollTo(0,0)}
selector.onchange=()=>{location.hash=selector.value==='home'?'home':'topic='+selector.value};document.getElementById('home').onclick=()=>{location.hash='home'};
document.getElementById('debug').onchange=e=>document.body.classList.toggle('debug',e.target.checked);window.addEventListener('hashchange',route);route();
</script></body></html>
'''
