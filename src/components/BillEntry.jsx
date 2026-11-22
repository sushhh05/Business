import React, { useState, useRef } from 'react';
import {
  formatDateDisplay,
  formatDateLong,
  formatMoney,
  formatWeightClean,
  getItemUnit,
  isItemOrdered,
  computeRowAmount,
  numberToIndianWords,
  COMPANY_INFO,
  getCustomerLastRates
} from '../utils/storage';
import { shareInvoiceAsImage } from '../utils/whatsappImageShare';
import { ScanSlipModal } from './ScanSlipModal';

export default function BillEntry({
  catalog,
  billData,
  setBillData,
  restaurantsList,
  records = [],
  onOpenAddCustomCustomer,
  onOpenAddVegetable,
  onSaveBill,
  onNewBlankBill,
  onOpenExportModal,
  mobileTab = 'EDIT',
  setMobileTab,
  showToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [activeFocusedRow, setActiveFocusedRow] = useState(null);
  const rowRefs = useRef({});

  const isFruit = billData.billCategory === 'FRUITS';
  const { invoiceNo, customerName, date, paymentStatus, tempoHire, items = {} } = billData;

  const activeFocusedVeg = catalog.find(v => v.id === activeFocusedRow);

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
    const vegMeta = catalog.find(v => v.id === vegId);

    setBillData(prev => {
      const currentItem = prev.items[vegId] || {
        weight: '',
        rate: '',
        amount: '',
        mode: vegMeta?.mode || 'per_kg',
        unit: vegMeta?.unit || (vegMeta?.mode === 'per_100' ? '100 pcs' : 'kg')
      };
      const updated = { ...currentItem, ...updates };

      // Auto-fill rate ONLY from recently/last generated bill of this restaurant
      // If this is the first bill of this restaurant or item was not in previous bill -> strictly blank!
      if (updates.weight !== undefined && String(updates.weight).trim() !== '') {
        if (!updated.rate || String(updated.rate).trim() === '' || String(updated.rate).trim() === '0') {
          if (updated.mode !== 'lump_sum' && updated.mode !== 'free') {
            const targetCustomer = prev.customerName || customerName || '';
            const lastRates = getCustomerLastRates(targetCustomer, records);
            if (lastRates && lastRates[vegId]?.rate && parseFloat(lastRates[vegId].rate) > 0) {
              updated.rate = String(lastRates[vegId].rate);
            } else {
              updated.rate = '';
            }
          }
        }
      }

      if (updates.weight !== undefined || updates.rate !== undefined || updates.mode !== undefined || updates.unit !== undefined) {
        if (updated.mode === 'per_kg' || updated.mode === 'per_100') {
          updated.amount = computeRowAmount(updated.weight, updated.rate, updated.amount, updated.mode, updated.unit);
        } else if (updated.mode === 'free') {
          updated.rate = '';
          updated.amount = '';
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

  function handleCustomerChange(newCustomer) {
    const lastRates = getCustomerLastRates(newCustomer, records);
    setBillData(prev => {
      const updatedItems = { ...prev.items };
      // For any item that already has quantity entered, re-fetch rates from this restaurant's last bill
      Object.keys(updatedItems).forEach(vegId => {
        const it = updatedItems[vegId];
        if (!it) return;
        const hasQty = String(it.weight || '').trim() !== '';

        if (hasQty && it.mode !== 'lump_sum' && it.mode !== 'free') {
          if (lastRates[vegId]?.rate && parseFloat(lastRates[vegId].rate) > 0) {
            it.rate = String(lastRates[vegId].rate);
            it.amount = computeRowAmount(it.weight, it.rate, '', it.mode, it.unit);
          } else {
            // First bill of that restaurant or item never billed before -> show blank!
            it.rate = '';
            it.amount = '';
          }
        }
      });

      return {
        ...prev,
        customerName: newCustomer,
        items: updatedItems
      };
    });

    if (newCustomer) {
      const ratesCount = Object.keys(lastRates).length;
      if (ratesCount > 0) {
        showToast(`📋 Loaded past rates for ${newCustomer}`);
      } else {
        showToast(`🆕 ${newCustomer} (First bill — rates will be blank)`, 'info');
      }
    }
  }

  function handleApplyScannedItems({ customer, items: scannedRows, isNewBill = true }) {
    const targetCustomer = customer || customerName || '';
    const lastRates = getCustomerLastRates(targetCustomer, records);

    // Create fresh items dictionary - OLD PRODUCTS ARE NOT RETAINED
    const nextItems = {};
    let appliedCount = 0;

    scannedRows.forEach(({ itemId, quantity, unit, rate: modalRate }) => {
      const vegMeta = catalog.find(v => v.id === itemId);
      if (!vegMeta) return;

      appliedCount++;

      // Rate priority:
      // 1. Rate explicitly confirmed in modal
      // 2. Last rate charged to this restaurant in previous bills
      // If neither exists (first bill or no prior rate), rate remains BLANK ('')
      let rateToUse = '';
      if (modalRate && parseFloat(modalRate) > 0) {
        rateToUse = String(modalRate);
      } else if (lastRates[itemId]?.rate && parseFloat(lastRates[itemId].rate) > 0) {
        rateToUse = String(lastRates[itemId].rate);
      }

      let calculatedAmount = '';
      if (quantity && rateToUse && !isNaN(quantity) && !isNaN(rateToUse)) {
        calculatedAmount = computeRowAmount(quantity, rateToUse, '', vegMeta.mode || 'per_kg', unit || vegMeta.unit || 'kg');
      }

      nextItems[itemId] = {
        weight: String(quantity),
        rate: rateToUse,
        amount: calculatedAmount,
        mode: vegMeta.mode || 'per_kg',
        unit: unit || vegMeta.unit || (vegMeta.mode === 'per_100' ? '100 pcs' : 'kg')
      };
    });

    setBillData(prev => ({
      ...prev,
      recordId: `rec_${Date.now()}`,
      customerName: targetCustomer,
      items: nextItems, // Only the products in this photo are in the bill!
      tempoHire: ''     // Fresh bill reset
    }));

    if (showToast) {
      const hasHotelRates = Object.keys(lastRates).length > 0;
      showToast(
        hasHotelRates
          ? `✨ Created fresh bill for ${targetCustomer} (${appliedCount} items, hotel rates loaded)`
          : `✨ Created fresh bill for ${targetCustomer} (first bill — enter rates manually)`,
        'success'
      );
    }
  }

  function handleKeyNavigation(e, vegId, field, rowIdx) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (field === 'qty') {
        focusCell(rowIdx, 'rate');
      } else if (field === 'rate') {
        focusCell(rowIdx, 'amt');
      } else if (field === 'amt') {
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
        targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (_) {}
    }
  }

  function clearAllEntries() {
    if (!confirm('Clear all quantities for the current bill?')) return;
    const cleared = {};
    catalog.forEach(v => {
      cleared[v.id] = { weight: '', rate: '', amount: '', mode: v.mode || 'per_kg', unit: v.unit || 'kg' };
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
      paymentStatus,
      billCategory: isFruit ? 'FRUITS' : 'VEGETABLES'
    };
    await shareInvoiceAsImage('printableBillArea', {
      invoiceNo,
      customerName,
      date,
      record: currentRec,
      catalog
    }, showToast);
  }

  // Ordered items for single-page invoice
  const orderedList = catalog.filter(v => isItemOrdered(items[v.id]));
  const previewList = showAllInPreview ? catalog : orderedList;

  return (
    <div className="space-y-4">
      {/* Mobile Tab Switcher */}
      <div className="no-print lg:hidden bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1 sticky top-[56px] z-20">
        <button
          type="button"
          onClick={() => setMobileTab('EDIT')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mobileTab === 'EDIT'
              ? 'bg-slate-900 text-white shadow-xs'
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
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>👁️</span>
          <span>Invoice Preview (Rs {formatMoney(grandTotal)})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Form & Entry Table */}
        <div className={`no-print lg:col-span-7 space-y-4 ${mobileTab === 'PREVIEW' ? 'hidden lg:block' : 'block'}`}>
          {/* Category Switcher */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{isFruit ? '🍎' : '🥬'}</span>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {isFruit ? 'Fruit Wholesale Billing' : 'Vegetable Wholesale Billing'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isFruit ? 'Fresh wholesale fruits catalog' : 'Daily wholesale vegetables catalog'}
                </p>
              </div>
            </div>

            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setBillData(prev => ({ ...prev, billCategory: 'VEGETABLES' }))}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  !isFruit ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🥬</span>
                <span>Vegetables</span>
              </button>
              <button
                type="button"
                onClick={() => setBillData(prev => ({ ...prev, billCategory: 'FRUITS' }))}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isFruit ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🍎</span>
                <span>Fruits</span>
              </button>
            </div>
          </div>

          {/* Customer & Invoice Details Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>📋</span>
                <span>Invoice &amp; Customer Information</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddVegetable && onOpenAddVegetable(isFruit ? 'Fruit' : 'Vegetable', searchQuery.trim())}
                  className="text-xs font-bold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title={isFruit ? "Add a new fruit to bill" : "Add a new product / vegetable to bill"}
                >
                  <span className="text-emerald-600 font-extrabold text-sm">➕</span>
                  <span>Add Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(true)}
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-600 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Extract items & quantities directly from camera photo or slip"
                >
                  <span className="text-sm">📸</span>
                  <span>Scan Slip (AI)</span>
                </button>
                <button
                  type="button"
                  onClick={onNewBlankBill}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>✨</span>
                  <span>New Blank Bill</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="inputInvoiceNo" className="block text-xs font-semibold text-slate-600 mb-1">Invoice No.</label>
                <input
                  id="inputInvoiceNo"
                  type="text"
                  placeholder="e.g. 2211"
                  value={invoiceNo}
                  onChange={e => setBillData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="inputDate" className="block text-xs font-semibold text-slate-600 mb-1">Invoice Date</label>
                <input
                  id="inputDate"
                  type="date"
                  value={date}
                  onChange={e => setBillData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="sm:col-span-5">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="selectCustomerDropdown" className="block text-xs font-semibold text-slate-600">
                    Bill To (M/s) *
                  </label>
                  <button
                    type="button"
                    onClick={onOpenAddCustomCustomer}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    + Add New
                  </button>
                </div>
                {/* Dual Input + Select for fast customer picking */}
                <select
                  id="selectCustomerDropdown"
                  value={customerName}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__ADD_NEW__') {
                      onOpenAddCustomCustomer();
                    } else {
                      handleCustomerChange(val);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">-- Select from your customers --</option>
                  {restaurantsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="__ADD_NEW__">➕ Add Custom Customer...</option>
                </select>
              </div>
            </div>

            {/* Quick Select Customer Pill Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Quick Select Customer (Click to set):
                </span>
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>📷</span>
                  <span>Scan Slip</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                {restaurantsList.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleCustomerChange(r)}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition cursor-pointer whitespace-nowrap ${
                      customerName === r
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Payment Status:</span>
                <select
                  value={paymentStatus}
                  onChange={e => setBillData(prev => ({ ...prev, paymentStatus: e.target.value }))}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition ${
                    paymentStatus === 'Paid'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  <option value="Credit / Unpaid">Credit / Unpaid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAllEntries}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition cursor-pointer"
                >
                  🗑️ Clear All Qty
                </button>
              </div>
            </div>
          </div>

          {/* Search & Entry Filter Bar */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={isFruit ? 'Search fruit (e.g. Mosambi, Apple, Banana)...' : 'Search item (e.g. Kobi, Tomato, Mushroom, Lemon)...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold px-1">✕</button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFilterMode('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  All Items ({catalog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('ORDERED')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    filterMode === 'ORDERED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  Ordered Only ({orderedCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenAddVegetable && onOpenAddVegetable(isFruit ? 'Fruit' : 'Vegetable', searchQuery.trim())}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                title={isFruit ? "Add a new fruit" : "Add a new product / vegetable"}
              >
                <span>➕</span>
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Active Editing Product Sticky Header Banner */}
          {activeFocusedVeg && (
            <div className="sticky top-14 sm:top-16 z-20 bg-slate-950 text-white px-3.5 py-2 rounded-xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base sm:text-lg shrink-0">{isFruit ? '🍎' : '🥬'}</span>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider leading-none">
                    Editing Item
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-white truncate block">
                    {activeFocusedVeg.name}
                  </span>
                </div>
                <span className="ml-1 text-[11px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 uppercase shrink-0">
                  {items[activeFocusedVeg.id]?.unit || activeFocusedVeg.unit || 'kg'}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-mono ml-auto shrink-0">
                <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  Qty: <strong className="text-amber-300 font-bold">{items[activeFocusedVeg.id]?.weight || '0'}</strong>
                </span>
                <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  Rate: <strong className="text-emerald-300 font-bold">{items[activeFocusedVeg.id]?.rate ? `₹${items[activeFocusedVeg.id].rate}` : '—'}</strong>
                </span>
                <span className="bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  Total: <strong className="text-cyan-300 font-bold">{items[activeFocusedVeg.id]?.amount ? `₹${items[activeFocusedVeg.id].amount}` : '₹0'}</strong>
                </span>
              </div>
            </div>
          )}

          {/* High-Speed Items Data Entry Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[520px] touch-pan-x touch-pan-y overscroll-contain">
              <table className="w-full min-w-[500px] sm:min-w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-20 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="hidden sm:table-cell py-2.5 px-2.5 w-10 text-center">#</th>
                    <th className="sticky left-0 z-30 bg-slate-50 py-2.5 px-2.5 min-w-[135px] sm:min-w-[170px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                      {isFruit ? 'Fruit' : 'Item'} (Particulars)
                    </th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-16 sm:w-22 text-center">Unit</th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-24 sm:w-28 text-right">Qty</th>
                    <th className="py-2.5 px-1.5 sm:px-2 w-20 sm:w-24 text-right">Rate (Rs)</th>
                    <th className="py-2.5 px-2 sm:px-2.5 w-24 sm:w-28 text-right">Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCatalog.map((veg, rIdx) => {
                    const st = items[veg.id] || {
                      weight: '',
                      rate: '',
                      amount: '',
                      mode: veg.mode || 'per_kg',
                      unit: veg.unit || (veg.mode === 'per_100' ? '100 pcs' : 'kg')
                    };
                    const ordered = isItemOrdered(st);
                    const currentUnit = st.unit || veg.unit || (st.mode === 'per_100' ? '100 pcs' : 'kg');
                    const hasOptions = Array.isArray(veg.unitOptions) && veg.unitOptions.length > 0;
                    const isFocused = activeFocusedRow === veg.id;

                    return (
                      <tr
                        key={veg.id}
                        className={`transition ${
                          isFocused
                            ? 'bg-amber-50/70 ring-1 ring-amber-400'
                            : (ordered ? 'bg-emerald-50/50 font-medium' : 'hover:bg-slate-50/50')
                        }`}
                      >
                        <td className="hidden sm:table-cell py-2 px-2.5 text-center text-xs text-slate-400 font-medium">{rIdx + 1}</td>
                        <td
                          className={`sticky left-0 z-10 py-2 px-2 sm:px-2.5 text-slate-900 text-xs sm:text-sm border-r border-slate-200/90 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] transition ${
                            isFocused
                              ? 'bg-amber-100/90 font-bold text-slate-950'
                              : (ordered ? 'bg-emerald-50 font-semibold' : 'bg-white')
                          }`}
                        >
                          {ordered && <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1.5 align-middle" />}
                          <span className="text-[10.5px] font-bold text-slate-400 mr-1 sm:hidden">{rIdx + 1}.</span>
                          <span className={ordered || isFocused ? 'font-bold text-slate-950' : 'font-medium'}>{veg.name}</span>
                        </td>
                        <td className="py-1.5 px-1 sm:px-1.5 text-center">
                          {hasOptions ? (
                            <select
                              value={currentUnit}
                              tabIndex={-1}
                              onChange={e => {
                                const newU = e.target.value;
                                const newMode = newU === '100 pcs' ? 'per_100' : 'per_kg';
                                updateItem(veg.id, { unit: newU, mode: newMode });
                              }}
                              className="px-1 py-1 rounded border border-slate-300 text-[11px] sm:text-xs bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                            >
                              {veg.unitOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-block text-[10.5px] sm:text-xs font-bold text-slate-600 uppercase bg-slate-100 px-1 py-0.5 rounded">
                              {currentUnit || 'kg'}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-1 sm:px-1.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-qty`] = el)}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder="0"
                            title={`${veg.name} Quantity`}
                            value={st.weight}
                            onFocus={() => setActiveFocusedRow(veg.id)}
                            onChange={e => updateItem(veg.id, { weight: e.target.value })}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'qty', rIdx)}
                            className={`w-full min-w-[72px] sm:min-w-[84px] px-1.5 sm:px-2 py-1.5 rounded-lg border text-right text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 transition ${
                              isFocused
                                ? 'bg-white border-amber-500 ring-2 ring-amber-400 text-slate-950 shadow-xs'
                                : (ordered
                                  ? 'bg-white border-emerald-500 text-slate-950 ring-1 ring-emerald-400/50 shadow-2xs'
                                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400')
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-1 sm:px-1.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-rate`] = el)}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder={st.mode === 'lump_sum' || st.mode === 'free' ? '-' : 'Rate'}
                            title={`${veg.name} Rate`}
                            disabled={st.mode === 'lump_sum' || st.mode === 'free'}
                            value={st.mode === 'lump_sum' || st.mode === 'free' ? '' : st.rate}
                            onFocus={() => setActiveFocusedRow(veg.id)}
                            onChange={e => updateItem(veg.id, { rate: e.target.value })}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'rate', rIdx)}
                            className={`w-full min-w-[62px] sm:min-w-[72px] px-1.5 sm:px-2 py-1.5 rounded-lg border text-right text-base sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                              st.mode === 'lump_sum' || st.mode === 'free'
                                ? 'bg-slate-100 text-slate-400'
                                : (isFocused
                                  ? 'bg-white border-amber-500 ring-2 ring-amber-400 text-slate-950'
                                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400')
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-1.5 sm:px-2.5">
                          <input
                            ref={el => (rowRefs.current[`${veg.id}-amt`] = el)}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            placeholder={st.mode === 'free' ? 'Free' : '0'}
                            title={`${veg.name} Amount`}
                            disabled={st.mode === 'free'}
                            value={st.mode === 'free' ? '' : st.amount}
                            onFocus={() => setActiveFocusedRow(veg.id)}
                            onChange={e => {
                              const val = e.target.value;
                              if (String(st.rate).trim() === '' && val.trim() !== '') {
                                updateItem(veg.id, { amount: val, mode: 'lump_sum' });
                              } else {
                                updateItem(veg.id, { amount: val });
                              }
                            }}
                            onKeyDown={e => handleKeyNavigation(e, veg.id, 'amt', rIdx)}
                            className={`w-full min-w-[68px] sm:min-w-[80px] px-1.5 sm:px-2 py-1.5 rounded-lg border text-right text-base sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                              st.mode === 'free'
                                ? 'bg-slate-100 text-slate-400'
                                : (isFocused
                                  ? 'bg-white border-amber-500 ring-2 ring-amber-400 text-slate-950'
                                  : 'bg-white border-slate-300 text-slate-950 hover:border-slate-400')
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-medium space-y-2.5">
                        <p>No matching {isFruit ? 'fruits' : 'vegetables'} found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
                        <button
                          type="button"
                          onClick={() => onOpenAddVegetable && onOpenAddVegetable(isFruit ? 'Fruit' : 'Vegetable', searchQuery.trim())}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <span>➕</span>
                          <span>Add {searchQuery ? `"${searchQuery}"` : 'New Product'} to Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-2.5 px-3 bg-slate-50/80 border-t border-slate-200 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenAddVegetable && onOpenAddVegetable(isFruit ? 'Fruit' : 'Vegetable', searchQuery.trim())}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 py-1 px-3 rounded-lg hover:bg-slate-200/70 transition cursor-pointer"
                        >
                          <span className="text-emerald-600 font-extrabold text-sm">➕</span>
                          <span>Add New {isFruit ? 'Fruit' : 'Product / Vegetable'} to Bill</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tempo Hire & Summary Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2.5">
              <label htmlFor="inputTempoHire" className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                🚚 Tempo Hire / Delivery (Rs):
              </label>
              <input
                id="inputTempoHire"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0"
                value={tempoHire}
                onChange={e => setBillData(prev => ({ ...prev, tempoHire: e.target.value }))}
                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-right bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Subtotal: Rs {formatMoney(subtotal)}</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900">Total Due: Rs {formatMoney(grandTotal)}</span>
              </div>
              <button
                type="button"
                onClick={onSaveBill}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>💾</span>
                <span>Save Bill</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Centered Single-Page Invoice Preview */}
        <div className={`lg:col-span-5 print-only-container lg:sticky lg:top-20 w-full ${mobileTab === 'EDIT' ? 'hidden lg:block' : 'block'}`}>
          {/* Mobile Back Button */}
          <div className="no-print lg:hidden mb-2.5">
            <button
              type="button"
              onClick={() => setMobileTab('EDIT')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
            >
              <span>←</span>
              <span>Back to Edit Bill</span>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="no-print bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Single-Page Invoice
              </span>
              <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAllInPreview}
                  onChange={e => setShowAllInPreview(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <span>All {catalog.length} rows</span>
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
                title="Send Single-Page Invoice via WhatsApp"
              >
                <span>📲</span>
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={onOpenExportModal}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>📄</span>
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition flex items-center gap-1 cursor-pointer"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Centered Document Viewer Container (Kept in middle like a real PDF) */}
          <div className="bg-slate-100/90 p-2 sm:p-4 rounded-2xl flex justify-center items-start overflow-x-auto border border-slate-200/80">
            <div
              id="printableBillArea"
              className="invoice-sheet bg-white rounded-lg p-5 sm:p-7 w-full max-w-[530px] text-slate-900 border border-slate-200 shadow-md"
            >
              {/* Top small label */}
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                INVOICE
              </div>

              {/* Title & Header Block */}
              <div className="mb-3">
                <h1 className="serif-title text-2xl font-bold tracking-tight text-slate-950 mb-1">
                  {COMPANY_INFO.name}
                </h1>
                <div className="text-[11.5px] text-slate-800 leading-snug space-y-0.5">
                  <p className="text-slate-600 font-medium">
                    {COMPANY_INFO.tagline}
                  </p>
                  <p className="text-slate-600">
                    {COMPANY_INFO.address} Phone: {COMPANY_INFO.phone}
                  </p>
                  <p className="text-slate-800 font-medium">
                    Proprietor: {COMPANY_INFO.proprietor}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <hr className="border-t border-slate-200 mb-2.5" />

              {/* Metadata */}
              <div className="text-[11.5px] space-y-0.5 mb-2.5 text-slate-900">
                <p>
                  <strong className="font-bold">Invoice No.:</strong> {invoiceNo || '—'}
                </p>
                <p>
                  <strong className="font-bold">Invoice Date:</strong> {formatDateLong(date) || formatDateDisplay(date)}
                </p>
                <p>
                  <strong className="font-bold">Bill To (M/s):</strong> {customerName || '—'}
                </p>
              </div>

              {/* Divider */}
              <hr className="border-t border-slate-200 mb-2.5" />

              {/* Invoice Items Table (Centered on page, compact row spacing) */}
              <div className="w-full overflow-hidden mb-3">
                <table className="invoice-table w-full">
                  <colgroup>
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '42%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="text-center py-1.5 px-1 text-[11px]">#</th>
                      <th className="text-left py-1.5 px-2 text-[11px]">Item</th>
                      <th className="text-right py-1.5 px-1.5 text-[11px]">Qty</th>
                      <th className="text-center py-1.5 px-1 text-[11px]">Unit</th>
                      <th className="text-right py-1.5 px-1.5 text-[11px]">Rate (Rs)</th>
                      <th className="text-right py-1.5 px-1.5 text-[11px]">Amount (Rs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewList.map((veg, idx) => {
                      const it = items[veg.id] || {};
                      const ordered = isItemOrdered(it);
                      if (!showAllInPreview && !ordered) return null;

                      const qtyText = ordered ? formatWeightClean(it.weight) : '';
                      const unitText = ordered ? getItemUnit(veg, it) : '';
                      const rateText = ordered
                        ? (it.mode === 'lump_sum' || it.mode === 'free' || !it.rate ? '-' : formatMoney(it.rate))
                        : '';
                      const amountText = ordered
                        ? (it.mode === 'free' ? '0' : (it.amount ? formatMoney(it.amount) : '-'))
                        : '';

                      return (
                        <tr key={veg.id}>
                          <td className="text-center text-slate-500 font-medium py-1 px-1 text-[11px]">{idx + 1}</td>
                          <td className="font-medium text-slate-900 py-1 px-2 text-[11px] truncate">{veg.name}</td>
                          <td className="text-right text-slate-900 py-1 px-1.5 text-[11px]">{qtyText}</td>
                          <td className="text-center text-slate-600 py-1 px-1 text-[10.5px]">{unitText}</td>
                          <td className="text-right text-slate-900 py-1 px-1.5 text-[11px]">{rateText}</td>
                          <td className="text-right font-medium text-slate-950 py-1 px-1.5 text-[11px]">{amountText}</td>
                        </tr>
                      );
                    })}
                    {orderedCount === 0 && !showAllInPreview && (
                      <tr>
                        <td colSpan="6" className="text-center py-6 text-slate-400 italic text-xs">
                          Enter quantities on the left to populate invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Divider */}
              <hr className="border-t border-slate-200 mb-2.5" />

              {/* Totals Table (Right aligned matching reference PDF) */}
              <div className="flex justify-end mb-3">
                <table className="w-64 border-collapse text-[11.5px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1 px-2 font-semibold text-slate-700">Subtotal (Items)</td>
                      <td className="py-1 px-2 text-right font-semibold text-slate-900">
                        Rs {formatMoney(subtotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1 px-2 font-semibold text-slate-700">Tempo Hire / Delivery</td>
                      <td className="py-1 px-2 text-right font-semibold text-slate-900">
                        Rs {formatMoney(tempoHire || 0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 border-t border-slate-300">
                      <td className="py-1.5 px-2 font-extrabold text-slate-950">TOTAL DUE</td>
                      <td className="py-1.5 px-2 text-right font-extrabold text-slate-950">
                        Rs {formatMoney(grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in words */}
              <div className="text-[11.5px] text-slate-900 mb-3 pb-2 border-b border-slate-200">
                <strong className="font-bold">Amount in words:</strong>{' '}
                <span className="font-medium">{numberToIndianWords(grandTotal)}</span>
              </div>

              {/* Signatory Section */}
              <div className="pt-1 text-[11.5px] text-slate-900 space-y-3">
                <p className="font-bold">For {COMPANY_INFO.name}</p>
                <p className="text-slate-700">
                  Authorised Signatory: <span className="inline-block border-b border-slate-400 w-44 ml-1"></span>
                </p>
              </div>

              {/* Subtle Footer */}
              <div className="mt-4 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                <span>INVOICE</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera & Slip AI Scanner Modal */}
      <ScanSlipModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        catalog={catalog}
        customers={restaurantsList}
        records={records}
        currentCustomer={customerName}
        onApply={handleApplyScannedItems}
      />
    </div>
  );
}
