import React, { useState } from 'react';
import { formatDateDisplay, formatMoney, computeRecordGrandTotal, getTodayISO, formatRecordForWhatsApp, openWhatsAppShare } from '../utils/storage';
import { shareInvoiceAsImage } from '../utils/whatsappImageShare';

export default function SheetView({
  records,
  setRecords,
  restaurantsList,
  catalog,
  onEditRecordInBill,
  onDuplicateForToday,
  onDeleteRecord,
  onOpenPdfForRecord,
  onStartNewBillForCustomer,
  showToast
}) {
  const [activeTab, setActiveTab] = useState(restaurantsList[0] || 'SAI DARSHAN');
  const [dateFilter, setDateFilter] = useState('');

  // Fallback to first restaurant if activeTab is not in list
  const effectiveActiveTab = restaurantsList.includes(activeTab)
    ? activeTab
    : (restaurantsList[0] || 'SAI DARSHAN');

  const filteredRecords = records.filter(r => {
    if (r.customerName !== effectiveActiveTab) return false;
    if (dateFilter && r.date !== dateFilter) return false;
    return true;
  });

  filteredRecords.sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.invoiceNo || '').localeCompare(String(a.invoiceNo || '')));

  let totalRevenue = 0;
  let totalUnpaid = 0;
  let totalPaid = 0;

  filteredRecords.forEach(r => {
    const gt = computeRecordGrandTotal(r);
    totalRevenue += gt;
    if (r.paymentStatus === 'Credit / Unpaid') totalUnpaid += gt;
    else totalPaid += gt;
  });

  function toggleRecordStatus(recordId) {
    setRecords(prev =>
      prev.map(r => {
        if (r.recordId === recordId) {
          const nextStatus = r.paymentStatus === 'Credit / Unpaid' ? 'Paid - Cash' : 'Credit / Unpaid';
          showToast(`Status updated to: ${nextStatus}`);
          return { ...r, paymentStatus: nextStatus };
        }
        return r;
      })
    );
  }

  function exportTabCSV() {
    if (filteredRecords.length === 0) {
      showToast('⚠️ No records to export');
      return;
    }
    const lines = [];
    lines.push(['Invoice No', 'Date', 'Restaurant (M/s.)', 'Total Amount', 'Payment Status'].join(','));
    filteredRecords.forEach(rec => {
      lines.push([
        `"${rec.invoiceNo || ''}"`,
        `"${formatDateDisplay(rec.date)}"`,
        `"${rec.customerName || ''}"`,
        `"${computeRecordGrandTotal(rec)}"`,
        `"${rec.paymentStatus || ''}"`
      ].join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Biroba_Sheet_${effectiveActiveTab.replace(/[^a-zA-Z0-9]/g, '_')}_${dateFilter || getTodayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`📊 Exported CSV for ${effectiveActiveTab}`);
  }

  return (
    <div className="no-print space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-base flex items-center justify-center">📊</span>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Spreadsheet Ledger &amp; Restaurant Tabs</h2>
            <p className="text-xs text-slate-500">Live view of Invoice #, Date, Restaurant, Total Amount &amp; Payment Status.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 pl-1.5">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button type="button" onClick={() => setDateFilter(getTodayISO())} className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold border border-slate-200 transition">
              Today
            </button>
            <button type="button" onClick={() => setDateFilter('')} className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold border border-slate-200 transition">
              All Dates
            </button>
          </div>

          <button
            type="button"
            onClick={() => onStartNewBillForCustomer(effectiveActiveTab)}
            className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <span>➕</span>
            <span>New {effectiveActiveTab} Bill</span>
          </button>

          <button
            type="button"
            onClick={exportTabCSV}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition flex items-center gap-1"
          >
            <span>📊</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Individual Restaurant Tabs Bar (No Master Tab) */}
      <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-800 overflow-x-auto shadow-inner flex items-center gap-1.5 scrollbar-thin">
        {restaurantsList.map(tabName => {
          const isActive = tabName === effectiveActiveTab;
          return (
            <button
              key={tabName}
              type="button"
              onClick={() => setActiveTab(tabName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-white text-emerald-950 shadow-md font-extrabold border-b-2 border-emerald-600'
                  : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800/80 hover:text-white'
              }`}
            >
              <span>🏢</span>
              <span>{tabName}</span>
            </button>
          );
        })}
      </div>

      {/* Spreadsheet Table: Invoice # (1st column), Date, Restaurant, Total Amount, Status, Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4 w-28 text-left">Invoice #</th>
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-4 min-w-[160px]">Restaurant (M/s.)</th>
                <th className="py-3 px-4 text-right min-w-[130px] text-emerald-900 bg-emerald-50/60 font-black">Total Amount</th>
                <th className="py-3 px-4 text-center w-36">Status</th>
                <th className="py-3 px-4 text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {filteredRecords.map(rec => {
                const grandTotal = computeRecordGrandTotal(rec);
                const isUnpaid = rec.paymentStatus === 'Credit / Unpaid';

                return (
                  <tr key={rec.recordId} className="hover:bg-emerald-50/40 transition border-b border-slate-100">
                    <td className="py-3 px-4 text-left font-bold text-slate-800 whitespace-nowrap">#{rec.invoiceNo || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{formatDateDisplay(rec.date)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{rec.customerName || '-'}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-900 bg-emerald-50/50 text-sm whitespace-nowrap">
                      ₹{formatMoney(grandTotal)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleRecordStatus(rec.recordId)}
                        title="Click to toggle Paid/Unpaid"
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          isUnpaid
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                        }`}
                      >
                        {isUnpaid ? 'Credit / Unpaid' : 'Paid'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditRecordInBill(rec)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg mr-1 transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateForToday(rec.recordId)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg mr-1 transition"
                      >
                        📋 Today
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPdfForRecord(rec)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg mr-1 transition"
                      >
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
                        className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg mr-1 transition"
                        title="Send invoice image on WhatsApp"
                      >
                        📲 WA Image
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.recordId)}
                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
                    No records found for {effectiveActiveTab} {dateFilter ? `on ${formatDateDisplay(dateFilter)}` : ''}.
                    <br />
                    <button
                      type="button"
                      onClick={() => onStartNewBillForCustomer(effectiveActiveTab)}
                      className="mt-2 text-emerald-700 underline font-bold"
                    >
                      Click here to create a new bill
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot className="sticky bottom-0 bg-emerald-100/90 text-emerald-950 font-black border-t-2 border-emerald-800 shadow-md z-10 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4 text-left">TOTALS</td>
                  <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">{filteredRecords.length} bills</td>
                  <td className="py-3 px-4 text-slate-600">—</td>
                  <td className="py-3 px-4 text-right text-base text-emerald-950 font-black">₹{formatMoney(totalRevenue)}</td>
                  <td className="py-3 px-4 text-center text-[11px] leading-tight">
                    <span className="text-amber-800 block">Unpaid: ₹{formatMoney(totalUnpaid)}</span>
                    <span className="text-emerald-800 block">Paid: ₹{formatMoney(totalPaid)}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-bold text-emerald-800">Ready</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>💡 Click on any <b>Status</b> badge (Paid/Unpaid) to toggle payment status instantly.</span>
        <span>Click <b>✏️ Edit</b> to load that invoice into Create Bill view.</span>
      </div>
    </div>
  );
}
