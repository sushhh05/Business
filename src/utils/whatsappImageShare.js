import { formatDateDisplay, formatMoney, isItemOrdered, formatWeightClean } from './storage';

/**
 * Renders a pixel-perfect, vector-sharp invoice directly onto an HTML5 Canvas,
 * matching the precision of the PDF invoice with zero text/line overlap.
 *
 * @param {Object} rec - Invoice record data
 * @param {Array} catalog - Vegetable catalog
 * @returns {Promise<Blob>} PNG Blob of the invoice
 */
export async function generateInvoiceCanvasBlob(rec, catalog) {
  // Ensure custom web fonts are loaded
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  // Pre-load logo image
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.src = '/icon-192.png';
  await new Promise(r => {
    if (logo.complete && logo.naturalWidth > 0) return r();
    logo.onload = r;
    logo.onerror = () => {
      // Fallback logo
      logo.src = '/Vegetable.jpg';
      logo.onload = r;
      logo.onerror = r;
    };
  });

  const {
    invoiceNo = '101',
    date = '',
    customerName = 'Customer',
    items = {},
    tempoHire = 0,
    paymentStatus = 'Credit / Unpaid'
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
        mode: it.mode || v.mode
      };
    });

  const rows = orderedItems.length > 0 ? orderedItems : [{ name: 'No items ordered', weight: '-', rate: '-', amount: '0' }];

  let subtotal = 0;
  orderedItems.forEach(it => {
    const a = parseFloat(it.amount);
    if (!isNaN(a)) subtotal += a;
  });
  const tempo = parseFloat(tempoHire) || 0;
  const grandTotal = Math.round((subtotal + tempo) * 100) / 100;

  // Geometry
  const scale = 2; // 2x Retina resolution
  const W = 640;
  const tL = 28;
  const tR = 612;
  const tW = tR - tL; // 584px

  // Column boundaries
  const c1 = tL + 46;  // 74  (No. column: 46px)
  const c2 = tL + 306; // 334 (Particulars column: 260px)
  const c3 = tL + 396; // 424 (Weight column: 90px)
  const c4 = tL + 476; // 504 (Rate column: 80px)
                       // Amount column: 108px (to 612)

  const thH = 30;
  const rowH = 25;
  const tempoH = 26;
  const totH = 32;

  const tableTopY = 208;
  const tableBottomY = tableTopY + thH + (rows.length * rowH) + tempoH + totH;
  const totalH = tableBottomY + 54;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(totalH * scale);

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  // Outer Decorative Double Border
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(10, 10, W - 20, totalH - 20);

  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, W - 28, totalH - 28);

  // 1. Top Blessings (Devanagari)
  ctx.fillStyle = '#166534';
  ctx.font = '600 11px "Noto Sans Devanagari", "Inter", sans-serif';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillText('|| श्री महालिंगराया प्रसन्न ||', 24, 30);

  ctx.textAlign = 'center';
  ctx.fillText('|| श्री स्वामी समर्थ प्रसन्न ||', W / 2, 30);

  ctx.textAlign = 'right';
  ctx.fillText('|| श्री बालाजी प्रसन्न ||', W - 24, 30);

  // 2. Logo
  const logoX = 26;
  const logoY = 48;
  const logoSize = 64;

  // Draw logo image with rounded clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (logo.complete && logo.naturalWidth > 0) {
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } else {
    ctx.fillStyle = '#ecf7f0';
    ctx.fill();
  }
  ctx.restore();

  // Subtle border around logo
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Header Texts (Centered)
  const textCenterX = 350;

  // Title
  ctx.fillStyle = '#c81e1e';
  ctx.font = '900 22px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BIROBA VEGETABLE SUPPLIERS', textCenterX, 58);

  // Subtitle
  ctx.fillStyle = '#166534';
  ctx.font = '700 10.5px "Inter", sans-serif';
  ctx.fillText('ALL KINDS OF FRESH VEGETABLE & FRUITS WHOLESALE SUPPLIERS', textCenterX, 76);

  // Address & Contacts
  ctx.fillStyle = '#14532d';
  ctx.font = '600 10px "Inter", sans-serif';
  ctx.fillText('Old Bhaji Market Byculla Mumbai-400 027 • M.: 9892406958 / 8451869058', textCenterX, 92);

  // Prop.
  ctx.fillStyle = '#c81e1e';
  ctx.font = '800 12.5px "Inter", sans-serif';
  ctx.fillText('Prop.: Birappa B. Nigadi', textCenterX, 110);

  // 4. Header Divider Line
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24, 126);
  ctx.lineTo(W - 24, 126);
  ctx.stroke();

  // 5. Invoice Metadata (No. & Date)
  const metaY = 148;
  ctx.fillStyle = '#166534';
  ctx.font = '800 12px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('No. :', 28, metaY);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px "Inter", sans-serif';
  ctx.fillText(invoiceNo || '-', 64, metaY);

  // Underline for No.
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(60, metaY + 5);
  ctx.lineTo(150, metaY + 5);
  ctx.stroke();

  // Date
  ctx.fillStyle = '#166534';
  ctx.font = '800 12px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Date :', W - 145, metaY);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px "Inter", sans-serif';
  ctx.fillText(formatDateDisplay(date), W - 28, metaY);

  // Underline for Date
  ctx.beginPath();
  ctx.moveTo(W - 140, metaY + 5);
  ctx.lineTo(W - 28, metaY + 5);
  ctx.stroke();

  // 6. Customer Name Row (M/s.)
  const custY = 176;
  ctx.fillStyle = '#166534';
  ctx.font = '800 13px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('M/s. :', 28, custY);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 15px "Inter", sans-serif';
  ctx.fillText(customerName.toUpperCase(), 74, custY);

  // Underline for M/s.
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(70, custY + 5);
  ctx.lineTo(W - 28, custY + 5);
  ctx.stroke();

  // 7. Table Header
  let curY = tableTopY;
  ctx.fillStyle = '#ecf7f0';
  ctx.fillRect(tL, curY, tW, thH);

  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tL, curY, tW, thH);

  ctx.fillStyle = '#14532d';
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'center';
  ctx.fillText('NO.', (tL + c1) / 2, curY + thH / 2);

  ctx.textAlign = 'left';
  ctx.fillText('PARTICULARS', c1 + 10, curY + thH / 2);

  ctx.textAlign = 'center';
  ctx.fillText('WEIGHT', (c2 + c3) / 2, curY + thH / 2);

  // RATE & PER
  ctx.fillText('RATE', (c3 + c4) / 2, curY + (thH / 2) - 5);
  ctx.font = '700 8.5px "Inter", sans-serif';
  ctx.fillText('PER', (c3 + c4) / 2, curY + (thH / 2) + 6);

  // AMOUNT & RS.
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', tR - 10, curY + (thH / 2) - 5);
  ctx.font = '700 8.5px "Inter", sans-serif';
  ctx.fillText('RS.', tR - 10, curY + (thH / 2) + 6);

  curY += thH;

  // 8. Item Rows
  rows.forEach((r, idx) => {
    // Alternating background
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tL, curY, tW, rowH);
    }

    // Bottom row line
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(tL, curY + rowH);
    ctx.lineTo(tR, curY + rowH);
    ctx.stroke();

    const textY = curY + (rowH / 2);

    // No.
    ctx.fillStyle = '#475569';
    ctx.font = '700 10.5px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${idx + 1}.`, (tL + c1) / 2, textY);

    // Particulars
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11.5px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, c1 + 10, textY);

    // Weight
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 11.5px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatWeightClean(r.weight), (c2 + c3) / 2, textY);

    // Rate
    const rateText = r.mode === 'lump_sum' || r.mode === 'free' || !r.rate ? '-' : `${r.rate}${r.mode === 'per_100' ? '/100' : ''}`;
    ctx.fillStyle = '#334155';
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rateText, (c3 + c4) / 2, textY);

    // Amount
    const amountText = r.mode === 'free' ? '-' : (r.amount ? formatMoney(r.amount) : '-');
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 11.5px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(amountText, tR - 10, textY);

    curY += rowH;
  });

  // 9. Tempo Hire Row
  ctx.fillStyle = '#f0fdf4';
  ctx.fillRect(tL, curY, tW, tempoH);
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tL, curY);
  ctx.lineTo(tR, curY);
  ctx.stroke();

  ctx.fillStyle = '#166534';
  ctx.font = '800 11.5px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Tempo Hire', c4 - 10, curY + (tempoH / 2));

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px "Inter", sans-serif';
  ctx.fillText(tempo > 0 ? formatMoney(tempo) : '-', tR - 10, curY + (tempoH / 2));

  curY += tempoH;

  // 10. Total Row
  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(tL, curY, tW, totH);
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tL, curY);
  ctx.lineTo(tR, curY);
  ctx.stroke();

  ctx.fillStyle = '#166534';
  ctx.font = '900 14px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Total', c4 - 10, curY + (totH / 2));

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 15px "Inter", sans-serif';
  ctx.fillText(formatMoney(grandTotal), tR - 10, curY + (totH / 2));

  curY += totH;

  // 11. Vertical Column Separator Lines & Outer Box for Table
  ctx.strokeStyle = '#1f6f43';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tL, tableTopY, tW, curY - tableTopY);

  // Column vertical lines
  [c1, c2, c3, c4].forEach((x, colIdx) => {
    // For weight/rate columns, stop before Tempo Hire
    const bottomY = colIdx >= 1 && colIdx <= 2 ? curY - tempoH - totH : curY;
    ctx.beginPath();
    ctx.moveTo(x, tableTopY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
  });

  // 12. Footer Status & Business Signature
  const footerY = curY + 22;

  // Status Badge
  const isPaid = paymentStatus === 'Paid';
  const badgeText = `Status: ${paymentStatus}`;
  ctx.font = '700 10.5px "Inter", sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 16;
  const badgeH = 22;

  ctx.fillStyle = isPaid ? '#ecfdf5' : '#fef3c7';
  ctx.strokeStyle = isPaid ? '#86efac' : '#fcd34d';
  ctx.lineWidth = 1;

  // Rounded pill for status
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(tL, footerY - (badgeH / 2), badgeW, badgeH, 6) : ctx.rect(tL, footerY - (badgeH / 2), badgeW, badgeH);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isPaid ? '#166534' : '#92400e';
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, tL + 8, footerY);

  // Business signature
  ctx.fillStyle = '#c81e1e';
  ctx.font = '900 12px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('For BIROBA VEGETABLE SUPPLIERS', tR, footerY);

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
 * On mobile devices, uses the Web Share API (File Sharing) to open native WhatsApp
 * with the invoice image attached ready to send to any selected contact.
 */
export async function shareInvoiceAsImage(targetElementOrId, meta = {}, showToast = () => {}) {
  try {
    const invoiceNo = meta.invoiceNo || '101';
    const customerName = (meta.customerName || 'Customer').trim();
    const safeCustomer = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Biroba_Bill_${invoiceNo}_${safeCustomer}.png`;

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
          text: `Biroba Vegetable Suppliers — Bill #${invoiceNo} for ${customerName}`
        });
        showToast('✅ WhatsApp / Share Sheet opened!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          // User cancelled the share dialog
          return;
        }
        console.warn('Web Share API error, using fallback:', err);
      }
    }

    // 2. Fallback for Desktop/browsers without file sharing:
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
      showToast('📋 Invoice image copied! In WhatsApp, just press Paste (Ctrl+V) to send.');
    } else {
      showToast('📥 Invoice image downloaded! Drag or attach it into your WhatsApp chat.');
    }
  } catch (err) {
    console.error('Failed to share invoice as image:', err);
    showToast('⚠️ Could not generate image. Please try again.');
  }
}
