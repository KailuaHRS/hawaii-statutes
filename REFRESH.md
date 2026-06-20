# Keeping this site up to date

Hawaii statutes change in two rhythms, and each is refreshed differently because the
official statute site (capitol.hawaii.gov) blocks automated servers (Cloudflare), while
the Legislative Reference Bureau's Acts reports (lrb.hawaii.gov) do not.

## 1. Automatic weekly refresh (no action needed)

A GitHub Actions workflow (`.github/workflows/refresh.yml`) runs **every Monday**. It:

1. Downloads the latest LRB annual **Acts** PDFs (current and prior year).
2. Parses bill numbers, effective dates, and titles, and merges them into
   `data/acts.json`.
3. Regenerates any affected **legislative-history tables** and commits/pushes the changes
   (which redeploys the site). Weeks with no changes do nothing.
4. If **new acts** appear (i.e. a session produced new laws), it opens a GitHub **Issue**
   notifying you that a browser-assisted refresh is due.

You can also run it on demand: **Actions tab → "Weekly HRS data refresh" → Run workflow.**

What this *cannot* do on its own: re-crawl the **statute text** or fetch **Governor signing
dates**, because both live behind Cloudflare. Those need the browser step below.

## 2. Browser-assisted full refresh (a few times a year)

Do this when the weekly job opens an Issue, or when the LRB posts the annual HRS update
(usually early in the year). It re-crawls the statute text and the signing dates through a
real browser, then rebuilds everything.

Steps (we can do this together):

1. **Re-crawl statutes** — load capitol.hawaii.gov in the browser and run the section
   crawler (same harness used to build the site) to refresh the full text + source notes.
2. **Re-crawl signing dates** — for any new acts, fetch the bill-status pages and parse the
   Governor's approval date.
3. **Rebuild** — regenerate the section pages (text + legislative-history tables) and push.

The scripts in `tools/` (`refresh.js`, `gen-pages.js`) and `data/acts.json` /
`data/signdates.json` are the building blocks; the browser crawl supplies the two
Cloudflare-protected pieces.

## Files

- `tools/refresh.js` — weekly Acts refresh (run by the workflow).
- `tools/gen-pages.js` — regenerates section/chapter pages from `data/`.
- `data/acts.json` — Act → bill / effective date / title (1999–2025).
- `data/signdates.json` — Governor signing dates by bill.
