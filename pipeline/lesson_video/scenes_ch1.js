// Chapter 1 scenes (hand-drawn layouts) and their narration.
/* ===================== scenes (art only; narration is in NARR) ===================== */
I.nailLift=()=>`<path d="M-30,56 V-8 Q-30,-48 0,-48 Q30,-48 30,-8 V56" fill="${F.skin}"/><path d="M-19,-6 V-28 Q-19,-40 0,-40 Q19,-40 19,-28 V-6 Q0,0 -19,-6 Z" fill="#FDEDE6" stroke-width="3"/><path d="M-19,-26 Q0,-18 19,-26 V-28 Q19,-40 0,-40 Q-19,-40 -19,-28 Z" fill="#fff" stroke-width="2.5"/><path d="M-14,-24 Q0,-14 14,-24" stroke="${GOLD}" stroke-width="3"/>`;
I.nailThick=()=>`<path d="M-30,56 V-8 Q-30,-48 0,-48 Q30,-48 30,-8 V56" fill="${F.skin}"/><path d="M-19,-6 V-28 Q-19,-40 0,-40 Q19,-40 19,-28 V-6 Q0,0 -19,-6 Z" fill="#FDEDE6" stroke-width="3"/><path d="M-21,-30 Q-22,-46 0,-48 Q22,-46 21,-30 Q0,-36 -21,-30 Z" fill="${F.gold}" stroke-width="3"/>`;
I.book=()=>`<path d="M-60,-46 Q-30,-56 0,-44 Q30,-56 60,-46 V44 Q30,34 0,46 Q-30,34 -60,44 Z" fill="${F.green}"/><path d="M0,-44 V46"/><path d="M-46,-24 H-14 M-46,-6 H-14 M14,-24 H46 M14,-6 H46" stroke="${MUT}" stroke-width="3"/>`;
I.hourglass=()=>`<path d="M-30,-50 H30 M-30,50 H30" stroke-width="6"/><path d="M-24,-50 Q-24,-10 0,0 Q24,-10 24,-50 M-24,50 Q-24,10 0,0 Q24,10 24,50" fill="#fff"/><path d="M-14,40 Q0,24 14,40 Z" fill="${F.gold}" stroke-width="3"/>`;
I.paper=()=>`<path d="M-40,-54 H22 L40,-36 V54 H-40 Z" fill="#fff"/><path d="M22,-54 V-36 H40"/><path d="M-26,-24 H26 M-26,-6 H26 M-26,12 H14" stroke="${MUT}" stroke-width="3"/>${W(0,42,'2006',{s:24,f:TEAL})}`;
I.syringe=()=>`<rect x="-14" y="-60" width="28" height="80" rx="5" fill="#fff"/><path d="M-14,-10 H14 V16 Q14,20 10,20 H-10 Q-14,20 -14,16 Z" fill="${F.gold}" stroke-width="3"/><path d="M0,20 V58" stroke-width="3.5"/><path d="M-22,-60 H22 M0,-60 V-80 M-12,-80 H12" stroke-width="4"/>`;
I.calendar=()=>`<rect x="-40" y="-36" width="80" height="76" rx="8" fill="#fff"/><rect x="-40" y="-36" width="80" height="20" rx="6" fill="${F.apricot}"/><path d="M-22,-46 V-28 M22,-46 V-28" stroke-width="5"/>${[0,1,2].map(r=>[0,1,2].map(c=>`<circle cx="${-22+c*22}" cy="${-2+r*14}" r="3" fill="${MUT}" stroke="none"/>`).join('')).join('')}`;
const num=(n,col)=>`<circle cx="0" cy="0" r="26" fill="#fff" stroke="${col}" stroke-width="4"/>${W(0,11,n,{s:32,f:col})}`;
const groupTag=(n,t,col,fill)=>`<circle cx="-${t.length*7.4+14}" cy="0" r="26" fill="${fill}" stroke="${col}" stroke-width="4"/>${W(-(t.length*7.4+14),11,n,{s:32,f:col})}${W(14,12,t,{s:40,f:col,a:'middle'})}`;
const reviewRow3=(y,txt,s=29)=>g(480,y,`<rect x="-380" y="-40" width="760" height="80" rx="20" fill="#fff"/>${check(-330,0,20)}${W(-296,10,txt,{s,a:'start'})}`);

const ART_CH1=[
[ // psa-dx-01 (16 scenes)
 ()=>C(0,H(360,190,'How doctors assess')+H(360,258,'possible PsA',{f:GRN})+swoosh(190,282,530)+W(360,340,'Chapter 1 · Lesson 1',{s:28,f:MUT}))+C(0,g(760,460,doctor({wave:true}))),
 ()=>C(0,g(220,465,patient())+ticks(270,350)+g(560,135,tag('Pain',ORG,F.apricot,170))+g(560,210,tag('Stiffness',ORG,F.apricot,170))+g(560,285,tag('Swelling',ORG,F.apricot,170))
     +`<path d="M790,140 A70,70 0 1 1 728,180" stroke="${ORG}" stroke-width="6"/><path d="M712,170 L728,182 L740,164" stroke="${ORG}" stroke-width="6"/>`+W2(790,300,'keeps coming','back',{s:30,f:ORG}))
   +C(1,check(390,402,18)+W(420,412,'Even without psoriasis, get checked',{s:32,f:GRN,a:'start'})),
 ()=>C(0,g(150,470,person({shirt:F.blue,hair:'#3A2A20'}),.8)+W(150,265,'Your doctor',{s:28,f:MUT})+arrow(240,330,360,330,GRN)+g(470,470,doctor({glasses:true}),.95)+g(470,180,tag('Rheumatologist',TEAL,F.teal,230)))
   +C(1,g(760,170,box(200,150)+g(0,-20,I.joint(),.6)+W(0,58,'Joints',{s:28}))+g(760,340,box(200,150)+g(0,-20,I.shield(),.7)+W(0,58,'Immune system',{s:28}))),
 ()=>C(0,`<circle cx="230" cy="250" r="110" fill="#fff"/>`+g(230,250,I.tube(),1.3)+xmark(230,250,70)+W(230,410,'One test alone',{s:32,f:RED}))
   +C(1,g(560,140,tag('Your story',ORG,F.apricot,190))+g(560,250,tag('An exam',TEAL,F.teal,190))+g(560,360,tag('Some tests',PLUM,F.plum,190))
     +arrow(665,140,760,230,MUT)+arrow(665,250,755,250,MUT)+arrow(665,360,760,275,MUT)+`<circle cx="840" cy="252" r="68" fill="${F.green}" stroke="${GRN}" stroke-width="4"/>`+W2(840,240,'all the','clues',{s:28,f:GRN})),
 ()=>C(0,g(200,465,patient())+g(740,465,doctor())+g(390,140,bubble(260,110)+W(0,10,'My symptoms…',{s:32,f:ORG})))
   +C(1,`<path d="M420,300 H540" stroke-width="4"/><path d="M440,300 A40,40 0 0 1 520,300" fill="${F.gold}"/>`+W(480,345,'worse in the morning',{s:28,f:GOLD})+arrow(480,360,480,392,GRN)+W(480,420,'can ease with exercise',{s:28,f:GRN})),
 ()=>C(0,g(280,250,box(320,300)+g(0,-40,I.family(),1.5)+W2(0,90,'Psoriasis or PsA','in the family?',{s:30})))
   +C(1,g(680,250,box(320,300)+g(-70,-50,I.calendar())+arrow(-20,-50,30,-50,MUT)+g(80,-50,I.skin(),.75)+W2(0,70,'Psoriasis for','many years',{s:30}))),
 ()=>C(0,g(170,470,doctor(),.85)+g(300,250,`<rect x="-34" y="-46" width="68" height="92" rx="8" fill="${F.gold}"/><rect x="-16" y="-54" width="32" height="14" rx="5" fill="#fff"/>${[-18,6,30].map(y=>check(-14,y,9)+`<path d="M0,${y} H22" stroke="${MUT}" stroke-width="4"/>`).join('')}`)+H(560,95,'Physical exam')+swoosh(430,115,690))
   +C(1,g(480,280,tile(ORG,F.apricot,I.joint(),'Joints'))+g(640,280,tile(PLUM,F.plum,I.skin(),'Psoriasis'))+g(800,280,tile(TEAL,F.teal,I.nail(),'Nails'))+W(640,410,'swollen or tender joints · skin · nail changes',{s:26,f:MUT})),
 ()=>C(0,g(320,250,I.skin(),2.2)+g(390,200,I.magnifier(),1.6)+W2(700,200,'Never told you','have psoriasis?',{s:36,f:PLUM})+W(700,320,'The doctor may check your skin',{s:28})),
 ()=>C(0,g(480,262,bodyMap(),.95)+dot(400,304)+dot(452,357)+dot(508,357)+pointer(400,304,320,262,'Joints',ORG,'end')+dot(480,195,TEAL,F.teal)+pointer(480,195,600,140,'Spine',TEAL)+dot(554,235,PLUM,F.plum)+pointer(554,235,650,228,'Skin',PLUM)+dot(566,304,GOLD,F.gold)+pointer(566,304,650,300,'Nails',GOLD))
   +C(1,dot(448,440,GRN,F.green)+pointer(448,440,330,400,'Tendon meets bone',GRN,'end')+W(320,438,'(back of the heel)',{s:24,f:MUT,a:'end'}))
   +C(2,g(810,400,I.finger(true),.8)+W(810,470,'',{s:1})+W2(720,375,'whole finger','or toe',{s:26,f:ORG,a:'end'})),
 ()=>C(0,g(320,230,box(260,290)+g(0,-10,I.nail(),1.6)+W(0,118,'Tiny dents (pitting)',{s:30}))+g(660,230,box(260,290)+g(0,-10,I.nailLift(),1.6)+W(0,118,'Nail lifting up',{s:30}))),
 ()=>C(0,`<circle cx="230" cy="220" r="105" fill="#fff"/>`+g(230,220,I.tube(),1.3)+g(300,170,I.magnifier(),.9)+W2(230,370,'Checks for other','conditions',{s:30,f:TEAL}))
   +C(1,W(690,110,'Other causes of joint pain',{s:32})+swoosh(530,128,850,MUT)+g(690,190,tag('Osteoarthritis',PLUM,F.plum,250))+g(690,265,tag('Rheumatoid arthritis',TEAL,F.teal,290))+g(690,340,tag('Gout',GOLD,F.gold,250))),
 ()=>C(0,g(330,250,I.joint(),2)+g(470,210,I.syringe(),1.1)+arrow(540,250,650,250,MUT)+g(740,250,I.tube(F.gold),1.3)+W(530,420,'Joint fluid test',{s:36,f:GOLD})),
 ()=>C(0,g(200,200,screen(170,140,g(0,0,xrayFinger(false)),'X-ray'))+g(480,200,screen(170,140,ultrasound,'Ultrasound'))+g(760,200,screen(170,140,mri,'MRI'))
     +W(480,400,'changes in joints, spine, or tendon sites',{s:30})+swoosh(250,416,710,ORG)),
 ()=>C(0,g(250,180,tile(ORG,F.apricot,I.family(),'Story'))+g(400,180,tile(TEAL,F.teal,I.joint(),'Exam'))+g(250,330,tile(PLUM,F.plum,I.tube(),'Blood test'))+g(400,330,tile(GOLD,F.gold,g(0,0,xrayFinger(false)),'Images')))
   +C(1,`<rect x="168" y="98" width="314" height="314" rx="30" stroke="${GRN}" stroke-width="6"/>`+arrow(510,255,600,255,GRN)+W2(740,240,'the whole','pattern',{s:44,f:GRN})),
 ()=>C(0,g(170,210,I.book(),1.1)+W(170,300,'Dr. Murphy',{s:28,f:MUT})+W(170,350,'Be prepared',{s:36,f:GRN}))
   +C(1,g(450,210,I.hourglass(),1.1)+W2(450,300,'delays can','happen',{s:28,f:MUT})+W(450,385,'Plan ahead',{s:34,f:GRN}))
   +C(2,g(760,240,I.notepad()+W(0,-60,'My changes',{s:28,f:GOLD})+[0,1].map(i=>check(-58,-10+i*42,11)+`<path d="M-36,${-6+i*42} H62" stroke="${MUT}" stroke-width="4"/>`).join(''),.85)+g(860,350,I.stopwatch(),.65)),
 ()=>C(0,H(480,90,'Remember')+swoosh(380,110,580))+C(1,reviewRow3(185,'No single test for PsA.'))+C(2,reviewRow3(285,'Story + exam + tests, together.'))+C(3,reviewRow3(385,'Pain, stiffness or swelling that keeps coming back? Get checked.',26)),
],
[ // psa-dx-02 (12 scenes)
 ()=>C(0,H(480,170,'CASPAR',{s:120,f:GRN})+swoosh(300,200,660))
   +C(1,W(480,280,'<tspan fill="#2E7A4F" font-size="40">CLAS</tspan>sification criteria for <tspan fill="#2E7A4F" font-size="40">P</tspan>soriatic <tspan fill="#2E7A4F" font-size="40">AR</tspan>thritis',{s:34}))
   +C(2,g(420,390,I.paper())+W(560,400,'study, 2006',{s:32,f:TEAL})),
 ()=>C(0,[[230,ORG,F.apricot],[480,PLUM,F.plum],[730,TEAL,F.teal]].map(([x,c,f])=>`<path d="M${x-90},250 L${x-70},400 H${x+70} L${x+90},250" fill="${f}" stroke="${c}" stroke-width="4"/>`).join('')
     +[[200,ORG],[250,ORG],[460,PLUM],[510,PLUM],[710,TEAL],[755,TEAL]].map(([x,c],i)=>`<circle cx="${x}" cy="${300+(i%2)*40}" r="16" fill="#fff" stroke="${c}" stroke-width="4"/>`).join('')+W(480,140,'Sort the signs into groups',{s:40})),
 ()=>C(0,`<path d="M130,430 V220 Q130,110 250,110 Q370,110 370,220 V430" stroke="${GRN}" stroke-width="12"/>`+g(250,215,I.fire(),1.4)+W(250,320,'Step 1',{s:38,f:GRN})+W(250,362,'a must',{s:32,f:RED}))
   +C(1,g(530,260,box(160,200)+g(0,-24,I.joint(),.9)+W(0,80,'A joint',{s:30}))+g(705,260,box(160,200)+g(0,-26,I.spine())+W(0,80,'The spine',{s:30}))+g(880,260,box(160,200)+g(-16,-30,I.heel(),.75)+W2(0,64,'Tendon','meets bone',{s:26}))),
 ()=>C(0,W(250,120,'Step 2',{s:48,f:GRN})+swoosh(170,140,330)+g(170,250,I.coin())+g(250,250,I.coin())+g(330,250,I.coin())+W(250,340,'add points',{s:34,f:GOLD}))
   +C(1,[['1',ORG,F.apricot,I.skin(),'Psoriasis'],['2',TEAL,F.teal,I.nail(),'Nails'],['3',PLUM,F.plum,I.tube(),'RF test'],['4',ORG,F.apricot,I.finger(true),'Finger/toe'],['5',GOLD,F.gold,xrayFinger(true),'New bone']].map(([n,c,f,ic,t],i)=>g(500+(i%3)*150-(i>2?-75:0),180+Math.floor(i/3)*170,`<rect x="-62" y="-62" width="124" height="124" rx="18" fill="${f}" stroke="${c}" stroke-width="3.5"/>${g(0,-12,ic,.5)}${W(0,48,t,{s:22,f:c})}`+g(-58,-58,num(n,c),.8))).join('')),
 ()=>C(0,g(480,85,groupTag('1','Psoriasis',PLUM,F.plum)))
   +C(1,g(250,270,box(240,250)+g(0,-30,I.skin(),1.1)+W2(0,64,'Now: skin','or scalp',{s:28}))+W(250,430,'counts the most',{s:30,f:PLUM})+`<path d="M330,170 l8,16 18,2 -13,12 4,18 -17,-9 -17,9 4,-18 -13,-12 18,-2 Z" fill="${F.gold}" stroke="${GOLD}" stroke-width="3"/>`)
   +C(2,arrow(380,270,450,270,MUT)+g(560,270,box(180,210)+g(0,-30,I.calendar())+W2(0,58,'In the','past',{s:26}))+arrow(660,270,720,270,MUT)+g(820,270,box(180,210)+g(0,-30,I.family())+W2(0,58,'Close','family',{s:26}))+W(560,410,'if not now',{s:24,f:MUT})+W(820,410,'if never',{s:24,f:MUT})),
 ()=>C(0,g(480,85,groupTag('2','Nail changes now',TEAL,F.teal)))
   +C(1,g(230,260,box(220,250)+g(0,-10,I.nail(),1.4)+W(0,108,'Pitting',{s:30}))+g(480,260,box(220,250)+g(0,-10,I.nailLift(),1.4)+W(0,108,'Nail lifting',{s:30}))+g(730,260,box(220,250)+g(0,-10,I.nailThick(),1.4)+W(0,108,'Thick buildup',{s:30}))),
 ()=>C(0,g(480,85,groupTag('3','Rheumatoid factor (RF)',PLUM,F.plum))+`<circle cx="280" cy="270" r="110" fill="#fff"/>`+g(280,270,I.tube(F.plum),1.3))
   +C(1,g(640,270,box(300,170)+W(0,-28,'RF result:',{s:32,f:MUT})+W(0,26,'negative',{s:44,f:GRN})+check(110,22,18))+W(640,410,'this is the one that counts',{s:30,f:GRN})),
 ()=>C(0,g(480,85,groupTag('4','Swollen finger or toe',ORG,F.apricot))+g(260,260,box(300,280)+g(-60,-10,I.finger(false))+g(60,-10,I.finger(true))+W(0,124,'“sausage digit”',{s:30,f:ORG})))
   +C(1,g(620,230,tag('swollen now',ORG,F.apricot,220))+W(620,295,'or',{s:30,f:MUT})+g(620,350,tag('recorded in the past',TEAL,F.teal,280))+g(840,290,I.calendar())),
 ()=>C(0,g(480,70,groupTag('5','New bone on an X-ray',GOLD,F.gold))+g(270,240,screen(260,200,g(0,0,xrayFinger(true),1.4),'Next to a joint'))+loop(305,235,40,36,GRN))
   +C(1,g(690,240,screen(260,200,g(0,0,xrayHeel,1.3),'Heel spur'))+xmark(690,240,58)+W(690,430,'alone: not that finding',{s:30,f:RED})),
 ()=>C(0,g(160,150,I.coin())+g(240,150,I.coin())+g(320,150,I.coin())+W(240,230,'points',{s:30,f:GOLD}))
   +C(1,g(240,340,I.house(),1.2)+xmark(240,340,55)+W(240,445,'Not a home diagnosis',{s:30,f:RED}))
   +C(2,g(720,465,doctor({glasses:true}),.95)+g(850,250,I.magnifier())+W(560,150,'All the findings',{s:34,f:TEAL})+W(560,210,'Other causes?',{s:34})),
 ()=>C(0,g(170,465,patient(),.9)+g(790,465,doctor(),.9)+g(480,240,box(310,260)+W(0,-84,'CASPAR',{s:38,f:TEAL})
     +[['1 Psoriasis',PLUM],['2 Nails',TEAL],['3 RF test',PLUM],['4 Finger or toe',ORG],['5 New bone',GOLD]].map(([t,c],i)=>W(-110,-40+i*36,t,{s:27,a:'start',f:c})).join(''))
     +`<path d="M300,120 q20,-30 50,-10" stroke="${MUT}" stroke-width="4"/><path d="M660,120 q-20,-30 -50,-10" stroke="${MUT}" stroke-width="4"/>`),
 ()=>C(0,H(480,90,'Remember')+swoosh(380,110,580))+C(1,reviewRow3(185,'Step 1: inflammation in a joint, spine, or tendon site.',26))+C(2,reviewRow3(285,'Step 2: five groups of signs add points.',27))+C(3,reviewRow3(385,'A score is not a home diagnosis.')),
]];


const CH1_NARR=[
 {
  "id": "psa-dx-01",
  "title": "How doctors assess possible PsA",
  "scenes": [
   {
    "name": "Welcome",
    "say": [
     "framing|Hi there, and welcome! Today, let’s find out how doctors check for possible psoriatic arthritis, or PsA."
    ]
   },
   {
    "name": "When to get checked",
    "say": [
     "nhs-psa|See a doctor if you have joint pain, stiffness, and swelling that keeps coming back.",
     "nhs-psa|Go even if you do not have psoriasis. These symptoms need to be checked."
    ]
   },
   {
    "name": "Meet the rheumatologist",
    "say": [
     "nhs-psa|If your doctor thinks you may have PsA, they will send you to a specialist called a rheumatologist.",
     "lesson-text|A rheumatologist is a doctor who treats joint and immune system diseases."
    ]
   },
   {
    "name": "No single test",
    "say": [
     "niams-care|There is no single test that can prove you have PsA.",
     "niams-care|Instead, the doctor puts several clues together: your story, an exam, and some tests."
    ]
   },
   {
    "name": "Your symptoms",
    "say": [
     "niams-care|First, the doctor talks with you about your symptoms.",
     "nhs-psa|For example, PsA symptoms can be worse first thing in the morning, and may get better with exercise."
    ]
   },
   {
    "name": "Family and skin history",
    "say": [
     "niams-care|The doctor will ask if anyone in your family has psoriasis or psoriatic arthritis.",
     "nhs-psa|PsA can sometimes start after a person has had psoriasis for many years."
    ]
   },
   {
    "name": "The physical exam",
    "say": [
     "niams-care|Next comes a physical exam.",
     "niams-care|Swollen or tender joints, psoriasis on the skin, and nail changes are important signs."
    ]
   },
   {
    "name": "Checking the skin",
    "say": [
     "niams-care|If you have never been told you have psoriasis, the doctor may check your skin for it."
    ]
   },
   {
    "name": "Where PsA can show up",
    "say": [
     "src-psa-one-pager-intro|PsA can affect the joints, the spine, the skin, and the nails.",
     "src-psa-one-pager-intro|It can also affect places where a tendon or ligament attaches to bone, like the back of the heel.",
     "src-psa-one-pager-intro|Some people get a whole finger or toe that swells up, like a little sausage."
    ]
   },
   {
    "name": "Nail changes",
    "say": [
     "src-psa-one-pager-intro|Nail changes can include tiny dents, called pitting, or a nail that lifts away from the skin underneath."
    ]
   },
   {
    "name": "Blood tests",
    "say": [
     "niams-care|A blood test helps check for other conditions, such as rheumatoid arthritis.",
     "nhs-psa|Other conditions can also cause joint pain, stiffness, and swelling. Examples are osteoarthritis, rheumatoid arthritis, and gout."
    ]
   },
   {
    "name": "Joint fluid test",
    "say": [
     "nhs-psa|Sometimes, a little fluid is taken from a sore joint and tested."
    ]
   },
   {
    "name": "Pictures of the inside",
    "say": [
     "niams-care|X-rays, ultrasound, or MRI scans can show changes in the joints, the spine, or where tendons attach to bone."
    ]
   },
   {
    "name": "Putting the clues together",
    "say": [
     "lesson-text|Each test is just one clue.",
     "lesson-text|The doctor looks at all the clues together to see the whole pattern."
    ]
   },
   {
    "name": "Be prepared",
    "say": [
     "src-murphys-laws-of-arthritis-preface|It pays to be prepared.",
     "src-murphys-laws-of-arthritis-preface|Problems like a delay in diagnosis can happen, unless we plan ahead.",
     "lesson-text|So bring a short list of your changes, even if they come and go. And note how long stiffness lasts after you wake up."
    ]
   },
   {
    "name": "Quick review",
    "say": [
     "framing|Great job! Let’s review.",
     "key-takeaway|There is no single test for PsA.",
     "key-takeaway|Your doctor puts together your story, an exam, and tests.",
     "key-takeaway|See a doctor if joint pain, stiffness, or swelling keeps coming back."
    ]
   }
  ]
 },
 {
  "id": "psa-dx-02",
  "title": "Understanding the CASPAR framework",
  "scenes": [
   {
    "name": "What is CASPAR?",
    "say": [
     "framing|Hi again! Let’s learn about CASPAR.",
     "src-psa-one-pager-intro|CASPAR stands for Classification criteria for Psoriatic Arthritis.",
     "src-psa-one-pager-intro|It comes from a study published in 2006."
    ]
   },
   {
    "name": "Sorting the signs",
    "say": [
     "lesson-text|Doctors use it to sort the signs of PsA into groups."
    ]
   },
   {
    "name": "Step one is a must",
    "say": [
     "src-mindmap|Step one is a must.",
     "src-mindmap|There has to be inflammation in a joint, in the spine, or where a tendon attaches to bone."
    ]
   },
   {
    "name": "Step two adds points",
    "say": [
     "src-mindmap|Step two adds points for other signs.",
     "src-mindmap|There are five groups of signs."
    ]
   },
   {
    "name": "Group 1: Psoriasis",
    "say": [
     "src-psa-one-pager-intro|Group one is psoriasis.",
     "src-psa-one-pager-intro|Psoriasis on your skin or scalp right now counts the most.",
     "src-psa-one-pager-intro|If you don’t have it now, having had it in the past counts. If you never had it, psoriasis in a close family member counts."
    ]
   },
   {
    "name": "Group 2: Nail changes",
    "say": [
     "src-psa-one-pager-intro|Group two is nail changes you have now.",
     "src-psa-one-pager-intro|Examples are tiny dents called pitting, a nail lifting off the skin underneath, or thick buildup under the nail."
    ]
   },
   {
    "name": "Group 3: The RF blood test",
    "say": [
     "src-psa-one-pager-intro|Group three is a blood test called rheumatoid factor, or RF.",
     "src-psa-one-pager-intro|Here, a negative result is the one that counts."
    ]
   },
   {
    "name": "Group 4: A swollen finger or toe",
    "say": [
     "src-psa-one-pager-intro|Group four is a whole finger or toe that is swollen, sometimes called a sausage digit.",
     "src-psa-one-pager-intro|It counts if it is swollen now, or if a doctor wrote it down in the past."
    ]
   },
   {
    "name": "Group 5: New bone on an X-ray",
    "say": [
     "src-mindmap|Group five is new bone forming right next to a joint, seen on an X-ray.",
     "lesson-text|A heel spur alone is not that finding."
    ]
   },
   {
    "name": "Points are not a home test",
    "say": [
     "lesson-text|The reference adds up these points.",
     "lesson-text|But a score is not a home diagnosis.",
     "lesson-text|A doctor must look at all the findings and check for other causes."
    ]
   },
   {
    "name": "Talk it through",
    "say": [
     "lesson-text|Knowing CASPAR can help you follow the conversation with your care team."
    ]
   },
   {
    "name": "Quick review",
    "say": [
     "framing|Nice work! Let’s review.",
     "key-takeaway|First, there must be inflammation in a joint, the spine, or a tendon attachment.",
     "key-takeaway|Psoriasis, nail changes, a negative RF test, a swollen finger or toe, and new bone near a joint can add points.",
     "key-takeaway|A score is not a home diagnosis."
    ]
   }
  ]
 }
];
const LESSONS1=CH1_NARR.map((l,L)=>({id:l.id,title:l.title,scenes:l.scenes.map((s,S)=>({name:s.name,say:s.say,art:ART_CH1[L][S]}))}));
