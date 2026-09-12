const CUP_SPREADSHEET_ID = '1l7PxRwHvRsCnj7DOsex2UcTqmcsPdTsjTqn7ltKkQ7M';
const CUP_SCHEMA_VERSION = '1.0';

/**
 * Cup backend for the private Google Sheet named "Cup".
 * Deploy as a Web App: Execute as Me; Who has access: Anyone.
 * The public URL is protected by a long API key stored in Script Properties.
 * Raw photos are NEVER accepted or stored by this backend.
 */

function setupCup() {
  const ss = SpreadsheetApp.openById(CUP_SPREADSHEET_ID);
  ensureCupSheets_(ss);
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('CUP_API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('CUP_API_KEY', key);
  }
  console.log('Cup backend ready.');
  console.log('Spreadsheet: ' + ss.getUrl());
  console.log('API KEY: ' + key);
  return { ok: true, spreadsheetUrl: ss.getUrl(), apiKey: key };
}

function rotateCupApiKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('CUP_API_KEY', key);
  console.log('NEW CUP API KEY: ' + key);
  return key;
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font:16px system-ui;background:#111;color:#eee;padding:32px;max-width:720px;margin:auto}b{color:#ffb04a}</style></head>' +
    '<body><h1>Cup backend</h1><p><b>Online.</b> This endpoint stores measurements only. It does not accept body photographs.</p></body></html>'
  );
}

function doPost(e) {
  let response;
  let nonce = '';
  try {
    const p = (e && e.parameter) || {};
    nonce = String(p.nonce || '');
    authorize_(String(p.apiKey || ''));
    const action = String(p.action || '');

    if (action === 'saveSession') {
      const data = JSON.parse(String(p.payload || '{}'));
      response = saveSession_(data);
    } else if (action === 'saveBra') {
      const data = JSON.parse(String(p.payload || '{}'));
      response = saveBra_(data);
    } else {
      throw new Error('Unknown action.');
    }
  } catch (err) {
    response = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  const safe = JSON.stringify({ type: 'cup-backend-response', nonce: nonce, response: response })
    .replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>' +
    'parent.postMessage(' + safe + ', "*");' +
    '</script></body></html>'
  );
}

function authorize_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('CUP_API_KEY');
  if (!expected) throw new Error('Cup backend has not been initialized. Run setupCup().');
  if (!provided || provided !== expected) throw new Error('Unauthorized.');
}

function saveSession_(d) {
  validateNoImagePayload_(d);
  const ss = SpreadsheetApp.openById(CUP_SPREADSHEET_ID);
  const sh = ss.getSheetByName('Sessions');
  if (!sh) throw new Error('Sessions sheet is missing.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const id = sanitizeText_(d.sessionId || Utilities.getUuid(), 80);
    const row = [
      id,
      new Date(),
      sanitizeText_(d.person || 'Alissa', 80),
      num_(d.frontBustWidth),
      num_(d.frontUnderbustWidth),
      num_(d.sideBustDepth),
      num_(d.sideUnderbustDepth),
      num_(d.estimatedBustCirc),
      num_(d.estimatedUnderbustCirc),
      num_(d.snugUnderbust),
      num_(d.standingBust),
      num_(d.leaningBust),
      num_(d.projection),
      num_(d.rootWidth),
      num_(d.centerSpacing),
      sanitizeText_(d.suggestedBand, 24),
      sanitizeText_(d.cupFamily, 32),
      pct_(d.confidence),
      sanitizeText_(d.notes, 800),
      sanitizeText_(d.source || 'Cup iPhone web app', 80),
      CUP_SCHEMA_VERSION
    ];
    sh.appendRow(row);
    const r = sh.getLastRow();
    sh.getRange(r, 2).setNumberFormat('m/d/yyyy h:mm:ss AM/PM');
    sh.getRange(r, 4, 1, 12).setNumberFormat('0.00');
    sh.getRange(r, 18).setNumberFormat('0%');
    return { ok: true, sessionId: id, row: r };
  } finally {
    lock.releaseLock();
  }
}

function saveBra_(d) {
  validateNoImagePayload_(d);
  const ss = SpreadsheetApp.openById(CUP_SPREADSHEET_ID);
  const sh = ss.getSheetByName('Bras');
  if (!sh) throw new Error('Bras sheet is missing.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const row = [
      new Date(),
      sanitizeText_(d.brand, 100),
      sanitizeText_(d.style, 160),
      sanitizeText_(d.printedSize, 40),
      sanitizeText_(d.fitRating, 40),
      num_(d.bandUnstretched),
      num_(d.bandStretched),
      num_(d.cupWidth),
      num_(d.cupDepth),
      num_(d.wireLength),
      num_(d.goreHeight),
      num_(d.goreWidth),
      sanitizeText_(d.notes, 800),
      sanitizeText_(d.sessionId, 80)
    ];
    sh.appendRow(row);
    const r = sh.getLastRow();
    sh.getRange(r, 1).setNumberFormat('m/d/yyyy h:mm:ss AM/PM');
    sh.getRange(r, 6, 1, 7).setNumberFormat('0.00');
    return { ok: true, row: r };
  } finally {
    lock.releaseLock();
  }
}

function validateNoImagePayload_(obj) {
  const raw = JSON.stringify(obj || {});
  if (raw.length > 30000) throw new Error('Payload is too large. Cup stores measurements only.');
  if (/data:image|base64|blob:/i.test(raw)) throw new Error('Image data is not permitted by the Cup backend.');
}

function num_(v) {
  if (v === '' || v === null || typeof v === 'undefined') return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : '';
}

function pct_(v) {
  if (v === '' || v === null || typeof v === 'undefined') return '';
  let n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (n > 1) n /= 100;
  return Math.max(0, Math.min(1, n));
}

function sanitizeText_(v, maxLen) {
  if (v === null || typeof v === 'undefined') return '';
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen || 500);
}

function ensureCupSheets_(ss) {
  const sessionsHeaders = ['Session ID','Timestamp','Person','Front Bust Width (in)','Front Underbust Width (in)','Side Bust Depth (in)','Side Underbust Depth (in)','Estimated Bust Circ. (in)','Estimated Underbust Circ. (in)','Snug Underbust (in)','Standing Bust (in)','Leaning Bust (in)','Projection (in)','Root Width (in)','Center Spacing (in)','Suggested Band','Cup Family','Confidence %','Notes','Source','Schema Version'];
  const brasHeaders = ['Added','Brand','Style / Model','Printed Size','Fit Rating','Band Unstretched (in)','Band Stretched (in)','Cup Width (in)','Cup Depth (in)','Wire Length (in)','Gore Height (in)','Gore Width (in)','Notes','Session ID'];

  let sessions = ss.getSheetByName('Sessions');
  if (!sessions) sessions = ss.insertSheet('Sessions');
  if (!sessions.getRange(1, 1).getValue()) sessions.getRange(1, 1, 1, sessionsHeaders.length).setValues([sessionsHeaders]);

  let bras = ss.getSheetByName('Bras');
  if (!bras) bras = ss.insertSheet('Bras');
  if (!bras.getRange(1, 1).getValue()) bras.getRange(1, 1, 1, brasHeaders.length).setValues([brasHeaders]);

  let settings = ss.getSheetByName('Settings');
  if (!settings) settings = ss.insertSheet('Settings');
}
