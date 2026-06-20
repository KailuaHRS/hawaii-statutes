# Hawaii Revised Statutes — Unofficial Searchable Copy

A fast, free, searchable copy of the **Hawaii Revised Statutes (HRS)** — all
**14 volumes · 1,108 chapters · 19,840 sections** — with legislative history, links
back to the official source on every page, and no tracking of any kind.

**Live site:** https://kailuahrs.github.io/hawaii-statutes/

> ⚖️ **Unofficial reproduction — not the official statutes and not legal advice.**
> May contain errors or be out of date. Always verify against the official text at
> <https://www.capitol.hawaii.gov/hrscurrent/>. See the in-site **About & Privacy** and
> **Sources & build notes** pages for the full disclaimer, provenance, and limitations.

---

## Features

### Search & browse
- **Full-text search** across every section — runs entirely in your browser (no server),
  instant after a one-time index load.
- **Typo-tolerant (fuzzy) matching** — e.g. "marijuna" still finds *marijuana*.
- **Plain-language synonyms** — everyday terms map to statutory language (e.g. *DUI* →
  §291E-61 "operating a vehicle under the influence", *eviction* → landlord–tenant).
- **Title-only toggle** and **filter by volume**.
- **Browse tree** — Volume → Chapter → Section, fully keyboard-navigable.

### Reading & citing
- A real, crawlable **page per section and per chapter** at stable, human-readable URLs
  (e.g. `/s/291E-61/`, `/c/711/`) — shareable, printable, and indexable by search engines.
- **Copy citation** (`Haw. Rev. Stat. § 291E-61`) and **Copy link** buttons.
- **Cross-reference auto-linking** — in-text references like "section 291E-3" or
  "chapter 711" become clickable.
- An **official-source link** on every page, back to capitol.hawaii.gov.

### Legislative history
- Each section that cites a modern Act shows a **Legislative history** table:
  **Act № (year) · Bill (linked to the official bill-status page) · Effective date ·
  Governor's signing date · Title** — covering Acts **1999–2025**.
- In-text "L 2023, c 148" citations link to the enacting bill.

- **Implementing administrative rules (HAR):** each statute lists the agency rules that implement it (department + HAR chapter), from the LRB 2024 *Table of Statutory Sections Implemented*.

### Discoverability & maintenance
- **`sitemap.xml`** (20,949 URLs) and **`robots.txt`** so search engines index individual statutes.
- **Weekly auto-refresh** (GitHub Actions) keeps the Acts/effective-date data current and
  opens an Issue when a browser-assisted full refresh is due. See `REFRESH.md`.
- **RSS feed** (`/feed.xml`) + a **Subscribe** page (RSS, email-via-bridge, or GitHub watch) —
  no email addresses or subscriber data ever touch this site.

### Quality & access
- **Accessibility:** WCAG 2.1 AA pass — skip link, ARIA roles/labels, visible focus,
  sufficient contrast, keyboard operation, screen-reader-friendly results.
- **Mobile:** slide-in navigation menu for phones.
- **Currency banner** noting when the data was retrieved.
- **Print-friendly** section pages.
- **Offline use:** download the whole site as a ZIP and run it locally (see below).

### Privacy
- No accounts, logins, cookies, analytics, trackers, third-party scripts, or database.
- Searching and browsing run in your browser; the site collects nothing.
- Hosted on GitHub Pages; GitHub keeps standard server logs (IP addresses) as any host does —
  the maintainers don't have access to those. Full details on the in-site privacy page.

---

## Using it

### Online
Just open the live site — nothing to install.

### Offline / your own copy
Download a copy and run it on your own computer (handy for offline access or archiving):

1. **Download ZIP:** the *Download / use offline* link in the site footer, or GitHub's green
   **Code → Download ZIP**.
2. Because browsers block local file access, serve the folder with a tiny local web server:
   - **Windows:** double-click **`Start-HRS.bat`** (needs Python installed).
   - **Any OS with Python:** run `python3 -m http.server 8777` in the folder, then open
     <http://localhost:8777/>.

A downloaded copy makes no outbound requests except links you choose to click.

### Re-host it
Plain static files — no build step. Drop them on any static host (GitHub Pages, Netlify, …).
See `PUBLISHING.md`.

---

## How it's kept up to date

The official statute site (capitol.hawaii.gov) blocks automated servers (Cloudflare), so
refreshes come in two parts:

1. **Automatic (weekly, server-side):** A GitHub Action downloads the Legislative Reference
   Bureau's annual Acts reports, updates effective dates / bills / titles, regenerates the
   legislative-history tables, and notifies via an Issue when new acts appear.
2. **Browser-assisted (a few times a year):** Re-crawling the **statute text** and **Governor
   signing dates** needs a real browser (Cloudflare). Triggered when the weekly job flags it.

Full details and scripts: **`REFRESH.md`**, `tools/refresh.js`, `tools/gen-pages.js`,
`tools/gen-feed.js`.

---

## Data sources

- **Statute text:** official HRS at capitol.hawaii.gov/hrscurrent (retrieved June 2026).
- **Act numbers, bills, effective dates, titles:** LRB annual "Bills Enacted" reports, **1999–2025**.
- **Governor signing dates:** the Legislature's individual bill-status pages.

The text of the HRS is law and, under the U.S. *government-edicts doctrine*, is not subject to
copyright. This project is independent and **not affiliated with, endorsed by, or approved by
the State of Hawaii**, and uses no State seal, emblem, or branding.

---

## Repository layout

```
index.html              The search/browse app (single page)
assets/                 app.js, style.css, minisearch.min.js
data/
  index-meta.json       browse tree + section catchlines/slugs
  search-index.json.gz  prebuilt full-text index (gzip)
  volumes/*.json        full section text by volume
  acts.json             Act → bill / effective date / title (1999–2025)
  signdates.json        Governor signing dates by bill
  updates.json          changelog that feeds the RSS feed
s/<section>/            generated per-section pages
c/<chapter>/            generated per-chapter pages
feed.xml                RSS update feed
sitemap.xml, robots.txt SEO
tools/                  refresh.js, gen-pages.js, gen-feed.js
.github/workflows/      weekly refresh workflow
REFRESH.md PUBLISHING.md  maintenance & hosting guides
```

---

## Roadmap / ideas

Features that would extend this further (not yet built):

- **Title/Division table of contents** — browse by the HRS's logical Division/Title hierarchy,
  the way attorneys think about the code, in addition to physical volumes.
- **Dark mode and adjustable text size.**
- **Bookmarks / saved sections** (stored locally in the browser).
- **Definitions linking** — link defined terms within a chapter to their "Definitions" section.
- **Section-level deep linking to subsections** and a "jump to §" box that recognizes a typed citation.
- **Version history / diffs** — show what changed between annual updates.
- **Per-section signing dates for pre-2009 acts** via the Session Laws "Approved" dates.

---

## Report an error / request a correction or takedown

Open an issue: <https://github.com/KailuaHRS/hawaii-statutes/issues>

---

*Public-domain statutory text, reproduced for free, non-commercial research and educational use.*
