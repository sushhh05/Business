import { DEFAULT_CATALOG, DEFAULT_FRUIT_CATALOG, SAMPLE_BT_INVOICE, SAMPLE_LOCOMO_FRUIT_INVOICE, SAMPLE_POWAI_INVOICE } from '../data/defaultCatalog.js';
export { DEFAULT_CATALOG, DEFAULT_FRUIT_CATALOG, SAMPLE_BT_INVOICE, SAMPLE_LOCOMO_FRUIT_INVOICE, SAMPLE_POWAI_INVOICE };
import { PREDEFINED_RESTAURANTS } from '../data/restaurants.js';

export const COMPANY_INFO = {
  name: 'Biroba Vegetable Suppliers',
  tagline: 'All kinds of fresh vegetables and fruits, wholesale suppliers',
  address: 'Old Bhaji Market, Byculla, Mumbai 400 027',
  phone: '9892406958 / 7400106277',
  proprietor: 'Birappa B. Nigadi'
};

export const STORAGE_KEYS = {
  CATALOG: 'biroba_veg_catalog_v3',
  FRUIT_CATALOG: 'biroba_fruit_catalog_v3',
  RECORDS: 'biroba_invoice_records_v3',
  CUSTOM_CUSTOMERS: 'biroba_custom_customers_v3',
  ACTIVE_DRAFT: 'biroba_active_bill_draft_v5',
  LAST_ACTIVE_TAB: 'biroba_last_active_tab_v1'
};

export function loadActiveDraft(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.items && typeof parsed.items === 'object') {
      // Discard any legacy demo/sample invoice
      if (
        parsed.recordId === 'rec_powai_2211' ||
        parsed.invoiceNo === '2211' ||
        parsed.customerName === 'Powai (पवई)' ||
        (parsed.customerName === 'SAI DARSHAN' && String(parsed.recordId || '').startsWith('rec_powai'))
      ) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_DRAFT);
        return fallback;
      }
      return parsed;
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}

export function saveActiveDraft(draft) {
  try {
    if (draft && typeof draft === 'object') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DRAFT, JSON.stringify(draft));
    }
  } catch (e) {}
}

export function loadLastActiveTab() {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_TAB);
    if (val && ['INVOICE', 'SHEET', 'RECORDS', 'CATALOG'].includes(val)) {
      return val;
    }
    return 'INVOICE';
  } catch (e) {
    return 'INVOICE';
  }
}

export function saveLastActiveTab(tab) {
  try {
    if (tab && typeof tab === 'string') {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_TAB, tab);
    }
  } catch (e) {}
}

export function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATALOG);
    if (!raw) return DEFAULT_CATALOG;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATALOG;
  } catch (e) {
    return DEFAULT_CATALOG;
  }
}

export function saveCatalog(catalog) {
  try {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
  } catch (e) {}
}

export function loadFruitCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FRUIT_CATALOG);
    if (!raw) return DEFAULT_FRUIT_CATALOG;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FRUIT_CATALOG;
  } catch (e) {
    return DEFAULT_FRUIT_CATALOG;
  }
}

export function saveFruitCatalog(catalog) {
  try {
    localStorage.setItem(STORAGE_KEYS.FRUIT_CATALOG, JSON.stringify(catalog));
  } catch (e) {}
}

export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) return [SAMPLE_BT_INVOICE, SAMPLE_LOCOMO_FRUIT_INVOICE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(r => r.recordId !== 'rec_powai_2211' && r.invoiceNo !== '2211' && r.customerName !== 'Powai (पवई)');
    }
    return [SAMPLE_BT_INVOICE, SAMPLE_LOCOMO_FRUIT_INVOICE];
  } catch (e) {
    return [SAMPLE_BT_INVOICE, SAMPLE_LOCOMO_FRUIT_INVOICE];
  }
}

export function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {}
}

export function loadCustomCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_CUSTOMERS);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) {
    return [];
  }
}

export function saveCustomCustomers(customers) {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CUSTOMERS, JSON.stringify(customers));
  } catch (e) {}
}

export function getAllRestaurants(customList) {
  const set = new Set(
    [...PREDEFINED_RESTAURANTS, ...(customList || [])]
      .filter(c => c && c !== 'Powai (पवई)' && c !== 'Powai')
  );
  return Array.from(set);
}

/**
 * Looks up the most recent rates charged to a specific restaurant across their invoice history.
 * Scans past invoices from newest to oldest.
 * 
 * @param {string} customerName 
 * @param {Array} records 
 * @returns {Object} Map of { [itemId]: { rate: string, fromInvoiceNo: string, date: string } }
 */
export function getCustomerLastRates(customerName, records = null) {
  const allRecords = records || loadRecords();
  if (!customerName || !Array.isArray(allRecords) || allRecords.length === 0) {
    return {};
  }

  const cleanName = customerName.trim().toUpperCase();

  const customerBills = allRecords
    .filter(r => r.customerName && r.customerName.trim().toUpperCase() === cleanName)
    .sort((a, b) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return String(b.invoiceNo || b.recordId || '').localeCompare(String(a.invoiceNo || a.recordId || ''));
    });

  const rateMap = {};
  for (const bill of customerBills) {
    if (!bill.items || typeof bill.items !== 'object') continue;
    for (const [itemId, it] of Object.entries(bill.items)) {
      if (!rateMap[itemId] && it && it.rate && parseFloat(it.rate) > 0) {
        rateMap[itemId] = {
          rate: String(it.rate),
          invoiceNo: bill.invoiceNo || '',
          date: bill.date || ''
        };
      }
    }
  }

  return rateMap;
}

export function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateLong(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[monthIdx] || parts[1]} ${year}`;
}

export function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatMoney(num) {
  const n = Number(num) || 0;
  return Number.isInteger(n)
    ? n.toLocaleString('en-IN')
    : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWeightClean(wStr) {
  if (wStr === undefined || wStr === null || wStr === '') return '';
  const n = parseFloat(wStr);
  if (isNaN(n)) return String(wStr).trim();
  return String(n);
}

export function getItemUnit(itemMeta, currentItem) {
  if (currentItem && currentItem.unit) return currentItem.unit;
  if (itemMeta && itemMeta.unit) return itemMeta.unit;
  if (itemMeta && itemMeta.mode === 'per_100') return '100 pcs';
  return 'kg';
}

export function isItemOrdered(item) {
  if (!item) return false;
  const w = String(item.weight || '').trim();
  const a = String(item.amount || '').trim();
  return (w !== '' && parseFloat(w) > 0) || (a !== '' && parseFloat(a) > 0);
}

export function computeRowAmount(weightStr, rateStr, currentAmountStr, mode, unit) {
  const w = parseFloat(weightStr);
  const r = parseFloat(rateStr);
  if (mode === 'free') return '';
  if (mode === 'lump_sum') return currentAmountStr !== undefined ? String(currentAmountStr) : '';
  if (!isNaN(w) && !isNaN(r)) {
    // 1. Explicit KG: always per kg
    if (unit === 'kg') {
      return String(Math.round(w * r * 100) / 100);
    }

    // 2. 100 Pieces: rate is per 100 pcs
    const isPer100 = unit === '100 pcs' || unit === 'per_100' || (mode === 'per_100' && unit !== 'kg');
    if (isPer100) {
      // If user entered piece count (e.g. 50, 80, 100, 200, >= 10): (w / 100) * r
      // If user entered hundreds count (e.g. 1, 2, 0.5, < 10): w * r
      const raw = w >= 10 ? (w / 100) * r : w * r;
      return String(Math.round(raw * 100) / 100);
    }

    // 3. Standard units (bundle, pkt, pcs, dozen, etc.)
    return String(Math.round(w * r * 100) / 100);
  }
  return '';
}

export function computeRecordGrandTotal(rec) {
  let sub = 0;
  if (rec.items) {
    Object.keys(rec.items).forEach(k => {
      const it = rec.items[k];
      const a = parseFloat(it.amount);
      if (!isNaN(a) && a > 0) sub += a;
    });
  }
  const th = parseFloat(rec.tempoHire) || 0;
  return Math.round((sub + th) * 100) / 100;
}

export function numberToIndianWords(num) {
  const n = Math.round(Number(num) || 0);
  if (n <= 0) return 'Rupees Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(val) {
    if (val < 20) return a[val];
    return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
  }

  function threeDigits(val) {
    const h = Math.floor(val / 100);
    const rem = val % 100;
    let res = '';
    if (h > 0) res += a[h] + ' Hundred';
    if (rem > 0) res += (res ? ' ' : '') + twoDigits(rem);
    return res;
  }

  let str = '';
  let remaining = n;

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crore > 0) str += twoDigits(crore) + ' Crore ';

  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakh > 0) str += twoDigits(lakh) + ' Lakh ';

  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousand > 0) str += twoDigits(thousand) + ' Thousand ';

  if (remaining > 0) {
    str += threeDigits(remaining) + ' ';
  }

  return `Rupees ${str.trim()} Only`;
}

export function formatRecordForWhatsApp(rec, catalog) {
  const isFruit = rec.billCategory === 'FRUITS';
  const subtotal = Object.values(rec.items || {}).reduce((sum, it) => {
    const a = parseFloat(it.amount);
    return !isNaN(a) ? sum + a : sum;
  }, 0);
  const tempo = parseFloat(rec.tempoHire) || 0;
  const grandTotal = Math.round((subtotal + tempo) * 100) / 100;

  const lines = [
    `*INVOICE #${rec.invoiceNo || '-'}*`,
    `*${COMPANY_INFO.name}*`,
    `${COMPANY_INFO.tagline}`,
    `${COMPANY_INFO.address} Phone: ${COMPANY_INFO.phone}`,
    `Proprietor: ${COMPANY_INFO.proprietor}`,
    '────────────────────────────',
    `*Invoice Date:* ${formatDateLong(rec.date) || formatDateDisplay(rec.date)}`,
    `*Bill To (M/s):* ${rec.customerName || 'Customer'}`,
    '────────────────────────────',
    '*#  Item  |  Qty  |  Rate  |  Amount*'
  ];

  let idx = 0;
  if (rec.items && catalog) {
    catalog.forEach(v => {
      const it = rec.items[v.id];
      if (isItemOrdered(it)) {
        idx++;
        const unit = it.unit || v.unit || (it.mode === 'per_100' ? '100 pcs' : 'kg');
        const w = `${formatWeightClean(it.weight)} ${unit}`;
        const r = it.mode === 'lump_sum' || it.mode === 'free' || !it.rate ? '-' : `Rs ${it.rate}`;
        const a = it.mode === 'free' ? 'FREE' : `Rs ${formatMoney(it.amount)}`;
        lines.push(`${idx}. ${v.name} : ${w} @ ${r} = *${a}*`);
      }
    });
  }

  lines.push('────────────────────────────');
  lines.push(`Subtotal (Items): Rs ${formatMoney(subtotal)}`);
  if (tempo > 0) {
    lines.push(`Tempo Hire / Delivery: Rs ${formatMoney(tempo)}`);
  }
  lines.push(`*TOTAL DUE: Rs ${formatMoney(grandTotal)}*`);
  lines.push(`*Amount in words:* ${numberToIndianWords(grandTotal)}`);
  lines.push('────────────────────────────');
  lines.push(`*For ${COMPANY_INFO.name}*`);
  lines.push('_Authorised Signatory_');
  return lines.join('\n');
}

export function openWhatsAppShare(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
