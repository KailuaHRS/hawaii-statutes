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
  let html=''; let gi=0;
  META.volumes.forEach(v=>{
    const grp=byVol[v.vol]; const gid='chaps-'+(gi++);
    html+=`<button type="button" class="vol" data-vol="${esc(v.vol)}" aria-expanded="false" aria-controls="${gid}">${esc(v.label)}<span class="cnt">${grp.chaps.length} ch.</span></button>`;
    html+=`<div class="chaps" id="${gid}" role="group" aria-label="Chapters in ${esc(v.label)}">`;
    grp.chaps.forEach(c=>{
      const rep=c.repealed?' (repealed)':'';
      html+=`<a class="chap${c.repealed?' repealed':''}" href="#/c/${esc(c.vol+'/'+c.chap)}" data-key="${esc(c.vol+'/'+c.chap)}"><span class="cnum">${esc(c.num)}</span><span class="ctitle">${esc(c.title)}${rep}</span></a>`;
    });
    html+='</div>';
  });
  tree.innerHTML=html;
  tree.querySelectorAll('.vol').forEach(el=>el.addEventListener('click',()=>{ const open=el.classList.toggle('open'); el.setAttribute('aria-expanded', open?'true':'false'); }));
}
function highlightTreeChapter(key){
  tree.querySelectorAll('.chap.active').forEach(e=>{e.classList.remove('active');e.removeAttribute('aria-current');});
  const el=tree.querySelector('.chap[data-key="'+CSS.escape(key)+'"]');
  if(el){ el.classList.add('active'); el.setAttribute('aria-current','page'); const chaps=el.parentElement; const vol=chaps.previousElementSibling; if(vol&&!vol.classList.contains('open')){vol.classList.add('open'); vol.setAttribute('aria-expanded','true');} try{ if(el.scrollIntoView) el.scrollIntoView({block:'nearest'}); }catch(_){} }
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
    <p class="home-dl"><a href="#/download">⬇ Download a copy to use offline</a></p>
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
    c.secs.forEach(s=>{ html+=`<li><a href="s/${esc(s[3])}/"><span class="sn">§${esc(s[1]||'')}</span><span class="sc">${esc(s[2])}</span></a></li>`; });
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
const SYN={
  'dui':['operating under the influence'],'dwi':['operating under the influence'],'ovuii':['operating under the influence intoxicant'],
  'drunk driving':['operating under the influence'],'dunk driving':['operating under the influence'],
  'eviction':['landlord tenant'],'evicted':['landlord tenant'],'evict':['landlord tenant'],
  'restraining order':['protective order'],'protective order':['protective order'],
  'weed':['marijuana'],'cannabis':['marijuana'],'pot':['marijuana'],
  'gun':['firearm'],'guns':['firearm'],'firearms':['firearm'],
  'speeding':['speed limit'],'stalking':['harassment stalking']
};
let lastSynNote='';
function expandQuery(q){
  const lq=q.toLowerCase().trim(); const out=[q];
  for(const k in SYN){
    const re=new RegExp('(^|\\W)'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\W|$)');
    if(lq===k||re.test(lq)){ SYN[k].forEach(x=>{ if(!out.some(o=>o.toLowerCase()===x.toLowerCase())) out.push(x); }); }
  }
  return out;
}
async function runSearch(q){
  lastQ=q;
  const titlesOnly=$('#titlesOnly').checked, volF=$('#volFilter').value;
  content.innerHTML='<div class="loading">Searching…</div>';
  await ensureMS();
  const fields = titlesOnly?['catchline']:['catchline','text'];
  const opts={ fields, prefix:true, fuzzy:0.2, combineWith:'AND', boost:{catchline:3} };
  const variants=expandQuery(q);
  const merged=new Map();
  variants.forEach((vq,vi)=>{ ms.search(vq,opts).forEach(r=>{ const sc=r.score*(vi===0?1:0.92); const cur=merged.get(r.id); if(!cur||sc>cur.score) merged.set(r.id,{id:r.id,score:sc}); }); });
  let res=[...merged.values()].sort((a,b)=>b.score-a.score);
  if(volF) res=res.filter(r=>idMeta[r.id]&&idMeta[r.id].vol===volF);
  lastSynNote = variants.length>1 ? variants.slice(1).join(', ') : '';
  lastResults=res; shown=0;
  renderResults(true);
}
async function renderResults(reset){
  const terms=termsOf(lastQ);
  if(reset){
    content.innerHTML=`<div class="results-head" role="status" aria-live="polite">${lastResults.length.toLocaleString()} result${lastResults.length===1?'':'s'} for “${esc(lastQ)}”${$('#titlesOnly').checked?' (titles only)':''}${lastSynNote?` <span class="synnote">(also including: ${esc(lastSynNote)})</span>`:''}</div><div id="rlist"></div><div class="more" id="moreWrap"></div>`;
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
      <a class="rtitle" href="s/${esc(m.slug)}/">§${esc(m.secnum||'')} — ${esc(m.catchline)}</a>
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
function downloadView(){
  highlightTreeChapter('');
  const secs = STATS ? STATS.sections.toLocaleString() : '';
  content.innerHTML = `<div class="legalpage">
    <div class="crumb"><a href="#/">Home</a> &rsaquo; Download &amp; use offline</div>
    <h1>Download &amp; use offline</h1>
    <p>You can run this entire site on your own computer &mdash; useful for offline access, keeping an archive, or hosting your own copy. The download includes all ${secs} sections plus the full-text search.</p>
    <p><a class="dlbtn" href="https://github.com/KailuaHRS/hawaii-statutes/archive/refs/heads/main.zip">&#11015; Download the site (.zip)</a></p>
    <h2>Windows</h2>
    <p>1. Unzip the downloaded file (right&#8209;click &rarr; Extract All).<br>
       2. Open the unzipped folder and double&#8209;click <strong>Start-HRS.bat</strong>.<br>
       3. Your browser opens the site automatically. To stop, close the small black window.</p>
    <p class="note">The Windows launcher uses Python. If double&#8209;clicking does nothing, install the free <a href="https://www.python.org/downloads/" target="_blank" rel="noopener">Python &#8599;</a> (tick &ldquo;Add python.exe to PATH&rdquo; during setup) and try again, or use the command method below.</p>
    <h2>Mac, Linux, or any system with Python</h2>
    <p>1. Unzip the file.<br>
       2. Open a Terminal, type <code>cd&nbsp;</code> then drag the unzipped folder onto the window (to fill in its path) and press Enter.<br>
       3. Run: <code>python3 -m http.server 8777</code><br>
       4. Open <strong>http://localhost:8777/</strong> in your browser. Press Ctrl+C in the Terminal to stop.</p>
    <p class="note">A small local web server is needed because browsers block pages from reading local data files directly. A downloaded copy runs entirely from local files and makes no outbound requests except links you choose to click.</p>
    <h2>Host your own copy</h2>
    <p>These are plain static files &mdash; no build step. You can put them on any static host (GitHub Pages, Netlify, and similar). The included <strong>PUBLISHING.md</strong> has step&#8209;by&#8209;step instructions, and the <a href="https://github.com/KailuaHRS/hawaii-statutes" target="_blank" rel="noopener">source repository &#8599;</a> can be forked.</p>
  </div>`;
  content.parentElement.scrollTop=0;
}

function subscribeView(){
  highlightTreeChapter('');
  const feed='https://kailuahrs.github.io/hawaii-statutes/feed.xml';
  content.innerHTML = `<div class="legalpage">
    <div class="crumb"><a href="#/">Home</a> &rsaquo; Subscribe</div>
    <h1>Subscribe to updates</h1>
    <p>Get notified when the statutes or legislative&#8209;history data are refreshed. In keeping with this site&rsquo;s privacy policy, <strong>we collect nothing</strong> &mdash; you subscribe using tools you control, and no personal data ever touches this site.</p>
    <h2>RSS / Atom feed</h2>
    <p>Add this feed to any reader (Feedly, Inoreader, Outlook, or your browser):</p>
    <p><a class="dlbtn" href="feed.xml">Open the RSS feed</a></p>
    <p class="note">Feed URL: <code>${feed}</code></p>
    <h2>Prefer email?</h2>
    <p>Free services can deliver the RSS feed to your inbox &mdash; you sign up there with your own address, and nothing touches this site. Paste the feed URL above into one of these:</p>
    <p><a href="https://blogtrottr.com/" target="_blank" rel="noopener">Blogtrottr <span aria-hidden="true">&#8599;</span></a> &nbsp;&middot;&nbsp; <a href="https://follow.it/" target="_blank" rel="noopener">Follow.it <span aria-hidden="true">&#8599;</span></a></p>
    <h2>On GitHub?</h2>
    <p>You can also <a href="https://github.com/KailuaHRS/hawaii-statutes" target="_blank" rel="noopener">watch the repository <span aria-hidden="true">&#8599;</span></a> to be notified when the data changes.</p>
  </div>`;
  content.parentElement.scrollTop=0;
}

function buildView(){
  highlightTreeChapter('');
  content.innerHTML = `<div class="legalpage">
    <div class="crumb"><a href="#/">Home</a> &rsaquo; Sources &amp; build notes</div>
    <h1>Sources, methods &amp; limitations</h1>
    <p>In the interest of transparency for anyone relying on this for research, here is where the data comes from, how the site was assembled, and the known limits and obstacles that were worked around.</p>

    <h2>Where the data comes from</h2>
    <p><strong>Statute text:</strong> the official Hawaii Revised Statutes at <a href="https://www.capitol.hawaii.gov/hrscurrent/" target="_blank" rel="noopener">capitol.hawaii.gov/hrscurrent</a>, retrieved June&nbsp;2026.<br>
    <strong>Act numbers &amp; effective dates:</strong> the Legislative Reference Bureau&rsquo;s annual &ldquo;Bills Enacted&rdquo; reports (the yearly Acts PDFs).<br>
    <strong>Governor signing dates:</strong> the Legislature&rsquo;s individual bill&#8209;status (measure) pages.</p>

    <h2>Limits worked around</h2>
    <ul class="buildlist">
      <li><strong>Automated access is blocked.</strong> The official site sits behind bot protection that blocks server&#8209;side crawlers and scripted downloads. The text was instead gathered through an ordinary web browser &mdash; the same way a person&rsquo;s browser loads each page.</li>
      <li><strong>Scale.</strong> About 19,840 sections and ~4,600 bill records were collected using parallel, resumable in&#8209;browser fetching rather than one page at a time.</li>
      <li><strong>&ldquo;As far back as available.&rdquo;</strong> Dated Act data covers <strong>1999&ndash;2025 (27 years)</strong> &mdash; the full span the LRB publishes these annual reports for. Citations to earlier years link to the official Session Laws instead of showing inline dates.</li>
      <li><strong>Signing dates are partial by design.</strong> Recent sessions publish the Governor&rsquo;s action and date on each bill&rsquo;s status page; older records (roughly pre&#8209;2009) do not include that line. Those acts show the effective date and a link to the official bill, where the signing date can be confirmed.</li>
      <li><strong>Findability.</strong> Each section is published as its own crawlable page with a sitemap, so search engines can surface individual statutes &mdash; something the official site&rsquo;s search does not do well.</li>
      <li><strong>Speed &amp; offline use.</strong> A compressed full&#8209;text search index runs entirely in your browser, and the whole site can be downloaded and run locally with no server dependency.</li>
    </ul>

    <h2>Limitations &amp; accuracy</h2>
    <p>This is an <strong>unofficial</strong> reproduction and may contain transcription or parsing errors. A small number of section headings and Act titles required automated cleanup and may read imperfectly. Dates are believed accurate but should be confirmed against the official sources for any consequential use. Always verify against the official Hawaii Revised Statutes and Session Laws of Hawaii.</p>

    <h2>Found a problem?</h2>
    <p>Please report errors or request corrections at <a href="https://github.com/KailuaHRS/hawaii-statutes/issues" target="_blank" rel="noopener">github.com/KailuaHRS/hawaii-statutes/issues <span aria-hidden="true">&#8599;</span></a>.</p>
  </div>`;
  content.parentElement.scrollTop=0;
}

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
    <h2>Copyright &amp; reuse</h2>
    <p>The text of the Hawaii Revised Statutes is law. Under the United States &ldquo;government edicts&rdquo; doctrine, statutory text &mdash; and the annotations prepared by the legislature&rsquo;s revisor &mdash; are not subject to copyright. This site reproduces that public&#8209;domain text, reformatted for searching, and is offered free for non&#8209;commercial research and educational use. The content was modified for use from its original source at capitol.hawaii.gov.</p>
    <p>This project is independent. It is not affiliated with, approved by, or endorsed by the State of Hawaii, and it does not use the State seal, coat of arms, or any official emblem or branding. The statutes here are provided &ldquo;as is,&rdquo; without warranties of any kind as to accuracy, completeness, or currency.</p>
    <h2>State of Hawaii policies</h2>
    <p>The statutory text on this site was sourced from the State of Hawaii’s website. The State’s own policies govern that official site:</p>
    <p><a href="https://www.capitol.hawaii.gov/privacy.aspx" target="_blank" rel="noopener">State of Hawaii Capitol website Privacy Policy ↗</a></p>
    <h2>Privacy statement for this site</h2>
    <div class="box">This is a static website. It has no accounts, logins, cookies, analytics, trackers, third-party scripts, or database. It does <strong>not</strong> ask you for personal information, and the site's own code collects none. Searching and browsing run in your browser: the statute text and search index are downloaded from the host, and everything else happens on your device.</div>
    <p>This site is hosted for free on <strong>GitHub Pages</strong> (operated by GitHub, Inc.). As with essentially any website, GitHub automatically records standard technical data from visitors — such as IP addresses — in its server logs to operate the service and maintain security. Those logs are managed by GitHub, not by this site: the maintainers add no tracking of their own and do not have access to visitors' IP addresses or server logs. GitHub's handling of this data is described in the <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub Privacy Statement ↗</a>.</p>
    <p>The only network requests this site makes are for its own files on the host and for any links you choose to click — such as the official-source links to the State of Hawaii's website (capitol.hawaii.gov), where the State's own policies apply. If you run a downloaded copy from your own computer, even the site's files are local, and the only outbound requests are links you choose to click.</p>
    <h2>Verifying the text</h2>
    <p>Every chapter and section page links to its corresponding page on the official State site, so you can confirm the wording against the source of truth.</p>
    <h2>Report an error or request a correction</h2>
    <p>Found a mistake, or want a page corrected or taken down? Please open an issue on the project repository: <a href="https://github.com/KailuaHRS/hawaii-statutes/issues" target="_blank" rel="noopener">github.com/KailuaHRS/hawaii-statutes/issues <span aria-hidden="true">↗</span></a>.</p>
    <p class="disclaimer">Statutes copied ${STATS&&STATS.crawledAt?esc(STATS.crawledAt.slice(0,10)):''} from capitol.hawaii.gov/hrscurrent.</p>
  </div>`;
  content.parentElement.scrollTop=0;
}

// ---------- routing ----------
function router(){
  const h=location.hash||'#/';
  const mC=h.match(/^#\/c\/(.+)$/), mS=h.match(/^#\/s\/(\d+)$/), mQ=h.match(/^#\/search\?q=(.*)$/);
  if(h==='#/subscribe'){ subscribeView(); }
  else if(h==='#/build'){ buildView(); }
  else if(h==='#/download'){ downloadView(); }
  else if(h==='#/about'){ aboutView(); }
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
    c.secs.forEach(s=>{ idMeta[s[0]]={vol:c.vol,chap:c.chap,secnum:s[1],catchline:s[2],slug:s[3]}; });
  });
  // volume filter options
  const vf=$('#volFilter');
  META.volumes.forEach(v=>{ const o=document.createElement('option'); o.value=v.vol; o.textContent=v.label; vf.appendChild(o); });
  buildTree();
  ensureMS().catch(()=>{}); // preload search index so first search is instant
  // mobile navigation
  const navToggle=$('#navToggle'), navBackdrop=$('#navBackdrop');
  function closeNav(){ document.body.classList.remove('nav-open'); if(navToggle)navToggle.setAttribute('aria-expanded','false'); }
  if(navToggle) navToggle.addEventListener('click',()=>{ const o=document.body.classList.toggle('nav-open'); navToggle.setAttribute('aria-expanded',o?'true':'false'); });
  if(navBackdrop) navBackdrop.addEventListener('click',closeNav);
  tree.addEventListener('click',e=>{ if(e.target.closest('.chap')) closeNav(); });
  // currency banner
  const banner=$('#currency');
  if(banner){
    try{ if(localStorage.getItem('hrsBannerDismissed')) banner.style.display='none'; }catch(_){}
    const dt=$('#currencyDate'); if(dt&&STATS&&STATS.crawledAt){ try{ dt.textContent=new Date(STATS.crawledAt).toLocaleDateString('en-US',{year:'numeric',month:'long'}); }catch(_){} }
    const x=$('#currencyClose'); if(x) x.addEventListener('click',()=>{ banner.style.display='none'; try{ localStorage.setItem('hrsBannerDismissed','1'); }catch(_){} });
  }
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
