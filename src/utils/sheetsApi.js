import { loadSyncQueue, removeFromSyncQueue } from './storage.js';

/**
 * Biroba Sheets API — Client-side helper
 * Calls the local Express server or Vercel serverless function to write to Google Sheets.
 */
export async function saveInvoiceToSheet(rec, catalog) {
  try {
    const response = await fetch('/api/save-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rec, catalog }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      console.warn('[SheetsAPI] Save failed:', err.error);
      return { ok: false, error: err.error, status: response.status };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // Network error — server might not be running or client is offline
    console.warn('[SheetsAPI] Could not reach sync server:', err.message);
    return { ok: false, error: err.message, networkError: true };
  }
}

/**
 * Sequentially replay pending offline invoices to Google Sheets
 * @param {Function} onProgress Optional callback (syncedItem, remainingQueueCount)
 * @returns {Promise<{ syncedCount: number, failedCount: number, offline?: boolean }>}
 */
export async function flushSyncQueue(onProgress) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, offline: true };
  }

  const queue = loadSyncQueue();
  if (!queue || queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    if (!item || !item.rec) continue;
    try {
      const result = await saveInvoiceToSheet(item.rec, item.catalog);
      if (result && result.ok) {
        removeFromSyncQueue(item.rec.recordId);
        syncedCount++;
        if (typeof onProgress === 'function') {
          onProgress(item, loadSyncQueue().length);
        }
      } else {
        failedCount++;
        // If network error (e.g. server down or connectivity cut), stop to avoid thrashing
        if (result && result.networkError) {
          break;
        }
      }
    } catch (e) {
      failedCount++;
      break;
    }
  }

  return { syncedCount, failedCount };
}
