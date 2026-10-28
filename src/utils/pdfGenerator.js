import { formatDateDisplay, formatMoney, formatWeightClean, computeRecordGrandTotal, getTodayISO } from './storage';

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

export function generateVectorInvoicePdfBytes({ invoiceNo, customerName, date, paymentStatus, tempoHire, grandTotal, itemsList, billCategory }) {
  const isFruit = billCategory === 'FRUITS';
  const dateStr = formatDateDisplay(date);
  const rows = itemsList.map((item, idx) => ({
    no: `${idx + 1}.`,
    name: item.name,
    weight: formatWeightClean(item.weight),
    rate: item.mode === 'lump_sum' || item.mode === 'free' || !item.rate ? '-' : `${item.rate}${item.mode === 'per_100' ? '/100' : ''}`,
    amount: item.mode === 'free' ? '-' : (item.amount ? formatMoney(item.amount) : '-')
  }));

  if (rows.length === 0) {
    rows.push({ no: '1.', name: 'No items', weight: '-', rate: '-', amount: '0' });
  }

  const pageW = 595.28;
  const rowHeight = 20;
  const pageH = Math.max(841.89, 230 + rows.length * rowHeight + 120);

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

  ops.push(`1 1 1 rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f`);
  ops.push(`0.122 0.435 0.263 RG 2 w 24 24 ${(pageW - 48).toFixed(2)} ${(pageH - 48).toFixed(2)} re S`);

  drawText('|| Shri Mahalingaraya Prasanna ||', 36, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'left');
  drawText('|| Shri Swami Samarth Prasanna ||', pageW / 2, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'center');
  drawText('|| Shri Balaji Prasanna ||', pageW - 36, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'right');

  drawText('BIROBA VEGETABLE SUPPLIERS', pageW / 2, 68, 'F2', 19, 0.784, 0.118, 0.118, 'center');
  drawText('ALL KINDS OF FRESH VEGETABLE & FRUITS WHOLESALE SUPPLIERS', pageW / 2, 84, 'F2', 9.5, 0.086, 0.396, 0.204, 'center');
  drawText('Old Bhaji Market Byculla Mumbai-400 027 | M.: 9892406958 / 8451869058', pageW / 2, 98, 'F1', 9.5, 0.086, 0.396, 0.204, 'center');
  drawText('Prop.: Birappa B. Nigadi', pageW / 2, 114, 'F2', 11.5, 0.784, 0.118, 0.118, 'center');

  ops.push(`0.086 0.396 0.204 RG 1.5 w 34 ${toPdfY(124)} m ${(pageW - 34).toFixed(2)} ${toPdfY(124)} l S`);

  drawText('No. :', 36, 144, 'F2', 11, 0.086, 0.396, 0.204, 'left');
  drawText(invoiceNo, 68, 144, 'F2', 12, 0.06, 0.09, 0.16, 'left');
  drawText(`Date : ${dateStr}`, pageW - 36, 144, 'F2', 11, 0.086, 0.396, 0.204, 'right');

  drawText('M/s. :', 36, 166, 'F2', 11, 0.086, 0.396, 0.204, 'left');
  drawText(customerName, 72, 166, 'F2', 13, 0.06, 0.09, 0.16, 'left');
  ops.push(`0.086 0.396 0.204 RG 0.8 w 70 ${toPdfY(170)} m ${(pageW - 36).toFixed(2)} ${toPdfY(170)} l S`);

  const tL = 34, tR = pageW - 34, tW = tR - tL;
  const c1 = tL + 40, c2 = tL + 280, c3 = tL + 365, c4 = tL + 435;
  let curY = 182;
  const thH = 26;

  ops.push(`0.925 0.969 0.941 rg ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re f`);
  ops.push(`0.122 0.435 0.263 RG 1.2 w ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re S`);

  drawText('No.', (tL + c1) / 2, curY + 17, 'F2', 9.5, 0.078, 0.325, 0.176, 'center');
  drawText('PARTICULARS', c1 + 8, curY + 17, 'F2', 9.5, 0.078, 0.325, 0.176, 'left');
  drawText('WEIGHT', (c2 + c3) / 2, curY + 17, 'F2', 9.5, 0.078, 0.325, 0.176, 'center');
  drawText('RATE', (c3 + c4) / 2, curY + 17, 'F2', 9.5, 0.078, 0.325, 0.176, 'center');
  drawText('AMOUNT (Rs.)', tR - 8, curY + 17, 'F2', 9.5, 0.078, 0.325, 0.176, 'right');

  curY += thH;

  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      ops.push(`0.973 0.980 0.988 rg ${tL} ${toPdfY(curY + rowHeight)} ${tW.toFixed(2)} ${rowHeight} re f`);
    }
    ops.push(`0.525 0.937 0.675 RG 0.6 w ${tL} ${toPdfY(curY + rowHeight)} m ${tR.toFixed(2)} ${toPdfY(curY + rowHeight)} l S`);

    drawText(r.no, (tL + c1) / 2, curY + 14, 'F1', 9.5, 0.078, 0.325, 0.176, 'center');
    drawText(r.name, c1 + 8, curY + 14, 'F2', 10, 0.06, 0.09, 0.16, 'left');
    drawText(r.weight, (c2 + c3) / 2, curY + 14, 'F2', 10, 0.06, 0.09, 0.16, 'center');
    drawText(r.rate, (c3 + c4) / 2, curY + 14, 'F1', 9.5, 0.06, 0.09, 0.16, 'center');
    drawText(r.amount, tR - 8, curY + 14, 'F2', 10, 0.06, 0.09, 0.16, 'right');

    curY += rowHeight;
  });

  const tempoH = 22;
  ops.push(`0.941 0.992 0.957 rg ${tL} ${toPdfY(curY + tempoH)} ${tW.toFixed(2)} ${tempoH} re f`);
  ops.push(`0.122 0.435 0.263 RG 1.0 w ${tL} ${toPdfY(curY + tempoH)} ${tW.toFixed(2)} ${tempoH} re S`);
  drawText('Tempo Hire', c4 - 10, curY + 15, 'F2', 10, 0.086, 0.396, 0.204, 'right');
  drawText(tempoHire > 0 ? formatMoney(tempoHire) : '-', tR - 8, curY + 15, 'F2', 10.5, 0.06, 0.09, 0.16, 'right');
  curY += tempoH;

  const totH = 26;
  ops.push(`0.863 0.988 0.906 rg ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re f`);
  ops.push(`0.122 0.435 0.263 RG 1.4 w ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re S`);
  drawText('Total (Rs.)', c4 - 10, curY + 17, 'F2', 12, 0.086, 0.396, 0.204, 'right');
  drawText(`Rs. ${formatMoney(grandTotal)}`, tR - 8, curY + 17, 'F2', 13, 0.06, 0.09, 0.16, 'right');
  curY += totH;

  ops.push('0.122 0.435 0.263 RG 1.1 w');
  [tL, c1, c2, c3, c4, tR].forEach((xp, i) => {
    const by = i >= 1 && i <= 3 ? curY - tempoH - totH : curY;
    ops.push(`${xp.toFixed(2)} ${toPdfY(182)} m ${xp.toFixed(2)} ${toPdfY(by)} l S`);
  });

  curY += 22;
  drawText(`Payment Status: ${paymentStatus}`, tL, curY, 'F2', 9.5, 0.086, 0.396, 0.204, 'left');
  drawText('For BIROBA VEGETABLE SUPPLIERS', tR, curY, 'F2', 11, 0.784, 0.118, 0.118, 'right');

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

  // 1. Background and Border
  ops.push(`1 1 1 rg 0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f`);
  ops.push(`0.122 0.435 0.263 RG 2 w 24 24 ${(pageW - 48).toFixed(2)} ${(pageH - 48).toFixed(2)} re S`);

  // 2. Blessings Header
  drawText('|| Shri Mahalingaraya Prasanna ||', 36, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'left');
  drawText('|| Shri Swami Samarth Prasanna ||', pageW / 2, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'center');
  drawText('|| Shri Balaji Prasanna ||', pageW - 36, 44, 'F2', 8.5, 0.086, 0.396, 0.204, 'right');

  // 3. Biroba Suppliers Header
  drawText('BIROBA VEGETABLE SUPPLIERS', pageW / 2, 68, 'F2', 19, 0.784, 0.118, 0.118, 'center');
  drawText('ALL KINDS OF FRESH VEGETABLE & FRUITS WHOLESALE SUPPLIERS', pageW / 2, 84, 'F2', 9.5, 0.086, 0.396, 0.204, 'center');
  drawText('Old Bhaji Market Byculla Mumbai-400 027 | M.: 9892406958 / 8451869058', pageW / 2, 98, 'F1', 9.5, 0.086, 0.396, 0.204, 'center');
  drawText('Prop.: Birappa B. Nigadi', pageW / 2, 114, 'F2', 11.5, 0.784, 0.118, 0.118, 'center');

  ops.push(`0.086 0.396 0.204 RG 1.5 w 34 ${toPdfY(122)} m ${(pageW - 34).toFixed(2)} ${toPdfY(122)} l S`);

  // 4. Statement Title Banner
  const bannerW = pageW - 68;
  ops.push(`0.122 0.435 0.263 rg 34 ${toPdfY(148)} ${bannerW.toFixed(2)} 22 re f`);
  let statementTitle = 'STATEMENT OF ACCOUNT / BILLING LEDGER';
  if (categoryFilter === 'FRUITS') statementTitle = 'STATEMENT OF ACCOUNT / FRUITS LEDGER';
  else if (categoryFilter === 'VEGETABLES') statementTitle = 'STATEMENT OF ACCOUNT / VEGETABLES LEDGER';
  else statementTitle = 'STATEMENT OF ACCOUNT / COMBINED LEDGER (VEG & FRUITS)';
  drawText(statementTitle, pageW / 2, 142, 'F2', 11, 1, 1, 1, 'center');

  // 5. Customer & Period Info
  drawText('M/s. (Restaurant) :', 36, 168, 'F2', 10, 0.086, 0.396, 0.204, 'left');
  drawText(customerName || 'Customer', 140, 168, 'F2', 12.5, 0.06, 0.09, 0.16, 'left');

  drawText(`Period: ${periodStr}`, pageW - 36, 168, 'F2', 10, 0.06, 0.09, 0.16, 'right');
  drawText(`Date Issued: ${issuedDateStr}`, pageW - 36, 182, 'F1', 9.5, 0.4, 0.45, 0.5, 'right');

  // 6. 4 KPI Summary Cards
  const kpiTop = 194;
  const kpiH = 38;
  const kpiGap = 8;
  const kpiW = (bannerW - (3 * kpiGap)) / 4;

  const kpis = [
    { label: 'TOTAL INVOICES', val: `${records.length} Bills`, bg: [0.95, 0.96, 0.98], border: [0.80, 0.83, 0.88], valColor: [0.1, 0.15, 0.25] },
    { label: 'TOTAL BILLED', val: `Rs. ${formatMoney(totalBilled)}`, bg: [0.92, 0.97, 0.94], border: [0.122, 0.435, 0.263], valColor: [0.08, 0.35, 0.18] },
    { label: 'TOTAL PAID', val: `Rs. ${formatMoney(totalPaid)}`, bg: [0.94, 0.99, 0.95], border: [0.20, 0.60, 0.30], valColor: [0.05, 0.45, 0.15] },
    { label: 'BALANCE DUE', val: `Rs. ${formatMoney(totalUnpaid)}`, bg: [0.99, 0.95, 0.93], border: [0.85, 0.35, 0.15], valColor: [0.78, 0.12, 0.12] }
  ];

  kpis.forEach((k, idx) => {
    const kx = 34 + idx * (kpiW + kpiGap);
    ops.push(`${k.bg[0]} ${k.bg[1]} ${k.bg[2]} rg ${kx.toFixed(2)} ${toPdfY(kpiTop + kpiH)} ${kpiW.toFixed(2)} ${kpiH} re f`);
    ops.push(`${k.border[0]} ${k.border[1]} ${k.border[2]} RG 1 w ${kx.toFixed(2)} ${toPdfY(kpiTop + kpiH)} ${kpiW.toFixed(2)} ${kpiH} re S`);
    drawText(k.label, kx + kpiW / 2, kpiTop + 14, 'F2', 7.5, 0.35, 0.4, 0.45, 'center');
    drawText(k.val, kx + kpiW / 2, kpiTop + 29, 'F2', 11, k.valColor[0], k.valColor[1], k.valColor[2], 'center');
  });

  // 7. Table Header
  const tL = 34, tR = pageW - 34, tW = tR - tL;
  const c1 = tL + 30;   // Sr
  const c2 = tL + 105;  // Date
  const c3 = tL + 175;  // Inv #
  const c4 = tL + 380;  // Items summary
  const c5 = tL + 450;  // Status
  // c5 to tR is Amount

  let curY = 244;
  const thH = 24;

  ops.push(`0.145 0.278 0.145 rg ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re f`);
  ops.push(`0.122 0.435 0.263 RG 1.2 w ${tL} ${toPdfY(curY + thH)} ${tW.toFixed(2)} ${thH} re S`);

  drawText('Sr.', (tL + c1) / 2, curY + 16, 'F2', 9, 1, 1, 1, 'center');
  drawText('DATE', (c1 + c2) / 2, curY + 16, 'F2', 9, 1, 1, 1, 'center');
  drawText('INVOICE #', (c2 + c3) / 2, curY + 16, 'F2', 9, 1, 1, 1, 'center');
  drawText('PARTICULARS / ITEMS SUMMARY', c3 + 6, curY + 16, 'F2', 9, 1, 1, 1, 'left');
  drawText('STATUS', (c4 + c5) / 2, curY + 16, 'F2', 9, 1, 1, 1, 'center');
  drawText('AMOUNT (Rs.)', tR - 6, curY + 16, 'F2', 9, 1, 1, 1, 'right');

  curY += thH;

  // 8. Table Rows
  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      ops.push(`0.965 0.985 0.970 rg ${tL} ${toPdfY(curY + rowHeight)} ${tW.toFixed(2)} ${rowHeight} re f`);
    }
    ops.push(`0.80 0.88 0.83 RG 0.5 w ${tL} ${toPdfY(curY + rowHeight)} m ${tR.toFixed(2)} ${toPdfY(curY + rowHeight)} l S`);

    drawText(r.sr, (tL + c1) / 2, curY + 15, 'F1', 9, 0.25, 0.3, 0.35, 'center');
    drawText(r.date, (c1 + c2) / 2, curY + 15, 'F2', 9.5, 0.1, 0.15, 0.2, 'center');
    drawText(r.invoiceNo, (c2 + c3) / 2, curY + 15, 'F2', 9.5, 0.1, 0.15, 0.2, 'center');
    drawText(r.itemsSummary, c3 + 6, curY + 15, 'F1', 9, 0.2, 0.25, 0.3, 'left');

    const isUnpaid = r.status === 'Unpaid';
    if (isUnpaid) {
      drawText('Unpaid', (c4 + c5) / 2, curY + 15, 'F2', 9, 0.8, 0.2, 0.1, 'center');
    } else if (r.status === 'Paid') {
      drawText('Paid', (c4 + c5) / 2, curY + 15, 'F2', 9, 0.05, 0.5, 0.15, 'center');
    } else {
      drawText(r.status, (c4 + c5) / 2, curY + 15, 'F1', 9, 0.4, 0.4, 0.4, 'center');
    }

    drawText(r.amount !== '0' ? `Rs. ${r.amount}` : '-', tR - 6, curY + 15, 'F2', 10, 0.08, 0.1, 0.15, 'right');

    curY += rowHeight;
  });

  // Table Totals Bar
  const totH = 26;
  ops.push(`0.88 0.96 0.91 rg ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re f`);
  ops.push(`0.122 0.435 0.263 RG 1.3 w ${tL} ${toPdfY(curY + totH)} ${tW.toFixed(2)} ${totH} re S`);
  drawText(`TOTALS (${records.length} Bills)`, c3 + 6, curY + 17, 'F2', 10.5, 0.086, 0.396, 0.204, 'left');
  drawText(`Rs. ${formatMoney(totalBilled)}`, tR - 6, curY + 17, 'F2', 12, 0.06, 0.09, 0.16, 'right');
  curY += totH;

  // Vertical Column Dividers
  ops.push('0.122 0.435 0.263 RG 0.8 w');
  [tL, c1, c2, c3, c4, c5, tR].forEach((xp, i) => {
    const by = (i === 1 || i === 2 || i === 4) ? curY - totH : curY;
    ops.push(`${xp.toFixed(2)} ${toPdfY(244)} m ${xp.toFixed(2)} ${toPdfY(by)} l S`);
  });

  // 9. Signoff & Notes Footer
  curY += 24;
  drawText('Note: Please verify the statement and settle outstanding amount at the earliest.', tL, curY, 'F1', 8.5, 0.4, 0.45, 0.5, 'left');
  drawText(`Outstanding Due: Rs. ${formatMoney(totalUnpaid)}`, tL, curY + 14, 'F2', 10, 0.78, 0.12, 0.12, 'left');

  drawText('For BIROBA VEGETABLE SUPPLIERS', tR, curY, 'F2', 10.5, 0.784, 0.118, 0.118, 'right');
  drawText('Proprietor / Authorized Signature', tR, curY + 18, 'F1', 8.5, 0.4, 0.45, 0.5, 'right');

  // Assembly PDF-1.4 stream
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
