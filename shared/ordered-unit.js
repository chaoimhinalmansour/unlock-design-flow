(()=>{
'use strict';
const api=window.UnlockContent,$=id=>document.getElementById(id),C=api.formatLabel,E=v=>C(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frame=$('canvas-frame'),legacy=$('timeline-scroll'),view=document.createElement('div');view.id='ordered-unit';view.className='ordered-unit';view.tabIndex=0;view.setAttribute('aria-label','按教材顺序排列的单元时间轴，可左右拖动');legacy.after(view);
let track=null,idx=null,pan={RW:{x:0,y:0},LS:{x:0,y:0}},lastOpened=null,suppress=0,layoutFrame=0;
let reusePlans=[], reuseNotes=new Map(), reuseBandHeight=0;
const pageText=e=>e.pages?.length?'p'+(e.pages.length===1?e.pages[0]:e.pages[0]+'-'+e.pages.at(-1)):'';
function typeText(e){if(e.teachingBox)return window.UnlockContentTeachingType(e.teachingBox);if(e.kind==='glossary')return '任务词汇';if(e.kind==='study')return '自研';if(e.kind==='task')return '练习';return({material:'主体阅读',resource:'资源',objectives:'单元目标',reference:'查阅资源',custom:'自研'})[e.kind]||''}
function courseLesson(m){return m.lesson}

function openButton(e){
 const notes=(reuseNotes.get(e.id)||[]).map(note=>
  '<span class="ordered-reuse-note"><span class="reuse-note-kind">'+E(note.kind)+'</span><span>'+E(note.text)+'</span></span>'
 ).join('');
 return '<button type="button" class="ordered-open" data-open-entry="'+E(e.id)+'" data-entry-kind="'+e.kind+'" data-parent-module="'+E(e.module)+'"'+(e.teachingBox?' data-teaching-box="'+E(e.teachingBox.printed)+'"':'')+(e.kind==='glossary'?' data-task-glossary="true"':'')+'>'+
  '<span class="ordered-kind">'+E((e.textbookStep?e.textbookStep+'　':'')+typeText(e))+'</span><span class="ordered-card-heading"><strong>'+E(e.title)+'</strong>'+
  (e.pages.length?'<small>'+E(pageText(e))+'</small>':'')+'</span>'+
  (e.kind==='glossary'?'<span class="ordered-glossary-preview">'+E(idx.glossaries[e.id].words.slice(0,4).map(x=>x.term).join('、'))+'</span>':'')+notes+'</button>';
}
function entryCard(id){
 return '<div class="ordered-entry" data-primary-entry="'+E(id)+'">'+openButton(idx.entries[id])+'</div>';
}

// Assign one lane to each overlapping interval. Non-overlapping branches reuse the space.
function assignLanes(intervals, gap){
 const ends=[];
 intervals.sort((a,b)=>a.start-b.start||a.end-b.end);
 for(const interval of intervals){
  let lane=ends.findIndex(end=>end+gap<interval.start);
  if(lane===-1)lane=ends.length;
  interval.lane=lane;
  ends[lane]=interval.end;
 }
 return ends.length;
}

function prepareReuse(){
 const moduleOrder=new Map(idx.modules.map((module,i)=>[module.id,i]));
 reuseNotes=new Map();
 const addNote=(id,text)=>reuseNotes.set(id,[...(reuseNotes.get(id)||[]),text]);
 reusePlans=(idx.exerciseReuse||[]).map(group=>{
  const source=idx.entries[group.from];
  const destinations=group.targets.map(target=>idx.entries[target.to]);
  const modules=[...new Set([source.module,...destinations.map(entry=>entry.module)])];
  const positions=modules.map(module=>moduleOrder.get(module));
  addNote(group.from,{kind:'产出',text:group.artifact});
  for(const entry of destinations){
   const location=source.module===entry.module?source.title:pageText(source)+' '+source.title;
   addNote(entry.id,{kind:'取用',text:location+' '+group.artifact});
  }
  return {...group,modules,start:Math.min(...positions),end:Math.max(...positions),lane:null};
 });
 const count=assignLanes(reusePlans.filter(plan=>plan.modules.length>1),0);
 reuseBandHeight=count?count*24+8:0;
}
function mainReading(e){
 const pages=e.pages.filter(p=>idx.originalPages[p]);
 const preview=pages.map(p=>'<img loading="lazy" src="'+api.escape(idx.originalPages[p])+'" alt="'+E(e.moduleLabel+' p'+p)+'">').join('');
 return '<div class="module-main-reading" data-primary-entry="'+E(e.id)+'"><button type="button" class="reading-main-open'+(preview?'':' no-preview')+'" data-open-entry="'+E(e.id)+'" data-entry-kind="material" data-parent-module="'+E(e.module)+'"><span class="reading-thumbnails">'+preview+'</span><span><small>阅读材料 '+E(pageText(e))+'</small><strong>'+E(e.title)+'</strong></span></button></div>';
}
function reserveGutters(){
 const position=new Map();
 for(const m of idx.modules){let i=0;for(const sid of m.phaseIds)for(const id of idx.entries[sid].items)position.set(id,i++);}
 for(const m of idx.modules){const intervals=[];for(const p of reusePlans){if(!p.modules.includes(m.id))continue;const ids=[p.from,...p.targets.map(t=>t.to)].filter(id=>idx.entries[id].module===m.id);const ys=ids.map(id=>position.get(id));if(p.modules.length>1)ys.push(-1);intervals.push({start:Math.min(...ys),end:Math.max(...ys)});}m.flowGutter=Math.max(48,assignLanes(intervals,.1)*14+20);}
}
function render(){
 const t=api.track();if(track){pan[track]={x:view.scrollLeft,y:view.scrollTop}}const changed=t!==track;track=t;idx=api.index.tracks[t];
 prepareReuse();reserveGutters();
 let ordinal=0;view.innerHTML='<div class="ordered-unit-line" style="--reuse-band:'+reuseBandHeight+'px"><div class="ordered-spine" aria-hidden="true"></div><svg class="ordered-reuse-wires" aria-hidden="true"></svg><ol class="ordered-modules">'+idx.modules.map(m=>{
  const e=idx.entries[m.entry],lesson=courseLesson(m);
  const lessonLabel=api.mode==='school'&&lesson?'第 '+lesson+' 节':'';
  const label=lessonLabel;
  const stage=m.stage==='review'?m.newCount+' 词待核对':m.stage?m.newCount+' 个首次学练':'';
  const start=m.stage==='lesson1'||m.stage==='lesson2';
  let lastParent='';const sections=m.phaseIds.map(id=>{const section=idx.entries[id],parent=section.parentPhase;const band=parent&&parent!==lastParent?'<div class="ordered-parent-phase">'+E(parent)+'</div>':'';lastParent=parent||lastParent;return band+'<section class="ordered-section" data-section-id="'+E(id)+'"><button type="button" class="ordered-section-title" data-open-entry="'+E(id)+'">'+E(section.title)+'</button><div class="ordered-section-items">'+section.items.map(entryCard).join('')+'</div></section>'}).join('');
  return '<li class="ordered-module'+(m.custom?' ordered-module-custom':'')+'" data-module="'+E(m.id)+'"'+(start?' data-lesson-start="'+lesson+'"':'')+' style="margin-right:'+(m.flowGutter-48)+'px"><p class="ordered-lesson">'+E(label)+'</p><div class="ordered-module-head"><button type="button" data-open-entry="'+E(m.entry)+'" class="ordered-module-open"><strong>'+E(m.label)+'</strong>'+(m.mainContents.length?'<span>'+m.mainContents.map(id=>E(idx.entries[id].title)).join(' / ')+'</span>':'')+(m.pages.length?'<small>'+E(pageText(e))+'</small>':(stage?'<small>'+E(stage)+'</small>':''))+'</button></div><div class="ordered-module-dot" aria-hidden="true">'+(m.custom?'自研':++ordinal)+'</div><div class="ordered-module-body">'+m.mainContents.map(id=>mainReading(idx.entries[id])).join('')+sections+'</div></li>';
 }).join('')+'</ol></div>';
 if(changed){const p=pan[t]||{x:0,y:0};view.scrollLeft=p.x;view.scrollTop=p.y}
 highlight();queueLayout();view.dataset.track=track;view.dataset.moduleCount=idx.modules.length;view.dataset.ready='false';
}

function roundedPath(points, radius=8){
 const clean=points.filter((point,i)=>i===0||point.x!==points[i-1].x||point.y!==points[i-1].y);
 let result='M '+clean[0].x+' '+clean[0].y;
 for(let i=1;i<clean.length-1;i++){
  const previous=clean[i-1],corner=clean[i],next=clean[i+1];
  const before=Math.hypot(corner.x-previous.x,corner.y-previous.y);
  const after=Math.hypot(next.x-corner.x,next.y-corner.y);
  const size=Math.min(radius,before/2,after/2);
  const entry={x:corner.x+(previous.x-corner.x)*size/before,y:corner.y+(previous.y-corner.y)*size/before};
  const exit={x:corner.x+(next.x-corner.x)*size/after,y:corner.y+(next.y-corner.y)*size/after};
  result+=' L '+entry.x+' '+entry.y+' Q '+corner.x+' '+corner.y+' '+exit.x+' '+exit.y;
 }
 const last=clean[clean.length-1];
 return result+' L '+last.x+' '+last.y;
}

function drawReuse(){
 const unit=view.querySelector('.ordered-unit-line');
 const svg=unit.querySelector('.ordered-reuse-wires');
 const origin=unit.getBoundingClientRect();
 const columns=new Map([...unit.querySelectorAll('.ordered-module')].map(el=>[el.dataset.module,{
  right:el.getBoundingClientRect().right-origin.left, segments:[]
 }]));
 const cards=new Map([...unit.querySelectorAll('.ordered-entry .ordered-open')].map(el=>[el.dataset.openEntry,{
  bounds:el.getBoundingClientRect(),module:el.dataset.parentModule,ports:[]
 }]));

 const routes=reusePlans.map(plan=>{
  const railY=plan.lane===null?null:172+plan.lane*24;
  const segments=new Map(plan.modules.map(id=>[id,{ports:[],railY}]));
  function addPort(id,outgoing){
   const card=cards.get(id);
   const port={id,outgoing,x:card.bounds.right-origin.left,y:0};
   card.ports.push(port);
   segments.get(card.module).ports.push(port);
  }
  addPort(plan.from,true);
  for(const target of plan.targets)addPort(target.to,false);
  return {plan,segments,railY};
 });

 for(const card of cards.values()){
  const {top,height}=card.bounds;
  const spacing=Math.min(12,(height-20)/Math.max(1,card.ports.length-1));
  card.ports.forEach((port,i)=>{
   port.y=top-origin.top+height/2+(i-(card.ports.length-1)/2)*spacing;
  });
 }
 for(const route of routes){
  for(const [module,segment] of route.segments){
   const ys=segment.ports.map(port=>port.y);
   if(segment.railY!==null)ys.push(segment.railY);
   segment.start=Math.min(...ys);
   segment.end=Math.max(...ys);
   columns.get(module).segments.push(segment);
  }
 }
 for(const column of columns.values()){
  assignLanes(column.segments,16);
  for(const segment of column.segments)segment.x=column.right+2+14*segment.lane;
 }

 const marker='<defs><marker id="exercise-reuse-arrow" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L7.5 4L1 7" fill="none" stroke="context-stroke" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>';
 const drawings=routes.map(({plan,segments,railY})=>{
  const label=E(plan.artifact);
  const halos=[];
  function wire(points,target=null){
   const d=roundedPath(points);
   halos.push('<path class="reuse-wire-halo" d="'+d+'"/>');
   return '<path class="reuse-wire"'+
    (target?' data-reuse-target="'+E(target)+'" marker-end="url(#exercise-reuse-arrow)"':'')+' d="'+d+'"/>';
  }
  const pieces=[],junctions=[];
  for(const segment of segments.values()){
   const ports=[...segment.ports].sort((a,b)=>a.y-b.y);
   const first=ports[0],last=ports[ports.length-1];
   const terminal={x:segment.x,y:last.y};
   if(railY===null){
    pieces.push(wire([first,{x:segment.x,y:first.y},terminal,last],last.id));
   }else if(last.outgoing){
    pieces.push(wire([last,terminal,{x:segment.x,y:railY+8}]));
   }else{
    pieces.push(wire([{x:segment.x,y:railY+8},terminal,last],last.id));
   }
   for(const port of ports){
    if(port===last||railY===null&&port===first)continue;
    const joint={x:segment.x,y:port.y};
    pieces.push(port.outgoing?wire([port,joint]):wire([joint,port],port.id));
    junctions.push('<circle class="reuse-junction" cx="'+joint.x+'" cy="'+joint.y+'" r="1.9"/>');
   }
  }
  if(railY!==null){
   const xs=[...segments.values()].map(segment=>segment.x).sort((a,b)=>a-b);
   const left=xs[0],right=xs[xs.length-1];
   pieces.push(wire([{x:left,y:railY+8},{x:left,y:railY},{x:right,y:railY},{x:right,y:railY+8}]));
   for(const x of xs.slice(1,-1)){
    pieces.push(wire([{x,y:railY},{x,y:railY+8}]));
    junctions.push('<circle class="reuse-junction" cx="'+x+'" cy="'+railY+'" r="1.9"/>');
    }
   pieces.push('<text class="reuse-rail-label" x="'+(left+12)+'" y="'+(railY-7)+'">'+label+'</text>');
  }
  return '<g class="reuse-route" data-reuse-source="'+E(plan.from)+'"><title>'+label+'</title>'+halos.join('')+pieces.join('')+junctions.join('')+'</g>';
 });
 svg.setAttribute('viewBox','0 0 '+origin.width+' '+origin.height);
 svg.innerHTML=marker+drawings.join('');
}

function layout(){
 drawReuse();
 highlight();
 view.dataset.ready='true';
}
function queueLayout(){view.dataset.ready='false';cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout)}
function highlight(){
 const id=api.selection().id;
 for(const button of view.querySelectorAll('[data-open-entry]')){
  button.classList.toggle('ordered-selected',button.dataset.openEntry===id);
 }
 for(const route of view.querySelectorAll('.reuse-route')){
  const targets=[...route.querySelectorAll('[data-reuse-target]')];
  route.classList.toggle('reuse-selected',route.dataset.reuseSource===id||targets.some(target=>target.dataset.reuseTarget===id));
 }
}
function reveal(id){const target=view.querySelector('[data-primary-entry="'+CSS.escape(id)+'"]')||view.querySelector('[data-open-entry="'+CSS.escape(id)+'"]');if(!target)return;const a=target.getBoundingClientRect(),v=view.getBoundingClientRect();const column=target.closest('.ordered-module');
 if(target.classList.contains('ordered-module-open')){
  view.scrollLeft+=column.getBoundingClientRect().left-v.left-canvasMargin();
  view.scrollTop=0;
 }else{
  view.scrollLeft+=a.left+a.width/2-v.left-v.width/2;
  if(a.top<v.top||a.bottom>v.bottom-12)view.scrollTop+=a.top-v.top-34;
 }}
view.addEventListener('click',event=>{if(performance.now()<suppress){event.preventDefault();return}const button=event.target.closest('[data-open-entry]');if(!button)return;lastOpened={id:button.dataset.openEntry,from:button.dataset.fromEntry||null};api.open(button.dataset.openEntry,{fromEntry:button.dataset.fromEntry||null,relation:!!button.dataset.fromEntry})});
document.addEventListener('unlock-content-change',event=>{if(api.track()!==track)render();else highlight();if(!event.detail.open&&lastOpened){const candidates=[...view.querySelectorAll('[data-open-entry]')];const button=candidates.find(b=>b.dataset.openEntry===lastOpened.id&&(b.dataset.fromEntry||null)===lastOpened.from);button?.focus({preventScroll:true})}});
let drag=null;view.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={pointer:e.pointerId,x:e.clientX,left:view.scrollLeft,active:false}});
view.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;const delta=e.clientX-drag.x;if(!drag.active&&Math.abs(delta)>6){drag.active=true;view.setPointerCapture(e.pointerId);view.classList.add('is-dragging')}if(drag.active){e.preventDefault();view.scrollLeft=drag.left-delta}});
function finish(e){if(!drag||drag.pointer!==e.pointerId)return;if(drag.active){suppress=performance.now()+300;if(view.hasPointerCapture(e.pointerId))view.releasePointerCapture(e.pointerId)}view.classList.remove('is-dragging');drag=null}
view.addEventListener('pointerup',finish);view.addEventListener('pointercancel',finish);view.addEventListener('dragstart',e=>e.preventDefault());
view.addEventListener('keydown',e=>{if(e.target.closest('button'))return;if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();view.scrollLeft=e.key==='Home'?0:e.key==='End'?view.scrollWidth:view.scrollLeft+(e.key==='ArrowRight'?1:-1)*412});
function canvasMargin(){
 return parseFloat(getComputedStyle(view.firstElementChild).paddingLeft);
}
function panModule(delta){
 const columns=[...view.querySelectorAll('.ordered-module')];
 const anchor=view.getBoundingClientRect().left+canvasMargin();
 const column=delta>0?columns.find(col=>col.getBoundingClientRect().left>anchor+2):
  columns.findLast(col=>col.getBoundingClientRect().left<anchor-2);
 if(column)reveal(column.querySelector('.ordered-module-open').dataset.openEntry);
}
function updatePanButtons(){
 $('pan-prev').disabled=view.scrollLeft<2;
 $('pan-next').disabled=view.scrollLeft+view.clientWidth>=view.scrollWidth-2;
}
view.addEventListener('scroll',updatePanButtons,{passive:true});
$('pan-prev').onclick=()=>panModule(-1);
$('pan-next').onclick=()=>panModule(1);
$('lesson-shortcuts').addEventListener('click',event=>{
 const target=event.target.closest('[data-go-entry]');
 if(target)reveal(target.dataset.goEntry);
});
addEventListener('resize',queueLayout);render();updatePanButtons();
document.addEventListener('unlock-content-change',updatePanButtons);if(api.selection().id)requestAnimationFrame(()=>reveal(api.selection().id));
window.UnlockOrderedUnit={reveal,refresh:render};
})();
