# Hawaii Revised Statutes — Unofficial Searchable Copy

A fast, searchable, browsable copy of the Hawaii Revised Statutes (HRS):
**14 volumes · 1,108 chapters · 19,840 sections**, with full-text search and a link
back to the official State source on every page.

> **Unofficial reproduction for research only — not the official statutes and not legal
> advice.** Always verify against the official text at
> <https://www.capitol.hawaii.gov/hrscurrent/>. See the in-site **About & Privacy** page
> for the full disclaimer and privacy statement.

## Use it online
The live site is published with GitHub Pages — just open the link, nothing to install.

## Run your own copy (offline)
You can download everything and run it on your own computer:

1. Download the ZIP (the **Download site (.zip)** link in the site footer, or the green
   **Code → Download ZIP** button on GitHub) and unzip it.
2. Because browsers block local file access, serve the folder with a tiny local web server:
   - **Windows:** double-click **`Start-HRS.bat`**, then open the address it shows.
   - **Any system with Python:** open a terminal in the folder and run
     `python -m http.server 8777`, then visit <http://localhost:8777/>.

The downloaded copy makes no outbound network requests except the official-source links
you choose to click.

## Re-host it yourself
This is plain static HTML/JS — no build step. Drop the files in any static host
(GitHub Pages, Netlify, etc.). See `PUBLISHING.md` for step-by-step GitHub Pages instructions.
