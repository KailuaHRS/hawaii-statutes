const fs=require('fs'),path=require('path');
const ROOT=process.env.HRS_ROOT||'.';
const SITE='https://kailuahrs.github.io/hawaii-statutes/';
const ups=JSON.parse(fs.readFileSync(path.join(ROOT,'data','updates.json')));
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const rfc822=d=>new Date(d+'T18:00:00Z').toUTCString();
const sorted=ups.slice().sort((a,b)=>b.date.localeCompare(a.date));
const newest=sorted.length?rfc822(sorted[0].date):new Date(0).toUTCString();
const items=sorted.map(u=>`  <item>
    <title>${esc(u.title)}</title>
    <link>${SITE}</link>
    <guid isPermaLink="false">hrs-${u.date}-${esc(u.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}</guid>
    <pubDate>${rfc822(u.date)}</pubDate>
    <description>${esc(u.summary)}</description>
  </item>`).join('\n');
const feed=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
  <title>Hawaii Revised Statutes (unofficial) — updates</title>
  <link>${SITE}</link>
  <atom:link href="${SITE}feed.xml" rel="self" type="application/rss+xml"/>
  <description>Updates to the unofficial searchable Hawaii Revised Statutes: data refreshes, new acts, and legislative-history changes.</description>
  <language>en-us</language>
  <lastBuildDate>${newest}</lastBuildDate>
${items}
</channel></rss>
`;
fs.writeFileSync(path.join(ROOT,'feed.xml'),feed);
console.log('feed.xml written with',ups.length,'items');
