const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M';
const KEY_FILE = path.join(__dirname, '..', 'business-512417-60e93e3837ee.json');

// All restaurants from the web app
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

// Exact theme from existing sheet
const HEADER_BG = { red: 0.22745098, green: 0.4117647, blue: 0.22352941 };
const HEADER_FG = { red: 1, green: 1, blue: 1 };
const DATA_FG   = { red: 0.09411765, green: 0.11372549, blue: 0.08627451 };
const DATA_BG   = { red: 1, green: 1, blue: 1 };
const ALT_ROW_BG = { red: 0.93, green: 0.96, blue: 0.93 }; // soft green tint for alternating rows

// Header columns matching the Daily Invoice Ledger structure
const HEADERS = [
  'Invoice No.',
  'Date',
  'Total (Rs.)',
  'Tempo Hire (Rs.)',
  'Grand Total (Rs.)',
  'Payment Status',
  'Notes'
];

function headerCellFormat(colIndex) {
  return {
    userEnteredFormat: {
      backgroundColor: HEADER_BG,
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      textFormat: {
        foregroundColor: HEADER_FG,
        fontFamily: 'Montserrat',
        fontSize: 11,
        bold: true
      },
      borders: {
        top:    { style: 'SOLID', width: 1, color: { red: 0.15, green: 0.3, blue: 0.15 } },
        bottom: { style: 'SOLID', width: 1, color: { red: 0.15, green: 0.3, blue: 0.15 } },
        left:   { style: 'SOLID', width: 1, color: { red: 0.15, green: 0.3, blue: 0.15 } },
        right:  { style: 'SOLID', width: 1, color: { red: 0.15, green: 0.3, blue: 0.15 } }
      }
    },
    userEnteredValue: { stringValue: HEADERS[colIndex] }
  };
}

function titleCellFormat(restaurantName) {
  return {
    userEnteredFormat: {
      backgroundColor: { red: 0.1451, green: 0.2784, blue: 0.1451 }, // deeper green for title
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      textFormat: {
        foregroundColor: HEADER_FG,
        fontFamily: 'Montserrat',
        fontSize: 14,
        bold: true
      }
    },
    userEnteredValue: { stringValue: `🥦 BIROBA VEGETABLE SUPPLIERS — ${restaurantName}` }
  };
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheets
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: false,
  });

  const existingSheets = res.data.sheets.map(s => s.properties.title);
  console.log('Existing tabs:', existingSheets);

  // Find which restaurants need new tabs
  const toCreate = RESTAURANTS.filter(r => !existingSheets.includes(r));
  const alreadyExist = RESTAURANTS.filter(r => existingSheets.includes(r));

  if (alreadyExist.length > 0) {
    console.log('Already exist (skipping):', alreadyExist);
  }

  if (toCreate.length === 0) {
    console.log('✅ All restaurant tabs already exist! Nothing to do.');
    return;
  }

  console.log(`\nCreating ${toCreate.length} new tabs:`, toCreate);

  // Step 1: Add all new sheets in one batch
  const addSheetRequests = toCreate.map(name => ({
    addSheet: {
      properties: {
        title: name,
        tabColor: HEADER_BG,
        gridProperties: { rowCount: 200, columnCount: HEADERS.length }
      }
    }
  }));

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: addSheetRequests }
  });

  // Map restaurant name → new sheetId
  const newSheetIds = {};
  addRes.data.replies.forEach((reply, i) => {
    newSheetIds[toCreate[i]] = reply.addSheet.properties.sheetId;
  });

  console.log('Sheets created. Applying formatting...');

  // Step 2: Format each new sheet
  const formatRequests = [];

  for (const name of toCreate) {
    const sheetId = newSheetIds[name];

    // --- Row 1: Restaurant title (merged across all columns) ---
    formatRequests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
        rows: [{
          values: [
            titleCellFormat(name),
            ...Array(HEADERS.length - 1).fill({ userEnteredFormat: { backgroundColor: { red: 0.1451, green: 0.2784, blue: 0.1451 } } })
          ]
        }],
        fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
      }
    });

    // Merge title row across all columns
    formatRequests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
        mergeType: 'MERGE_ALL'
      }
    });

    // --- Row 2: Header row ---
    formatRequests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: HEADERS.length },
        rows: [{
          values: HEADERS.map((_, i) => headerCellFormat(i))
        }],
        fields: 'userEnteredValue,userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)'
      }
    });

    // --- Rows 3-200: Data rows default formatting ---
    // Apply alternating row colors for data area (rows 3-200)
    for (let r = 2; r < 200; r++) {
      const bg = (r % 2 === 0) ? DATA_BG : ALT_ROW_BG;
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
          cell: {
            userEnteredFormat: {
              backgroundColor: bg,
              verticalAlignment: 'MIDDLE',
              textFormat: {
                foregroundColor: DATA_FG,
                fontFamily: 'Roboto',
                fontSize: 10,
                bold: false
              },
              borders: {
                bottom: { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.9, blue: 0.85 } },
                right:  { style: 'SOLID', width: 1, color: { red: 0.85, green: 0.9, blue: 0.85 } }
              }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat,borders)'
        }
      });
    }

    // --- Column widths ---
    const colWidths = [90, 100, 110, 110, 120, 120, 140, 200];
    colWidths.forEach((px, ci) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: ci, endIndex: ci + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize'
        }
      });
    });

    // --- Row 1 height (title) ---
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize'
      }
    });

    // --- Row 2 height (header) ---
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 30 },
        fields: 'pixelSize'
      }
    });

    // Freeze title + header rows
    formatRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 2 }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    });
  }

  // Send all format requests in batches of 50 to avoid quota limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < formatRequests.length; i += BATCH_SIZE) {
    const batch = formatRequests.slice(i, i + BATCH_SIZE);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: batch }
    });
    console.log(`  Formatted batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(formatRequests.length/BATCH_SIZE)}`);
  }

  console.log(`\n✅ Done! Created and formatted ${toCreate.length} restaurant tabs:`);
  toCreate.forEach(n => console.log(`  📊 ${n}`));
  console.log('\nOpen your sheet to see the new tabs 🎉');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
