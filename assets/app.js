(function(){
'use strict';
const $ = s => document.querySelector(s);
const content = $('#content'), tree = $('#tree'), statusEl = $('#status');
let META=null, STATS=null;
const idMeta = {};            // id -> {vol,chap,secnum,catchline}
const chapByKey = {};         // "vol/chap" -> chapter entry
const volCache = {};          // vol -> {id:{t,u}} promise/data
let ms=null, msLoading=null;  // MiniSearch
const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){ statusEl.textContent=m; statusEl.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>statusEl.classList.remove('show'),1600); }

// ---------- data loading ----------
async function loadJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(url+' '+r.status); return r.json(); }
async function loadGzJSON(url){
  const r=await fetch(url); if(!r.ok) throw new Error(url+' '+r.status);
  const buf=new Uint8Array(await r.arrayBuffer());
  // gzip magic bytes 0x1f 0x8b -> needs manual inflate; otherwise server already decompressed it
  if(buf[0]===0x1f && buf[1]===0x8b && ('DecompressionStream' in window)){
    const stream=new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return new TextDecoder('utf-8').decode(buf);
}
async function getVol(vol){
  if(!volCache[vol]) volCache[vol]=loadJSON('data/volumes/'+vol+'.json');
  return volCache[vol];
}
async function getSectionText(id){
  const m=idMeta[id]; if(!m) return null;
  const v=await getVol(m.vol); return v[id]||null;
}

// ---------- sidebar tree ----------
function buildTree(){
  const byVol={};
  META.volumes.forEach(v=>byVol[v.vol]={label:v.label,chaps:[]});
  META.chapters.forEach(c=>{ if(byVol[c.vol]) byVol[c.vol].chaps.push(c); });
  let html='';
  META.volumes.forEach(v=>{
    const grp=byVol[v.vol];
    html+=`<div class="vol" data-vol="${esc(v.vol)}">${esc(v.label)}<span class="cnt">${grp.chaps.length} ch.</span></div>`;
    html+='<div class="chaps">';
    grp.chaps.forEach(c=>{
      html+=`<div class="chap${c.repealed?' repealed':''}" data-key="${esc(c.vol+'/'+c.chap)}"><span class="cnum">${esc(c.num)}</span><span class="ctitle">${esc(c.title)}${c.repealed?' (repealed)':''}</span></div>`;
    });
    html+='</div>';
  });
  tree.innerHTML=html;
  tree.querySelectorAll('.vol').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('open')));
  tree.querySelectorAll('.chap').forEach(el=>el.addEventListener('click',()=>{ location.hash='#/c/'+el.dataset.key; }));
}
function highlightTreeChapter(key){
  tree.querySelectorAll('.chap.active').forEach(e=>e.classList.remove('active'));
  const el=tree.querySelector('.chap[data-key="'+CSS.escape(key)+'"]');
  if(el){ el.classList.add('active'); const chaps=el.parentElement; const vol=chaps.previousElementSibling; if(vol&&!vol.classList.contains('open'))vol.classList.add('open'); try{ if(el.scrollIntoView) el.scrollIntoView({block:'nearest'}); }catch(_){} }
}

// ---------- views ----------
function home(){
  highlightTreeChapter('');
  content.innerHTML=`<div class="home-hero">
    <h1>Hawaii Revised Statutes</h1>
    <p>A searchable, browsable copy of the current Hawaii Revised Statutes. Search the full text above, or browse by volume and chapter on the left.</p>
    <div class="stat-row">
      <div class="stat"><div class="n">${STATS.sections.toLocaleString()}</div><div class="l">Sections</div></div>
      <div class="stat"><div class="n">${STATS.chapters.toLocaleString()}</div><div class="l">Chapters</div></div>
      <div class="stat"><div class="n">${STATS.volumes}</div><div class="l">Volumes</div></div>
    </div>
    <p class="disclaimer"><strong>Unofficial copy for research only — not the official statutes and not legal advice.</strong>
    Generated ${STATS.crawledAt?esc(STATS.crawledAt.slice(0,10)):''} from the official source. It may contain errors or be out of date.
    Always verify against the official Hawaii Revised Statutes at
    <a href="https://www.capitol.hawaii.gov/hrscurrent/" target="_blank" rel="noopener">capitol.hawaii.gov/hrscurrent</a>.</p>
  </div>`;
}

function chapterView(key){
  const c=chapByKey[key];
  if(!c){ content.innerHTML='<p>Chapter not found.</p>'; return; }
  highlightTreeChapter(key);
  const vol=META.volumes.find(v=>v.vol===c.vol);
  const offChap = (META.source||'https://www.capitol.hawaii.gov/hrscurrent/') + c.vol + '/' + c.chap + '/';
  let html=`<div class="crumb"><a href="#/">Home</a> › ${esc(vol?vol.label:c.vol)}</div>
    <h1 class="title">Chapter ${esc(c.num)}</h1><h2 class="subtitle">${esc(c.title)}</h2>
    <a class="officlink" href="${esc(offChap)}" target="_blank" rel="noopener">⚖ View this chapter on the official State site ↗</a>`;
  if(c.note) html+=`<div class="chapnote">${esc(c.note)}</div>`;
  if(c.secs.length){
    html+='<ul class="seclist">';
    c.secs.forEach(s=>{ html+=`<li><a href="#/s/${s[0]}"><span class="sn">§${esc(s[1]||'')}</span><span class="sc">${esc(s[2])}</span></a></li>`; });
    html+='</ul>';
  } else if(!c.note){ html+='<p style="color:var(--muted)">No sections (chapter repealed or reserved).</p>'; }
  content.innerHTML=html;
  content.parentElement.scrollTop=0;
}

async function sectionView(id){
  id=+id;
  const m=idMeta[id]; if(!m){ content.innerHTML='<p>Section not found.</p>'; return; }
  const key=m.vol+'/'+m.chap, c=chapByKey[key];
  highlightTreeChapter(key);
  content.innerHTML='<div class="loading">Loading section…</div>';
  const data=await getSectionText(id);
  const vol=META.volumes.find(v=>v.vol===m.vol);
  // sibling nav within chapter
  let prev=null,next=null;
  if(c){ const i=c.secs.findIndex(s=>s[0]===id); if(i>0)prev=c.secs[i-1][0]; if(i>=0&&i<c.secs.length-1)next=c.secs[i+1][0]; }
  const body = data? data.t : '(text unavailable)';
  let html=`<div class="section">
    <div class="crumb"><a href="#/">Home</a> › <a href="#/c/${esc(key)}">Ch. ${esc(c?c.num:m.chap)} — ${esc(c?c.title:'')}</a></div>
    ${data&&data.u?`<a class="officlink" href="${esc(data.u)}" target="_blank" rel="noopener">⚖ View this section on the official State site ↗</a>`:''}
    <div class="sechead"><div class="secnum">§${esc(m.secnum||'')}</div><div class="seccatch">${esc(m.catchline)}</div></div>
    <div class="body">${highlightTerms(esc(body))}</div>`;
  if(data&&data.u) html+=`<div class="src">⚖ Official version of this section (authoritative): <a href="${esc(data.u)}" target="_blank" rel="noopener">${esc(data.u)}</a></div>`;
  html+='<div class="navbtns">'+(prev!=null?`<a href="#/s/${prev}">‹ Previous</a>`:'<span></span>')+(next!=null?`<a href="#/s/${next}">Next ›</a>`:'<span></span>')+'</div></div>';
  content.innerHTML=html;
  content.parentElement.scrollTop=0;
}

// ---------- search ----------
async function ensureMS(){
  if(ms) return ms;
  if(!msLoading){
    msLoading=(async()=>{
      toast('Loading search index…');
      const txt=await loadGzJSON('data/search-index.json.gz');
      ms=MiniSearch.loadJSON(txt,{ fields:['catchline','text'], storeFields:[], idField:'id',
        searchOptions:{ boost:{catchline:3}, prefix:true, combineWith:'AND' } });
      toast('Search ready'); return ms;
    })();
  }
  return msLoading;
}
let lastResults=[], shown=0, lastQ='';
const PAGE=40;
function termsOf(q){ return q.toLowerCase().match(/[a-z0-9]+/g)||[]; }
function highlightTerms(html){
  const ts=termsOf(lastQ); if(!ts.length) return html;
  const re=new RegExp('('+ts.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
  return html.replace(re,'<mark>$1</mark>');
}
function snippet(text,terms){
  if(!text) return '';
  const low=text.toLowerCase(); let pos=-1;
  for(const t of terms){ const i=low.indexOf(t); if(i>=0&&(pos<0||i<pos))pos=i; }
  if(pos<0)pos=0;
  let start=Math.max(0,pos-90), end=Math.min(text.length,pos+200);
  let snip=(start>0?'…':'')+text.slice(start,end).replace(/\s+/g,' ').trim()+(end<text.length?'…':'');
  return highlightTerms(esc(snip));
}
async function runSearch(q){
  lastQ=q;
  const titlesOnly=$('#titlesOnly').checked, volF=$('#volFilter').value;
  content.innerHTML='<div class="loading">Searching…</div>';
  await ensureMS();
  let res=ms.search(q,{ fields: titlesOnly?['catchline']:['catchline','text'], prefix:true, combineWith:'AND', boost:{catchline:3} });
  if(volF) res=res.filter(r=>idMeta[r.id]&&idMeta[r.id].vol===volF);
  lastResults=res; shown=0;
  renderResults(true);
}
async function renderResults(reset){
  const terms=termsOf(lastQ);
  if(reset){
    content.innerHTML=`<div class="results-head">${lastResults.length.toLocaleString()} result${lastResults.length===1?'':'s'} for “${esc(lastQ)}”${$('#titlesOnly').checked?' (titles only)':''}</div><div id="rlist"></div><div class="more" id="moreWrap"></div>`;
  }
  const rlist=$('#rlist');
  const slice=lastResults.slice(shown,shown+PAGE);
  // prefetch volumes needed for snippets
  const vols=[...new Set(slice.map(r=>idMeta[r.id]&&idMeta[r.id].vol).filter(Boolean))];
  const volData={};
  await Promise.all(vols.map(async v=>{ volData[v]=await getVol(v); }));
  let html='';
  for(const r of slice){
    const m=idMeta[r.id]; if(!m) continue;
    const c=chapByKey[m.vol+'/'+m.chap];
    const vlabel=(META.volumes.find(v=>v.vol===m.vol)||{}).label||m.vol;
    const txt=(volData[m.vol]&&volData[m.vol][r.id])?volData[m.vol][r.id].t:'';
    html+=`<div class="result">
      <a class="rtitle" href="#/s/${r.id}">§${esc(m.secnum||'')} — ${esc(m.catchline)}</a>
      <div class="rcrumb">${esc(vlabel)} · Ch. ${esc(c?c.num:m.chap)}${c?(' — '+esc(c.title)):''}</div>
      <div class="rsnip">${snippet(txt,terms)}</div></div>`;
  }
  rlist.insertAdjacentHTML('beforeend',html);
  shown+=slice.length;
  const mw=$('#moreWrap');
  if(mw) mw.innerHTML = shown<lastResults.length ? `<button id="moreBtn">Show more (${(lastResults.length-shown).toLocaleString()} remaining)</button>` : '';
  const mb=$('#moreBtn'); if(mb) mb.addEventListener('click',()=>renderResults(false));
  if(reset) content.parentElement.scrollTop=0;
}

// ---------- about / legal / privacy ----------
function findBySecnum(sn){ for(const id in idMeta){ if(idMeta[id].secnum===sn) return id; } return null; }
function aboutView(){
  highlightTreeChapter('');
  const id23g = findBySecnum('23G-15');
  const link23g = id23g!=null ? `<a href="#/s/${id23g}">HRS §23G-15</a>` : 'HRS §23G-15';
  content.innerHTML = `<div class="legalpage">
    <div class="crumb"><a href="#/">Home</a> › About &amp; Legal</div>
    <h1>About, Legal &amp; Privacy</h1>
    <div class="box"><strong>Unofficial reproduction.</strong> This website is an independent, unofficial copy of the Hawaii Revised Statutes (HRS), created for research convenience. It is <strong>not</strong> affiliated with, endorsed by, or maintained by the State of Hawaii or the Hawaii Legislative Reference Bureau. It may contain errors, omissions, or out-of-date text, and it has no legal force. Nothing here is legal advice.</div>
    <h2>Official source &amp; legal status</h2>
    <p>The official HRS is compiled and published by the Hawaii Legislative Reference Bureau. Under ${link23g}, the matter set forth in the supplements and replacement volumes “shall be prima facie evidence of the law.” For authoritative text — and in the case of any conflict — consult the official Hawaii Revised Statutes and the Session Laws of Hawaii.</p>
    <p><a href="https://www.capitol.hawaii.gov/hrscurrent/" target="_blank" rel="noopener">Official Hawaii Revised Statutes ↗</a></p>
    <h2>State of Hawaii policies</h2>
    <p>The statutory text on this site was sourced from the State of Hawaii’s website. The State’s own policies govern that official site:</p>
    <p><a href="https://www.capitol.hawaii.gov/privacy.aspx" target="_blank" rel="noopener">State of Hawaii Capitol website Privacy Policy ↗</a></p>
    <h2>Privacy statement for this site</h2>
    <div class="box">This is a static website with no accounts, logins, cookies, analytics, trackers, or database. It does <strong>not</strong> ask for or collect any personal information from you. All searching and browsing run in your own browser — the statute text and search index are downloaded from the host and everything else happens on your device. The people who maintain this site receive no information about you and do not track visitors.</div>
    <p>This site is hosted for free on <strong>GitHub Pages</strong> (operated by GitHub, Inc.). As with virtually any website, GitHub automatically records standard technical data from visitors — such as IP addresses — in its server logs in order to run the service and keep it secure. This site's maintainers cannot see or access that data. GitHub's handling of it is governed by the <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub Privacy Statement ↗</a>.</p>
    <p>The only other network requests happen when you click an official-source link, which opens the State of Hawaii's website (capitol.hawaii.gov), where the State's own policies apply. If you instead run a copy of this site from your own computer, it makes no outbound requests at all apart from those official-source links you choose to click.</p>
    <h2>Verifying the text</h2>
    <p>Every chapter and section page links to its corresponding page on the official State site, so you can confirm the wording against the source of truth.</p>
    <p class="disclaimer">Statutes copied ${STATS&&STATS.crawledAt?esc(STATS.crawledAt.slice(0,10)):''} from capitol.hawaii.gov/hrscurrent.</p>
  </div>`;
  content.parentElement.scrollTop=0;
}

// ---------- routing ----------
function router(){
  const h=location.hash||'#/';
  const mC=h.match(/^#\/c\/(.+)$/), mS=h.match(/^#\/s\/(\d+)$/), mQ=h.match(/^#\/search\?q=(.*)$/);
  if(h==='#/about'){ aboutView(); }
  else if(mQ){ const q=decodeURIComponent(mQ[1]); if($('#q').value!==q)$('#q').value=q; runSearch(q); }
  else if(mS){ sectionView(mS[1]); }
  else if(mC){ chapterView(decodeURIComponent(mC[1])); }
  else home();
}

// ---------- init ----------
async function init(){
  try{
    [META,STATS]=await Promise.all([loadJSON('data/index-meta.json'),loadJSON('data/stats.json')]);
  }catch(e){ content.innerHTML='<p style="color:#b00">Could not load data. Make sure you are running this through a local web server (see README), not opening the file directly.</p>'; return; }
  META.chapters.forEach(c=>{
    chapByKey[c.vol+'/'+c.chap]=c;
    c.secs.forEach(s=>{ idMeta[s[0]]={vol:c.vol,chap:c.chap,secnum:s[1],catchline:s[2]}; });
  });
  // volume filter options
  const vf=$('#volFilter');
  META.volumes.forEach(v=>{ const o=document.createElement('option'); o.value=v.vol; o.textContent=v.label; vf.appendChild(o); });
  buildTree();
  // search box handlers
  let t=null;
  $('#q').addEventListener('input',e=>{ clearTimeout(t); const q=e.target.value.trim(); t=setTimeout(()=>{ if(q.length>=2) location.hash='#/search?q='+encodeURIComponent(q); else if(!q) location.hash='#/'; },280); });
  $('#q').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=e.target.value.trim(); if(q) location.hash='#/search?q='+encodeURIComponent(q); }});
  $('#titlesOnly').addEventListener('change',()=>{ const q=$('#q').value.trim(); if(q) runSearch(q); });
  $('#volFilter').addEventListener('change',()=>{ const q=$('#q').value.trim(); if(q) runSearch(q); });
  $('#homeLink').addEventListener('click',()=>location.hash='#/');
  window.addEventListener('hashchange',router);
  router();
}
init();
})();
