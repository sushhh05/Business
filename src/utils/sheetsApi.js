/**
 * Biroba Sheets API — Client-side helper
 * Calls the local Express server which handles Google Sheets writes.
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
      return { ok: false, error: err.error };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // Network error — server might not be running; silently degrade
    console.warn('[SheetsAPI] Could not reach sync server:', err.message);
    return { ok: false, error: err.message };
  }
}
