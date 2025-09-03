# Question Bank Shuffle — Minimal Free Stack

This is a tiny, free-to-host quiz app using:
- Google Sheets → question bank
- Google Apps Script → exposes the sheet as a public JSON API
- Firebase (Auth + Realtime Database) → signup/login + save results
- Pure HTML/CSS/JS → frontend (host anywhere like Netlify/GitHub Pages)

---

## 1) Prepare Google Sheet
Create a Google Sheet with a header row like:

| Question | Option A | Option B | Option C | Option D | Correct Answer |
|---------|----------|----------|----------|----------|----------------|
| 2+2 = ? | 3        | 4        | 5        | 6        | B              |

**Notes**
- `Correct Answer` can be `A/B/C/D` or the exact text of the correct option.

## 2) Publish the Sheet as a JSON API (Google Apps Script)
Open the Sheet → Extensions → Apps Script → paste `Code.gs` from this project.
Then: Deploy → New deployment → Type: Web app → Who has access: **Anyone**.
Copy the deployment URL (it ends with `/exec`) and paste it into `app.js` as `SHEET_API_URL`.

## 3) Set up Firebase (free)
- Go to https://console.firebase.google.com
- Create a web app (no hosting needed).
- Enable **Email/Password** in Authentication → Sign-in methods.
- Enable **Realtime Database** (start in test mode for development).
- Copy your config into `app.js` under `// TODO: paste your Firebase config here`.

Data will be stored under:
- `/users/{uid}` → profile (name, email, age, grade)
- `/results/{uid}/{pushId}` → quiz result (score, total, answers...)

## 4) Run locally
Just open `index.html` in a local server (e.g., VS Code Live Server).
Or drag & drop the folder into Netlify/GitHub Pages.

## 5) Deploy (optional)
- **Netlify**: Drag-drop the folder into the dashboard.
- **GitHub Pages**: Push to a repo → Settings → Pages → set branch to `main` and `/` root.

---

## Quick customization
- Edit grade options inside `index.html` (the `<select id="grade">`).
- Style changes in `styles.css`.
- Change shuffle behavior in `app.js` (`shuffle()` function).

Have fun and good luck! 🎉
