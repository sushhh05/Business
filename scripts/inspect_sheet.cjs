const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M';
const KEY_FILE = path.join(__dirname, '..', 'business-512417-60e93e3837ee.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get spreadsheet metadata
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: false,
  });

  const spreadsheet = res.data;
  console.log('=== SPREADSHEET PROPERTIES ===');
  console.log('Title:', spreadsheet.properties.title);
  console.log('Locale:', spreadsheet.properties.locale);
  console.log('\n=== EXISTING SHEETS/TABS ===');

  spreadsheet.sheets.forEach(sheet => {
    const p = sheet.properties;
    console.log(`\nSheet: "${p.title}" (sheetId: ${p.sheetId}, index: ${p.index})`);
    if (p.tabColor) console.log('  Tab Color:', JSON.stringify(p.tabColor));
    if (p.tabColorStyle) console.log('  Tab Color Style:', JSON.stringify(p.tabColorStyle));
  });

  // Get header row data from the first sheet
  const firstSheetTitle = spreadsheet.sheets[0].properties.title;
  console.log(`\n=== HEADER ROW DATA from "${firstSheetTitle}" ===`);
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${firstSheetTitle}'!A1:Z5`,
  });
  if (dataRes.data.values) {
    dataRes.data.values.forEach((row, i) => {
      console.log(`Row ${i+1}:`, row);
    });
  }

  // Get formatting of the first sheet (first 3 rows)
  const fmtRes = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [`'${firstSheetTitle}'!A1:Z3`],
    includeGridData: true,
  });

  const gridData = fmtRes.data.sheets[0].data[0];
  if (gridData && gridData.rowData) {
    console.log('\n=== FORMATTING ===');
    gridData.rowData.slice(0, 3).forEach((row, ri) => {
      console.log(`\n-- Row ${ri+1} --`);
      if (row.values) {
        row.values.slice(0, 8).forEach((cell, ci) => {
          if (cell.userEnteredFormat) {
            const fmt = cell.userEnteredFormat;
            const bg = fmt.backgroundColor;
            const font = fmt.textFormat;
            const bold = font && font.bold;
            const fontSize = font && font.fontSize;
            const fontFamily = font && font.fontFamily;
            const fgColor = font && font.foregroundColor;
            console.log(`  Col ${ci}: bg=${JSON.stringify(bg)}, bold=${bold}, fontSize=${fontSize}, font=${fontFamily}, fg=${JSON.stringify(fgColor)}`);
          }
        });
      }
    });
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
