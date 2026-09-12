const SENDER_NAME  = 'FitPulse';
const FOLDER_NAME  = 'FitPulse Reminders';
const SHEET_NAME   = 'Reminders';

const FIREBASE_BASE = 'https://fitpulse-bca3b-default-rtdb.asia-southeast1.firebasedatabase.app';

const NAVY       = '#1A2530';
const ORANGE     = '#FF6B35';
const PINK       = '#FF3D81';
const LIGHT_GRAY = '#F5F7FA';
const DARK_GRAY  = '#333333';

const VARIATION_EMOJI = {
  'Yoga Flow':           '🧘',
  'HIIT Blast':          '🔥',
  'Strength Builder':    '💪',
  'Cardio Sprint':       '🏃',
  'Mobility & Stretch':  '🤍',
  'Core Pilates':        '🤸',
  'Spin Endurance':      '🚴',
  'Dance Cardio':        '💃'
};

function doGet() {
  return jsonResponse({
    status: 'ok',
    service: 'FitPulse backend',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (data.action === 'delete') {
      return handleDelete(data);
    }

    if (!data.email || !data.date || !data.time) {
      return jsonResponse({ status: 'error', message: 'Missing email, date or time.' });
    }

    if (data.sendNow) {
      return handleSendNow(data);
    }
    return handleScheduled(data);
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function handleSendNow(data) {
  const result = buildReminderDoc(data);
  sendReminderEmail(data, result.pdfBlob);
  logToSheet(data, result.docUrl, result.pdfUrl, 'sent', null);
  updateFirebaseStatus(data.id, 'sent');
  return jsonResponse({
    status: 'success',
    mode: 'now',
    reminderId: data.id,
    emailedTo: data.email,
    docUrl: result.docUrl,
    pdfUrl: result.pdfUrl
  });
}

function handleScheduled(data) {
  const when = parseScheduledDate(data.date, data.time);
  if (!when) {
    return jsonResponse({ status: 'error', message: 'Invalid date or time.' });
  }

  if (when.getTime() < Date.now() - 60 * 1000) {
    return jsonResponse({ status: 'error', message: 'Pick a time in the future.' });
  }

  logToSheet(data, '', '', 'pending', when);

  return jsonResponse({
    status: 'success',
    mode: 'scheduled',
    reminderId: data.id,
    scheduledFor: when.toISOString()
  });
}

function handleDelete(data) {
  const id = String(data.id || '').trim();
  if (!id) {
    return jsonResponse({ status: 'error', message: 'Missing reminder id.' });
  }

  try {
    const sheet = getSheet();
    const range = sheet.getDataRange();
    const rows = range.getValues();

    let deleted = false;
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][1] || '').trim() === id) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    return jsonResponse({
      status: 'success',
      deleted: deleted,
      id: id
    });
  } catch (err) {
    console.error('Delete failed for ' + id + ':', err);
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function processPendingReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const sheet = getSheet();
    const range = sheet.getDataRange();
    const rows = range.getValues();
    if (rows.length < 2) return;

    const now = new Date();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = String(row[13] || '').trim();
      if (status !== 'pending') continue;

      const nextRun = row[14];
      if (!(nextRun instanceof Date)) continue;
      if (nextRun.getTime() > now.getTime()) continue;

      try {
        sendDueRow(row, i + 1, sheet);
      } catch (err) {
        console.error('Send failed for row ' + (i + 1) + ':', err);
        sheet.getRange(i + 1, 14).setValue('error');
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function sendDueRow(row, sheetRow, sheet) {
  const data = {
    id:                row[1],
    name:              row[2],
    email:             row[3],
    variation:         row[4],
    variationKey:      row[5],
    variationEmoji:    VARIATION_EMOJI[row[4]] || '✨',
    date:              toDateString(row[6]),
    time:              toTimeString(row[7]),
    repeat:            row[8] || 'Once',
    level:             row[9] || '',
    duration:          row[10] || 45,
    notes:             row[11] || '',
    exercises:         safeJson(row[12]),
    timezoneOffsetMinutes: Number(row[15]) || 0
  };

  const result = buildReminderDoc(data);
  sendReminderEmail(data, result.pdfBlob);

  sheet.getRange(sheetRow, 17).setValue(result.docUrl);
  sheet.getRange(sheetRow, 18).setValue(result.pdfUrl);

  const nextRun = computeNextRun(row[14], data.repeat);

  if (nextRun) {
    sheet.getRange(sheetRow, 15).setValue(nextRun);
    sheet.getRange(sheetRow, 14).setValue('pending');
  } else {
    sheet.getRange(sheetRow, 14).setValue('sent');
  }

  updateFirebaseStatus(data.id, nextRun ? 'pending' : 'sent');
}

function computeNextRun(currentRun, repeat) {
  if (!repeat || repeat === 'Once') return null;
  if (!(currentRun instanceof Date)) return null;

  const next = new Date(currentRun.getTime());

  if (repeat === 'Daily') {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (repeat === 'Weekdays') {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
    return next;
  }
  if (repeat === 'Weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  return null;
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processPendingReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('processPendingReminders')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('Trigger installed — processPendingReminders will run every minute.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processPendingReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('Trigger removed.');
}

function showTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const active = triggers.filter(function (t) {
    return t.getHandlerFunction() === 'processPendingReminders';
  });
  Logger.log(active.length > 0
    ? 'Active — ' + active.length + ' trigger(s) installed.'
    : 'No trigger installed. Run setupTrigger() once.');
}

function buildReminderDoc(data) {
  const folder = getOrCreateFolder();
  const userName = data.name || 'User';

  const doc = DocumentApp.create('FitPulse Reminder - ' + userName + ' - ' + data.date);
  const body = doc.getBody();

  body.setMarginTop(54);
  body.setMarginBottom(54);
  body.setMarginLeft(72);
  body.setMarginRight(72);

  const header = body.appendParagraph('FITPULSE');
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1)
        .setFontFamily('Georgia')
        .setFontSize(28)
        .setForegroundColor(ORANGE)
        .setBold(true)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
        .setSpacingBefore(0)
        .setSpacingAfter(6);

  const tagline = body.appendParagraph('Personal workout reminders, delivered on time');
  tagline.setFontFamily('Arial')
         .setFontSize(10)
         .setItalic(true)
         .setForegroundColor('#999999')
         .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
         .setSpacingAfter(12);

  const subHeader = body.appendParagraph(
    (data.variation || 'Workout') + '   ·   ' + formatMediumDate(data.date) + '   ·   ' + formatTime12(data.time)
  );
  subHeader.setFontFamily('Arial')
           .setFontSize(11.5)
           .setForegroundColor(PINK)
           .setBold(true)
           .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
           .setSpacingAfter(6);

  body.appendHorizontalRule();

  addSectionHeading(body, 'REMINDER DETAILS');

  const detailsData = [
    ['Name',          data.name || '—'],
    ['Email',         data.email || '—'],
    ['Variation',     (data.variationEmoji || '') + ' ' + (data.variation || '—')],
    ['Date',          formatMediumDate(data.date)],
    ['Time',          formatTime12(data.time)],
    ['Repeat',        data.repeat || 'Once'],
    ['Fitness level', data.level || '—'],
    ['Duration',      (data.duration || 45) + ' minutes'],
    ['Notes',         data.notes || 'None']
  ];

  const detailsTable = body.appendTable(detailsData);
  detailsTable.setBorderWidth(0);
  for (let i = 0; i < detailsTable.getNumRows(); i++) {
    const row = detailsTable.getRow(i);
    row.getCell(0).setWidth(150).setBackgroundColor(LIGHT_GRAY);
    row.getCell(0).setPaddingTop(10).setPaddingBottom(10)
        .setPaddingLeft(14).setPaddingRight(14);
    row.getCell(0).editAsText()
        .setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor(DARK_GRAY);
    row.getCell(1).setPaddingTop(10).setPaddingBottom(10).setPaddingLeft(16);
    row.getCell(1).editAsText()
        .setFontFamily('Arial').setFontSize(10.5).setForegroundColor(DARK_GRAY);
  }

  body.appendParagraph('').setSpacingAfter(4);

  addSectionHeading(body, 'YOUR RECOMMENDED WORKOUT');

  const exercises = data.exercises || [];

  if (exercises.length === 0) {
    const empty = body.appendParagraph('Your session plan will be provided at the time of your workout.');
    empty.setFontFamily('Arial').setFontSize(10.5)
         .setForegroundColor(DARK_GRAY).setLineSpacing(1.4);
  } else {
    exercises.forEach(function (ex, idx) {
      const title = body.appendParagraph((idx + 1) + '.  ' + titleCase(ex.name || 'Exercise'));
      title.setFontFamily('Georgia')
           .setFontSize(14)
           .setBold(true)
           .setForegroundColor(NAVY)
           .setSpacingBefore(idx === 0 ? 16 : 26)
           .setSpacingAfter(10);

      const imageBlob = fetchImageBlob(ex.image);
      if (imageBlob) {
        try {
          const img = body.appendImage(imageBlob);
          img.setWidth(180);
          img.setHeight(135);
          body.appendParagraph('').setSpacingAfter(6);
        } catch (err) {
          console.warn('Image embed failed for ' + ex.name + ': ' + err);
        }
      }

      const meta = body.appendParagraph(
        'Focus: ' + (ex.muscle || '—') +
        '   ·   Equipment: ' + (ex.equipment || '—') +
        '   ·   Level: ' + (ex.difficulty || '—')
      );
      meta.setFontFamily('Arial').setFontSize(9.5)
          .setForegroundColor(DARK_GRAY).setSpacingAfter(12);

      const label = body.appendParagraph('How to do it');
      label.setFontFamily('Arial').setFontSize(10).setBold(true)
           .setForegroundColor(ORANGE).setSpacingAfter(5);

      const inst = body.appendParagraph(
        (ex.instructions && String(ex.instructions).trim())
          ? String(ex.instructions)
          : 'Perform the movement with controlled form. Breathe steadily — exhale on the effort, inhale on the return.'
      );
      inst.setFontFamily('Arial').setFontSize(10.5)
          .setForegroundColor(DARK_GRAY).setLineSpacing(1.55).setSpacingAfter(8);
    });
  }

  if (data.quote && data.quote.text) {
    body.appendHorizontalRule();
    body.appendParagraph('').setSpacingAfter(6);

    const quote = body.appendParagraph('"' + data.quote.text + '"');
    quote.setFontFamily('Georgia').setFontSize(12).setItalic(true)
         .setForegroundColor(NAVY)
         .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
         .setLineSpacing(1.55).setSpacingAfter(8);

    const author = body.appendParagraph('— ' + (data.quote.author || 'Unknown'));
    author.setFontFamily('Arial').setFontSize(9).setForegroundColor('#999999')
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(0);
  }

  body.appendParagraph('').setSpacingAfter(12);
  const mot = body.appendParagraph('Hydrate. Warm up. Show up.');
  mot.setFontFamily('Georgia').setFontSize(13).setBold(true)
     .setForegroundColor(ORANGE)
     .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(0);

  body.appendParagraph('').setSpacingAfter(24);

  const dateLine = body.appendParagraph(
    'Generated automatically on ' + new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  );
  dateLine.setFontFamily('Arial').setFontSize(8.5).setForegroundColor('#999999')
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(4);

  const brandLine = body.appendParagraph('FitPulse  ·  Personal workout reminders');
  brandLine.setFontFamily('Arial').setFontSize(8.5).setForegroundColor('#999999')
           .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(0);

  doc.saveAndClose();
  Utilities.sleep(1500);

  const docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(folder);

  const pdfBlob = docFile.getAs(MimeType.PDF)
                        .setName('FitPulse-Reminder-' + (data.id || Date.now()) + '.pdf');
  const pdfFile = folder.createFile(pdfBlob);

  return {
    docUrl: docFile.getUrl(),
    pdfUrl: pdfFile.getUrl(),
    pdfBlob: pdfBlob
  };
}

function addSectionHeading(body, text) {
  const heading = body.appendParagraph(text);
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2)
         .setFontFamily('Georgia')
         .setFontSize(13)
         .setForegroundColor(NAVY)
         .setBold(true)
         .setSpacingBefore(24)
         .setSpacingAfter(14);
  return heading;
}

function fetchImageBlob(url) {
  if (!url) return null;
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    return res.getBlob();
  } catch (err) {
    console.warn('fetchImageBlob failed: ' + err);
    return null;
  }
}

function sendReminderEmail(data, pdfBlob) {
  const firstName = (data.name || 'there').split(' ')[0];
  const subject = 'Your FitPulse workout reminder — ' +
                  (data.variation || 'Workout') + ' on ' + formatMediumDate(data.date);

  GmailApp.sendEmail(
    data.email,
    subject,
    'Hi ' + firstName + ', your workout reminder is ready. The PDF plan is attached.',
    {
      htmlBody: buildEmailBody(data, firstName),
      attachments: [pdfBlob],
      name: SENDER_NAME,
      replyTo: data.email
    }
  );
}

function buildEmailBody(data, firstName) {
  const quote = (data.quote && data.quote.text)
    ? '<div style="margin-top:22px;padding:16px 18px;border-radius:12px;background:#1a1a20;border-left:3px solid #ff6b35;">' +
        '<div style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:#fff;line-height:1.6;">"' +
          esc(data.quote.text) +
        '"</div>' +
        '<div style="margin-top:6px;font-size:11px;color:#a4a4b0;">— ' +
          esc(data.quote.author || 'Unknown') +
        '</div>' +
      '</div>'
    : '';

  return '' +
    '<div style="font-family:Arial,sans-serif;background:#101014;padding:32px 14px;color:#fff;">' +
      '<div style="max-width:600px;margin:auto;background:#101014;border:1px solid #2a2a33;border-radius:16px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#ff6b35,#ff3d81);padding:28px 32px;">' +
          '<div style="font-size:22px;font-weight:900;color:#fff;">FitPulse</div>' +
          '<div style="margin-top:6px;font-size:14px;opacity:0.9;color:#fff;">Your workout reminder is ready</div>' +
        '</div>' +
        '<div style="padding:28px 32px;">' +
          '<div style="font-size:16px;font-weight:700;color:#fff;">Hey ' + esc(firstName) + ',</div>' +
          '<p style="margin-top:10px;color:#a4a4b0;line-height:1.7;">' +
            'Your <b style="color:#fff;">' + esc(data.variation || 'workout') + '</b> plan is attached as a PDF. ' +
            'It includes reference photos and step-by-step instructions for each exercise.' +
          '</p>' +
          '<div style="margin-top:20px;padding:16px 18px;background:#1a1a20;border:1px solid #2a2a33;border-radius:12px;">' +
            '<div style="font-size:11px;font-weight:800;color:#a4a4b0;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Reminder Details</div>' +
            '<div style="font-size:14px;line-height:1.9;color:#fff;">' +
              '<b>When:</b> ' + esc(formatMediumDate(data.date)) + ' at ' + esc(formatTime12(data.time)) + '<br>' +
              '<b>Repeat:</b> ' + esc(data.repeat || 'Once') + '<br>' +
              '<b>Level:</b> ' + esc(data.level || '') + ' · ' + esc(String(data.duration || 45)) + ' min' +
            '</div>' +
          '</div>' +
          quote +
          '<div style="margin-top:24px;text-align:center;color:#6a6a75;font-size:12px;">' +
            'FitPulse · Personal workout reminders' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function logToSheet(data, docUrl, pdfUrl, status, nextRun) {
  const sheet = getSheet();
  sheet.appendRow([
    new Date(),
    data.id || makeId(),
    data.name || '',
    data.email || '',
    data.variation || '',
    data.variationKey || '',
    data.date || '',
    data.time || '',
    data.repeat || 'Once',
    data.level || '',
    data.duration || '',
    data.notes || '',
    JSON.stringify(data.exercises || []),
    status || 'pending',
    nextRun || null,
    Number(data.timezoneOffsetMinutes) || 0,
    docUrl || '',
    pdfUrl || ''
  ]);
}

function getOrCreateFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function getSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');

  if (id) {
    try {
      const sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
      ensureSheetColumns(sheet);
      return sheet;
    } catch (_) {}
  }

  const ss = SpreadsheetApp.create('FitPulse Reminders');
  props.setProperty('SHEET_ID', ss.getId());

  const sheet = ss.getSheets()[0].setName(SHEET_NAME);
  sheet.appendRow([
    'Received At', 'ID', 'Name', 'Email', 'Variation', 'Variation Key',
    'Date', 'Time', 'Repeat', 'Level', 'Duration', 'Notes',
    'Exercises (JSON)', 'Status', 'Next Run', 'TZ Offset (min)',
    'Document URL', 'PDF URL'
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSheetColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, 18).getValues()[0];
  if (!headers[16]) sheet.getRange(1, 17).setValue('Document URL');
  if (!headers[17]) sheet.getRange(1, 18).setValue('PDF URL');
}

function updateFirebaseStatus(id, status) {
  if (!id) return;
  try {
    const url = FIREBASE_BASE + '/reminders/' + encodeURIComponent(id) + '.json';
    const payload = { status: status };
    if (status === 'sent') payload.sentAt = Date.now();

    UrlFetchApp.fetch(url, {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.warn('Firebase status sync failed for ' + id + ': ' + err);
  }
}

function parseScheduledDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(dateStr + 'T' + timeStr + ':00');
  return isNaN(d) ? null : d;
}

function toDateString(v) {
  if (v instanceof Date) {
    const p = function (n) { return String(n).padStart(2, '0'); };
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
  }
  return String(v || '');
}

function toTimeString(v) {
  if (v instanceof Date) {
    const p = function (n) { return String(n).padStart(2, '0'); };
    return p(v.getHours()) + ':' + p(v.getMinutes());
  }
  return String(v || '');
}

function safeJson(str) {
  try { return JSON.parse(str || '[]'); }
  catch (_) { return []; }
}

function formatTime12(hhmm) {
  if (!hhmm) return '—';
  const parts = String(hhmm).split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return hhmm;

  const suffix = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
}

function formatMediumDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function titleCase(str) {
  return String(str || '').toLowerCase().split(/\s+/).filter(Boolean)
    .map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeId() {
  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  return 'FP-' + stamp + '-' + Math.floor(1000 + Math.random() * 9000);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function testBackend() {
  const fakeData = {
    id: 'FP-TEST-' + Math.floor(1000 + Math.random() * 9000),
    name: 'Test User',
    email: 'any-gmail-address@gmail.com',
    variation: 'Strength Builder',
    variationEmoji: '💪',
    date: '2026-09-15',
    time: '07:00',
    repeat: 'Weekdays',
    level: 'Intermediate',
    duration: 50,
    notes: 'Focus on form today',
    quote: {
      text: 'Discipline is the bridge between goals and accomplishment.',
      author: 'Jim Rohn'
    },
    exercises: [
      {
        name: 'Pull-ups',
        muscle: 'Lats',
        equipment: 'Pull-up Bar',
        difficulty: 'Intermediate',
        image: 'https://wger.de/media/exercise-images/91/Pull-ups-1.png',
        instructions: 'Hang from a bar with an overhand grip slightly wider than shoulder width. ' +
                      'Pull your chest up toward the bar by driving your elbows down and back. ' +
                      'Lower yourself under control until your arms are fully extended, then repeat.'
      },
      {
        name: 'Push-ups',
        muscle: 'Chest',
        equipment: 'Bodyweight',
        difficulty: 'Beginner',
        image: 'https://wger.de/media/exercise-images/100/Push-ups-1.png',
        instructions: 'Start in a plank position with hands slightly wider than your shoulders. ' +
                      'Lower your body until your chest nearly touches the floor, keeping your core tight. ' +
                      'Push back up to the starting position.'
      }
    ],
    timezoneOffsetMinutes: -480
  };

  const result = buildReminderDoc(fakeData);
  sendReminderEmail(fakeData, result.pdfBlob);
  Logger.log('Sent to: ' + fakeData.email);
  Logger.log('Doc URL: ' + result.docUrl);
  Logger.log('PDF URL: ' + result.pdfUrl);
}

function testScheduledQueue() {
  const fakeData = {
    id: 'FP-QUEUE-' + Math.floor(1000 + Math.random() * 9000),
    name: 'Queue Test',
    email: 'any-gmail-address@gmail.com',
    variation: 'HIIT Blast',
    variationKey: 'hiit',
    date: '2026-09-15',
    time: '07:00',
    repeat: 'Once',
    level: 'Intermediate',
    duration: 30,
    notes: 'Queued test',
    exercises: [],
    timezoneOffsetMinutes: -480
  };

  const when = parseScheduledDate(fakeData.date, fakeData.time);
  logToSheet(fakeData, '', '', 'pending', when);
  Logger.log('Queued row. It will fire at ' + when.toString());
}

function processNow() {
  processPendingReminders();
  Logger.log('processPendingReminders() ran.');
}