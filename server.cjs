/**
 * Biroba Vegetable Suppliers — Google Sheets Sync Server
 * Runs locally on port 3001. Vite proxies /api/* here.
 */
const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
app.use(express.json({ limit: '5mb' }));

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M';
const fs = require('fs');

const HEADER_BG  = { red: 0.22745098, green: 0.4117647,  blue: 0.22352941 };
const HEADER_FG  = { red: 1,          green: 1,          blue: 1          };
const DATA_FG    = { red: 0.09411765, green: 0.11372549, blue: 0.08627451 };
const DATA_BG    = { red: 1,          green: 1,          blue: 1          };
const ALT_ROW_BG = { red: 0.93,       green: 0.96,       blue: 0.93       };
const TITLE_BG   = { red: 0.1451,     green: 0.2784,     blue: 0.1451     };

const RESTAURANT_HEADERS = [
  'Invoice No.', 'Date',
  'Total (Rs.)', 'Tempo Hire (Rs.)', 'Grand Total (Rs.)',
  'Payment Status', 'Notes'
];
const LEDGER_SHEET = 'Daily Invoice Ledger';

async function getSheets() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim();
      credentials = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (_) {}
  }

  const localKeyPath = path.join(__dirname, 'business-512417-60e93e3837ee.json');
  if (!credentials && fs.existsSync(localKeyPath)) {
    const auth = new google.auth.GoogleAuth({ keyFile: localKeyPath, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return google.sheets({ version: 'v4', auth });
  }

  if (credentials) {
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return google.sheets({ version: 'v4', auth });
  }

  throw new Error('Google Service Account key not found.');
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.00$/, '');
}
function buildItemsSummary(rec, catalog) {
  if (!catalog || !rec.items) return '';
  return catalog.filter(v => {
    const it = rec.items[v.id];
    if (!it) return false;
    return (parseFloat(it.weight) > 0) || (parseFloat(it.amount) > 0);
  }).map(v => {
    const it = rec.items[v.id];
    let s = v.name;
    if (parseFloat(it.weight) > 0) s += `:${it.weight}${it.mode === 'per_100' ? 'pcs' : 'kg'}`;
    if (it.rate && it.mode !== 'lump_sum' && it.mode !== 'free') s += `@Rs.${it.rate}`;
    if (parseFloat(it.amount) > 0 && it.mode !== 'free') s += `=Rs.${fmtMoney(it.amount)}`;
    if (it.mode === 'free') s += '(FREE)';
    return s;
  }).join(' | ');
}
function computeSubtotal(rec, catalog) {
  let sub = 0;
  if (!rec.items || !catalog) return 0;
  catalog.forEach(v => { const a = parseFloat((rec.items[v.id] || {}).amount); if (!isNaN(a) && a > 0) sub += a; });
  return Math.round(sub * 100) / 100;
}

async function getSheetMeta(sheets) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, includeGridData: false });
  const map = {};
  res.data.sheets.forEach(s => { map[s.properties.title] = s.properties.sheetId; });
  return map;
}

async function createRestaurantTab(sheets, name) {
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: name, tabColor: HEADER_BG, gridProperties: { rowCount: 500, columnCount: RESTAURANT_HEADERS.length } } } }] }
  });
  const sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  const fmtReqs = [
    { updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: RESTAURANT_HEADERS.length }, rows: [{ values: [{ userEnteredFormat: { backgroundColor: TITLE_BG, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { foregroundColor: HEADER_FG, fontFamily: 'Montserrat', fontSize: 14, bold: true } }, userEnteredValue: { stringValue: 'BIROBA VEGETABLE SUPPLIERS — ' + name } }, ...Array(RESTAURANT_HEADERS.length - 1).fill({ userEnteredFormat: { backgroundColor: TITLE_BG } })] }], fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)' } },
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: RESTAURANT_HEADERS.length }, mergeType: 'MERGE_ALL' } },
    { updateCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: RESTAURANT_HEADERS.length }, rows: [{ values: RESTAURANT_HEADERS.map(h => ({ userEnteredFormat: { backgroundColor: HEADER_BG, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { foregroundColor: HEADER_FG, fontFamily: 'Montserrat', fontSize: 11, bold: true } }, userEnteredValue: { stringValue: h } })) }], fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)' } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } },
    ...[100, 110, 120, 120, 130, 140, 180].map((px, ci) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: ci, endIndex: ci+1 }, properties: { pixelSize: px }, fields: 'pixelSize' } }))
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: fmtReqs } });
  console.log('  Created tab:', name);
  return sheetId;
}

async function findRowByInvoiceNo(sheets, sheetTitle, invoiceNo) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetTitle}'!A:A` });
    const vals = res.data.values || [];
    for (let i = 2; i < vals.length; i++) {
      if (vals[i] && vals[i][0] && String(vals[i][0]).trim() === String(invoiceNo).trim()) return i + 1;
    }
  } catch (_) {}
  return null;
}

async function writeInvoiceToRestaurantTab(sheets, tabName, rec, catalog) {
  const subtotal = computeSubtotal(rec, catalog);
  const tempo = parseFloat(rec.tempoHire) || 0;
  const grand = Math.round((subtotal + tempo) * 100) / 100;
  const rowValues = [String(rec.invoiceNo || ''), fmtDate(rec.date), fmtMoney(subtotal), tempo > 0 ? fmtMoney(tempo) : '', fmtMoney(grand), rec.paymentStatus || '', ''];

  const existingRow = await findRowByInvoiceNo(sheets, tabName, rec.invoiceNo);
  if (existingRow) {
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${tabName}'!A${existingRow}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [rowValues] } });
    console.log(`  Updated row ${existingRow} in "${tabName}" #${rec.invoiceNo}`);
    return { action: 'updated', row: existingRow };
  } else {
    const appendRes = await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `'${tabName}'!A3`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [rowValues] } });
    try {
      const match = (appendRes.data.updates.updatedRange || '').match(/!A(\d+)/);
      if (match) {
        const ri = parseInt(match[1], 10) - 1;
        const meta = await getSheetMeta(sheets);
        const sid = meta[tabName];
        if (sid !== undefined) {
          const bg = (ri % 2 === 0) ? DATA_BG : ALT_ROW_BG;
          await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ repeatCell: { range: { sheetId: sid, startRowIndex: ri, endRowIndex: ri+1, startColumnIndex: 0, endColumnIndex: RESTAURANT_HEADERS.length }, cell: { userEnteredFormat: { backgroundColor: bg, verticalAlignment: 'MIDDLE', textFormat: { foregroundColor: DATA_FG, fontFamily: 'Roboto', fontSize: 10 } } }, fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)' } }] } });
        }
      }
    } catch (e) { console.warn('Row fmt warn:', e.message); }
    console.log(`  Appended to "${tabName}" #${rec.invoiceNo}`);
    return { action: 'appended' };
  }
}

async function writeToLedger(sheets, rec, catalog) {
  const subtotal = computeSubtotal(rec, catalog);
  const tempo = parseFloat(rec.tempoHire) || 0;
  const grand = Math.round((subtotal + tempo) * 100) / 100;
  const itemCount = catalog.filter(v => { const it = rec.items && rec.items[v.id]; return it && (parseFloat(it.weight) > 0 || parseFloat(it.amount) > 0); }).length;
  const row = [String(rec.invoiceNo || ''), fmtDate(rec.date), rec.customerName || '', itemCount, fmtMoney(grand), rec.paymentStatus || ''];
  const existingRow = await findRowByInvoiceNo(sheets, LEDGER_SHEET, rec.invoiceNo);
  if (existingRow) {
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `'${LEDGER_SHEET}'!A${existingRow}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
    console.log(`  Updated ledger row ${existingRow}`);
  } else {
    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `'${LEDGER_SHEET}'!A4`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
    console.log(`  Appended to ledger`);
  }
}

app.post('/api/save-invoice', async (req, res) => {
  const { rec, catalog } = req.body;
  if (!rec || !rec.customerName) return res.status(400).json({ ok: false, error: 'Missing rec or customerName' });
  console.log(`\nSyncing invoice #${rec.invoiceNo} for "${rec.customerName}"...`);
  try {
    const sheets = await getSheets();
    const meta = await getSheetMeta(sheets);
    const tabName = rec.customerName.trim().toUpperCase();
    if (meta[tabName] === undefined) { console.log('  Creating tab:', tabName); await createRestaurantTab(sheets, tabName); }
    const tabResult = await writeInvoiceToRestaurantTab(sheets, tabName, rec, catalog);
    await writeToLedger(sheets, rec, catalog);
    console.log('  Sync done!');
    res.json({ ok: true, tabResult });
  } catch (err) {
    console.error('  Sheets error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'Biroba Sheets Sync' }));

app.listen(3001, () => {
  console.log('\nBiroba Sheets Sync Server running on http://localhost:3001\n');
});
