const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SPREADSHEET_ID = '13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M';
const KEY_FILE = path.join(__dirname, '..', 'business-512417-60e93e3837ee.json');

const RESTAURANTS = [
  'SAI DARSHAN',
  'SURYA',
  'SAI SAGAR',
  'GURUDAYA',
  'BHAGAT TARACHAND',
  'HIGHWAY TEA',
  'AISHANI ENTERPRISES-MAROL',
  'CHINA TOWN',
  'MANISHA BAR',
  'SHIVADI',
  'SINDH PUNJAB',
  'ICHIMI VEGETABLES POWAI',
  'LOCOMO',
  'LOCOMO EXPRESS'
];

const NEW_HEADERS = [
  'Invoice No.',
  'Date',
  'Total (Rs.)',
  'Tempo Hire (Rs.)',
  'Grand Total (Rs.)',
  'Payment Status',
  'Notes'
];

const HEADER_BG = { red: 0.22745098, green: 0.4117647, blue: 0.22352941 };
const HEADER_FG = { red: 1, green: 1, blue: 1 };
const TITLE_BG  = { red: 0.1451, green: 0.2784, blue: 0.1451 };

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Connecting to Google Sheets...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetMap = {};
  meta.data.sheets.forEach(s => {
    sheetMap[s.properties.title] = s.properties.sheetId;
  });

  for (const rName of RESTAURANTS) {
    const sheetId = sheetMap[rName];
    if (sheetId === undefined) {
      console.log(`Tab "${rName}" not found in sheet, skipping.`);
      continue;
    }

    try {
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${rName}'!A2:H2`
      });
      const curHeaders = headerRes.data.values ? headerRes.data.values[0] : [];
      const itemsIdx = curHeaders.findIndex(h => String(h).toLowerCase().includes('item'));

      const requests = [];

      if (itemsIdx >= 0) {
        console.log(`Deleting "Items Ordered" column (index ${itemsIdx}) from "${rName}"...`);
        requests.push({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: itemsIdx,
              endIndex: itemsIdx + 1
            }
          }
        });
      }

      // Re-format title row 1 to span exactly 7 columns
      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: NEW_HEADERS.length
          },
          rows: [{
            values: [
              {
                userEnteredFormat: {
                  backgroundColor: TITLE_BG,
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  textFormat: { foregroundColor: HEADER_FG, fontFamily: 'Montserrat', fontSize: 14, bold: true }
                },
                userEnteredValue: { stringValue: 'BIROBA VEGETABLE SUPPLIERS — ' + rName }
              },
              ...Array(NEW_HEADERS.length - 1).fill({ userEnteredFormat: { backgroundColor: TITLE_BG } })
            ]
          }],
          fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
        }
      });
      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: NEW_HEADERS.length
          },
          mergeType: 'MERGE_ALL'
        }
      });

      // Update row 2 headers
      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 0,
            endColumnIndex: NEW_HEADERS.length
          },
          rows: [{
            values: NEW_HEADERS.map(h => ({
              userEnteredFormat: {
                backgroundColor: HEADER_BG,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                textFormat: { foregroundColor: HEADER_FG, fontFamily: 'Montserrat', fontSize: 11, bold: true }
              },
              userEnteredValue: { stringValue: h }
            }))
          }],
          fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
        }
      });

      // Set clean column pixel widths
      const colWidths = [100, 110, 120, 120, 130, 140, 180];
      colWidths.forEach((px, ci) => {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: ci, endIndex: ci + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize'
          }
        });
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests }
      });

      console.log(`  ✓ Updated "${rName}" successfully (7 columns: ${NEW_HEADERS.join(', ')})`);
    } catch (err) {
      console.error(`  ✗ Error updating "${rName}":`, err.message);
    }
  }

  console.log('\nAll restaurant tabs updated in Google Sheets!');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
