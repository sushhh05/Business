import { DEFAULT_CATALOG, SAMPLE_BT_INVOICE } from '../data/defaultCatalog';
export { DEFAULT_CATALOG, SAMPLE_BT_INVOICE };
import { PREDEFINED_RESTAURANTS } from '../data/restaurants';

export const STORAGE_KEYS = {
  CATALOG: 'biroba_veg_catalog_v1',
  RECORDS: 'biroba_invoice_records_v1',
  CUSTOM_CUSTOMERS: 'biroba_custom_customers_v2',
  ACTIVE_DRAFT: 'biroba_active_bill_draft_v2',
  LAST_ACTIVE_TAB: 'biroba_last_active_tab_v1'
};

export function loadActiveDraft(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.items && typeof parsed.items === 'object') {
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

export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) return [SAMPLE_BT_INVOICE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [SAMPLE_BT_INVOICE];
  } catch (e) {
    return [SAMPLE_BT_INVOICE];
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
  const set = new Set([...PREDEFINED_RESTAURANTS, ...(customList || [])]);
  return Array.from(set);
}

export function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '');
}

export function formatWeightClean(wStr) {
  if (wStr === undefined || wStr === null || wStr === '') return '';
  const n = parseFloat(wStr);
  if (isNaN(n)) return String(wStr).trim();
  return String(n);
}

export function isItemOrdered(item) {
  if (!item) return false;
  const w = String(item.weight || '').trim();
  const a = String(item.amount || '').trim();
  return (w !== '' && parseFloat(w) > 0) || (a !== '' && parseFloat(a) > 0);
}

export function computeRowAmount(weightStr, rateStr, currentAmountStr, mode) {
  const w = parseFloat(weightStr);
  const r = parseFloat(rateStr);
  if (mode === 'free') return '';
  if (mode === 'lump_sum') return currentAmountStr !== undefined ? String(currentAmountStr) : '';
  if (!isNaN(w) && !isNaN(r)) {
    const raw = mode === 'per_100' ? (w / 100) * r : w * r;
    return String(Math.round(raw * 100) / 100);
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

export function formatRecordForWhatsApp(rec, catalog) {
  const lines = [
    '🥦 *BIROBA VEGETABLE SUPPLIERS*',
    '📍 Old Bhaji Market, Byculla, Mumbai-27',
    '📞 Prop.: Birappa B. Nigadi (9892406958)',
    '━━━━━━━━━━━━━━━━━━━━',
    `🧾 *Bill No:* #${rec.invoiceNo || '-'}`,
    `📅 *Date:* ${formatDateDisplay(rec.date)}`,
    `🏢 *M/s:* *${rec.customerName || 'Customer'}*`,
    '━━━━━━━━━━━━━━━━━━━━'
  ];
  let idx = 0;
  if (rec.items && catalog) {
    catalog.forEach(v => {
      const it = rec.items[v.id];
      if (isItemOrdered(it)) {
        idx++;
        const w = formatWeightClean(it.weight) + (it.mode === 'per_100' ? ' pcs' : ' kg');
        const r = it.mode === 'lump_sum' || it.mode === 'free' || !it.rate ? '' : ` @ ₹${it.rate}`;
        const a = it.mode === 'free' ? 'FREE' : `₹${formatMoney(it.amount)}`;
        lines.push(`${idx}. ${v.name}: ${w}${r} = *${a}*`);
      }
    });
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  const tempo = parseFloat(rec.tempoHire) || 0;
  if (tempo > 0) {
    lines.push(`🚚 Tempo Hire: *₹${formatMoney(tempo)}*`);
  }
  const grandTotal = computeRecordGrandTotal(rec);
  lines.push(`💰 *GRAND TOTAL: ₹${formatMoney(grandTotal)}*`);
  lines.push(`📌 *Status:* ${rec.paymentStatus || 'Credit / Unpaid'}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('🙏 _Thank you for your business!_');
  return lines.join('\n');
}

export function openWhatsAppShare(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

