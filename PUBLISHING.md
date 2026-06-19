# Publishing this site for free on GitHub Pages

This turns the folder into a public website with a real link (no `.bat`, no install
for visitors). GitHub Pages is free and hosts the site over secure HTTPS.

You will upload the **contents of this `HRS-Site` folder** so that `index.html` sits at
the top level of your repository.

---

## Easiest route — GitHub website (no software to install)

1. **Make a free account** at https://github.com (skip if you have one).

2. **Create a repository:** click the **+** (top right) → **New repository**.
   - Name it something like `hawaii-statutes`
   - Choose **Public**
   - Click **Create repository**

3. **Upload the files:** on the new repo page, click **Add file → Upload files**.
   - Open this `HRS-Site` folder on your computer, select **everything inside it**
     (the `index.html`, `assets` folder, `data` folder, and the other files), and
     **drag it all** onto the GitHub upload area. GitHub keeps the folder structure.
   - Scroll down and click **Commit changes**.

4. **Turn on Pages:** go to **Settings** (top of the repo) → **Pages** (left menu).
   - Under **Build and deployment → Source**, choose **Deploy from a branch**.
   - **Branch:** `main`, folder **`/ (root)`** → **Save**.

5. **Wait about a minute**, then refresh that Pages settings screen. It will show:
   **"Your site is live at https://YOUR-USERNAME.github.io/hawaii-statutes/"**
   That link is your website. Share it with anyone.

---

## Alternative route — GitHub Desktop app (nice if you'll update it later)

1. Install **GitHub Desktop** from https://desktop.github.com and sign in.
2. **File → New repository**, name it `hawaii-statutes`, pick a local folder, **Create**.
3. Copy **everything inside this `HRS-Site` folder** into that new repository folder.
4. In GitHub Desktop you'll see the files listed → type a summary → **Commit to main**
   → **Publish repository** (leave it Public).
5. On github.com open the repo → **Settings → Pages** → Source **Deploy from a branch**
   → `main` / `/ (root)` → **Save**. Your live link appears in a minute.

---

## Notes

- **Updating after a legislative session:** re-upload the `data` folder (or commit the
  changed files in GitHub Desktop). Nothing else needs to change.
- **Custom domain (optional):** in Settings → Pages you can attach your own domain name
  (e.g. `hawaiistatutes.org`) if you buy one.
- **The `Start-HRS.bat` and `README.txt`** are only for running the site locally; they're
  harmless to upload but aren't used by the website.
- This is public-domain government text, and the site already carries the unofficial-copy
  disclaimer and links back to the official State source on every page.
