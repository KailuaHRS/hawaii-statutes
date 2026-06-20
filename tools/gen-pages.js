const fs=require('fs'), path=require('path');
const ROOT=process.env.HRS_ROOT||'.';
const DATA=path.join(ROOT,'data');
const BASE='https://kailuahrs.github.io/hawaii-statutes/';
const meta=JSON.parse(fs.readFileSync(path.join(DATA,'index-meta.json')));
const acts=JSON.parse(fs.readFileSync(path.join(ROOT,'data','acts.json')));   // {year:{act:{bill,effDate,title,uponApproval,approvalDate}}}
let signdates={}; try{ signdates=JSON.parse(fs.readFileSync(path.join(ROOT,'data','signdates.json'))); }catch(e){ console.log('NOTE: signdates.json not found - signed column blank'); }
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slugOf=sn=>String(sn).replace(/:/g,'-').replace(/[^0-9A-Za-z.\-]/g,'-');
const chapSlugOf=n=>String(n).replace(/[^0-9A-Za-z]/g,'-');
const volCache={}; const vol=v=>volCache[v]||(volCache[v]=JSON.parse(fs.readFileSync(path.join(DATA,'volumes',v+'.json'))));

// id/slug maps (same as before)
const idInfo={}, secToSlug=new Map(), chapToSlug=new Map(), chapByKey={};
const usedSlug=new Set();
meta.chapters.forEach(c=>{ chapByKey[c.vol+'/'+c.chap]=c; chapToSlug.set(String(c.num),chapSlugOf(c.num)); });
meta.chapters.forEach(c=>c.secs.forEach(s=>{
  const [id,secnum,catchline]=s; let base=slugOf(secnum||('sec-'+id)),g=base,n=2;
  while(usedSlug.has(g)){g=base+'-'+n;n++;} usedSlug.add(g);
  idInfo[id]={id,secnum,catchline,vol:c.vol,chap:c.chap,chapNum:c.num,chapTitle:c.title,slug:g};
  if(secnum&&!secToSlug.has(secnum)) secToSlug.set(secnum,g);
}));

const MONTHS={'1':'Jan','2':'Feb','3':'Mar','4':'Apr','5':'May','6':'Jun','7':'Jul','8':'Aug','9':'Sep','10':'Oct','11':'Nov','12':'Dec'};
function fmtMDY(d){ if(!d)return null; const m=d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(!m)return d; return `${MONTHS[String(+m[1])]} ${+m[2]}, ${m[3]}`; }
function fmtLong(d){ if(!d)return null; const m=d.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/); if(!m)return d; return `${m[1].slice(0,3)} ${+m[2]}, ${m[3]}`; }
function measureUrl(bill,year){ const m=String(bill).match(/^([A-Z]+)(\d+)$/); if(!m)return null; return `https://www.capitol.hawaii.gov/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${year}`; }

// parse [L YYYY, c NNN] citations with year tracking -> ordered unique {year,act}
function parseCites(text){
  const out=[], seen=new Set();
  const notes=text.match(/\[[^\]]*\bL \d{4}[^\]]*\]/g)||[];
  for(const note of notes){ let cur=null; const re=/L (\d{4})|c (\d+[A-Za-z]?)/g; let t;
    while((t=re.exec(note))){ if(t[1])cur=t[1]; else if(t[2]&&cur){ const k=cur+'-'+parseInt(t[2],10); if(!seen.has(k)){seen.add(k); out.push({year:cur,act:parseInt(t[2],10)});} } } }
  return out;
}
function legHistory(text){
  const cites=parseCites(text);
  const rows=cites.map(({year,act})=>{
    const a=acts[year]&&acts[year][act]; if(!a) return null;
    const url=measureUrl(a.bill,year);
    const signRaw=signdates[`${year}|${String(a.bill).replace(/^([A-Z]+).*/,'$1')}|${String(a.bill).replace(/^[A-Z]+/,'')}`];
    const signed = signRaw?fmtMDY(signRaw) : (a.approvalDate?fmtLong(a.approvalDate):null);
    return {year,act,bill:a.bill,url,eff:fmtLong(a.effDate),signed,title:a.title};
  }).filter(Boolean);
  rows.sort((x,y)=> (y.year-x.year)|| (y.act-x.act));   // newest first
  return rows;
}
function historyTableHtml(rows){
  if(!rows.length) return '';
  let body=rows.map(r=>`<tr><td class="lh-act">Act ${r.act} (${r.year})</td><td>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.bill)}</a>`:esc(r.bill)}</td><td>${esc(r.eff||'')}</td><td>${esc(r.signed||'—')}</td><td class="lh-title">${esc(r.title||'')}</td></tr>`).join('');
  return `<section class="leghistory"><h2>Legislative history</h2>
  <div class="lh-scroll"><table class="lhtable"><thead><tr><th>Act</th><th>Bill</th><th>Effective</th><th>Signed</th><th>Title</th></tr></thead><tbody>${body}</tbody></table></div>
  <p class="lhnote">Bill, effective, and signing dates from the Hawaii State Legislature and the Legislative Reference Bureau (Acts 1999&ndash;2025). &ldquo;Signed&rdquo; is the Governor&rsquo;s approval date where published. Confirm against the official source for any consequential use.</p></section>`;
}
// linkify full "L YYYY, c NNN" tokens in the (escaped) body where we have act data
function linkifyCites(escaped){
  return escaped.replace(/L (\d{4}), c (\d+[A-Za-z]?)/g,(m,y,a)=>{
    const an=parseInt(a,10); const rec=acts[y]&&acts[y][an];
    if(!rec) return m; const url=measureUrl(rec.bill,y);
    return url?`L ${y}, c <a class="actref" href="${esc(url)}" target="_blank" rel="noopener" title="Act ${an} (${y}) = ${esc(rec.bill)}; eff. ${esc(fmtLong(rec.effDate)||'')}">${a}</a>`:m;
  });
}

const FOOTER=`<footer id="legal">
  <span><strong>Unofficial reproduction — not the official statutes and not legal advice.</strong> May contain errors or be out of date. The official version is published by the Hawaii Legislative Reference Bureau.</span>
  <span class="legal-links">
    <a href="https://www.capitol.hawaii.gov/hrscurrent/" target="_blank" rel="noopener">Official HRS<span aria-hidden="true">&nbsp;↗</span></a>
    <a href="../../#/about">About &amp; Privacy</a>
    <a href="../../#/build">Sources &amp; build notes</a>
    <a href="https://github.com/KailuaHRS/hawaii-statutes/issues" target="_blank" rel="noopener">Report an error<span aria-hidden="true">&nbsp;↗</span></a>
  </span></footer>`;
const HEADER=`<header id="topbar">
  <a class="brand" href="../../" title="Home"><span class="brand-main">Hawaii Revised Statutes</span><span class="brand-sub">unofficial searchable copy</span></a>
  <form class="pagesearch" role="search" onsubmit="location.href='../../#/search?q='+encodeURIComponent(this.q.value);return false;">
    <input name="q" type="search" aria-label="Search the statutes" placeholder="Search the statutes…"><button type="submit">Search</button></form></header>`;
const CCJS=`<script>function cc(b,t,l){if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){var o=b.textContent;b.textContent=l+' copied ✓';setTimeout(function(){b.textContent=o;},1500);});}}</script>`;

function sectionPage(info){
  const data=vol(info.vol)[info.id]||{t:'',u:''}; const text=data.t||'';
  const desc=(info.catchline+' — '+text.replace(/\s+/g,' ')).slice(0,158).replace(/"/g,'')+'…';
  const body=linkifyCites(linkifySections(esc(text), info.slug));
  const rows=legHistory(text); const histHtml=historyTableHtml(rows);
  const c=chapByKey[info.vol+'/'+info.chap]; const secs=c?c.secs:[]; const i=secs.findIndex(s=>s[0]===info.id);
  let prev=i>0?`<a href="../${idInfo[secs[i-1][0]].slug}/">‹ §${esc(idInfo[secs[i-1][0]].secnum)}</a>`:'<span></span>';
  let next=(i>=0&&i<secs.length-1)?`<a href="../${idInfo[secs[i+1][0]].slug}/">§${esc(idInfo[secs[i+1][0]].secnum)} ›</a>`:'<span></span>';
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>§${esc(info.secnum)} ${esc(info.catchline)} — Hawaii Revised Statutes</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}s/${info.slug}/"><link rel="stylesheet" href="../../assets/style.css">
</head><body class="docpage"><a href="#main" class="skip">Skip to content</a>${HEADER}
<main id="main" tabindex="-1" class="docwrap"><div class="section">
  <nav class="crumb" aria-label="Breadcrumb"><a href="../../">Home</a> › <a href="../../c/${chapSlugOf(info.chapNum)}/">Ch. ${esc(info.chapNum)} — ${esc(info.chapTitle)}</a></nav>
  <div class="sechead"><div class="secnum">§${esc(info.secnum)}</div><h1 class="seccatch">${esc(info.catchline)}</h1></div>
  <div class="toolbar">
    <button type="button" class="copybtn" onclick="cc(this,'Haw. Rev. Stat. § ${esc(info.secnum)}','Citation')">Copy citation</button>
    <button type="button" class="copybtn" onclick="cc(this,location.href,'Link')">Copy link</button>
    ${data.u?`<a class="officlink" href="${esc(data.u)}" target="_blank" rel="noopener">⚖ Official version ↗</a>`:''}</div>
  <div class="body">${body}</div>
  ${histHtml}
  <div class="navbtns">${prev}${next}</div>
  <p class="srcnote">Citation: <strong>Haw. Rev. Stat. § ${esc(info.secnum)}</strong>. Unofficial — verify against the <a href="${esc(data.u||'https://www.capitol.hawaii.gov/hrscurrent/')}" target="_blank" rel="noopener">official source</a>.</p>
</div></main>${FOOTER}${CCJS}</body></html>`;
}
// keep section cross-ref linking too
const SECRE=/(\d+[A-Z]?(?::\d+)?-\d+(?:\.\d+)?)/g;
function linkifySections(escaped,curSlug){
  let out=escaped.replace(SECRE,(m)=>{ const sl=secToSlug.get(m); return (sl&&sl!==curSlug)?`<a class="xref" href="../${sl}/">${m}</a>`:m; });
  out=out.replace(/(\bchapters?\s+)(\d+[A-Z]?)\b/gi,(m,p1,num)=>{ const cs=chapToSlug.get(num); return cs?`${p1}<a class="xref" href="../../c/${cs}/">${num}</a>`:m; });
  return out;
}
function chapterPage(c){
  const num=c.num,cslug=chapSlugOf(num);
  const offChap=`https://www.capitol.hawaii.gov/hrscurrent/${c.vol}/${c.chap}/`;
  let list=c.secs.length?('<ul class="seclist">'+c.secs.map(s=>`<li><a href="../../s/${idInfo[s[0]].slug}/"><span class="sn">§${esc(s[1])}</span><span class="sc">${esc(s[2])}</span></a></li>`).join('')+'</ul>'):'<p class="note">No sections (chapter repealed or reserved).</p>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chapter ${esc(num)} — ${esc(c.title)} — Hawaii Revised Statutes</title>
<meta name="description" content="${esc('Chapter '+num+', '+c.title+' — Hawaii Revised Statutes.')}">
<link rel="canonical" href="${BASE}c/${cslug}/"><link rel="stylesheet" href="../../assets/style.css">
</head><body class="docpage"><a href="#main" class="skip">Skip to content</a>${HEADER}
<main id="main" tabindex="-1" class="docwrap">
  <nav class="crumb" aria-label="Breadcrumb"><a href="../../">Home</a> › Chapter ${esc(num)}</nav>
  <h1 class="title">Chapter ${esc(num)}</h1><h2 class="subtitle">${esc(c.title)}</h2>
  <a class="officlink" href="${offChap}" target="_blank" rel="noopener">⚖ View this chapter on the official State site ↗</a>
  ${c.note?`<div class="chapnote">${esc(c.note)}</div>`:''}${list}
</main>${FOOTER}</body></html>`;
}

let nsec=0,nchap=0,withHist=0; const urls=[BASE];
for(const c of meta.chapters){
  const cslug=chapSlugOf(c.num); const cdir=path.join(ROOT,'c',cslug); fs.mkdirSync(cdir,{recursive:true});
  fs.writeFileSync(path.join(cdir,'index.html'),chapterPage(c)); nchap++; urls.push(`${BASE}c/${cslug}/`);
  for(const s of c.secs){ const inf=idInfo[s[0]]; const sdir=path.join(ROOT,'s',inf.slug); fs.mkdirSync(sdir,{recursive:true});
    const html=sectionPage(inf); if(/leghistory/.test(html))withHist++;
    fs.writeFileSync(path.join(sdir,'index.html'),html); nsec++; urls.push(`${BASE}s/${inf.slug}/`); }
}
const sm='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`<url><loc>${u}</loc></url>`).join('\n')+'\n</urlset>\n';
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),sm);
console.log('section pages:',nsec,'| chapter pages:',nchap,'| sections with legislative-history table:',withHist);
