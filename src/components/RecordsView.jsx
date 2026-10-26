import React, { useState } from 'react';
import { formatDateDisplay, formatMoney, computeRecordGrandTotal, formatRecordForWhatsApp, openWhatsAppShare } from '../utils/storage';
import { shareInvoiceAsImage } from '../utils/whatsappImageShare';

export default function RecordsView({
  records,
  setRecords,
  restaurantsList,
  catalog,
  onEditRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onOpenPdf,
  showToast
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  let totalBilling = 0;
  let unpaid = 0;
  let paid = 0;

  records.forEach(r => {
    const gt = computeRecordGrandTotal(r);
    totalBilling += gt;
    if (r.paymentStatus === 'Credit / Unpaid') unpaid += gt;
    else paid += gt;
  });

  const filtered = records.filter(r => {
    if (statusFilter === 'Credit / Unpaid' && r.paymentStatus !== 'Credit / Unpaid') return false;
    if (statusFilter === 'Paid' && r.paymentStatus === 'Credit / Unpaid') return false;
    if (search) {
      const q = search.trim().toLowerCase();
      const matchInv = String(r.invoiceNo || '').toLowerCase().includes(q);
      const matchCust = String(r.customerName || '').toLowerCase().includes(q);
      const matchDate = formatDateDisplay(r.date).toLowerCase().includes(q);
      if (!matchInv && !matchCust && !matchDate) return false;
    }
    return true;
  });

  function exportCSV() {
    if (records.length === 0) {
      showToast('⚠️ No records to export');
      return;
    }
    const lines = [];
    lines.push(['Invoice No', 'Date', 'Restaurant', 'Payment Status', 'Items Count', 'Tempo Hire', 'Grand Total', 'Breakdown'].join(','));
    records.forEach(rec => {
      const parts = [];
      if (rec.items) {
        Object.keys(rec.items).forEach(k => {
          const it = rec.items[k];
          const veg = catalog.find(x => x.id === k);
          const name = veg?.name || it.name || k;
          parts.push(`${name}: ${it.weight}${it.mode === 'per_100' ? 'pcs' : 'kg'}=Rs.${it.amount}`);
        });
      }
      lines.push([
        `"${rec.invoiceNo || ''}"`,
        `"${formatDateDisplay(rec.date)}"`,
        `"${rec.customerName || ''}"`,
        `"${rec.paymentStatus || ''}"`,
        `"${parts.length}"`,
        `"${rec.tempoHire || 0}"`,
        `"${computeRecordGrandTotal(rec)}"`,
        `"${parts.join('; ')}"`
      ].join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Biroba_All_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📊 Exported CSV');
  }

  function backupJSON() {
    const data = {
      exportedAt: new Date().toISOString(),
      business: 'Biroba Vegetable Suppliers',
      records
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Biroba_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('💾 Backup downloaded');
  }

  function restoreJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.records && Array.isArray(parsed.records)) {
          setRecords(parsed.records);
          showToast('✅ Restored records from backup');
        } else {
          showToast('⚠️ Invalid backup file format');
        }
      } catch (err) {
        showToast('⚠️ Error parsing backup file');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="no-print space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Saved Invoices</p>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-1">{records.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Billing</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">₹{formatMoney(totalBilling)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Credit / Unpaid</p>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">₹{formatMoney(unpaid)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Paid / Collected</p>
          <p className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">₹{formatMoney(paid)}</p>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Filter by Restaurant (M/s.) or Invoice No..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="Credit / Unpaid">Credit / Unpaid Only</option>
            <option value="Paid">Paid Only</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportCSV} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5">
            <span>📊</span>
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={backupJSON} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition">
            ⬇️ Backup
          </button>
          <label className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer">
            ⬆️ Restore
            <input type="file" accept=".json" onChange={restoreJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Saved Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Restaurant (M/s.)</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Tempo Hire</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map(rec => {
                const gt = computeRecordGrandTotal(rec);
                const isUnp = rec.paymentStatus === 'Credit / Unpaid';
                const itemsCount = Object.keys(rec.items || {}).length;

                return (
                  <tr key={rec.recordId} className="hover:bg-slate-50 transition border-b border-slate-100">
                    <td className="py-2.5 px-4 font-bold text-slate-800">#{rec.invoiceNo || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-semibold">{formatDateDisplay(rec.date)}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{rec.customerName || '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{itemsCount} items</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600 font-semibold">{rec.tempoHire > 0 ? `₹${formatMoney(rec.tempoHire)}` : '-'}</td>
                    <td className="py-2.5 px-4 text-right font-extrabold text-emerald-800 text-sm">₹{formatMoney(gt)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isUnp ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isUnp ? 'Credit / Unpaid' : 'Paid'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button type="button" onClick={() => onEditRecord(rec)} className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded mr-1">
                        ✏️ Edit
                      </button>
                      <button type="button" onClick={() => onDuplicateRecord(rec.recordId)} className="px-2 py-1 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded mr-1">
                        📋 Today
                      </button>
                      <button type="button" onClick={() => onOpenPdf(rec)} className="px-2 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded mr-1">
                        📄 PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          shareInvoiceAsImage(null, {
                            invoiceNo: rec.invoiceNo,
                            customerName: rec.customerName,
                            date: rec.date,
                            record: rec,
                            catalog
                          }, showToast);
                        }}
                        className="px-2 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded mr-1"
                        title="Send invoice image on WhatsApp"
                      >
                        📲 WA Image
                      </button>
                      <button type="button" onClick={() => onDeleteRecord(rec.recordId)} className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded">
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400 font-medium">No billing records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
