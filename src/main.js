const defaults={blue:'#315BD6',yellow:'#FFB800',green:'#087765',clay:'#B76645',ink:'#12191A'};
let tokens=JSON.parse(localStorage.getItem('motif-tokens')||'null')||{...defaults};
let shapes=[
 {id:'note',type:'note',x:205,y:255,w:250,h:240,color:'blue',r:10},
 {id:'camera',type:'camera',x:396,y:174,w:176,h:146,color:'yellow',r:18},
 {id:'badge',type:'badge',x:510,y:106,w:105,h:105,color:'ink',r:53},
 {id:'frame',type:'frame',x:160,y:195,w:98,h:87,color:'green',r:17},
];
let selected='camera',grid=true,drag=null;
const $=s=>document.querySelector(s);

function shapeSvg(s){const c=tokens[s.color];if(s.type==='note')return `<g data-id="${s.id}" transform="translate(${s.x} ${s.y})"><rect width="${s.w}" height="${s.h}" rx="${s.r}" fill="${c}"/><path d="M28 48h98M28 71h152M28 94h132M28 117h165M28 178c28-19 41 27 69 8s41-3 67 6 36-9 56-3" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" opacity=".94"/></g>`;
if(s.type==='camera')return `<g data-id="${s.id}" transform="translate(${s.x} ${s.y})"><path d="M20 15h36L67 0h52l11 15h26a20 20 0 0120 20v91a20 20 0 01-20 20H20A20 20 0 010 126V35a20 20 0 0120-20z" fill="${c}"/><circle cx="89" cy="78" r="41" fill="#f8f8f3"/><circle cx="89" cy="78" r="31" fill="url(#lens)" stroke="${tokens.ink}" stroke-width="5"/></g>`;
if(s.type==='badge')return `<g data-id="${s.id}" transform="translate(${s.x} ${s.y})"><circle cx="52" cy="52" r="52" fill="${c}"/><circle cx="52" cy="52" r="40" fill="none" stroke="white" stroke-width="2" stroke-dasharray="5 6"/><path d="M52 29l8 15 15 8-15 8-8 15-8-15-15-8 15-8z" fill="white"/><circle cx="52" cy="52" r="11" fill="${tokens.blue}"/></g>`;
if(s.type==='frame')return `<g data-id="${s.id}" transform="translate(${s.x} ${s.y})"><path d="M0 28V15Q0 0 15 0h20M63 0h20q15 0 15 15v20M98 55v17q0 15-15 15H63M35 87H15Q0 87 0 72V55" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/></g>`;
if(s.type==='circle')return `<circle data-id="${s.id}" cx="${s.x+s.w/2}" cy="${s.y+s.h/2}" r="${s.w/2}" fill="${c}"/>`;
return `<rect data-id="${s.id}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${c}"/>`}

function render(){
 document.documentElement.style.cssText+=`;--blue:${tokens.blue};--yellow:${tokens.yellow};--green:${tokens.green};--clay:${tokens.clay}`;
 const s=shapes.find(x=>x.id===selected);
 $('#app').innerHTML=`<main class="app"><header class="topbar"><div class="brand"><span class="brandmark"><i></i><i></i><i></i><i></i></span>Motif</div><div class="project"><span>/</span><strong>Untitled composition</strong><span>Saved locally</span></div><div class="top-actions"><button class="btn" id="shuffle">↝ &nbsp;Remix</button><button class="btn iconbtn" id="grid" title="Toggle grid">⌗</button><button class="switch" id="theme" aria-label="Toggle dark mode"></button><button class="btn primary" id="export">Export SVG&nbsp; ↓</button></div></header>
 <div class="workspace"><aside class="sidebar"><p class="eyebrow">Primitive library</p><div class="shape-grid">${[['rect','Rectangle'],['circle','Circle'],['frame','Frame'],['line','Line']].map(x=>`<button class="shape-btn" data-add="${x[0]}"><span class="shape-icon ${x[0]}"></span>${x[1]}</button>`).join('')}</div><div class="section"><p class="eyebrow">Composition layers</p><div class="layers">${[...shapes].reverse().map(x=>`<div class="layer ${x.id===selected?'active':''}" data-select="${x.id}"><span class="layer-swatch" style="background:${tokens[x.color]}"></span>${x.id[0].toUpperCase()+x.id.slice(1)}<span class="drag">⠿</span></div>`).join('')}</div></div></aside>
 <section class="stage"><div class="canvas-shell ${grid?'grid-on':''}"><svg id="canvas" class="canvas" viewBox="0 0 760 760" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lens" cx="35%" cy="30%"><stop stop-color="#fff"/><stop offset=".42" stop-color="#b9d6ff"/><stop offset="1" stop-color="${tokens.blue}"/></radialGradient></defs>${shapes.map(shapeSvg).join('')}${s?`<rect class="selection" x="${s.x-8}" y="${s.y-8}" width="${s.w+16}" height="${s.h+16}" rx="5"/><rect class="corner" x="${s.x-12}" y="${s.y-12}" width="8" height="8"/><rect class="corner" x="${s.x+s.w+4}" y="${s.y+s.h+4}" width="8" height="8"/>`:''}</svg></div><div class="zoom">− &nbsp; 100% &nbsp; +</div></section>
 <aside class="rightbar"><div class="property-head"><div><p class="eyebrow" style="margin-bottom:6px">Inspector</p><h2>${s?s.id[0].toUpperCase()+s.id.slice(1):'Nothing selected'}</h2></div><button class="remove" id="remove">×</button></div>${s?`<div class="field-row"><div class="field"><label>X position</label><input class="input" data-prop="x" type="number" value="${Math.round(s.x)}"></div><div class="field"><label>Y position</label><input class="input" data-prop="y" type="number" value="${Math.round(s.y)}"></div></div><div class="field-row"><div class="field"><label>Width</label><input class="input" data-prop="w" type="number" value="${s.w}"></div><div class="field"><label>Height</label><input class="input" data-prop="h" type="number" value="${s.h}"></div></div><div class="wide-field"><label>Fill token</label><select class="input" id="fill">${Object.keys(tokens).map(k=>`<option ${s.color===k?'selected':''}>${k}</option>`).join('')}</select></div>`:''}<div class="section"><p class="eyebrow">Design tokens</p>${Object.entries(tokens).map(([k,v])=>`<div class="token"><input class="color" type="color" value="${v}" data-token="${k}"><div><div class="token-name">${k[0].toUpperCase()+k.slice(1)}</div><div class="token-code">${v}</div></div><span></span></div>`).join('')}<button class="btn" id="save" style="width:100%;justify-content:center;margin-top:10px">Save colour system</button><p class="hint">Your token set and theme are saved to this browser.</p></div></aside></div></main><div class="toast" id="toast">Saved</div>`;
 bind();
}
function bind(){
 document.querySelectorAll('[data-select]').forEach(e=>e.onclick=()=>{selected=e.dataset.select;render()});
 document.querySelectorAll('[data-add]').forEach(e=>e.onclick=()=>addShape(e.dataset.add));
 document.querySelectorAll('[data-prop]').forEach(e=>e.onchange=()=>{shapes.find(x=>x.id===selected)[e.dataset.prop]=+e.value;render()});
 document.querySelectorAll('[data-token]').forEach(e=>e.oninput=()=>{tokens[e.dataset.token]=e.value.toUpperCase();render()});
 $('#fill')&&($('#fill').onchange=e=>{shapes.find(x=>x.id===selected).color=e.target.value;render()});
 $('#remove').onclick=()=>{shapes=shapes.filter(x=>x.id!==selected);selected=shapes.at(-1)?.id;render()};
 $('#grid').onclick=()=>{grid=!grid;render()}; $('#theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('motif-theme',document.body.className)};
 $('#save').onclick=()=>{localStorage.setItem('motif-tokens',JSON.stringify(tokens));toast('Colour system saved')};
 $('#shuffle').onclick=()=>{shapes.forEach((s,i)=>{s.x=130+Math.random()*360;s.y=110+Math.random()*360});render()}; $('#export').onclick=exportSvg;
 const svg=$('#canvas');svg.onpointerdown=e=>{const el=e.target.closest('[data-id]');if(!el)return;selected=el.dataset.id;const s=shapes.find(x=>x.id===selected);drag={x:e.clientX,y:e.clientY,sx:s.x,sy:s.y};svg.setPointerCapture(e.pointerId)};svg.onpointermove=e=>{if(!drag)return;const s=shapes.find(x=>x.id===selected),scale=760/svg.getBoundingClientRect().width;s.x=Math.round((drag.sx+(e.clientX-drag.x)*scale)/10)*10;s.y=Math.round((drag.sy+(e.clientY-drag.y)*scale)/10)*10;const group=svg.querySelector(`[data-id="${selected}"]`);if(group?.tagName.toLowerCase()==='g')group.setAttribute('transform',`translate(${s.x} ${s.y})`)};svg.onpointerup=()=>{drag=null;render()};
}
function addShape(type){const id=type+' '+(shapes.length+1);shapes.push({id,type:type==='line'?'rect':type,x:285,y:320,w:type==='circle'?100:160,h:type==='circle'?100:type==='line'?8:100,color:type==='circle'?'yellow':'blue',r:type==='circle'?50:12});selected=id;render()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1500)}
function exportSvg(){const content=shapes.map(shapeSvg).join('');const blob=new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760">${content}</svg>`],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='motif-composition.svg';a.click();URL.revokeObjectURL(a.href);toast('SVG exported')}
if(localStorage.getItem('motif-theme')==='dark')document.body.classList.add('dark');render();
