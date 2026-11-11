// Whiteboard drawing kit: helpers, drawn icons and scene layouts. Shared by every lesson video.
/* ===================== whiteboard drawing kit ===================== */
const INK='#1E1E1E', GRN='#2E7A4F', ORG='#D9662B', RED='#D2372B', TEAL='#14746F', PLUM='#8E3B7A', GOLD='#9A7800', MUT='#6B756E';
const F={green:'#D8EFD6',apricot:'#FFD9C2',teal:'#CDEDE8',plum:'#F2DCEE',gold:'#FBECB0',skin:'#F6D2B8',skin2:'#C99572',skin3:'#8D5F45',bone:'#FBF4E6',blue:'#DCEAF6',grey:'#E6ECEF',hot:'#F6A58A',paper:'#FFFBEA'};
const HF=`font-family="Kalam,'Comic Sans MS',cursive" font-weight="700"`, WF=`font-family="'Patrick Hand','Comic Sans MS',cursive"`;
const g=(x,y,inner,s=1)=>`<g transform="translate(${x},${y})${s!==1?` scale(${s})`:''}">${inner}</g>`;
const C=(cue,inner)=>`<g data-c="${cue}">${inner}</g>`;
const W=(x,y,t,o={})=>`<text x="${x}" y="${y}" text-anchor="${o.a||'middle'}" ${WF} font-size="${o.s||30}" fill="${o.f||INK}" stroke="none">${t}</text>`;
const W2=(x,y,a,b,o={})=>W(x,y,a,o)+W(x,y+(o.s||30)*1.05,b,o);
const H=(x,y,t,o={})=>`<text x="${x}" y="${y}" text-anchor="${o.a||'middle'}" ${HF} font-size="${o.s||56}" fill="${o.f||INK}" stroke="none">${t}</text>`;
const swoosh=(x1,y,x2,col=GRN)=>`<path d="M${x1},${y} Q${(x1+x2)/2},${y+12} ${x2},${y-5}" stroke="${col}" stroke-width="6"/>`;
function arrow(x1,y1,x2,y2,col=INK){const a=Math.atan2(y2-y1,x2-x1),h=16;
  return `<path d="M${x1},${y1} Q${(x1+x2)/2},${(y1+y2)/2-14} ${x2},${y2}" stroke="${col}" stroke-width="5"/><path d="M${x2-h*Math.cos(a-.5)},${y2-h*Math.sin(a-.5)} L${x2},${y2} L${x2-h*Math.cos(a+.5)},${y2-h*Math.sin(a+.5)}" stroke="${col}" stroke-width="5"/>`;}
const loop=(cx,cy,rx,ry,col=ORG)=>`<path d="M${cx-rx},${cy+4} C${cx-rx},${cy-ry*1.1} ${cx+rx},${cy-ry*1.1} ${cx+rx},${cy} C${cx+rx},${cy+ry*1.1} ${cx-rx*.9},${cy+ry*1.15} ${cx-rx*.95},${cy-ry*.25}" stroke="${col}" stroke-width="5"/>`;
const ticks=(x,y,col=ORG)=>[[-50],[-15],[20]].map(([a])=>{const r=a*Math.PI/180;return `<path d="M${x+Math.cos(r)*8},${y+Math.sin(r)*8} L${x+Math.cos(r)*22},${y+Math.sin(r)*22}" stroke="${col}" stroke-width="4"/>`}).join('');
const xmark=(x,y,r=44)=>`<path d="M${x-r},${y-r} L${x+r},${y+r}" stroke="${RED}" stroke-width="10"/><path d="M${x+r},${y-r} L${x-r},${y+r}" stroke="${RED}" stroke-width="10"/>`;
const check=(x,y,r=20,col=GRN)=>`<path d="M${x-r*.65},${y} L${x-r*.15},${y+r*.55} L${x+r*.75},${y-r*.6}" stroke="${col}" stroke-width="${Math.max(5,r*.32)}"/>`;
const box=(w,h,fill='#fff',rx=18)=>`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
function bubble(w,h,tail='left'){const x0=-w/2,x1=w/2,y0=-h/2,y1=h/2,r=24,tx=tail==='left'?x0+50:x1-50,d=tail==='left'?-1:1;
  return `<path fill="#fff" d="M${x0+r},${y0} H${x1-r} Q${x1},${y0} ${x1},${y0+r} V${y1-r} Q${x1},${y1} ${x1-r},${y1} H${tx+14} L${tx+d*26},${y1+34} L${tx-14},${y1} H${x0+r} Q${x0},${y1} ${x0},${y1-r} V${y0+r} Q${x0},${y0} ${x0+r},${y0} Z"/>`;}
const tag=(t,col=GRN,fill=F.green,w)=>{const W_=w||t.length*14+44;return `<rect x="${-W_/2}" y="-24" width="${W_}" height="48" rx="24" fill="${fill}" stroke="${col}" stroke-width="3.5"/>${W(0,9,t,{s:28,f:col})}`};

function person(o={}){
  const skin=o.skin||F.skin, shirt=o.shirt||F.apricot, hair=o.hair||'#5A3E2B';
  let s=`<path d="M-58,0 V-86 Q-58,-146 0,-146 Q58,-146 58,-86 V0" fill="${o.doctor?'#fff':shirt}"/>`;
  if(o.doctor) s+=`<path d="M-22,-144 L0,-104 L22,-144 Z" fill="${F.teal}"/><path d="M0,-104 V-4"/><path d="M-20,-138 Q-40,-92 -9,-80 M20,-138 Q40,-92 9,-80" stroke-width="4.5"/><circle cx="0" cy="-76" r="8" fill="${F.grey}"/><rect x="22" y="-66" width="22" height="24" rx="3"/>`;
  else s+=`<path d="M-18,-144 Q0,-124 18,-144"/>`;
  if(o.long) s+=`<path d="M-36,-208 Q-52,-160 -30,-140" stroke="${hair}" stroke-width="12"/><path d="M36,-208 Q52,-160 30,-140" stroke="${hair}" stroke-width="12"/>`;
  s+=`<circle cx="0" cy="-196" r="38" fill="${skin}"/>`;
  s+=`<path d="M-38,-198 Q-42,-242 0,-240 Q42,-242 38,-198 Q26,-222 2,-220 Q-26,-226 -38,-198 Z" fill="${hair}"/>`;
  if(o.glasses) s+=`<circle cx="-14" cy="-194" r="10"/><circle cx="14" cy="-194" r="10"/><path d="M-4,-195 H4"/>`;
  s+=`<circle cx="-14" cy="-194" r="3" fill="${INK}"/><circle cx="14" cy="-194" r="3" fill="${INK}"/><path d="M-12,-178 Q0,-167 12,-178"/>`;
  if(o.wave) s+=`<path d="M48,-110 Q84,-138 90,-172" stroke="${o.doctor?'#C9CFC6':shirt}" stroke-width="20"/><circle cx="92" cy="-184" r="13" fill="${skin}"/><path d="M106,-200 q10,10 6,24 M116,-210 q14,16 8,36" stroke="${MUT}" stroke-width="3.5"/>`;
  return s;
}
const doctor=(o={})=>person({doctor:true,skin:F.skin2,hair:'#2A211C',...o});
const patient=(o={})=>person({skin:F.skin,shirt:F.apricot,hair:'#7A5232',long:true,...o});

const I={
 joint:()=>`<rect x="-14" y="-64" width="28" height="54" rx="14" fill="${F.bone}"/><rect x="-14" y="10" width="28" height="54" rx="14" fill="${F.bone}"/><circle cx="0" cy="0" r="13" fill="${F.hot}"/>${ticks(16,-12)}`,
 shield:()=>`<path d="M0,-44 L36,-30 V0 Q36,30 0,46 Q-36,30 -36,0 V-30 Z" fill="${F.teal}"/>${check(0,0,20,TEAL)}`,
 clock:()=>`<circle cx="0" cy="0" r="42" fill="#fff"/><path d="M0,-34 V-28 M34,0 H28 M0,34 V28 M-34,0 H-28" stroke-width="4"/><path d="M0,0 V-26"/><path d="M0,0 L18,8" stroke="${ORG}" stroke-width="5"/>`,
 mug:()=>`<path d="M-30,-28 H22 V22 Q22,40 4,40 H-12 Q-30,40 -30,22 Z" fill="${F.apricot}"/><path d="M22,-14 Q46,-14 46,4 Q46,22 22,22"/><path d="M-14,-40 q-8,-10 0,-20 M4,-40 q-8,-10 0,-20" stroke="${MUT}" stroke-width="3.5"/>`,
 skin:()=>`<rect x="-50" y="-38" width="100" height="76" rx="18" fill="${F.skin}"/><path d="M-26,-14 Q-30,-28 -8,-26 Q14,-34 24,-16 Q36,0 18,14 Q0,26 -16,16 Q-34,8 -26,-14 Z" fill="#EE9C93" stroke-width="3"/><path d="M-14,-10 h10 M4,-6 h12 M-8,6 h9" stroke="#fff" stroke-width="3"/>`,
 family:()=>`<path d="M-30,-12 V6 H30 V-12 M0,6 V22" stroke-width="3.5"/><circle cx="-30" cy="-30" r="16" fill="${F.plum}"/><circle cx="30" cy="-30" r="16" fill="${F.teal}"/><circle cx="0" cy="38" r="15" fill="${F.apricot}"/>`,
 tube:(liq='#F08F84')=>`<g transform="rotate(12)"><rect x="-15" y="-50" width="30" height="96" rx="15" fill="#fff"/><path d="M-12,0 H12 V31 Q12,43 0,43 Q-12,43 -12,31 Z" fill="${liq}" stroke-width="3"/><rect x="-20" y="-60" width="40" height="13" rx="5" fill="${F.teal}"/></g>`,
 notepad:()=>`<rect x="-90" y="-110" width="180" height="220" rx="14" fill="${F.paper}"/><circle cx="-40" cy="-110" r="7" fill="#fff"/><circle cx="0" cy="-110" r="7" fill="#fff"/><circle cx="40" cy="-110" r="7" fill="#fff"/>`,
 stopwatch:()=>`<rect x="-10" y="-64" width="20" height="14" rx="4" fill="${F.grey}"/><circle cx="0" cy="0" r="48" fill="#fff"/><path d="M0,0 L0,-38 A38,38 0 0 1 33,19 Z" fill="${F.green}" stroke-width="3"/><path d="M0,0 L22,-30" stroke="${GRN}" stroke-width="5"/>`,
 magnifier:()=>`<circle cx="0" cy="0" r="34" fill="${F.blue}" stroke-width="7"/><path d="M25,25 L58,58" stroke-width="12"/>`,
 nail:(changed=true)=>`<path d="M-30,56 V-8 Q-30,-48 0,-48 Q30,-48 30,-8 V56" fill="${F.skin}"/><path d="M-19,-6 V-28 Q-19,-40 0,-40 Q19,-40 19,-28 V-6 Q0,0 -19,-6 Z" fill="#FDEDE6" stroke-width="3"/>${changed?`<circle cx="-8" cy="-26" r="2.4" fill="${INK}" stroke-width="2"/><circle cx="6" cy="-30" r="2.4" fill="${INK}" stroke-width="2"/><circle cx="9" cy="-16" r="2.4" fill="${INK}" stroke-width="2"/><circle cx="-4" cy="-14" r="2.4" fill="${INK}" stroke-width="2"/>`:''}`,
 spine:()=>[0,1,2,3,4].map(i=>`<rect x="-24" y="${-56+i*23}" width="48" height="17" rx="7" fill="${F.bone}" stroke-width="3.5"/>`).join('')+ticks(28,-10),
 heel:()=>`<path d="M-30,-60 V18 Q-30,40 -6,42 H54 Q66,42 66,30 Q66,20 50,16 L10,4 V-60" fill="${F.skin}"/><path d="M-16,-58 V22" stroke="${ORG}" stroke-width="6"/><circle cx="-16" cy="26" r="8" fill="${F.hot}" stroke-width="3"/>`,
 fire:()=>`<path d="M0,-46 Q30,-14 22,14 Q16,40 0,42 Q-16,40 -22,14 Q-30,-14 0,-46 Z" fill="${F.hot}"/><path d="M0,-6 Q14,10 8,22 Q4,32 0,32 Q-4,32 -8,22 Q-14,10 0,-6 Z" fill="${F.gold}" stroke-width="3"/>`,
 house:()=>`<path d="M-48,2 L0,-42 L48,2" stroke-width="6"/><rect x="-34" y="-6" width="68" height="50" rx="4" fill="${F.gold}"/><rect x="-10" y="16" width="20" height="28" fill="${F.apricot}" stroke-width="3"/>`,
 finger:(sw)=>sw?`<path d="M-34,70 V-18 Q-36,-58 0,-58 Q36,-58 34,-18 V70" fill="#F2B79C"/><path d="M-12,-40 Q0,-48 12,-40 V-30 Q0,-26 -12,-30 Z" fill="#FDEDE6" stroke-width="3"/>${ticks(36,-30)}`
   :`<path d="M-20,70 V-30 Q-20,-58 0,-58 Q20,-58 20,-30 V70" fill="${F.skin}"/><path d="M-11,-40 Q0,-48 11,-40 V-30 Q0,-26 -11,-30 Z" fill="#FDEDE6" stroke-width="3"/><path d="M-10,0 H10 M-10,34 H10" stroke-width="3"/>`,
 coin:()=>`<circle cx="0" cy="0" r="32" fill="${F.gold}"/>${W(0,10,'+1',{s:30,f:GOLD})}`,
};
function screen(w,h,inner,label){
  return `<rect x="${-w/2-10}" y="${-h/2-10}" width="${w+20}" height="${h+20}" rx="16" fill="#fff"/><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="8" fill="${F.grey}"/>${inner}${W(0,h/2+48,label,{s:30})}`;
}
const xrayFinger=(glow)=>`<rect x="-12" y="-62" width="24" height="52" rx="10" fill="#fff"/><rect x="-12" y="-2" width="24" height="60" rx="10" fill="#fff"/>${glow?`<path d="M12,-8 q16,4 10,18" stroke="${GRN}" stroke-width="6"/>`:''}`;
const xrayHeel=`<path d="M-50,-30 Q-56,20 -30,30 H50 Q60,26 50,10 L10,-30 Z" fill="#fff"/><path d="M-34,28 L-50,44 L-22,32" fill="${F.gold}" stroke-width="3.5"/>`;
const ultrasound=`<path d="M0,-44 L-50,36 Q0,54 50,36 Z" fill="#C6D2D8"/><path d="M-26,0 Q0,10 26,0 M-36,20 Q0,32 36,20" stroke="#fff" stroke-width="3"/>`;
const mri=`<circle cx="0" cy="0" r="44" fill="#fff" stroke-width="5"/><circle cx="0" cy="0" r="24" fill="${F.grey}"/><rect x="-66" y="-5" width="132" height="12" rx="6" fill="${F.blue}"/>`;
function bodyMap(){const b='#BFDDC3';
  return `<path d="M-46,-110 L-76,-28 L-88,44" stroke="${b}" stroke-width="26"/><path d="M46,-110 L76,-28 L88,44" stroke="${b}" stroke-width="26"/>
  <path d="M-24,10 L-30,100 L-34,186" stroke="${b}" stroke-width="26"/><path d="M24,10 L30,100 L34,186" stroke="${b}" stroke-width="26"/>
  <rect x="-52" y="-130" width="104" height="150" rx="40" fill="${F.green}"/><circle cx="0" cy="-166" r="32" fill="${F.green}"/>`;}
const dot=(x,y,col=ORG,fill=F.hot)=>`<circle cx="${x}" cy="${y}" r="15" stroke="${col}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7" fill="${fill}" stroke="${col}" stroke-width="3"/>`;
const pointer=(x,y,tx,ty,txt,col,a='start')=>`<path d="M${x},${y} L${tx},${ty}" stroke="${MUT}" stroke-width="3" stroke-dasharray="2 9"/>${W(tx+(a==='start'?10:-10),ty+10,txt,{s:30,f:col,a})}`;
const tile=(col,fill,icon,txt)=>`<rect x="-66" y="-66" width="132" height="132" rx="20" fill="${fill}" stroke="${col}" stroke-width="3.5"/>${g(0,-12,icon,.55)}${W(0,52,txt,{s:24,f:col})}`;


/* ===================== more icons (drawn, ~100px, centred on 0,0) ===================== */
Object.assign(I,{
 eye:()=>`<path d="M-52,0 Q0,-44 52,0 Q0,44 -52,0 Z" fill="#fff"/><circle cx="0" cy="0" r="18" fill="${F.blue}"/><circle cx="0" cy="0" r="8" fill="${INK}"/><path d="M-30,-30 l-8,-12 M0,-36 v-14 M30,-30 l8,-12" stroke-width="3.5"/>`,
 redEye:()=>`<path d="M-52,0 Q0,-44 52,0 Q0,44 -52,0 Z" fill="#fff"/><path d="M-40,-6 q8,4 14,0 M30,8 q8,-2 12,4 M-36,10 q10,-2 14,6" stroke="${RED}" stroke-width="3"/><circle cx="0" cy="0" r="18" fill="${F.blue}"/><circle cx="0" cy="0" r="8" fill="${INK}"/>`,
 blurEye:()=>`<path d="M-52,0 Q0,-44 52,0 Q0,44 -52,0 Z" fill="#fff" stroke-dasharray="6 6"/><circle cx="0" cy="0" r="18" fill="${F.blue}" stroke-dasharray="4 5"/><circle cx="0" cy="0" r="8" fill="${INK}"/>`,
 sun:()=>`<circle cx="0" cy="0" r="26" fill="${F.gold}"/>${[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return `<path d="M${Math.cos(r)*36},${Math.sin(r)*36} L${Math.cos(r)*50},${Math.sin(r)*50}" stroke="${GOLD}" stroke-width="5"/>`}).join('')}`,
 floaters:()=>`<rect x="-46" y="-40" width="92" height="80" rx="12" fill="#fff"/><circle cx="-14" cy="-8" r="6" fill="${INK}"/><circle cx="16" cy="10" r="4" fill="${INK}"/><path d="M-30,18 q8,-8 16,0" stroke-width="3"/><path d="M20,-22 l6,-10 M30,-16 l10,-4" stroke="${GOLD}" stroke-width="4"/>`,
 gut:()=>`<path d="M-40,-40 Q-48,0 -36,34 Q-20,48 0,40 Q20,48 36,34 Q48,0 40,-40 Q20,-48 0,-40 Q-20,-48 -40,-40 Z" fill="${F.apricot}"/><path d="M-22,-20 Q0,-30 22,-20 Q30,0 10,4 Q-10,8 -20,18 Q0,28 22,20" stroke-width="3.5"/>`,
 heart:()=>`<path d="M0,40 C-60,0 -50,-50 -14,-42 C-4,-40 0,-30 0,-26 C0,-30 4,-40 14,-42 C50,-50 60,0 0,40 Z" fill="#F6B3AE"/><path d="M-30,-4 H-12 L-4,-18 L6,12 L14,-4 H30" stroke="${RED}" stroke-width="3.5"/>`,
 scale:()=>`<rect x="-46" y="-34" width="92" height="76" rx="14" fill="#fff"/><path d="M-26,-14 A28,28 0 0 1 26,-14" fill="${F.grey}"/><path d="M0,-6 L12,-22" stroke="${RED}" stroke-width="4"/><path d="M-30,30 H30" stroke="${MUT}" stroke-width="3"/>`,
 drop:()=>`<path d="M0,-46 Q34,-4 30,18 Q26,42 0,42 Q-26,42 -30,18 Q-34,-4 0,-46 Z" fill="#F6B3AE"/>${W(0,26,'sugar',{s:20,f:RED})}`,
 gauge:()=>`<rect x="-30" y="-46" width="60" height="92" rx="12" fill="#fff"/><rect x="-20" y="-34" width="40" height="26" rx="4" fill="${F.green}"/><path d="M-12,-20 h24" stroke-width="3"/><circle cx="0" cy="20" r="10" fill="${F.grey}"/>`,
 cuff:()=>`<rect x="-46" y="-26" width="70" height="52" rx="12" fill="${F.blue}"/><path d="M24,0 Q50,0 46,30 M46,30 a8,8 0 1 0 0.1,0" stroke-width="4"/>`,
 mood:()=>`<path d="M-44,10 Q-54,-20 -26,-30 Q-18,-50 6,-44 Q26,-56 40,-34 Q60,-24 48,2 Q56,26 30,30 Q10,44 -10,32 Q-36,40 -44,10 Z" fill="${F.plum}"/><circle cx="-12" cy="-8" r="3" fill="${INK}"/><circle cx="12" cy="-8" r="3" fill="${INK}"/><path d="M-10,14 Q0,6 10,14" stroke-width="3.5"/>`,
 brain:()=>`<path d="M-40,0 Q-46,-30 -20,-38 Q-6,-50 10,-40 Q36,-44 40,-18 Q52,6 34,22 Q26,40 4,36 Q-14,44 -26,30 Q-46,26 -40,0 Z" fill="${F.plum}"/><path d="M0,-38 Q-8,-10 4,6 Q10,20 2,34 M-24,-14 Q-10,-6 -20,10 M22,-20 Q12,-4 26,8" stroke-width="3"/>`,
 moon:()=>`<path d="M14,-44 A44,44 0 1 0 40,24 A34,34 0 1 1 14,-44 Z" fill="${F.gold}"/><path d="M30,-30 l4,8 8,1 -6,6 2,8 -8,-4 -8,4 2,-8 -6,-6 8,-1 Z" fill="#fff" stroke-width="2.5"/>`,
 bed:()=>`<path d="M-56,30 V-20 M-56,8 H56 V30 M56,8 V-4 H-20 V8" stroke-width="5"/><rect x="-50" y="-14" width="28" height="18" rx="8" fill="#fff"/>${W(30,-24,'z z',{s:24,f:TEAL})}`,
 plate:()=>`<circle cx="0" cy="0" r="46" fill="#fff"/><circle cx="0" cy="0" r="32" fill="${F.grey}"/><path d="M-16,-10 q8,-14 18,0 q-8,10 -18,0 Z" fill="#9BD49B" stroke-width="3"/><circle cx="12" cy="10" r="9" fill="${F.apricot}" stroke-width="3"/><circle cx="-10" cy="14" r="6" fill="#D96B8A" stroke-width="3"/>`,
 apple:()=>`<path d="M0,-24 Q-40,-40 -38,4 Q-34,40 -8,38 Q0,34 8,38 Q34,40 38,4 Q40,-40 0,-24 Z" fill="#F6A5A0"/><path d="M0,-24 Q2,-36 8,-44" stroke-width="4"/><path d="M6,-34 q14,-12 22,-2 q-12,10 -22,2 Z" fill="#9BD49B" stroke-width="3"/>`,
 veg:()=>`<path d="M-6,46 L-30,-10 Q-30,-24 -16,-24 Q-4,-24 2,-12 L10,40 Z" fill="${F.apricot}"/><path d="M-22,-24 q-10,-20 -2,-26 M-14,-24 q2,-22 12,-24 M-6,-20 q12,-16 22,-12" stroke="${GRN}" stroke-width="4"/>`,
 shoe:()=>`<path d="M-50,20 V-10 Q-50,-30 -30,-30 L-6,-30 L4,-6 Q30,0 46,10 Q54,20 46,26 H-50 Z" fill="${F.teal}"/><path d="M-50,26 H50" stroke-width="5"/><path d="M-20,-16 h14 M-16,-6 h16" stroke-width="3"/>`,
 waves:()=>`<path d="M-50,-10 q12,-12 25,0 q12,12 25,0 q12,-12 25,0 q12,12 25,0" stroke="${TEAL}" stroke-width="5"/><path d="M-50,14 q12,-12 25,0 q12,12 25,0 q12,-12 25,0 q12,12 25,0" stroke="${TEAL}" stroke-width="5"/><circle cx="0" cy="-32" r="10" fill="${F.skin}"/>`,
 bike:()=>`<circle cx="-30" cy="16" r="22" fill="#fff"/><circle cx="32" cy="16" r="22" fill="#fff"/><path d="M-30,16 L-6,-14 H22 L32,16 M-6,-14 L4,16 L22,-14 M-12,-24 H4" stroke-width="4"/>`,
 dumbbell:()=>`<rect x="-50" y="-22" width="16" height="44" rx="5" fill="${F.grey}"/><rect x="34" y="-22" width="16" height="44" rx="5" fill="${F.grey}"/><rect x="-34" y="-6" width="68" height="12" rx="4" fill="#fff"/>`,
 yoga:()=>`<circle cx="0" cy="-36" r="11" fill="${F.skin}"/><path d="M0,-24 V10 M-36,-30 L0,-14 L36,-30 M0,10 L-30,34 H30 L0,10" stroke-width="5"/>`,
 pill:()=>`<g transform="rotate(-35)"><rect x="-44" y="-17" width="88" height="34" rx="17" fill="#fff"/><path d="M0,-17 V17" stroke-width="4"/><rect x="0" y="-17" width="44" height="34" rx="0" fill="${F.apricot}" stroke="none"/><path d="M0,-17 H27 A17,17 0 0 1 27,17 H0" fill="${F.apricot}"/></g>`,
 syringe:()=>`<g transform="rotate(-40)"><rect x="-12" y="-40" width="24" height="64" rx="5" fill="#fff"/><path d="M-12,-6 H12 V20 H-12 Z" fill="${F.teal}" stroke-width="3"/><path d="M0,24 V54" stroke-width="3.5"/><path d="M-20,-40 H20 M0,-40 V-58 M-12,-58 H12" stroke-width="4"/></g>`,
 drip:()=>`<path d="M-30,-50 V50" stroke-width="4"/><path d="M-40,-50 H20" stroke-width="4"/><path d="M0,-50 V-40" stroke-width="3"/><rect x="-14" y="-40" width="28" height="44" rx="8" fill="${F.blue}"/><path d="M0,4 V22 Q0,40 24,44" stroke-width="3"/>`,
 signal:()=>`<circle cx="-30" cy="0" r="14" fill="${F.plum}"/><path d="M-14,0 H20" stroke-width="4" stroke-dasharray="6 6"/><circle cx="34" cy="0" r="14" fill="#fff"/>${xmark(3,0,10)}`,
 cell:()=>`<circle cx="0" cy="0" r="46" fill="${F.green}"/><circle cx="6" cy="4" r="16" fill="${F.plum}"/><path d="M-30,-14 q10,-8 20,0 M-24,22 q10,6 18,-2" stroke-width="3"/>`,
 phone:()=>`<rect x="-28" y="-50" width="56" height="100" rx="10" fill="#fff"/><rect x="-20" y="-38" width="40" height="66" rx="4" fill="${F.blue}"/><circle cx="0" cy="38" r="5" fill="${INK}"/>`,
 chat:()=>`<path d="M-48,-36 H48 V20 H-8 L-28,40 V20 H-48 Z" fill="#fff"/><path d="M-32,-16 H32 M-32,2 H14" stroke="${MUT}" stroke-width="4"/>`,
 warn:()=>`<path d="M0,-50 L52,40 H-52 Z" fill="#FDE2DE" stroke="${RED}" stroke-width="6"/><path d="M0,-18 V12" stroke="${RED}" stroke-width="8"/><circle cx="0" cy="26" r="4" fill="${RED}" stroke="${RED}"/>`,
 hospital:()=>`<rect x="-46" y="-30" width="92" height="74" rx="6" fill="#fff"/><path d="M-46,-30 L0,-56 L46,-30"/><rect x="-14" y="-18" width="28" height="28" rx="4" fill="#FDE2DE" stroke="${RED}"/><path d="M0,-12 V4 M-8,-4 H8" stroke="${RED}" stroke-width="4"/><rect x="-10" y="20" width="20" height="24" fill="${F.grey}"/>`,
 thermo:()=>`<rect x="-10" y="-50" width="20" height="74" rx="10" fill="#fff"/><circle cx="0" cy="34" r="16" fill="#F6B3AE"/><path d="M0,30 V-20" stroke="${RED}" stroke-width="6"/>`,
 bandage:()=>`<g transform="rotate(-30)"><rect x="-50" y="-16" width="100" height="32" rx="16" fill="${F.apricot}"/><rect x="-16" y="-16" width="32" height="32" fill="#fff" stroke-width="3"/><circle cx="-6" cy="-6" r="2" fill="${INK}"/><circle cx="6" cy="6" r="2" fill="${INK}"/></g>`,
 cloud:()=>`<path d="M-44,20 Q-58,-6 -30,-14 Q-26,-40 0,-34 Q20,-50 36,-26 Q60,-20 50,8 Q56,30 30,30 H-30 Q-44,30 -44,20 Z" fill="${F.grey}"/><path d="M-12,40 l-6,12 M6,40 l-6,12 M24,40 l-6,12" stroke="${TEAL}" stroke-width="4"/>`,
 people:()=>`<circle cx="-26" cy="-22" r="14" fill="${F.apricot}"/><circle cx="26" cy="-22" r="14" fill="${F.teal}"/><circle cx="0" cy="-30" r="15" fill="${F.plum}"/><path d="M-48,40 Q-48,0 -26,0 Q-8,0 -8,40 M8,40 Q8,0 26,0 Q48,0 48,40 M-20,40 Q-20,-10 0,-10 Q20,-10 20,40"/>`,
 stairs:()=>`<path d="M-50,40 H-26 V16 H-2 V-8 H22 V-32 H50" stroke-width="5"/><path d="M-50,40 H50" stroke="${MUT}" stroke-width="3"/>`,
 chair:()=>`<path d="M-24,-46 V14 H30 V46 M-24,14 V46 M-24,-46 H-10 V2 H30" stroke-width="5"/><rect x="-24" y="2" width="54" height="12" rx="3" fill="${F.apricot}"/>`,
 shirt:()=>`<path d="M-20,-44 L-48,-30 L-38,-6 L-28,-12 V44 H28 V-12 L38,-6 L48,-30 L20,-44 Q0,-30 -20,-44 Z" fill="${F.blue}"/><circle cx="0" cy="-10" r="3" fill="${INK}"/><circle cx="0" cy="8" r="3" fill="${INK}"/><circle cx="0" cy="26" r="3" fill="${INK}"/>`,
 shelf:()=>`<path d="M-50,-10 H50 M-40,-10 V-14" stroke-width="5"/><rect x="-30" y="-42" width="22" height="32" rx="3" fill="${F.apricot}"/><rect x="0" y="-36" width="26" height="26" rx="3" fill="${F.teal}"/><path d="M-10,46 V10 M-10,10 L-22,-2" stroke-width="5"/><circle cx="-24" cy="-4" r="6" fill="${F.skin}"/>`,
 door:()=>`<rect x="-34" y="-50" width="68" height="100" rx="4" fill="${F.gold}"/><circle cx="20" cy="4" r="5" fill="${INK}"/><path d="M-60,10 H-40" stroke="${MUT}" stroke-width="4"/><path d="M-50,0 L-40,10 L-50,20" stroke="${MUT}" stroke-width="4"/>`,
 battery:()=>`<rect x="-46" y="-24" width="84" height="48" rx="8" fill="#fff"/><rect x="38" y="-10" width="10" height="20" rx="3" fill="${F.grey}"/><rect x="-38" y="-16" width="20" height="32" rx="3" fill="#F6B3AE"/>`,
 pin:()=>`<path d="M0,46 Q-36,4 -36,-16 A36,36 0 0 1 36,-16 Q36,4 0,46 Z" fill="${F.apricot}"/><circle cx="0" cy="-16" r="12" fill="#fff"/>`,
 question:()=>`<circle cx="0" cy="0" r="46" fill="${F.gold}"/>${W(0,22,'?',{s:70,f:GOLD})}`,
 balance:()=>`<path d="M0,-40 V40 M-30,40 H30 M-50,-24 H50" stroke-width="5"/><path d="M-50,-24 L-64,6 H-36 Z" fill="${F.teal}"/><path d="M50,-24 L36,6 H64 Z" fill="${F.gold}"/>`,
 graph:()=>`<path d="M-50,40 H52 M-50,40 V-46" stroke-width="4"/><path d="M-44,20 Q-30,-30 -16,10 Q-4,30 8,-20 Q20,-50 32,6 Q40,24 48,0" stroke="${ORG}" stroke-width="5"/>`,
 notebook:()=>`<rect x="-40" y="-50" width="80" height="100" rx="8" fill="${F.paper}"/><path d="M-26,-26 H26 M-26,-6 H26 M-26,14 H14" stroke="${MUT}" stroke-width="4"/>${check(-34,-26,8)}`,
 calendar:()=>`<rect x="-40" y="-36" width="80" height="76" rx="8" fill="#fff"/><rect x="-40" y="-36" width="80" height="20" rx="6" fill="${F.apricot}"/><path d="M-22,-46 V-28 M22,-46 V-28" stroke-width="5"/>${[0,1,2].map(r=>[0,1,2].map(c=>`<circle cx="${-22+c*22}" cy="${-2+r*14}" r="3" fill="${MUT}" stroke="none"/>`).join('')).join('')}`,
 newBadge:()=>`<circle cx="0" cy="0" r="44" fill="${F.gold}"/>${W(0,10,'new',{s:32,f:GOLD})}`,
 repeat:()=>`<path d="M-30,-10 A32,32 0 1 1 -16,26" stroke="${TEAL}" stroke-width="6"/><path d="M-44,-20 L-30,-6 L-18,-24" stroke="${TEAL}" stroke-width="6"/>`,
 worse:()=>`<path d="M-44,30 L-14,0 L6,16 L40,-30" stroke="${RED}" stroke-width="6"/><path d="M22,-32 L42,-32 L42,-12" stroke="${RED}" stroke-width="6"/>`,
 skinScalp:()=>`<circle cx="0" cy="6" r="40" fill="${F.skin}"/><path d="M-40,0 Q-36,-44 0,-42 Q36,-44 40,0 Q20,-24 0,-22 Q-20,-24 -40,0 Z" fill="#7A5232"/><path d="M-20,-30 q10,-8 20,0 q-10,6 -20,0 Z" fill="#EE9C93" stroke-width="2.5"/>`,
 knee:()=>`<rect x="-16" y="-62" width="32" height="54" rx="14" fill="${F.bone}"/><rect x="-16" y="10" width="32" height="54" rx="14" fill="${F.bone}"/><ellipse cx="0" cy="0" rx="22" ry="14" fill="${F.hot}"/>${ticks(22,-14)}`,
 shoulder:()=>`<path d="M-50,40 V0 Q-50,-40 -10,-40 H40" stroke="${F.bone}" stroke-width="22"/><path d="M-50,40 V0 Q-50,-40 -10,-40 H40" stroke-width="3" fill="none" stroke-dasharray="0"/><circle cx="-36" cy="-26" r="14" fill="${F.hot}"/>${ticks(-20,-44)}`,
 elbow:()=>`<path d="M-50,-30 L0,10 L50,-36" stroke="${F.bone}" stroke-width="22"/><circle cx="0" cy="10" r="13" fill="${F.hot}"/>${ticks(14,-6)}`,
 hip:()=>`<path d="M-50,-30 Q0,-50 50,-30 Q40,0 0,4 Q-40,0 -50,-30 Z" fill="${F.bone}"/><path d="M26,0 L36,50" stroke="${F.bone}" stroke-width="20"/><circle cx="26" cy="0" r="12" fill="${F.hot}"/>${ticks(40,-12)}`,
 ankle:()=>`<path d="M-14,-56 V10 Q-14,30 6,32 H50 Q60,32 58,44 H-24 Q-36,44 -34,26 L-34,-56" fill="${F.skin}"/><circle cx="-12" cy="16" r="11" fill="${F.hot}"/>${ticks(2,2)}`,
 hand:()=>`<path d="M-30,50 V-6 Q-30,-20 -22,-20 V-40 Q-22,-50 -14,-50 Q-6,-50 -6,-40 V-48 Q-6,-58 2,-58 Q10,-58 10,-48 V-42 Q10,-52 18,-52 Q26,-52 26,-42 V-28 Q26,-36 34,-36 Q42,-36 42,-26 V10 Q42,50 10,50 Z" fill="${F.skin}"/><circle cx="2" cy="-30" r="7" fill="${F.hot}" stroke-width="3"/>`,
 neck:()=>`<circle cx="0" cy="-30" r="22" fill="${F.skin}"/><rect x="-10" y="-10" width="20" height="24" fill="${F.skin}"/><path d="M-44,40 Q-40,14 0,14 Q40,14 44,40" fill="${F.blue}"/>${ticks(12,0)}`,
 pelvis:()=>`<path d="M-50,-20 Q-50,30 -14,34 L0,10 L14,34 Q50,30 50,-20 Q30,-6 0,-10 Q-30,-6 -50,-20 Z" fill="${F.bone}"/><rect x="-10" y="-50" width="20" height="40" rx="5" fill="${F.bone}"/><circle cx="-12" cy="-6" r="7" fill="${F.hot}" stroke-width="3"/><circle cx="12" cy="-6" r="7" fill="${F.hot}" stroke-width="3"/>`,
 xray:()=>`<rect x="-46" y="-40" width="92" height="80" rx="8" fill="${F.grey}"/>${xrayFinger(false).replace(/<rect x="-12" y="-62" width="24" height="52"/,'<rect x="-10" y="-34" width="20" height="30"').replace(/<rect x="-12" y="-2" width="24" height="60"/,'<rect x="-10" y="2" width="20" height="32"')}`,
 star:()=>`<path d="M0,-44 L12,-14 L44,-12 L18,8 L28,40 L0,22 L-28,40 L-18,8 L-44,-12 L-12,-14 Z" fill="${F.gold}"/>`,
 pillar:(col,fill)=>`<rect x="-36" y="-80" width="72" height="16" rx="3" fill="${fill}" stroke="${col}"/><rect x="-26" y="-64" width="52" height="130" fill="#fff" stroke="${col}"/><path d="M-12,-60 V60 M12,-60 V60" stroke="${col}" stroke-width="2.5"/><rect x="-36" y="66" width="72" height="16" rx="3" fill="${fill}" stroke="${col}"/>`,
 scaleWeight:()=>I.scale(),
 smoke:()=>`<rect x="-46" y="-6" width="80" height="14" rx="4" fill="#fff"/><rect x="34" y="-6" width="12" height="14" fill="${F.apricot}"/>${xmark(0,0,30)}`,
});
I.finger2=()=>I.finger(true);
I.nailx=()=>I.nail(true);

/* ===================== layouts ===================== */
function wrap(t,max){ if(t.length<=max) return [t]; const w=t.split(' '); let a='',lines=[]; for(const x of w){ if((a+' '+x).trim().length>max&&a){lines.push(a);a=x;} else a=(a+' '+x).trim(); } if(a) lines.push(a); return lines; }
const WL=(x,y,t,o={})=>{const ls=wrap(t,o.max||28);const lh=(o.s||30)*1.12;const y0=y-(ls.length-1)*lh/2*(o.center===false?0:1);return ls.map((l,i)=>W(x,y0+i*lh,l,o)).join('');};
const icon=(k)=>typeof k==='function'?k():(I[k]?I[k]():'');
const COL={green:[GRN,F.green],teal:[TEAL,F.teal],plum:[PLUM,F.plum],orange:[ORG,F.apricot],gold:[GOLD,F.gold],red:[RED,'#FDE2DE'],ink:[INK,'#fff']};
const pal=(c)=>COL[c||'ink']||COL.ink;
const CYCLE=['orange','teal','plum','gold','green'];

const BODY_AT={eyes:[0,-172],scalp:[0,-192],neck:[0,-130],shoulder:[48,-112],shoulderL:[-48,-112],elbow:[76,-28],elbowL:[-76,-28],skin:[-76,-28],wrist:[86,30],hand:[88,48],handL:[-88,48],nails:[88,52],spine:[0,-70],back:[0,-40],gut:[0,-30],si:[0,4],hip:[24,12],hipL:[-24,12],knee:[30,100],kneeL:[-30,100],ankle:[33,172],ankleL:[-33,172],midfoot:[40,186],heel:[-34,192],toe:[44,192],finger:[90,60]};

const L={
 title:(s)=>C(0,H(330,190,s.lines[0])+(s.lines[1]?H(330,258,s.lines[1],{f:GRN}):'')+swoosh(160,282,500)+W(330,340,s.sub||'',{s:28,f:MUT}))
   +C(0,g(760,460,(s.who==='patient'?patient:doctor)({wave:true}))),
 cards:(s)=>{const n=s.items.length, top=s.head?1:0, cw=Math.min(210,(880/n)-18), ch=s.ch||(n>4?190:230), y=s.head?275:250, step=880/n;
   let out=s.head?C(s.head[1]??0,H(480,80,s.head[0],{s:46,f:pal(s.head[2])[0]})+swoosh(480-Math.min(240,s.head[0].length*11),100,480+Math.min(240,s.head[0].length*11),pal(s.head[2])[0])):'';
   s.items.forEach((it,i)=>{const [ic,lab,cue,c]=it, x=40+step*(i+.5), [col,fill]=pal(c||CYCLE[i%5]);
     const lines=wrap(lab,n>4?10:12);
     out+=C(cue??0,g(x,y,`<rect x="${-cw/2}" y="${-ch/2}" width="${cw}" height="${ch}" rx="18" fill="#fff"/><rect x="${-cw/2}" y="${-ch/2}" width="${cw}" height="12" rx="6" fill="${fill}" stroke="${col}" stroke-width="3"/>`
       +g(0,-ch*.14,icon(ic),n>4?.72:.9)+lines.map((l,j)=>W(0,ch/2-22-(lines.length-1-j)*30,l,{s:n>4?23:26,f:col})).join('')));});
   return out+(s.note?C(s.note[1]??0,WL(480,460,s.note[0],{s:28,f:pal(s.note[2])[0],max:56})):'');},
 feature:(s)=>{const [col,fill]=pal(s.col||'teal');
   let out=C(0,`<circle cx="230" cy="245" r="130" fill="${fill}" stroke="${col}" stroke-width="5"/>`+g(230,245,icon(s.icon),1.7)+H(640,120,s.title,{s:s.title.length>16?42:50,f:col})+swoosh(640-Math.min(230,s.title.length*12),142,640+Math.min(230,s.title.length*12),col));
   let y=210; s.lines.forEach(([t,cue,c])=>{const ls=wrap(t,26); out+=C(cue,ls.map((l,j)=>W(640,y+j*38,l,{s:32,f:pal(c)[0]})).join('')); y+=ls.length*38+24;});
   return out;},
 big:(s)=>{const x=s.icon?590:480, n=s.lines.reduce((a,l)=>a+wrap(l[0],s.icon?28:34).length,0), lh=58; let y=255-(n-1)*lh/2; let out=s.icon?C(s.icon[1]??0,g(190,250,icon(s.icon[0]),1.9)):'';
   s.lines.forEach(([t,cue,c,sz])=>{wrap(t,s.icon?28:34).forEach(l=>{out+=C(cue,W(x,y,l,{s:sz||42,f:pal(c)[0]}));y+=lh;});});
   return out+(s.under?C(s.under[1],swoosh(x-200,y-lh+22,x+200,pal(s.under[2])[0])):'');},
 list:(s)=>{const x0=s.icon?110:200; let out=C(s.head?.[1]??0,s.head?H(480,82,s.head[0],{s:44,f:pal(s.head[2]||'green')[0]})+swoosh(480-s.head[0].length*11,102,480+s.head[0].length*11,pal(s.head[2]||'green')[0]):'');
   if(s.icon) out+=C(s.icon[1]??0,g(800,260,icon(s.icon[0]),1.7));
   let y=s.head?165:120; const max=s.icon?30:42;
   s.items.forEach(([t,cue,c])=>{const ls=wrap(t,max); out+=C(cue,check(x0,y-8,15)+ls.map((l,j)=>W(x0+30,y+j*36,l,{s:30,a:'start',f:pal(c)[0]})).join('')); y+=ls.length*36+20;});
   return out;},
 body:(s)=>{const bx=s.bx||290, by=262, sc=.95; let out=C(0,g(bx,by,bodyMap(),sc)); const used={l:[],r:[]};
   const pts=s.regions.map(([k,lab,cue,c])=>{const [ax,ay]=BODY_AT[k]||[0,0];return {k,lab,cue,c,x:bx+ax*sc,y:by+ay*sc,side:(s.side||'r')};});
   ['l','r'].forEach(side=>{let last=-1e9;const ps=pts.filter(p=>p.side===side&&p.lab).sort((a,b)=>a.y-b.y);ps.forEach(p=>{p.ly=Math.max(p.y,last+46);last=p.ly;});
     const over=last-450; if(over>0){ let floor=1e9; for(let i=ps.length-1;i>=0;i--){ ps[i].ly=Math.min(ps[i].ly-over,floor); floor=ps[i].ly-46; } }});
   pts.forEach((p,i)=>{const [col,fill]=pal(p.c||CYCLE[i%5]); const tx=p.side==='r'?bx+150:bx-150;
     out+=C(p.cue,dot(p.x,p.y,col,fill)+(p.lab?pointer(p.x,p.y,tx,p.ly,p.lab,col,p.side==='r'?'start':'end'):''));});
   if(s.note) out+=C(s.note[1],WL(s.nx||810,s.ny||250,s.note[0],{s:30,f:pal(s.note[2])[0],max:15}));
   return out;},
 vs:(s)=>{const box=(x,[ic,lab,cue,c])=>{const [col,fill]=pal(c);return C(cue,g(x,235,`<rect x="-140" y="-130" width="280" height="260" rx="22" fill="#fff"/><rect x="-140" y="-130" width="280" height="14" rx="7" fill="${fill}" stroke="${col}" stroke-width="3"/>`+g(0,-40,icon(ic),.95)+wrap(lab,16).map((l,j,a)=>W(0,100-(a.length-1-j)*32,l,{s:30,f:col})).join('')));};
   return box(240,s.L)+box(720,s.R)+C(s.R[2],H(480,250,s.mid||'≠',{s:70,f:MUT}))+(s.note?C(s.note[1],WL(480,430,s.note[0],{s:30,f:pal(s.note[2])[0],max:52})):'');},
 alert:(s)=>{let out=C(0,`<rect x="40" y="40" width="880" height="400" rx="26" fill="#FFF6F4" stroke="${RED}" stroke-width="5"/>`+g(190,240,icon(s.icon||'warn'),1.9));
   const n=s.lines.reduce((a,l)=>a+wrap(l[0],24).length,0), lh=56; let y=245-(n-1)*lh/2;
   s.lines.forEach(([t,cue,c])=>{wrap(t,24).forEach(l=>{out+=C(cue,W(600,y,l,{s:40,f:pal(c||'red')[0]}));y+=lh;});});
   return out;},
 talk:(s)=>{const pat=s.side!=='doctor'; let out=C(0,g(170,465,patient(),.9)+g(790,465,doctor(),.9));
   const bx=pat?420:540; const ls=s.bubble; const h=Math.max(110,ls.length*40+50);
   out+=C(s.cue??0,g(bx,40+h/2,bubble(400,h,pat?'left':'right')+ls.map((l,j)=>W(0,-((ls.length-1)*40)/2+j*40+10,l,{s:30,f:pal(s.col)[0]})).join('')));
   if(s.note) out+=C(s.note[1],WL(480,400,s.note[0],{s:28,f:pal(s.note[2])[0],max:30}));
   return out;},
 pro:(s)=>{const [col,fill]=pal(s.col||'teal'); let out=C(0,g(210,470,doctor({glasses:!!s.glasses}),.95)+g(210,170,tag(s.tag,col,fill,Math.max(200,s.tag.length*15+40))));
   let y=s.y0||170; s.lines.forEach(([t,cue,c])=>{const ls=wrap(t,24); out+=C(cue,ls.map((l,j)=>W(660,y+j*40,l,{s:33,f:pal(c)[0]})).join('')); y+=ls.length*40+30;});
   if(s.icon) out+=C(s.icon[1],g(660,y+50,icon(s.icon[0]),1.1));
   return out;},
 steps:(s)=>{const n=s.items.length, step=860/n; let out=s.head?C(s.head[1]??0,H(480,80,s.head[0],{s:44,f:pal(s.head[2])[0]})):'';
   s.items.forEach(([ic,lab,cue,c],i)=>{const x=50+step*(i+.5), [col,fill]=pal(c||CYCLE[i%5]);
     out+=C(cue,`<circle cx="${x}" cy="240" r="62" fill="${fill}" stroke="${col}" stroke-width="4"/>`+g(x,240,icon(ic),.85)+wrap(lab,14).map((l,j)=>W(x,340+j*32,l,{s:28,f:col})).join('')+(i<n-1?arrow(x+70,240,x+step-70,240,MUT):''));});
   return out+(s.note?C(s.note[1],WL(480,440,s.note[0],{s:28,f:pal(s.note[2])[0],max:56})):'');},
 grid6:(s)=>{const D=[['skin','Skin','plum'],['nailx','Nails','teal'],['joint','Joints away from the spine','orange'],['spine','Spine','gold'],['finger2','Whole finger or toe','orange'],['heel','Tendon attachment sites','green']];
   return D.map(([ic,lab,c],i)=>{const [col,fill]=pal(c);const x=200+(i%3)*280, y=150+Math.floor(i/3)*190;
     return C(s.cues?s.cues[i]:(s.cue??0),g(x,y,`<rect x="-120" y="-80" width="240" height="160" rx="20" fill="${fill}" stroke="${col}" stroke-width="3.5"/>`+g(-62,0,icon(ic),.75)+wrap(lab,12).map((l,j,a)=>W(40,8-(a.length-1)*16+j*32,l,{s:26,f:col})).join('')));}).join('')
     +(s.note?C(s.note[1],WL(480,455,s.note[0],{s:28,f:pal(s.note[2])[0],max:58})):'');},
 wave:(s)=>{let out=C(0,`<path d="M100,380 H880 M100,380 V110" stroke-width="4"/>`+W(110,100,'activity',{s:24,f:MUT,a:'start'})+W(870,410,'time',{s:24,f:MUT,a:'end'})
     +`<path d="M110,320 Q180,300 230,250 Q270,160 320,250 Q370,330 440,310 Q500,290 560,300 Q620,180 680,280 Q740,340 860,320" stroke="${ORG}" stroke-width="6"/>`);
   if(s.flare!=null) out+=C(s.flare,loop(275,190,40,40,RED)+W(275,140,'flare',{s:30,f:RED})+loop(625,215,40,40,RED)+W(625,165,'flare',{s:30,f:RED}));
   if(s.note) out+=C(s.note[1],WL(480,450,s.note[0],{s:28,f:pal(s.note[2])[0],max:56}));
   return out;},
 pillars:(s)=>{const P=[['plate','Nourishment','food','orange'],['shoe','Motion','movement','teal'],['brain','Mastery','coping','plum'],['moon','Repose','rest','gold']];
   return P.map(([ic,name,plain,c],i)=>{const [col,fill]=pal(c),x=150+i*220;return C(s.cues?s.cues[i]:(s.cue??0),g(x,230,I.pillar(col,fill),1.05)+g(x,200,icon(ic),.6)+W(x,350,name,{s:30,f:col}));}).join('')
     +(s.plain!=null?C(s.plain,P.map(([ic,name,plain,c],i)=>W(150+i*220,392,'('+plain+')',{s:26,f:MUT})).join('')):'')
     +(s.head?C(s.head[1]??0,H(480,70,s.head[0],{s:40})):'');},
 review:(s)=>{const n=s.rows.length, gap=n>2?104:124, y0=n>2?180:215; let out=C(0,H(480,88,'Remember')+swoosh(380,108,580));
   s.rows.forEach((r,i)=>{const ls=wrap(r,46), h=ls.length>1?96:76; out+=C(i+1,g(480,y0+i*gap,`<rect x="-380" y="${-h/2}" width="760" height="${h}" rx="20" fill="#fff"/>${check(-330,0,20)}`+ls.map((l,j)=>W(-296,10+(j-(ls.length-1)/2)*34,l,{s:29,a:'start'})).join('')));});
   return out;},
};
const SPEC=(s)=>Array.isArray(s)?s.map(SPEC).join(''):L[s.t](s);
