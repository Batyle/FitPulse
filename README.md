# FitClass

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
2. Optionally set `FITPULSE_SHEET_ID` to an existing Google Sheet ID. The script creates `Reminders` and `Users` tabs as needed.
3. Deploy → New deployment → Web app; choose **Execute as: Me** and **Who has access: Anyone**.
4. Copy its `/exec` URL into `appsScriptUrl` above.

The same web app handles reminder scheduling and accounts. New account records are saved in the `Users` tab; returning users are matched by email. Passwords are salted and hashed before storage. Each saved or updated reminder also sends a Gmail receipt containing the submitted reminder details to the email address entered in the form. The **Forgot password** option emails a six-digit code that expires after 15 minutes (the first use requires Apps Script permission to send email).

## FitPulse EmailJS template

The EmailJS template controls the final email body. The app now sends the full reminder context and a responsive, branded email under `email_html`. In EmailJS, edit template `template_x7z2cgf`, set **To Email** to `{{to_email}}`, **Subject** to `{{subject}}`, then use this as the message body:

```html
{{{email_html}}}
```

The three braces are important: they render the supplied HTML design instead of displaying it as text. If using a plain-text template, use `{{message}}` instead. Available context includes `variation`, `class_date`, `class_time`, `duration_min`, `fitness_level`, `repeat_label`, `notes`, `workout_list`, and `workout_html`.
