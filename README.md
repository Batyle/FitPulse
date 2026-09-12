# FitPulse

A dark, responsive boutique-gym class booking website. It gets exercise suggestions from API Ninjas when configured and automatically falls back to the free-exercise-db dataset (and finally embedded sample data) if that service is unavailable.

## Run locally

Open `index.html` with a static server (for example, VS Code Live Server) or deploy the folder directly to Netlify/Vercel.

To enable the API and booking email service, add this before `script.js` in both HTML files (or create a non-committed `config.js` and reference it first):

```html
<script>
window.FITCLASS_CONFIG = {
  apiKey: 'YOUR_API_NINJAS_KEY',
  appsScriptUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
};
</script>
```

## Google Apps Script deployment

1. Create a new Apps Script project and paste in `Code.gs`.
2. Optionally set `SHEET_ID` to an existing Google Sheet ID for booking logs.
3. Deploy → New deployment → Web app; choose **Execute as: Me** and **Who has access: Anyone**.
4. Copy its `/exec` URL into `appsScriptUrl` above.

The script creates a Google Doc, converts it to PDF, emails it to the customer, and returns the booking ID.
