# FitPulse — Personal Workout Reminders

A modern workout reminder web app for anyone who wants a simple, no-login fitness nudge. Pick a variation, choose a time, and FitPulse sends a branded reminder email at the exact moment you requested — with a personalised PDF plan built from the open wger exercise library.

## 🌐 Live Site

https://fit-pulse-mocha.vercel.app/

## ✨ Features

- Responsive dark-themed home page with hero, steps, variation grid, and daily motivational quote
- Eight built-in workout variations plus unlimited custom variations
- Live exercise preview with real photos, muscles, equipment, and instructions from the wger API
- Schedule form with date, time, repeat, level, and notes
- Two send modes: **Send My Reminder** (scheduled) and **Send Email Now** (instant)
- Google Apps Script backend that builds a styled Google Doc, converts it to PDF, and emails it via EmailJS
- Scheduled delivery driven by an every-minute Apps Script time trigger
- Public Backlog dashboard with live sync, filter, search, and delete
- Local storage mirror so the backlog still works if Firebase is unreachable

## 📁 Project Structure

- `index.html` — landing page with hero, steps, and variation grid
- `about.html` — the story and purpose behind FitPulse
- `team.html` — the two-person team that built the project
- `schedule.html` — reminder form, exercise preview, custom variation builder
- `dashboard.html` — public backlog of every reminder
- `style.css` — all styling for every page
- `firebase-config.js` — shared Firebase module (Realtime Database + Analytics)
- `emailjs-config.js` — EmailJS config and template parameter builder
- `Code.gs` — Apps Script backend for PDF generation, scheduling, and EmailJS delivery

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3, vanilla JavaScript (ES modules)
- **API — EmailJS**: `service_kmrvd4s`, template `template_x7z2cgf`
- **API — wger Exercise Database**: free, no key required
- **API — ZenQuotes**: free daily motivational quote
- **API — jsDelivr CDN**: serves the EmailJS browser SDK
- **Backend**: Google Apps Script (DocumentApp + DriveApp + Sheets + GmailApp + LockService + UrlFetchApp)
- **Database**: Firebase Realtime Database (public `reminders` node)
- **Hosting**: static deployment (Vercel / Firebase Hosting / Netlify)

## 🔧 How It Works

1. User opens `index.html` and browses the variation grid
2. Selects a variation → `schedule.html?v=<name>` prefills the form
3. The preview panel fetches real exercises from the wger API
4. User fills in name, email, date, time, repeat, and level
5. On submit, the payload is posted to the Apps Script Web App URL
6. For **scheduled** reminders, Apps Script writes a `pending` row to Google Sheets with a `Next Run` timestamp
7. A time-based trigger runs every minute and emails the reminder via EmailJS at the right moment
8. For **Send Email Now**, Apps Script builds the PDF and the browser sends the email through the EmailJS SDK immediately
9. Every reminder is also written to Firebase so the Backlog dashboard updates live
10. Success message displays on the page with the reminder reference ID

## 🚀 Deployment

- **Frontend**: auto-deployed from GitHub `main` branch (Vercel / Firebase Hosting)
- **Backend**: Apps Script deployed as a Web App with `Execute as: Me` and `Who has access: Anyone`
- **Database**: Firebase Realtime Database with the following public rules on the `reminders` node:

```json
{
  "rules": {
    "reminders": {
      ".read": true,
      ".write": true,
      ".indexOn": ["sentAt", "createdAt"]
    }
  }
}
