import {
  formatDateDisplay,
  formatDateLong,
  formatMoney,
  isItemOrdered,
  formatWeightClean,
  getItemUnit,
  numberToIndianWords,
  COMPANY_INFO
} from './storage';

/**
 * Renders a pixel-perfect, clean modern corporate invoice directly onto an HTML5 Canvas,
 * exactly matching c:\Users\susha\Downloads\INVOICE.pdf with zero line/text overlap.
 *
 * @param {Object} rec - Invoice record data
 * @param {Array} catalog - Vegetable/fruit catalog
 * @returns {Promise<Blob>} PNG Blob of the invoice
 */
export async function generateInvoiceCanvasBlob(rec, catalog) {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  const {
    invoiceNo = '2211',
    date = '',
    customerName = 'SAI DARSHAN',
    items = {},
    tempoHire = 0
  } = rec;

  const orderedItems = (catalog || [])
    .filter(v => isItemOrdered(items[v.id]))
    .map(v => {
      const it = items[v.id] || {};
      return {
        id: v.id,
        name: v.name,
        weight: it.weight,
        rate: it.rate,
        amount: it.amount,
        mode: it.mode || v.mode,
        unit: getItemUnit(v, it)
      };
    });

  const rows = orderedItems.length > 0
    ? orderedItems
    : [{ name: 'No items ordered', weight: '-', unit: 'kg', rate: '-', amount: '0' }];

  let subtotal = 0;
  orderedItems.forEach(it => {
    const a = parseFloat(it.amount);
    if (!isNaN(a)) subtotal += a;
  });
  const tempo = parseFloat(tempoHire) || 0;
  const grandTotal = Math.round((subtotal + tempo) * 100) / 100;

  // Geometry
  const scale = 2; // 2x Retina resolution
  const W = 680;
  const tL = 36;
  const tR = W - 36;
  const tW = tR - tL; // 608px

  // Column boundaries
  const c1 = tL + 42;  // # (42px)
  const c2 = tL + 300; // Item (258px)
  const c3 = tL + 375; // Qty (75px)
  const c4 = tL + 440; // Unit (65px)
  const c5 = tL + 520; // Rate (80px)
                       // Amount: c5 to tR (88px)

  const thH = 28;
  const rowH = 24;

  const topMetaH = 190;
  const tableTopY = topMetaH;
  const tableH = thH + (rows.length * rowH);
  const bottomBoxH = 175;
  const totalH = tableTopY + tableH + bottomBoxH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(totalH * scale);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  // Subtle clean border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, W - 24, totalH - 24);

  // 1. Top small label
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 9px "Inter", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('INVOICE', tL, 30);

  // 2. Large INVOICE Heading
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px "Playfair Display", Georgia, serif';
  ctx.fillText('INVOICE', tL, 46);

  // 3. Company Information Block
  ctx.font = 'bold 12.5px "Inter", sans-serif';
  ctx.fillText(COMPANY_INFO.name, tL, 82);
  const compNameW = ctx.measureText(COMPANY_INFO.name).width;

  ctx.font = 'normal 12px "Inter", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(` ${COMPANY_INFO.tagline}`, tL + compNameW, 82);

  ctx.fillStyle = '#475569';
  ctx.font = 'normal 11.5px "Inter", sans-serif';
  ctx.fillText(`${COMPANY_INFO.address} Phone: ${COMPANY_INFO.phone}`, tL, 100);

  ctx.fillStyle = '#1e293b';
  ctx.font = '500 11.5px "Inter", sans-serif';
  ctx.fillText(`Proprietor: ${COMPANY_INFO.proprietor}`, tL, 118);

  // Horizontal Rule 1
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tL, 136);
  ctx.lineTo(tR, 136);
  ctx.stroke();

  // 4. Invoice Metadata
  const metaY = 144;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11.5px "Inter", sans-serif';
  ctx.fillText('Invoice No.:', tL, metaY);
  ctx.font = 'normal 11.5px "Inter", sans-serif';
  ctx.fillText(` ${invoiceNo || '—'}`, tL + 74, metaY);

  ctx.font = 'bold 11.5px "Inter", sans-serif';
  ctx.fillText('Invoice Date:', tL, metaY + 16);
  ctx.font = 'normal 11.5px "Inter", sans-serif';
  ctx.fillText(` ${formatDateLong(date) || formatDateDisplay(date)}`, tL + 82, metaY + 16);

  ctx.font = 'bold 11.5px "Inter", sans-serif';
  ctx.fillText('Bill To (M/s):', tL, metaY + 32);
  ctx.font = 'bold 12px "Inter", "Noto Sans Devanagari", sans-serif';
  ctx.fillText(` ${customerName || '—'}`, tL + 82, metaY + 32);

  // Horizontal Rule 2
  ctx.beginPath();
  ctx.moveTo(tL, metaY + 48);
  ctx.lineTo(tR, metaY + 48);
  ctx.stroke();

  // 5. Table Header
  const curY = tableTopY;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tL, curY, tW, thH);

  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(tL, curY, tW, thH);

  // Header column lines
  [c1, c2, c3, c4, c5].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, curY);
    ctx.lineTo(x, curY + thH);
    ctx.stroke();
  });

  ctx.fillStyle = '#475569';
  ctx.font = '600 11px "Inter", sans-serif';
  ctx.textBaseline = 'middle';

  const thMid = curY + thH / 2;
  ctx.textAlign = 'center';
  ctx.fillText('#', (tL + c1) / 2, thMid);

  ctx.textAlign = 'left';
  ctx.fillText('Item', c1 + 8, thMid);

  ctx.textAlign = 'right';
  ctx.fillText('Qty', c3 - 8, thMid);

  ctx.textAlign = 'center';
  ctx.fillText('Unit', (c3 + c4) / 2, thMid);

  ctx.textAlign = 'right';
  ctx.fillText('Rate (Rs)', c5 - 8, thMid);

  ctx.textAlign = 'right';
  ctx.fillText('Amount (Rs)', tR - 8, thMid);

  // 6. Table Rows
  let rowY = curY + thH;

  rows.forEach((r, idx) => {
    // Cell border bottom
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(tL, rowY + rowH);
    ctx.lineTo(tR, rowY + rowH);
    ctx.stroke();

    // Vertical lines
    ctx.strokeRect(tL, rowY, tW, rowH);
    [c1, c2, c3, c4, c5].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x, rowY + rowH);
      ctx.stroke();
    });

    const mid = rowY + rowH / 2;

    // #
    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), (tL + c1) / 2, mid);

    // Item
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 11.5px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, c1 + 8, mid);

    // Qty
    ctx.textAlign = 'right';
    ctx.fillText(formatWeightClean(r.weight), c3 - 8, mid);

    // Unit
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText(r.unit || 'kg', (c3 + c4) / 2, mid);

    // Rate
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    const rateStr = r.mode === 'lump_sum' || r.mode === 'free' || !r.rate ? '-' : formatMoney(r.rate);
    ctx.fillText(rateStr, c5 - 8, mid);

    // Amount
    ctx.font = '600 11.5px "Inter", sans-serif';
    const amtStr = r.mode === 'free' ? '0' : (r.amount ? formatMoney(r.amount) : '-');
    ctx.fillText(amtStr, tR - 8, mid);

    rowY += rowH;
  });

  // 7. Divider under table
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tL, rowY + 12);
  ctx.lineTo(tR, rowY + 12);
  ctx.stroke();

  // 8. Totals Box (Right Aligned Table)
  const boxW = 260;
  const boxL = tR - boxW;
  let totY = rowY + 22;

  // Subtotal row
  ctx.fillStyle = '#334155';
  ctx.font = '600 11.5px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Subtotal (Items)', boxL + 6, totY + 8);
  ctx.textAlign = 'right';
  ctx.fillText(`Rs ${formatMoney(subtotal)}`, tR - 6, totY + 8);

  ctx.strokeStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.moveTo(boxL, totY + 18);
  ctx.lineTo(tR, totY + 18);
  ctx.stroke();

  // Tempo Hire row
  totY += 22;
  ctx.textAlign = 'left';
  ctx.fillText('Tempo Hire / Delivery', boxL + 6, totY + 8);
  ctx.textAlign = 'right';
  ctx.fillText(`Rs ${formatMoney(tempo)}`, tR - 6, totY + 8);

  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(boxL, totY + 18);
  ctx.lineTo(tR, totY + 18);
  ctx.stroke();

  // TOTAL DUE row
  totY += 22;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(boxL, totY, boxW, 24);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(boxL, totY, boxW, 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12.5px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL DUE', boxL + 8, totY + 12);
  ctx.textAlign = 'right';
  ctx.fillText(`Rs ${formatMoney(grandTotal)}`, tR - 8, totY + 12);

  // 9. Amount in Words
  let wordY = totY + 36;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11.5px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Amount in words:', tL, wordY);
  ctx.font = 'normal 11.5px "Inter", sans-serif';
  ctx.fillText(` ${numberToIndianWords(grandTotal)}`, tL + 104, wordY);

  // Divider line
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(tL, wordY + 14);
  ctx.lineTo(tR, wordY + 14);
  ctx.stroke();

  // 10. Signatory Section
  const sigY = wordY + 28;
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.fillText(`For ${COMPANY_INFO.name}`, tL, sigY);

  ctx.font = 'normal 11.5px "Inter", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Authorised Signatory: ______________________', tL, sigY + 18);

  // 11. Footer
  const footerY = totalH - 24;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'normal 9px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('INVOICE', tL, footerY);
  ctx.textAlign = 'right';
  ctx.fillText('Page 1 of 1', tR, footerY);

  // Convert canvas to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
}

/**
 * Capture an invoice and share as an image directly to WhatsApp.
 */
export async function shareInvoiceAsImage(targetElementOrId, meta = {}, showToast = () => {}) {
  try {
    const invoiceNo = meta.invoiceNo || '2211';
    const customerName = (meta.customerName || 'Customer').trim();
    const safeCustomer = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Biroba_Invoice_${invoiceNo}_${safeCustomer}.png`;

    showToast('📸 Creating invoice image for WhatsApp...');

    const rec = meta.record || {
      invoiceNo,
      date: meta.date || '',
      customerName,
      items: {},
      tempoHire: 0,
      paymentStatus: 'Credit / Unpaid'
    };

    const catalog = meta.catalog || [];

    // Generate high-resolution pixel-perfect canvas blob
    const blob = await generateInvoiceCanvasBlob(rec, catalog);
    const file = new File([blob], fileName, { type: 'image/png' });

    // 1. Mobile Web Share API: Native file sharing directly into WhatsApp
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Invoice #${invoiceNo} - ${customerName}`,
          text: `Biroba Vegetable Suppliers — Invoice #${invoiceNo} for ${customerName}`
        });
        showToast('✅ WhatsApp / Share Sheet opened!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Web Share API error, using fallback:', err);
      }
    }

    // 2. Fallback for Desktop/browsers without file sharing
    let copied = false;
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        copied = true;
      } catch (clipErr) {
        console.warn('Clipboard write failed:', clipErr);
      }
    }

    // Trigger image file download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // Open WhatsApp Web
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Invoice #${invoiceNo} for ${customerName} (Image ready)`)}`;
    window.open(waUrl, '_blank');

    if (copied) {
      showToast('📋 Invoice image copied! In WhatsApp, press Paste (Ctrl+V) to send.');
    } else {
      showToast('📥 Invoice image downloaded! Drag or attach it into your WhatsApp chat.');
    }
  } catch (err) {
    console.error('Failed to share invoice as image:', err);
    showToast('⚠️ Could not generate image. Please try again.');
  }
}
