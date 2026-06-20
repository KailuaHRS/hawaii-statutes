// Weekly refresh: pull latest LRB Acts PDFs, merge into data/acts.json, regenerate pages.
// Server-side only (LRB is fetchable). Statute text + signing dates need a browser refresh.
const fs=require('fs'), {execSync}=require('child_process'), path=require('path');
const ROOT=process.env.HRS_ROOT||'.';
const now=new Date(); const Y=now.getFullYear();
const YEARS=(process.env.YEARS? process.env.YEARS.split(',').map(s=>+s) : [Y, Y-1]);

const deLetter=s=>s.replace(/\b([A-Z](?: [A-Z]){2,})\b/g,m=>m.replace(/ /g,'')).replace(/\s+/g,' ').trim();
function cleanTitle(raw){
  let t=deLetter(raw).replace(/R\s*E\s*L\s*A\s*T\s*I\s*N\s*G\s+T\s*O/i,'RELATING TO');
  t=t.replace(/^(?:(?:HD|SD|CD)\d?\w*\s*|\([^)]*\)\s*|[HS]?SCR\s*[-\d]+\s*|CCR\s*[-\d]+\s*)+/i,'');
  const kw=t.match(/(RELATING TO .*|MAKING APPROPRIATION.*|PROPOSING .*|AUTHORIZING .*|A BILL FOR AN ACT.*|ESTABLISHING .*|AMENDING .*)/i);
  if(kw) t=kw[1];
  return t.replace(/\s*\.\s*$/,'.').replace(/\s+/g,' ').trim().slice(0,120);
}
function parsePdf(file){
  const txt=execSync(`pdftotext -layout "${file}" - 2>/dev/null`).toString();
  const lines=txt.split('\n'); const acts={};
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^\s*(\d{1,3})\s+((?:HB|SB|GM)\s?\d{1,4})\b(.*)$/);
    if(!m) continue;
    const act=parseInt(m[1],10); if(!act||act>500) continue;
    const bill=m[2].replace(/\s+/g,'').replace(/^([A-Z]+)0*/,'$1');
    let tp=[]; if(m[3].trim()) tp.push(m[3].trim()); let eff=null;
    for(let j=i+1;j<Math.min(i+8,lines.length);j++){
      const em=lines[j].match(/Effective:\s*(.+)$/); if(em){eff=em[1].trim();break;}
      if(/^\s*\d{1,3}\s+(?:HB|SB|GM)/.test(lines[j])) break;
      const tl=lines[j].trim(); if(tl) tp.push(tl);
    }
    if(!eff) continue; eff=eff.replace(/\s+/g,' ');
    const par=eff.match(/\(([A-Z][a-z]+ \d{1,2}, \d{4})\)/), plain=eff.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
    const effDate=par?par[1]:(plain?plain[1]:eff.slice(0,40));
    const uponApproval=/upon (its )?approval/i.test(eff);
    if(!acts[act]) acts[act]={bill,act,title:cleanTitle(tp.join(' ')),effDate,uponApproval,approvalDate:uponApproval&&par?par[1]:null};
  }
  return acts;
}
function dl(year){
  const f=`/tmp/${year}_Acts.pdf`;
  try{ execSync(`curl -s -f --max-time 90 -o "${f}" "https://lrb.hawaii.gov/wp-content/uploads/${year}_Acts.pdf"`); 
       if(fs.existsSync(f)&&fs.statSync(f).size>1000&&fs.readFileSync(f,{encoding:'latin1'}).slice(0,4)==='%PDF') return f; }catch(e){}
  return null;
}

const actsPath=path.join(ROOT,'data','acts.json');
const acts=JSON.parse(fs.readFileSync(actsPath));
const newActs=[], changed=[];
for(const year of YEARS){
  const f=dl(year); if(!f){ console.log('skip',year,'(no PDF)'); continue; }
  const parsed=parsePdf(f); const yk=String(year);
  acts[yk]=acts[yk]||{};
  for(const a in parsed){
    const np=parsed[a], old=acts[yk][a];
    if(!old){ acts[yk][a]=np; newActs.push({year:yk,act:+a,bill:np.bill,eff:np.effDate,title:np.title}); }
    else if(old.bill!==np.bill||old.effDate!==np.effDate||old.title!==np.title){
      acts[yk][a]={...old,...np}; changed.push({year:yk,act:+a,bill:np.bill,eff:np.effDate,title:np.title}); }
  }
  console.log(`parsed ${year}: ${Object.keys(parsed).length} acts`);
}
fs.writeFileSync(actsPath, JSON.stringify(acts));
fs.writeFileSync(path.join(ROOT,'tools','_changes.json'), JSON.stringify({ranAt:now.toISOString(),years:YEARS,newCount:newActs.length,changedCount:changed.length,newActs:newActs.slice(0,80),changed:changed.slice(0,80)},null,1));
console.log(`NEW acts: ${newActs.length} | CHANGED acts: ${changed.length}`);
// regenerate pages (only diffs will be committed)
execSync(`HRS_ROOT="${ROOT}" node tools/gen-pages.js`,{stdio:'inherit',cwd:ROOT,env:{...process.env,HRS_ROOT:ROOT}});
