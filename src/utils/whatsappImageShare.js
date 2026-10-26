import html2canvas from 'html2canvas';
import { formatDateDisplay, formatMoney, isItemOrdered, formatWeightClean } from './storage';

/**
 * Capture an invoice DOM element and share as an image directly to WhatsApp.
 * On mobile devices, uses the Web Share API (File Sharing) to open native WhatsApp
 * with the invoice image attached ready to send to any selected contact.
 */
export async function shareInvoiceAsImage(targetElementOrId, meta = {}, showToast = () => {}) {
  try {
    let el = typeof targetElementOrId === 'string' ? document.getElementById(targetElementOrId) : targetElementOrId;
    
    const invoiceNo = meta.invoiceNo || '101';
    const customerName = (meta.customerName || 'Customer').trim();
    const safeCustomer = customerName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Biroba_Bill_${invoiceNo}_${safeCustomer}.png`;

    showToast('📸 Creating invoice image for WhatsApp...');

    let cleanupElement = null;

    // If the target element is hidden (e.g. mobile tab in EDIT mode), create an off-screen clone to render
    if (!el || el.offsetParent === null) {
      if (meta.record && meta.catalog) {
        cleanupElement = createOffscreenBillElement(meta.record, meta.catalog);
        document.body.appendChild(cleanupElement);
        el = cleanupElement;
      } else {
        // Fallback: search for #printableBillArea
        el = document.getElementById('printableBillArea');
      }
    }

    if (!el) {
      showToast('⚠️ Could not find bill preview to generate image');
      return;
    }

    // Capture using html2canvas with high-DPI crisp scale
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc) => {
        // Ensure cloned element is visible and properly styled in virtual DOM
        const clonedEl = clonedDoc.getElementById('printableBillArea') || clonedDoc.querySelector('.bill-paper');
        if (clonedEl) {
          clonedEl.style.display = 'block';
          clonedEl.style.visibility = 'visible';
          clonedEl.style.maxWidth = '560px';
          clonedEl.style.width = '560px';
        }
      }
    });

    if (cleanupElement && cleanupElement.parentNode) {
      cleanupElement.parentNode.removeChild(cleanupElement);
    }

    // Convert canvas to PNG blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas conversion failed'))), 'image/png', 0.95);
    });

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
    // Copy image to clipboard so user can press Ctrl+V in WhatsApp Web
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

/**
 * Creates an off-screen high-quality DOM representation of an invoice
 * for capturing when the live preview isn't currently displayed.
 */
function createOffscreenBillElement(rec, catalog) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '560px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-100';
  container.className = 'bill-paper';
  container.style.padding = '18px';
  container.style.border = '2px solid #1f6f43';
  container.style.fontFamily = "'Inter', 'Noto Sans Devanagari', sans-serif";

  const { invoiceNo, date, customerName, items = {}, tempoHire = 0, paymentStatus = 'Credit / Unpaid' } = rec;

  let subtotal = 0;
  const rowsHtml = catalog
    .filter(v => isItemOrdered(items[v.id]))
    .map((veg, idx) => {
      const it = items[veg.id] || {};
      const amt = parseFloat(it.amount) || 0;
      subtotal += amt;
      const weightText = formatWeightClean(it.weight);
      const rateText = it.mode === 'lump_sum' || it.mode === 'free' || !it.rate ? '-' : `${it.rate}${it.mode === 'per_100' ? '/100' : ''}`;
      const amountText = it.mode === 'free' ? '-' : (it.amount ? formatMoney(it.amount) : '-');

      return `
        <tr>
          <td style="text-align:center; padding:5px 6px; border:1px solid #1f6f43; font-size:12px; font-weight:600;">${idx + 1}.</td>
          <td style="padding:5px 8px; border:1px solid #1f6f43; font-size:12px; font-weight:700; color:#14532d;">${veg.name}</td>
          <td style="text-align:center; padding:5px 6px; border:1px solid #1f6f43; font-size:12px; font-weight:700;">${weightText}</td>
          <td style="text-align:center; padding:5px 6px; border:1px solid #1f6f43; font-size:12px;">${rateText}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #1f6f43; font-size:12px; font-weight:700;">${amountText}</td>
        </tr>
      `;
    })
    .join('');

  const grandTotal = Math.round((subtotal + (parseFloat(tempoHire) || 0)) * 100) / 100;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#166534; margin-bottom:6px;">
      <span>|| श्री महालिंगराया प्रसन्न ||</span>
      <span>|| श्री स्वामी समर्थ प्रसन्न ||</span>
      <span>|| श्री बालाजी प्रसन्न ||</span>
    </div>
    <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #1f6f43; padding-bottom:8px; margin-bottom:8px;">
      <div style="width:56px; height:48px; display:flex; align-items:center; justify-content:center;">
        <img src="/icon-192.png" style="max-width:100%; max-height:100%; object-fit:contain;" />
      </div>
      <div style="flex:1; text-align:center;">
        <h2 style="color:#c81e1e; font-size:18px; font-weight:900; margin:0; line-height:1.2;">BIROBA VEGETABLE SUPPLIERS</h2>
        <p style="color:#166534; font-size:10px; font-weight:700; margin:2px 0 0 0;">ALL KINDS OF FRESH VEGETABLE &amp; FRUITS WHOLESALE SUPPLIERS</p>
        <p style="color:#166534; font-size:9.5px; font-weight:600; margin:1px 0 0 0;">Old Bhaji Market Byculla Mumbai-400 027 • M.: 9892406958 / 7400106277</p>
        <p style="color:#c81e1e; font-size:12px; font-weight:800; margin:2px 0 0 0;">Prop.: Birappa B. Nigadi</p>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
      <div><span style="color:#166534; font-weight:700;">No.</span> <strong style="border-bottom:1px solid #1f6f43; padding:0 8px;">${invoiceNo || '-'}</strong></div>
      <div><span style="color:#166534; font-weight:700;">Date :</span> <strong style="border-bottom:1px solid #1f6f43; padding:0 8px;">${formatDateDisplay(date)}</strong></div>
    </div>
    <div style="font-size:13px; margin-bottom:10px;">
      <span style="color:#166534; font-weight:700;">M/s.</span> <strong style="border-bottom:1px solid #1f6f43; padding:0 12px; font-size:14px;">${customerName || '____________________'}</strong>
    </div>
    <table style="width:100%; border-collapse:collapse; table-layout:fixed; border:1.5px solid #1f6f43;">
      <colgroup>
        <col style="width:9%;" />
        <col style="width:43%;" />
        <col style="width:16%;" />
        <col style="width:14%;" />
        <col style="width:18%;" />
      </colgroup>
      <thead>
        <tr style="background:#ecf7f0;">
          <th style="padding:6px 4px; border:1px solid #1f6f43; font-size:11px; color:#14532d; font-weight:700;">No.</th>
          <th style="padding:6px 6px; border:1px solid #1f6f43; font-size:11px; color:#14532d; font-weight:700; text-align:left;">PARTICULARS</th>
          <th style="padding:6px 4px; border:1px solid #1f6f43; font-size:11px; color:#14532d; font-weight:700;">WEIGHT</th>
          <th style="padding:6px 4px; border:1px solid #1f6f43; font-size:11px; color:#14532d; font-weight:700;">RATE<br><span style="font-size:9px;">Per</span></th>
          <th style="padding:6px 6px; border:1px solid #1f6f43; font-size:11px; color:#14532d; font-weight:700; text-align:right;">AMOUNT<br><span style="font-size:9px;">Rs.</span></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:12px; color:#94a3b8; font-size:12px;">No items entered.</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #1f6f43; background:#f0fdf4;">
          <td colspan="4" style="text-align:right; font-weight:700; color:#166534; padding:6px 12px; font-size:12px;">Tempo Hire</td>
          <td style="text-align:right; font-weight:700; padding:6px 8px; font-size:12px;">${tempoHire > 0 ? formatMoney(tempoHire) : '-'}</td>
        </tr>
        <tr style="border-top:2px solid #1f6f43; background:#ecfdf5;">
          <td colspan="4" style="text-align:right; font-weight:900; color:#166534; padding:8px 12px; font-size:14px;">Total</td>
          <td style="text-align:right; font-weight:900; color:#0f172a; padding:8px 8px; font-size:15px;">₹${formatMoney(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:12px;">
      <span style="font-weight:700; background:#f8fafc; border:1px solid #cbd5e1; padding:3px 8px; border-radius:4px;">
        Status: ${paymentStatus}
      </span>
      <p style="color:#c81e1e; font-weight:900; font-size:12px; margin:0;">
        For BIROBA VEGETABLE SUPPLIERS
      </p>
    </div>
  `;

  return container;
}
