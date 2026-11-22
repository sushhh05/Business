import {
  formatDateDisplay,
  formatDateLong,
  formatMoney,
  formatWeightClean,
  computeRecordGrandTotal,
  numberToIndianWords,
  getTodayISO,
  COMPANY_INFO
} from './storage';

function cleanPdfString(str) {
  return String(str || '')
    .replace(/₹/g, 'Rs.')
    .replace(/•/g, '|')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '');
}

function approxPdfTextWidth(text, size, isBold) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 32) w += 0.28;
    else if ('ilI1.,:;|!'.indexOf(text[i]) >= 0) w += 0.28;
    else if ('MW@#%&'.indexOf(text[i]) >= 0) w += 0.84;
    else if (c >= 65 && c <= 90) w += isBold ? 0.70 : 0.65;
    else w += isBold ? 0.58 : 0.54;
  }
  return w * size;
}

/**
 * Generates an exact single-page corporate invoice PDF, centered in the middle of an A4 page,
 * exactly matching c:\Users\susha\Downloads\INVOICE.pdf.
 */
export function generateVectorInvoicePdfBytes({
  invoiceNo,
  customerName,
  date,
  paymentStatus,
  tempoHire,
  grandTotal,
  itemsList = [],
  billCategory
}) {
  const isFruit = billCategory === 'FRUITS';
  const dateStr = formatDateLong(date) || formatDateDisplay(date);

  const formattedRows = itemsList.map((item, idx) => ({
    no: `${idx + 1}`,
    name: item.name,
    qty: formatWeightClean(item.weight),
    unit: item.unit || (item.mode === 'per_100' ? '100 pcs' : 'kg'),
    rate: item.mode === 'lump_sum' || item.mode === 'free' || !item.rate ? '-' : formatMoney(item.rate),
    amount: item.mode === 'free' ? '0' : (item.amount ? formatMoney(item.amount) : '-')
  }));

  if (formattedRows.length === 0) {
    formattedRows.push({ no: '1', name: 'No items ordered', qty: '-', unit: 'kg', rate: '-', amount: '0' });
  }

  // Standard A4 dimensions
  const pageW = 595.28;
  const pageH = 841.89;

  // Invoice centered in the middle with balanced margins
  const tL = 46;
  const tR = pageW - 46; // 549.28
  const tW = tR - tL;    // 503.28

  // Column positions inside the centered invoice table
  const c1 = tL + 26;   // # (26pt)
  const c2 = tL + 245;  // Item (219pt)
  const c3 = tL + 305;  // Qty (60pt)
  const c4 = tL + 355;  // Unit (50pt)
  const c5 = tL + 425;  // Rate (70pt)
                        // Amount: c5 to tR (78.28pt)

  function toPdfY(y) {
    return (pageH - y).toFixed(2);
  }

  // Dynamically calculate row height to ensure ALL items fit on 1 SINGLE PAGE
  const count = formattedRows.length;
  let rowHeight = 17;
  let fontSize = 9;
  let nameFontSize = 9.5;

  if (count > 30) {
    rowHeight = 11.5;
    fontSize = 7;
    nameFontSize = 7.5;
  } else if (count > 22) {
    rowHeight = 13.5;
    fontSize = 7.5;
    nameFontSize = 8;
  } else if (count > 15) {
    rowHeight = 15;
    fontSize = 8.5;
    nameFontSize = 9;
  }

  const ops = [];

  function drawText(text, x, topY, font, size, r, g, b, align) {
    const safe = cleanPdfString(text);
    let drawX = x;
    const w = approxPdfTextWidth(safe, size, font === 'F2');
    if (align === 'center') drawX = x - w / 2;
    else if (align === 'right') drawX = x - w;
    ops.push(`BT /${font} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${drawX.toFixed(2)} ${toPdfY(topY)} Tm (${safe}) Tj ET`);
  }

  // Pure white page background
  ops.push(`1 1 1 rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f`);

  // 1. Top subtle INVOICE label
  drawText('INVOICE', tL, 38, 'F1', 7.5, 0.55, 0.60, 0.65, 'left');

  // 2. Company Name Heading (replacing large INVOICE heading)
  drawText(COMPANY_INFO.name, tL, 62, 'F2', 20, 0.06, 0.09, 0.16, 'left');

  // 3. Tagline & Business Details Block
  drawText(COMPANY_INFO.tagline, tL, 78, 'F1', 9.5, 0.28, 0.33, 0.40, 'left');
  drawText(`${COMPANY_INFO.address} Phone: ${COMPANY_INFO.phone}`, tL, 91, 'F1', 9, 0.28, 0.33, 0.40, 'left');
  drawText(`Proprietor: ${COMPANY_INFO.proprietor}`, tL, 104, 'F2', 9, 0.12, 0.16, 0.23, 'left');

  // Divider Line 1
  ops.push(`0.88 0.90 0.93 RG 0.8 w ${tL} ${toPdfY(114)} m ${tR.toFixed(2)} ${toPdfY(114)} l S`);

  // 4. Metadata Block
  drawText(`Invoice No.: ${invoiceNo || '—'}`, tL, 127, 'F2', 9.5, 0.06, 0.09, 0.16, 'left');
  drawText(`Invoice Date: ${dateStr}`, tL, 140, 'F2', 9.5, 0.06, 0.09, 0.16, 'left');
  drawText(`Bill To (M/s): ${customerName || '—'}`, tL, 153, 'F2', 9.5, 0.06, 0.09, 0.16, 'left');

  // Divider Line 2
  ops.push(`0.88 0.90 0.93 RG 0.8 w ${tL} ${toPdfY(161)} m ${tR.toFixed(2)} ${toPdfY(161)} l S`);

  // 5. Table Header
  let curY = 169;
  const thH = 20;

  // Header fill & border
  ops.push(`0.97 0.98 0.99 rg ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re f`);
  ops.push(`0.88 0.90 0.93 RG 0.8 w ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re S`);

  // Vertical column dividers
  [c1, c2, c3, c4, c5].forEach(x => {
    ops.push(`${x.toFixed(2)} ${toPdfY(curY)} m ${x.toFixed(2)} ${toPdfY(curY + thH)} l S`);
  });

  drawText('#', (tL + c1) / 2, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'center');
  drawText('Item', c1 + 6, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'left');
  drawText('Qty', c3 - 6, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'right');
  drawText('Unit', (c3 + c4) / 2, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'center');
  drawText('Rate (Rs)', c5 - 6, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'right');
  drawText('Amount (Rs)', tR - 6, curY + 13, 'F2', 8.5, 0.28, 0.33, 0.40, 'right');

  curY += thH;

  // 6. Draw Table Rows
  formattedRows.forEach(r => {
    ops.push(`0.88 0.90 0.93 RG 0.5 w ${tL} ${toPdfY(curY + rowHeight)} ${tW.toFixed(2)} ${rowHeight} re S`);
    [c1, c2, c3, c4, c5].forEach(x => {
      ops.push(`${x.toFixed(2)} ${toPdfY(curY)} m ${x.toFixed(2)} ${toPdfY(curY + rowHeight)} l S`);
    });

    const textOffsetY = rowHeight * 0.72;
    drawText(r.no, (tL + c1) / 2, curY + textOffsetY, 'F1', fontSize, 0.40, 0.45, 0.50, 'center');
    drawText(r.name, c1 + 6, curY + textOffsetY, 'F1', nameFontSize, 0.06, 0.09, 0.16, 'left');
    drawText(r.qty, c3 - 6, curY + textOffsetY, 'F1', fontSize, 0.06, 0.09, 0.16, 'right');
    drawText(r.unit, (c3 + c4) / 2, curY + textOffsetY, 'F1', fontSize - 0.5, 0.30, 0.35, 0.40, 'center');
    drawText(r.rate, c5 - 6, curY + textOffsetY, 'F1', fontSize, 0.06, 0.09, 0.16, 'right');
    drawText(r.amount, tR - 6, curY + textOffsetY, 'F2', fontSize, 0.06, 0.09, 0.16, 'right');

    curY += rowHeight;
  });

  // Divider line under table
  ops.push(`0.88 0.90 0.93 RG 0.8 w ${tL} ${toPdfY(curY + 7)} m ${tR.toFixed(2)} ${toPdfY(curY + 7)} l S`);

  // 7. Totals Box (Right Aligned Table)
  const boxW = 200;
  const boxL = tR - boxW;
  let totY = curY + 12;

  let sub = 0;
  itemsList.forEach(it => { const a = parseFloat(it.amount); if (!isNaN(a)) sub += a; });

  // Subtotal
  drawText('Subtotal (Items)', boxL + 4, totY + 10, 'F2', 9, 0.20, 0.25, 0.30, 'left');
  drawText(`Rs ${formatMoney(sub)}`, tR - 4, totY + 10, 'F2', 9, 0.06, 0.09, 0.16, 'right');

  totY += 15;
  ops.push(`0.92 0.94 0.96 RG 0.5 w ${boxL} ${toPdfY(totY)} m ${tR.toFixed(2)} ${toPdfY(totY)} l S`);

  // Tempo Hire
  drawText('Tempo Hire / Delivery', boxL + 4, totY + 10, 'F2', 9, 0.20, 0.25, 0.30, 'left');
  drawText(`Rs ${formatMoney(tempoHire || 0)}`, tR - 4, totY + 10, 'F2', 9, 0.06, 0.09, 0.16, 'right');

  totY += 15;
  // TOTAL DUE Box
  ops.push(`0.97 0.98 0.99 rg ${boxL} ${toPdfY(totY + 18)} ${boxW.toFixed(2)} 18 re f`);
  ops.push(`0.80 0.83 0.88 RG 0.8 w ${boxL} ${toPdfY(totY + 18)} ${boxW.toFixed(2)} 18 re S`);

  drawText('TOTAL DUE', boxL + 6, totY + 13, 'F2', 10, 0.06, 0.09, 0.16, 'left');
  drawText(`Rs ${formatMoney(grandTotal)}`, tR - 6, totY + 13, 'F2', 10.5, 0.06, 0.09, 0.16, 'right');

  // 8. Amount in words
  const wordY = totY + 28;
  drawText(`Amount in words: ${numberToIndianWords(grandTotal)}`, tL, wordY, 'F2', 9, 0.06, 0.09, 0.16, 'left');

  ops.push(`0.88 0.90 0.93 RG 0.8 w ${tL} ${toPdfY(wordY + 8)} m ${tR.toFixed(2)} ${toPdfY(wordY + 8)} l S`);

  // 9. Signatory Section
  const sigY = wordY + 22;
  drawText(`For ${COMPANY_INFO.name}`, tL, sigY, 'F2', 9.5, 0.06, 0.09, 0.16, 'left');
  drawText('Authorised Signatory: ______________________', tL, sigY + 14, 'F1', 8.5, 0.25, 0.30, 0.35, 'left');

  // 10. Footer (strictly Single Page)
  drawText('Page 1 of 1', tR, pageH - 24, 'F1', 7.5, 0.55, 0.60, 0.65, 'right');

  // Assemble SINGLE-PAGE PDF Document
  const stream = ops.join('\n');
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 6 0 R >>\nendobj\n`);
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i];
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function generateVectorStatementPdfBytes({
  customerName,
  fromDate,
  toDate,
  records = [],
  catalog = [],
  categoryFilter = 'ALL'
}) {
  const fromStr = fromDate ? formatDateDisplay(fromDate) : 'Start';
  const toStr = toDate ? formatDateDisplay(toDate) : formatDateDisplay(getTodayISO());
  const periodStr = fromDate || toDate ? `${fromStr} to ${toStr}` : 'Complete Ledger (All Invoices)';
  const issuedDateStr = formatDateDisplay(getTodayISO());

  let totalBilled = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  const rows = records.map((rec, idx) => {
    const amt = computeRecordGrandTotal(rec);
    totalBilled += amt;
    const isUnpaid = rec.paymentStatus === 'Credit / Unpaid';
    if (isUnpaid) totalUnpaid += amt;
    else totalPaid += amt;

    const isFruit = rec.billCategory === 'FRUITS';
    let itemsSummary = '-';
    if (rec.items) {
      const names = [];
      if (catalog && catalog.length > 0) {
        catalog.forEach(v => {
          const it = rec.items[v.id];
          if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
            names.push(v.name);
          }
        });
      }
      if (names.length === 0) {
        Object.keys(rec.items).forEach(k => {
          const it = rec.items[k];
          if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
            names.push(it.name || k);
          }
        });
      }
      if (names.length > 0) {
        const joined = names.length <= 4 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
        itemsSummary = categoryFilter === 'ALL' ? `[${isFruit ? 'Fruit' : 'Veg'}] ${joined}` : joined;
      }
    }

    return {
      sr: `${idx + 1}.`,
      date: formatDateDisplay(rec.date),
      invoiceNo: `#${rec.invoiceNo || '-'}`,
      itemsSummary,
      status: isUnpaid ? 'Unpaid' : 'Paid',
      amount: formatMoney(amt)
    };
  });

  if (rows.length === 0) {
    rows.push({
      sr: '1.',
      date: '-',
      invoiceNo: '-',
      itemsSummary: 'No invoices found for this date range',
      status: '-',
      amount: '0'
    });
  }

  const pageW = 595.28;
  const rowHeight = 22;
  const baseH = 340;
  const pageH = Math.max(841.89, baseH + rows.length * rowHeight + 110);

  const ops = [];
  function toPdfY(y) {
    return (pageH - y).toFixed(2);
  }

  function drawText(text, x, topY, font, size, r, g, b, align) {
    const safe = cleanPdfString(text);
    let drawX = x;
    const w = approxPdfTextWidth(safe, size, font === 'F2');
    if (align === 'center') drawX = x - w / 2;
    else if (align === 'right') drawX = x - w;
    ops.push(`BT /${font} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${drawX.toFixed(2)} ${toPdfY(topY)} Tm (${safe}) Tj ET`);
  }

  // 1. Background
  ops.push(`1 1 1 rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f`);

  // 2. Biroba Suppliers Header
  drawText('INVOICE STATEMENT', 36, 42, 'F1', 8, 0.5, 0.55, 0.6, 'left');
  drawText(COMPANY_INFO.name, 36, 66, 'F2', 18, 0.06, 0.09, 0.16, 'left');
  drawText(`${COMPANY_INFO.tagline} | Phone: ${COMPANY_INFO.phone}`, 36, 82, 'F1', 9.5, 0.3, 0.35, 0.4, 'left');
  drawText(`Proprietor: ${COMPANY_INFO.proprietor} | ${COMPANY_INFO.address}`, 36, 96, 'F1', 9.5, 0.3, 0.35, 0.4, 'left');

  ops.push(`0.85 0.88 0.91 RG 1 w 34 ${toPdfY(108)} m ${(pageW - 34).toFixed(2)} ${toPdfY(108)} l S`);

  // 3. Statement Title Banner
  const bannerW = pageW - 68;
  ops.push(`0.08 0.12 0.18 rg 34 ${toPdfY(134)} ${bannerW.toFixed(2)} 22 re f`);
  let statementTitle = 'STATEMENT OF ACCOUNT / BILLING LEDGER';
  if (categoryFilter === 'FRUITS') statementTitle = 'STATEMENT OF ACCOUNT / FRUITS LEDGER';
  else if (categoryFilter === 'VEGETABLES') statementTitle = 'STATEMENT OF ACCOUNT / VEGETABLES LEDGER';
  drawText(statementTitle, pageW / 2, 128, 'F2', 10, 1, 1, 1, 'center');

  // 4. Customer & Period Info
  drawText('Bill To (M/s) :', 36, 154, 'F2', 10, 0.08, 0.12, 0.18, 'left');
  drawText(customerName || 'Customer', 115, 154, 'F2', 12, 0.06, 0.09, 0.16, 'left');

  drawText(`Period: ${periodStr}`, pageW - 36, 154, 'F2', 10, 0.06, 0.09, 0.16, 'right');
  drawText(`Date Issued: ${issuedDateStr}`, pageW - 36, 168, 'F1', 9, 0.4, 0.45, 0.5, 'right');

  // 5. 4 KPI Summary Cards
  const kpiTop = 180;
  const kpiH = 36;
  const kpiGap = 8;
  const kpiW = (bannerW - (3 * kpiGap)) / 4;

  const kpis = [
    { label: 'TOTAL INVOICES', val: `${records.length} Bills`, bg: [0.96, 0.97, 0.99], border: [0.85, 0.88, 0.92], valColor: [0.1, 0.15, 0.25] },
    { label: 'TOTAL BILLED', val: `Rs. ${formatMoney(totalBilled)}`, bg: [0.95, 0.97, 0.96], border: [0.75, 0.85, 0.8], valColor: [0.08, 0.35, 0.18] },
    { label: 'TOTAL PAID', val: `Rs. ${formatMoney(totalPaid)}`, bg: [0.95, 0.98, 0.96], border: [0.70, 0.88, 0.75], valColor: [0.05, 0.45, 0.15] },
    { label: 'BALANCE DUE', val: `Rs. ${formatMoney(totalUnpaid)}`, bg: [0.99, 0.96, 0.95], border: [0.92, 0.75, 0.7], valColor: [0.78, 0.12, 0.12] }
  ];

  kpis.forEach((k, idx) => {
    const kx = 34 + idx * (kpiW + kpiGap);
    ops.push(`${k.bg[0]} ${k.bg[1]} ${k.bg[2]} rg ${kx.toFixed(2)} ${toPdfY(kpiTop + kpiH)} ${kpiW.toFixed(2)} ${kpiH} re f`);
    ops.push(`${k.border[0]} ${k.border[1]} ${k.border[2]} RG 0.8 w ${kx.toFixed(2)} ${toPdfY(kpiTop + kpiH)} ${kpiW.toFixed(2)} ${kpiH} re S`);
    drawText(k.label, kx + kpiW / 2, kpiTop + 13, 'F2', 7, 0.35, 0.4, 0.45, 'center');
    drawText(k.val, kx + kpiW / 2, kpiTop + 27, 'F2', 10.5, k.valColor[0], k.valColor[1], k.valColor[2], 'center');
  });

  // 6. Table Header
  const tL = 34, tR = pageW - 34, tW = tR - tL;
  const c1 = tL + 30;   // Sr
  const c2 = tL + 105;  // Date
  const c3 = tL + 175;  // Inv #
  const c4 = tL + 380;  // Items summary
  const c5 = tL + 450;  // Status

  let curY = 228;
  const thH = 22;

  ops.push(`0.96 0.97 0.99 rg ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re f`);
  ops.push(`0.85 0.88 0.91 RG 1 w ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re S`);

  drawText('Sr.', (tL + c1) / 2, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'center');
  drawText('DATE', (c1 + c2) / 2, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'center');
  drawText('INVOICE #', (c2 + c3) / 2, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'center');
  drawText('PARTICULARS / ITEMS SUMMARY', c3 + 6, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'left');
  drawText('STATUS', (c4 + c5) / 2, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'center');
  drawText('AMOUNT (Rs.)', tR - 6, curY + 15, 'F2', 8.5, 0.2, 0.25, 0.3, 'right');

  curY += thH;

  // 7. Table Rows
  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      ops.push(`0.98 0.985 0.99 rg ${tL} ${toPdfY(curY + rowHeight)} ${tW.toFixed(2)} ${rowHeight} re f`);
    }
    ops.push(`0.88 0.90 0.93 RG 0.5 w ${tL} ${toPdfY(curY + rowHeight)} m ${tR.toFixed(2)} ${toPdfY(curY + rowHeight)} l S`);

    drawText(r.sr, (tL + c1) / 2, curY + 14, 'F1', 9, 0.35, 0.4, 0.45, 'center');
    drawText(r.date, (c1 + c2) / 2, curY + 14, 'F2', 9, 0.1, 0.15, 0.2, 'center');
    drawText(r.invoiceNo, (c2 + c3) / 2, curY + 14, 'F2', 9, 0.1, 0.15, 0.2, 'center');
    drawText(r.itemsSummary, c3 + 6, curY + 14, 'F1', 8.5, 0.2, 0.25, 0.3, 'left');

    const isUnpaid = r.status === 'Unpaid';
    if (isUnpaid) {
      drawText('Unpaid', (c4 + c5) / 2, curY + 14, 'F2', 8.5, 0.8, 0.2, 0.1, 'center');
    } else {
      drawText('Paid', (c4 + c5) / 2, curY + 14, 'F2', 8.5, 0.05, 0.5, 0.15, 'center');
    }

    drawText(r.amount !== '0' ? `Rs. ${r.amount}` : '-', tR - 6, curY + 14, 'F2', 9.5, 0.08, 0.1, 0.15, 'right');

    curY += rowHeight;
  });

  // Table Totals Bar
  const totH = 24;
  ops.push(`0.95 0.96 0.98 rg ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re f`);
  ops.push(`0.80 0.83 0.88 RG 1 w ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re S`);
  drawText(`TOTALS (${records.length} Bills)`, c3 + 6, curY + 16, 'F2', 10, 0.06, 0.09, 0.16, 'left');
  drawText(`Rs. ${formatMoney(totalBilled)}`, tR - 6, curY + 16, 'F2', 11, 0.06, 0.09, 0.16, 'right');
  curY += totH;

  // 8. Signoff & Notes
  curY += 24;
  drawText('Note: Please verify the statement and settle outstanding amount at the earliest.', tL, curY, 'F1', 8.5, 0.4, 0.45, 0.5, 'left');
  drawText(`Outstanding Due: Rs. ${formatMoney(totalUnpaid)}`, tL, curY + 14, 'F2', 9.5, 0.78, 0.12, 0.12, 'left');

  drawText(`For ${COMPANY_INFO.name}`, tR, curY, 'F2', 10, 0.06, 0.09, 0.16, 'right');
  drawText('Authorised Signatory: ______________________', tR, curY + 16, 'F1', 8.5, 0.4, 0.45, 0.5, 'right');

  // Assembly
  const stream = ops.join('\n');
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 6 0 R >>\nendobj\n`);
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i];
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}
