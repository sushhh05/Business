import React, { useState, useRef, useEffect } from 'react';
import {
  formatDateDisplay,
  formatMoney,
  formatWeightClean,
  isItemOrdered,
  computeRowAmount,
  formatRecordForWhatsApp,
  openWhatsAppShare
} from '../utils/storage';
import { shareInvoiceAsImage } from '../utils/whatsappImageShare';

export default function BillEntry({
  catalog,
  billData,
  setBillData,
  restaurantsList,
  onOpenAddCustomCustomer,
  onOpenAddVegetable,
  onSaveBill,
  onNewBlankBill,
  onLoadSampleBill,
  onOpenExportModal,
  showToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState('EDIT'); // 'EDIT' or 'PREVIEW'
  const rowRefs = useRef({});

  const { invoiceNo, customerName, date, paymentStatus, tempoHire, items } = billData;

  // Filter catalog rows
  const filteredCatalog = catalog.filter((veg, idx) => {
    const item = items[veg.id];
    const ordered = isItemOrdered(item);
    if (filterMode === 'ORDERED' && !ordered) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !veg.name.toLowerCase().includes(q) && !String(idx + 1).includes(q)) return false;
    return true;
  });

  const orderedCount = catalog.filter(v => isItemOrdered(items[v.id])).length;

  // Calculate totals
  let subtotal = 0;
  catalog.forEach(v => {
    const it = items[v.id];
    if (isItemOrdered(it)) {
      const a = parseFloat(it.amount);
      if (!isNaN(a) && a > 0) subtotal += a;
    }
  });
  const grandTotal = Math.round((subtotal + (parseFloat(tempoHire) || 0)) * 100) / 100;

  function updateItem(vegId, updates) {
    setBillData(prev => {
      const currentItem = prev.items[vegId] || { weight: '', rate: '', amount: '', mode: 'per_kg' };
      const updated = { ...currentItem, ...updates };

      if (updates.weight !== undefined || updates.rate !== undefined) {
        if (updated.mode === 'per_kg' || updated.mode === 'per_100') {
          updated.amount = computeRowAmount(updated.weight, updated.rate, updated.amount, updated.mode);
        }
      }

      return {
        ...prev,
        items: {
          ...prev.items,
          [vegId]: updated
        }
      };
    });
  }

  function handleKeyNavigation(e, vegId, field, rowIdx) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (field === 'qty') {
        const rateInput = rowRefs.current[`${vegId}-rate`];
        if (rateInput && !rateInput.disabled && (!rateInput.value || rateInput.value === '0')) {
          focusCell(rowIdx, 'rate');
        } else {
          focusCell(rowIdx, 'rate');
        }
      } else if (field === 'rate' || field === 'amt') {
        focusNextRowQty(rowIdx);
      }
    } else if (e.key === 'Tab') {
      if (field === 'amt' && !e.shiftKey) {
        e.preventDefault();
        focusNextRowQty(rowIdx);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (field === 'qty') focusCell(rowIdx, 'rate');
      else if (field === 'rate') focusCell(rowIdx, 'amt');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (field === 'amt') focusCell(rowIdx, 'rate');
      else if (field === 'rate') focusCell(rowIdx, 'qty');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(rowIdx + 1, field);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(rowIdx - 1, field);
    }
  }

  function focusNextRowQty(currentRowIdx) {
    focusCell(currentRowIdx + 1, 'qty');
  }

  function focusCell(targetRowIdx, field = 'qty') {
    if (targetRowIdx < 0 || targetRowIdx >= filteredCatalog.length) return;
    const targetVeg = filteredCatalog[targetRowIdx];
    if (!targetVeg) return;

    const targetEl = rowRefs.current[`${targetVeg.id}-${field}`] || rowRefs.current[`${targetVeg.id}-qty`];
    if (targetEl && !targetEl.disabled) {
      targetEl.focus();
      try {
        targetEl.select();
      } catch (_) {}
      try {
        targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (_) {}
    }
  }

  function clearAllEntries() {
    if (!confirm('Clear all quantities for the current bill?')) return;
    const cleared = {};
    catalog.forEach(v => {
      cleared[v.id] = { weight: '', rate: v.defaultRate || '', amount: '', mode: v.mode || 'per_kg' };
    });
    setBillData(prev => ({ ...prev, tempoHire: '', items: cleared }));
    showToast('Cleared all quantities');
  }

  async function handleSendWhatsApp() {
    const currentRec = {
      invoiceNo,
      date,
      customerName,
      items,
      tempoHire,
      paymentStatus
    };
    await shareInvoiceAsImage('printableBillArea', {
      invoiceNo,
      customerName,
      date,
      record: currentRec,
      catalog
    }, showToast);
  }

  return (
    <div className="space-y-3">
      {/* Mobile View Toggle: Edit Bill vs Live Bill Preview (Sticky on mobile) */}
      <div className="no-print lg:hidden bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 sticky top-[56px] z-20">
        <button
          type="button"
          onClick={() => setMobileTab('EDIT')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mobileTab === 'EDIT'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>✏️</span>
          <span>Edit Bill ({orderedCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('PREVIEW')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mobileTab === 'PREVIEW'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>👁️</span>
          <span>Live Bill Preview (₹{formatMoney(grandTotal)})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Interactive Order Entry & Controls */}
        <div className={`no-print lg:col-span-7 space-y-4 ${mobileTab === 'PREVIEW' ? 'hidden lg:block' : 'block'}`}>
          {/* Step 1: Customer & Invoice Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">1</span>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">Restaurant &amp; Bill Details</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onLoadSampleBill} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition">
                Load Sample Bill (BT - 20/10/26)
              </button>
              <button type="button" onClick={onNewBlankBill} className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition">
                + New Blank Bill
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <label htmlFor="inputInvoiceNo" className="block text-xs font-semibold text-slate-600 mb-1">Invoice No.</label>
              <input
                id="inputInvoiceNo"
                type="text"
                placeholder="e.g. 101"
                value={invoiceNo}
                onChange={e => setBillData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="inputCustomerName" className="block text-xs font-semibold text-slate-600 mb-1">M/s. (Restaurant Name) *</label>
              <input
                id="inputCustomerName"
                type="text"
                list="savedCustomersList"
                placeholder="Enter or select restaurant (e.g. BT, SAI DARSHAN)"
                value={customerName}
                onChange={e => setBillData(prev => ({ ...prev, customerName: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase"
              />
              <datalist id="savedCustomersList">
                {restaurantsList.map(r => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="inputInvoiceDate" className="block text-xs font-semibold text-slate-600 mb-1">Bill Date</label>
              <input
                id="inputInvoiceDate"
                type="date"
                value={date}
                onChange={e => setBillData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Quick Restaurant Chips & Payment Status */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Quick Select M/s.:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {restaurantsList.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBillData(prev => ({ ...prev, customerName: r }))}
                    className="text-xs bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-md font-semibold border border-slate-200 transition whitespace-nowrap"
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenAddCustomCustomer}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-950 px-2.5 py-1 rounded-md font-bold border border-emerald-300 transition whitespace-nowrap flex items-center gap-1"
                >
                  <span>➕</span>
                  <span>Add Custom</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="selectPaymentStatus" className="text-xs font-semibold text-slate-600">Status:</label>
              <select
                id="selectPaymentStatus"
                value={paymentStatus}
                onChange={e => setBillData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Credit / Unpaid">Credit / Unpaid</option>
                <option value="Paid - Cash">Paid - Cash</option>
                <option value="Paid - UPI / Bank">Paid - UPI / Bank</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Vegetable Order Entry Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">2</span>
              <div>
                <h2 className="font-bold text-slate-800 text-sm sm:text-base">Enter Today's Vegetable Quantities &amp; Rates</h2>
                <p className="text-xs text-slate-500">Only items with a Weight or Amount entered appear on the final restaurant invoice.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onOpenAddVegetable} className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition">
                + Add Custom Item
              </button>
              <button type="button" onClick={clearAllEntries} className="text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg transition">
                Clear Entries
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search vegetable (e.g. Flower, Tomato, Lemon, Turya)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold px-1">✕</button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${filterMode === 'ALL' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                All Items ({catalog.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('ORDERED')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${filterMode === 'ORDERED' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Ordered Only ({orderedCount})
              </button>
            </div>
          </div>

          {/* Scrollable Vegetable Entry List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                    <th className="py-2.5 px-2.5">Vegetable (Particulars)</th>
                    <th className="py-2.5 px-2 w-28">Mode</th>
                    <th className="py-2.5 px-2 w-24 text-right">Weight/Qty</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredCatalog.map((veg, rIdx) => {
                    const st = items[veg.id] || { weight: '', rate: veg.defaultRate || '', amount: '', mode: veg.mode || 'per_kg' };
                    const ordered = isItemOrdered(st);

                    return (
                      <tr key={veg.id} className={ordered ? 'bg-emerald-50/70 hover:bg-emerald-100/60 transition' : 'hover:bg-slate-50 transition'}>
                        <td className="py-2 px-2.5 text-center font-semibold text-xs text-slate-500">{rIdx + 1}</td>
                        <td className="py-2 px-2.5 font-semibold text-slate-800 text-xs sm:text-sm">
                          {ordered && <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1.5" />}
                          {veg.name}
                        </td>
                        <td className="py-1.5 px-1.5">
                          <select
                            value={st.mode}
                            tabIndex={-1}
                            onChange={e => {
                              const m = e.target.value;
                              if (m === 'free') updateItem(veg.id, { mode: m, rate: '', amount: '' });
                              else if (m === 'lump_sum') updateItem(veg.id, { mode: m, rate: '' });
                              else updateItem(veg.id, { mode: m });
                            }}
                            className="w-full px-1.5 py-1 rounded border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 font-semibold"
                          >
                            <option value="per_kg">Kg × Rate</option>
                            <option value="per_100">Per 100 Pcs</option>
                            <option value="lump_sum">Direct Rs.</option>
                            <option value="free">Free / 0</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-qty`] = el)}
                            type="number"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder={st.mode === 'per_100' ? 'Pcs' : 'Kg'}
                            value={st.weight}
                            onChange={e => updateItem(veg.id, { weight: e.target.value })}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'qty', rIdx)}
                            className="w-full px-2 py-1 rounded border border-slate-300 text-right text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white text-blue-900"
                          />
                        </td>
                        <td className="py-1.5 px-1.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-rate`] = el)}
                            type="number"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder={st.mode === 'lump_sum' || st.mode === 'free' ? '-' : 'Rate'}
                            disabled={st.mode === 'lump_sum' || st.mode === 'free'}
                            value={st.mode === 'lump_sum' || st.mode === 'free' ? '' : st.rate}
                            onChange={e => updateItem(veg.id, { rate: e.target.value })}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'rate', rIdx)}
                            className={`w-full px-2 py-1 rounded border border-slate-300 text-right text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                              st.mode === 'lump_sum' || st.mode === 'free' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-purple-900'
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-2.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-amt`] = el)}
                            type="number"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder={st.mode === 'free' ? 'Free' : '0'}
                            disabled={st.mode === 'free'}
                            value={st.mode === 'free' ? '' : st.amount}
                            onChange={e => {
                              const val = e.target.value;
                              if (String(st.rate).trim() === '' && val.trim() !== '') {
                                updateItem(veg.id, { amount: val, mode: 'lump_sum' });
                              } else {
                                updateItem(veg.id, { amount: val });
                              }
                            }}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'amt', rIdx)}
                            className={`w-full px-2 py-1 rounded border border-slate-300 text-right text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                              st.mode === 'free' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-emerald-900'
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCatalog.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">No matching items found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tempo Hire & Bottom Summary Bar */}
          <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80">
            <div className="flex items-center gap-3">
              <label htmlFor="inputTempoHire" className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">🚚 Tempo Hire (₹):</label>
              <input
                id="inputTempoHire"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={tempoHire}
                onChange={e => setBillData(prev => ({ ...prev, tempoHire: e.target.value }))}
                className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-right bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Items Subtotal: ₹{formatMoney(subtotal)}</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-900">Grand Total: ₹{formatMoney(grandTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileTab('PREVIEW');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="lg:hidden px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 transition flex items-center gap-1"
                >
                  <span>👁️ Preview</span>
                </button>
                <button
                  type="button"
                  onClick={onSaveBill}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>Save Bill Record</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Live Official Invoice Preview */}
      <div className={`lg:col-span-5 print-only-container lg:sticky lg:top-20 w-full ${mobileTab === 'EDIT' ? 'hidden lg:block' : 'block'}`}>
        <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 sm:p-3 mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Live Bill Preview</span>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllInPreview}
                onChange={e => setShowAllInPreview(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>All {catalog.length} rows</span>
            </label>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs transition flex items-center gap-1 shadow-sm"
              title="Send Invoice Image via WhatsApp"
            >
              <span>📲</span>
              <span>WhatsApp Image</span>
            </button>
            <button type="button" onClick={onOpenExportModal} className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm">
              <span>📄</span>
              <span>PDF</span>
            </button>
            <button type="button" onClick={() => window.print()} className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm">
              <span>🖨️</span>
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Official Biroba Bill Sheet */}
        <div id="printableBillArea" className="bill-paper rounded-xl p-2 sm:p-5 mx-auto w-full max-w-xl">
          <div className="devanagari flex items-center justify-between text-[8px] sm:text-xs font-semibold bill-green mb-1.5 px-1">
            <span>|| श्री महालिंगराया प्रसन्न ||</span>
            <span>|| श्री स्वामी समर्थ प्रसन्न ||</span>
            <span>|| श्री बालाजी प्रसन्न ||</span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 border-b-2 border-emerald-800 pb-2.5 mb-2.5">
            <div className="w-12 h-12 sm:w-20 sm:h-16 shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src="/icon-192.png"
                alt="Fresh Vegetables"
                className="max-w-full max-h-full object-contain"
                onError={e => { e.target.src = '/Vegetable.jpg'; }}
              />
            </div>
            <div className="flex-1 text-center min-w-0">
              <h2 className="bill-red font-extrabold text-base sm:text-xl tracking-tight leading-tight">
                BIROBA VEGETABLE SUPPLIERS
              </h2>
              <p className="bill-green font-bold text-[8.5px] sm:text-[11px] tracking-tight mt-0.5 leading-tight">
                ALL KINDS OF FRESH VEGETABLE &amp; FRUITS WHOLESALE SUPPLIERS
              </p>
              <p className="bill-green font-semibold text-[8px] sm:text-[10px] leading-tight">
                Old Bhaji Market Byculla Mumbai-400 027<span className="hidden sm:inline"> • M.: 9892406958 / 7400106277</span>
              </p>
              <p className="bill-red font-bold text-[10.5px] sm:text-sm mt-0.5">
                Prop.: Birappa B. Nigadi
              </p>
            </div>
          </div>

          <div className="text-xs sm:text-sm mb-3 space-y-2 px-1">
            <div className="flex items-center justify-between gap-3 pb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="bill-green font-bold">No. :</span>
                <span className="font-extrabold text-slate-900 border-b-2 border-emerald-700/80 min-w-[60px] px-1 pb-0.5">{invoiceNo || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="bill-green font-bold">Date :</span>
                <span className="font-bold text-slate-900 border-b-2 border-emerald-700/80 min-w-[95px] px-1 pb-0.5 text-right">{formatDateDisplay(date)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="bill-green font-bold shrink-0">M/s. :</span>
              <span className="font-extrabold text-slate-900 text-sm sm:text-base border-b-2 border-emerald-700/80 flex-1 px-2 pb-0.5 truncate">{customerName || '____________________'}</span>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <table className="bill-table w-full">
              <colgroup>
                <col style={{ width: '9%' }} />
                <col style={{ width: '43%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-center">No.</th>
                  <th className="text-left">PARTICULARS</th>
                  <th className="text-center leading-tight">WEIGHT</th>
                  <th className="text-center leading-tight">RATE<br /><span className="text-[8px] sm:text-[10px] font-semibold">Per</span></th>
                  <th className="text-right leading-tight">AMOUNT<br /><span className="text-[8px] sm:text-[10px] font-semibold">Rs.</span></th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((veg, idx) => {
                  const it = items[veg.id] || {};
                  const ordered = isItemOrdered(it);
                  if (!showAllInPreview && !ordered) return null;

                  const weightText = ordered ? formatWeightClean(it.weight) : '';
                  const rateText = ordered ? (it.mode === 'lump_sum' || it.mode === 'free' || !it.rate ? '-' : `${it.rate}${it.mode === 'per_100' ? '/100' : ''}`) : '';
                  const amountText = ordered ? (it.mode === 'free' ? '-' : (it.amount ? formatMoney(it.amount) : '-')) : '';

                  return (
                    <tr key={veg.id}>
                      <td className="text-center font-semibold">{idx + 1}.</td>
                      <td className="font-semibold text-slate-900 truncate sm:whitespace-normal">{veg.name}</td>
                      <td className="text-center font-bold text-slate-900">{weightText}</td>
                      <td className="text-center font-semibold text-slate-800">{rateText}</td>
                      <td className="text-right font-bold text-slate-900">{amountText}</td>
                    </tr>
                  );
                })}
                {orderedCount === 0 && !showAllInPreview && (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-slate-400 italic font-medium text-xs">Enter quantities above to populate bill.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-800">
                  <td colSpan="4" className="text-right font-bold bill-green py-1 pr-2 sm:pr-3 bg-emerald-50/40 text-[11px] sm:text-sm">Tempo Hire</td>
                  <td className="text-right font-bold text-slate-900 py-1 px-1 sm:px-2 bg-emerald-50/40 text-[11px] sm:text-sm">{tempoHire > 0 ? formatMoney(tempoHire) : '-'}</td>
                </tr>
                <tr className="border-t-2 border-emerald-800 bg-emerald-50/80">
                  <td colSpan="4" className="text-right font-extrabold bill-green text-xs sm:text-base py-1.5 pr-2 sm:pr-3">Total</td>
                  <td className="text-right font-extrabold text-slate-900 text-sm sm:text-lg py-1.5 px-1 sm:px-2">{formatMoney(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2.5 pt-1 flex items-center justify-between text-xs gap-1">
            <span className={`text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded border ${
              paymentStatus === 'Credit / Unpaid' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              Status: {paymentStatus}
            </span>
            <p className="bill-red font-extrabold text-[10px] sm:text-sm tracking-tight text-right">
              For BIROBA VEGETABLE SUPPLIERS
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
