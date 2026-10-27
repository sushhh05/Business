import React, { useState } from 'react';
import { formatDateDisplay, formatMoney, computeRecordGrandTotal, getTodayISO, formatRecordForWhatsApp, openWhatsAppShare } from '../utils/storage';
import { shareInvoiceAsImage } from '../utils/whatsappImageShare';
import { generateVectorStatementPdfBytes } from '../utils/pdfGenerator';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fallback to first restaurant if activeTab is not in list
  const effectiveActiveTab = restaurantsList.includes(activeTab)
    ? activeTab
    : (restaurantsList[0] || 'SAI DARSHAN');

  // Helper date calculations
  function getDaysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getStartOfMonthISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  function setLast10Days() {
    setFromDate(getDaysAgoISO(10));
    setToDate(getTodayISO());
    showToast('📅 Selected Last 10 Days');
  }

  function setLast30Days() {
    setFromDate(getDaysAgoISO(30));
    setToDate(getTodayISO());
    showToast('📅 Selected Last 30 Days (1 Month)');
  }

  function setThisMonth() {
    setFromDate(getStartOfMonthISO());
    setToDate(getTodayISO());
    showToast('📅 Selected This Month');
  }

  function setTodayRange() {
    setFromDate(getTodayISO());
    setToDate(getTodayISO());
    showToast('📅 Selected Today');
  }

  function clearDateRange() {
    setFromDate('');
    setToDate('');
    showToast('📅 All Dates (Complete Ledger)');
  }

  const filteredRecords = records.filter(r => {
    if (r.customerName !== effectiveActiveTab) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  });

  // Chronological sort (oldest to newest) for financial statement ledger
  filteredRecords.sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || '')));

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

  function exportStatementPdf() {
    if (filteredRecords.length === 0) {
      showToast(`⚠️ No records found for ${effectiveActiveTab} in selected dates`);
      return;
    }

    try {
      const bytes = generateVectorStatementPdfBytes({
        customerName: effectiveActiveTab,
        fromDate,
        toDate,
        records: filteredRecords,
        catalog
      });

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fStr = fromDate || 'Start';
      const tStr = toDate || getTodayISO();
      a.download = `Biroba_Statement_${effectiveActiveTab.replace(/[^a-zA-Z0-9]/g, '_')}_${fStr}_to_${tStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`📄 Statement PDF exported for ${effectiveActiveTab}`);
    } catch (err) {
      console.error(err);
      showToast('❌ Failed to generate Statement PDF');
    }
  }

  function exportTabCSV() {
    if (filteredRecords.length === 0) {
      showToast('⚠️ No records to export');
      return;
    }
    const lines = [];
    lines.push(['Sr', 'Invoice No', 'Date', 'Restaurant (M/s.)', 'Items Summary', 'Total Amount (Rs.)', 'Payment Status'].join(','));
    filteredRecords.forEach((rec, idx) => {
      let itemsSummary = '-';
      if (rec.items && catalog) {
        const names = [];
        catalog.forEach(v => {
          const it = rec.items[v.id];
          if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
            names.push(`${v.name} (${it.weight || ''}${it.mode === 'per_100' ? 'pcs' : 'kg'})`);
          }
        });
        if (names.length > 0) itemsSummary = names.join('; ');
      }

      lines.push([
        `"${idx + 1}"`,
        `"${rec.invoiceNo || ''}"`,
        `"${formatDateDisplay(rec.date)}"`,
        `"${rec.customerName || ''}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        `"${computeRecordGrandTotal(rec)}"`,
        `"${rec.paymentStatus || ''}"`
      ].join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fStr = fromDate || 'Start';
    const tStr = toDate || getTodayISO();
    a.download = `Biroba_Sheet_${effectiveActiveTab.replace(/[^a-zA-Z0-9]/g, '_')}_${fStr}_to_${tStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`📊 Exported CSV for ${effectiveActiveTab}`);
  }

  return (
    <div className="no-print space-y-4">
      {/* Top Filter & Statement Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-lg flex items-center justify-center shadow-xs">📊</span>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Spreadsheet Ledger &amp; Restaurant Tabs</h2>
              <p className="text-xs text-slate-500">View and export statements for 10 days, 1 month, or custom date ranges.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onStartNewBillForCustomer(effectiveActiveTab)}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>➕</span>
              <span>New {effectiveActiveTab} Bill</span>
            </button>

            <button
              type="button"
              onClick={exportStatementPdf}
              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs border border-emerald-900 cursor-pointer"
              title="Download Statement in PDF format following Biroba invoice theme"
            >
              <span>📄</span>
              <span>Export Statement PDF</span>
            </button>

            <button
              type="button"
              onClick={exportTabCSV}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition flex items-center gap-1 cursor-pointer"
            >
              <span>📊</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Date Range Selector & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-2 py-0.5 rounded border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <span className="text-slate-400 font-bold mx-0.5">→</span>
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-2 py-0.5 rounded border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Quick Range Presets */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={setLast10Days}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
              >
                10 Days
              </button>
              <button
                type="button"
                onClick={setLast30Days}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
              >
                1 Month (30 Days)
              </button>
              <button
                type="button"
                onClick={setThisMonth}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={setTodayRange}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={clearDateRange}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
              >
                All Dates
              </button>
            </div>
          </div>

          {/* Active Range & Status KPI Chips */}
          <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
            <span className="text-slate-600">
              Showing <b>{filteredRecords.length}</b> bills
            </span>
            {(fromDate || toDate) && (
              <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {formatDateDisplay(fromDate) || 'Start'} to {formatDateDisplay(toDate) || 'Today'}
              </span>
            )}
            <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
              Total: ₹{formatMoney(totalRevenue)}
            </span>
            {totalUnpaid > 0 && (
              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                Due: ₹{formatMoney(totalUnpaid)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Individual Restaurant Tabs Bar */}
      <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-800 overflow-x-auto shadow-inner flex items-center gap-1.5 scrollbar-thin">
        {restaurantsList.map(tabName => {
          const isActive = tabName === effectiveActiveTab;
          return (
            <button
              key={tabName}
              type="button"
              onClick={() => setActiveTab(tabName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
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

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[64vh] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Sr.</th>
                <th className="py-3 px-4 w-24 text-left">Invoice #</th>
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-4 min-w-[140px]">Restaurant (M/s.)</th>
                <th className="py-3 px-4 text-right min-w-[130px] text-emerald-900 bg-emerald-50/60 font-black">Total Amount</th>
                <th className="py-3 px-4 text-center w-36">Status</th>
                <th className="py-3 px-4 text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
              {filteredRecords.map((rec, idx) => {
                const grandTotal = computeRecordGrandTotal(rec);
                const isUnpaid = rec.paymentStatus === 'Credit / Unpaid';

                return (
                  <tr key={rec.recordId} className="hover:bg-emerald-50/40 transition border-b border-slate-100">
                    <td className="py-3 px-4 text-center font-semibold text-slate-500">{idx + 1}</td>
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
                        className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
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
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg mr-1 transition cursor-pointer"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateForToday(rec.recordId)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg mr-1 transition cursor-pointer"
                      >
                        📋 Today
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPdfForRecord(rec)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg mr-1 transition cursor-pointer"
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
                        className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg mr-1 transition cursor-pointer"
                        title="Send invoice image on WhatsApp"
                      >
                        📲 WA Image
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.recordId)}
                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-medium text-xs sm:text-sm">
                    No records found for {effectiveActiveTab} {(fromDate || toDate) ? `between ${formatDateDisplay(fromDate) || 'Start'} and ${formatDateDisplay(toDate) || 'Today'}` : ''}.
                    <br />
                    <button
                      type="button"
                      onClick={() => onStartNewBillForCustomer(effectiveActiveTab)}
                      className="mt-2 text-emerald-700 underline font-bold cursor-pointer"
                    >
                      Click here to create a new bill
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot className="sticky bottom-0 bg-emerald-100/95 text-emerald-950 font-black border-t-2 border-emerald-800 shadow-md z-10 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 px-4 text-center">TOTAL</td>
                  <td className="py-3 px-4 text-left font-bold text-slate-800 whitespace-nowrap">{filteredRecords.length} bills</td>
                  <td className="py-3 px-4 text-slate-600 font-semibold whitespace-nowrap">
                    {fromDate ? formatDateDisplay(fromDate) : 'Start'} → {toDate ? formatDateDisplay(toDate) : 'Today'}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{effectiveActiveTab}</td>
                  <td className="py-3 px-4 text-right text-base text-emerald-950 font-black">₹{formatMoney(totalRevenue)}</td>
                  <td className="py-3 px-4 text-center text-[11px] leading-tight">
                    <span className="text-amber-800 block">Unpaid: ₹{formatMoney(totalUnpaid)}</span>
                    <span className="text-emerald-800 block">Paid: ₹{formatMoney(totalPaid)}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={exportStatementPdf}
                      className="px-2.5 py-1 bg-emerald-800 text-white rounded text-xs font-bold hover:bg-emerald-900 transition shadow-xs cursor-pointer"
                    >
                      📄 PDF Statement
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
        <span>💡 Click on any <b>Status</b> badge (Paid/Unpaid) to toggle payment status instantly.</span>
        <span>Export professional PDF statements for any 10-day, monthly, or custom period with one click.</span>
      </div>
    </div>
  );
}
