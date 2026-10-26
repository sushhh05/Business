import { formatDateDisplay, formatMoney, formatWeightClean } from './storage';

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

export function generateVectorInvoicePdfBytes({ invoiceNo, customerName, date, paymentStatus, tempoHire, grandTotal, itemsList }) {
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
  drawText('Old Bhaji Market Byculla Mumbai-400 027 | M.: 9892406958 / 7400106277', pageW / 2, 98, 'F1', 9.5, 0.086, 0.396, 0.204, 'center');
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
