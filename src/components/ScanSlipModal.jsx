import React, { useState, useRef, useEffect, useMemo } from 'react';
import { prepareImageForAI, extractChitDataWithAI } from '../utils/geminiVision';
import { matchItemToCatalog, matchCustomerToPredefined, resolveItemUnit, parseRawTextToItems } from '../utils/fuzzyMatcher';
import { getCustomerLastRates, computeRowAmount } from '../utils/storage';

export function ScanSlipModal({
  isOpen,
  onClose,
  catalog = [],
  customers = [],
  records = [],
  currentCustomer = '',
  onApply
}) {
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState(currentCustomer || (customers[0] || ''));
  const [scannedItems, setScannedItems] = useState([]);
  const [rawSlipText, setRawSlipText] = useState(() => {
    return localStorage.getItem('biroba_last_scanned_slip_text') || '';
  });
  const [activeTab, setActiveTab] = useState('ITEMS'); // 'ITEMS' | 'TEXT'

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Map of last charged rates for the currently selected customer
  const customerRatesMap = useMemo(() => {
    return getCustomerLastRates(selectedCustomer, records);
  }, [selectedCustomer, records]);

  // Sync customer on open
  useEffect(() => {
    if (isOpen) {
      if (currentCustomer) setSelectedCustomer(currentCustomer);
      else if (customers.length > 0) setSelectedCustomer(customers[0]);
    } else {
      setIsScanning(false);
      setErrorMessage(null);
    }
  }, [isOpen, currentCustomer, customers]);

  // When selectedCustomer changes, re-apply that customer's historical rates to items without custom edits
  useEffect(() => {
    if (scannedItems.length === 0) return;

    setScannedItems(prev =>
      prev.map(row => {
        if (!row.matchedItemId) return row;
        const catItem = catalog.find(v => v.id === row.matchedItemId);
        const lastRateInfo = customerRatesMap[row.matchedItemId];

        // Determine rate strictly from this customer's last bill; if first bill or not found, leave blank
        const rateToUse = lastRateInfo?.rate || '';
        const mode = row.unit === '100 pcs' ? 'per_100' : (catItem?.mode || 'per_kg');
        const amount = computeRowAmount(row.quantity, rateToUse, '', mode, row.unit);

        return {
          ...row,
          rate: rateToUse,
          amount,
          rateSource: lastRateInfo ? `From Last Bill (#${lastRateInfo.invoiceNo})` : 'First Bill / Manual'
        };
      })
    );
  }, [selectedCustomer, customerRatesMap, catalog]);

  // Clipboard paste (Ctrl+V) support
  useEffect(() => {
    if (!isOpen) return;

    function handlePaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processImageFile(file);
          break;
        }
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, catalog, customers]);

  if (!isOpen) return null;

  async function processImageFile(file) {
    if (!file) return;

    try {
      setErrorMessage(null);
      setIsScanning(true);
      setScanStep('Compressing photo for fast & low-token scan...');

      const { base64Data, mimeType, previewUrl } = await prepareImageForAI(file, 1024, 0.75);
      setImagePreview(previewUrl);

      setScanStep('Reading handwritten items with AI Vision...');
      const result = await extractChitDataWithAI(base64Data, mimeType);

      // Save raw text for user viewing / editing without re-burning tokens
      const text = result.rawText || (result.items || []).map(it => `${it.rawName} ${it.quantity} ${it.unit || ''}`.trim()).join('\n');
      setRawSlipText(text);
      try {
        localStorage.setItem('biroba_last_scanned_slip_text', text);
      } catch (_) {}

      setScanStep('Matching catalog items & looking up hotel rates...');

      // Auto-detect customer
      let targetCust = selectedCustomer;
      if (result.customer) {
        const matchedCust = matchCustomerToPredefined(result.customer, customers);
        if (matchedCust) {
          targetCust = matchedCust;
          setSelectedCustomer(matchedCust);
        }
      }

      const ratesForCust = getCustomerLastRates(targetCust, records);

      // Map items with customer-specific rates
      const rows = (result.items || []).map((it, idx) => {
        const { matchedItem, score, confidence } = matchItemToCatalog(it.rawName, catalog);
        const resolvedUnit = resolveItemUnit(matchedItem, it.unit);

        const itemId = matchedItem ? matchedItem.id : '';
        const lastRateInfo = itemId ? ratesForCust[itemId] : null;
        const rateToUse = lastRateInfo?.rate || '';
        const mode = resolvedUnit === '100 pcs' ? 'per_100' : (matchedItem?.mode || 'per_kg');
        const amount = computeRowAmount(it.quantity || '1', rateToUse, '', mode, resolvedUnit);

        return {
          id: `scan_row_${Date.now()}_${idx}`,
          rawName: it.rawName,
          matchedItemId: itemId,
          quantity: it.quantity || '1',
          unit: resolvedUnit,
          rate: rateToUse,
          amount,
          rateSource: lastRateInfo ? `From Last Bill (#${lastRateInfo.invoiceNo})` : 'First Bill / Manual',
          score,
          confidence
        };
      });

      setScannedItems(rows);
      setActiveTab('ITEMS');
      setIsScanning(false);
      setScanStep('');
    } catch (err) {
      console.error('Scan failed:', err);
      setIsScanning(false);
      setScanStep('');
      setErrorMessage(err.message || 'Failed to scan slip. Please try again with a clearer photo.');
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }

  // Parse or Re-parse from raw text directly (Costs 0 tokens!)
  function handleReparseFromText() {
    if (!rawSlipText.trim()) {
      alert('Please enter or paste slip text before parsing.');
      return;
    }

    try {
      localStorage.setItem('biroba_last_scanned_slip_text', rawSlipText);
    } catch (_) {}

    const parsed = parseRawTextToItems(rawSlipText, catalog);
    const rows = parsed.map(row => {
      const catItem = catalog.find(v => v.id === row.matchedItemId);
      const lastRateInfo = row.matchedItemId ? customerRatesMap[row.matchedItemId] : null;
      const rateToUse = lastRateInfo?.rate || '';
      const mode = row.unit === '100 pcs' ? 'per_100' : (catItem?.mode || 'per_kg');
      const amount = computeRowAmount(row.quantity, rateToUse, '', mode, row.unit);

      return {
        ...row,
        rate: rateToUse,
        amount,
        rateSource: lastRateInfo ? `From Last Bill (#${lastRateInfo.invoiceNo})` : 'First Bill / Manual'
      };
    });

    setScannedItems(rows);
    setActiveTab('ITEMS');
  }

  function handleUpdateItem(id, updates) {
    setScannedItems(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, ...updates };

        // If matched item changed, update unit and rates
        if (updates.matchedItemId !== undefined) {
          const itemObj = catalog.find(v => v.id === updates.matchedItemId);
          if (itemObj) {
            updated.unit = resolveItemUnit(itemObj, row.unit);
            const lastRateInfo = customerRatesMap[updates.matchedItemId];
            updated.rate = lastRateInfo?.rate || '';
            updated.rateSource = lastRateInfo ? `From Last Bill (#${lastRateInfo.invoiceNo})` : 'First Bill / Manual';
          }
        }

        // Recalculate amount if qty, rate, or unit changes
        const currentItemObj = catalog.find(v => v.id === updated.matchedItemId);
        const mode = updated.unit === '100 pcs' ? 'per_100' : (currentItemObj?.mode || 'per_kg');
        updated.amount = computeRowAmount(updated.quantity, updated.rate, '', mode, updated.unit);

        return updated;
      })
    );
  }

  function handleDeleteItem(id) {
    setScannedItems(prev => prev.filter(row => row.id !== id));
  }

  function handleAddNewRow() {
    const firstItem = catalog[0];
    const lastRateInfo = firstItem ? customerRatesMap[firstItem.id] : null;
    const rateToUse = lastRateInfo?.rate || '';

    setScannedItems(prev => [
      ...prev,
      {
        id: `scan_row_${Date.now()}`,
        rawName: '',
        matchedItemId: firstItem ? firstItem.id : '',
        quantity: '1',
        unit: firstItem ? (firstItem.unit || 'kg') : 'kg',
        rate: rateToUse,
        amount: rateToUse,
        rateSource: lastRateInfo ? `From Last Bill (#${lastRateInfo.invoiceNo})` : 'First Bill / Manual',
        score: 100,
        confidence: 'high'
      }
    ]);
  }

  function handleApplyAsNewBill() {
    const validRows = scannedItems.filter(row => row.matchedItemId && parseFloat(row.quantity) > 0);

    if (validRows.length === 0) {
      alert('Please match at least one product with a valid quantity before creating invoice.');
      return;
    }

    onApply({
      customer: selectedCustomer,
      isNewBill: true, // Tells BillEntry to start a fresh clean bill without retaining old products!
      items: validRows.map(row => ({
        itemId: row.matchedItemId,
        quantity: String(row.quantity),
        unit: row.unit,
        rate: row.rate,
        amount: row.amount
      }))
    });

    onClose();
  }

  const validItemsCount = scannedItems.filter(r => r.matchedItemId && parseFloat(r.quantity) > 0).length;
  const estimatedTotal = scannedItems.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📸</span>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                Scan Slip &amp; Generate New Invoice
              </h3>
              <p className="text-[11px] text-slate-300">
                Creates a fresh bill with only the photo&apos;s items &amp; auto-fills hotel rates from past bills
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mode Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('ITEMS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ITEMS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>🥬</span>
              <span>Matched Items ({scannedItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TEXT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TEXT'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>📝</span>
              <span>Slip Text (0 Tokens)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isScanning}
              onClick={() => cameraInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Snap with phone camera"
            >
              <span>📷</span>
              <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 disabled:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Upload image file or screenshot"
            >
              <span>🖼️</span>
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5">
          
          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <p className="font-bold">Scan Error</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Scanning Progress Spinner */}
          {isScanning && (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3 animate-pulse">
              <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Scanning handwritten slip...</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">{scanStep}</p>
                <p className="text-[11px] text-emerald-600 mt-1 font-semibold">Using lightweight token-efficient vision model</p>
              </div>
            </div>
          )}

          {/* Empty State when no items scanned yet */}
          {!isScanning && scannedItems.length === 0 && !imagePreview && (
            <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-4 bg-slate-50/50">
              <div className="text-4xl">📸</div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">Add Your Vegetable Slip Photo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Open your camera to snap a handwritten note or upload a photo. Items &amp; quantities will be extracted automatically into a brand new invoice.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <span className="text-base">📷</span>
                  <span>Take Camera Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <span className="text-base">🖼️</span>
                  <span>Upload Image File</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Shortcut: Copy an image from WhatsApp and press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-600 font-mono text-[10px]">Ctrl+V</kbd> to paste directly.
              </p>
            </div>
          )}

          {/* TAB 1: Matched Items & Rates Table */}
          {activeTab === 'ITEMS' && !isScanning && scannedItems.length > 0 && (
            <div className="space-y-3.5">
              
              {/* Hotel / Customer Selector Bar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>🏪</span>
                      <span>Customer / Hotel for New Bill:</span>
                    </label>
                    <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Past Rates Only (Blank if First Bill)
                    </span>
                  </div>
                  <select
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {customers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {imagePreview && (
                  <div className="flex items-center gap-2 shrink-0 bg-white p-1.5 rounded-lg border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="Thumbnail"
                      className="w-10 h-10 object-cover rounded border border-slate-300"
                    />
                    <div className="text-[11px]">
                      <p className="font-bold text-slate-700">Slip Attached</p>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="text-emerald-700 hover:underline font-semibold"
                      >
                        Retake photo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Items & Rates Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>🥬</span>
                    <span>Only Products in this Photo will be in New Invoice:</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleAddNewRow}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Product</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full min-w-[540px] text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 text-[11px] text-slate-600 font-bold">
                        <tr>
                          <th className="py-2 px-2.5">Detected on Slip</th>
                          <th className="py-2 px-2.5">Matched Product</th>
                          <th className="py-2 px-2 text-center w-20">Qty</th>
                          <th className="py-2 px-2 text-center w-20">Unit</th>
                          <th className="py-2 px-2 text-right w-24">Rate (Rs)</th>
                          <th className="py-2 px-2.5 text-right w-20">Amt (Rs)</th>
                          <th className="py-2 px-1 text-center w-7"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {scannedItems.map(row => {
                          const itemObj = catalog.find(v => v.id === row.matchedItemId);
                          const unitOptions = itemObj?.unitOptions || [itemObj?.unit || 'kg'];

                          return (
                            <tr key={row.id} className="hover:bg-slate-50 transition">
                              {/* Raw Detected Text */}
                              <td className="py-2 px-2.5">
                                <span className="font-semibold text-slate-700 font-mono text-[11px] block truncate max-w-[110px]" title={row.rawName}>
                                  {row.rawName || '—'}
                                </span>
                                {row.confidence === 'high' && (
                                  <span className="text-[9.5px] text-emerald-600 font-medium">✓ Auto-matched</span>
                                )}
                                {row.confidence === 'medium' && (
                                  <span className="text-[9.5px] text-amber-600 font-medium">~ Review</span>
                                )}
                                {row.confidence === 'low' && (
                                  <span className="text-[9.5px] text-rose-500 font-medium">? Select</span>
                                )}
                              </td>

                              {/* Catalog Product Dropdown */}
                              <td className="py-2 px-2.5">
                                <select
                                  value={row.matchedItemId}
                                  onChange={e => handleUpdateItem(row.id, { matchedItemId: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                                >
                                  <option value="">-- Select Product --</option>
                                  {catalog.map(v => (
                                    <option key={v.id} value={v.id}>
                                      {v.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Quantity */}
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min="0"
                                  value={row.quantity}
                                  onChange={e => handleUpdateItem(row.id, { quantity: e.target.value })}
                                  className="w-18 min-w-[72px] px-2 py-1 text-center rounded-md border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2 px-2 text-center">
                                {unitOptions.length > 1 ? (
                                  <select
                                    value={row.unit}
                                    onChange={e => handleUpdateItem(row.id, { unit: e.target.value })}
                                    className="w-20 px-1 py-1 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-800 bg-white focus:outline-none"
                                  >
                                    {unitOptions.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-600 px-1.5 py-1 bg-slate-100 rounded">
                                    {row.unit || 'kg'}
                                  </span>
                                )}
                              </td>

                              {/* Rate (Editable with Last Bill Tag) */}
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min="0"
                                  placeholder="Rate"
                                  value={row.rate}
                                  onChange={e => handleUpdateItem(row.id, { rate: e.target.value })}
                                  className="w-20 min-w-[72px] px-2 py-1 text-right rounded-md border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                />
                                {row.rateSource && (
                                  <span className={`block text-[9px] font-medium leading-tight truncate max-w-[90px] text-right mt-0.5 ${
                                    row.rateSource.startsWith('From Last') ? 'text-emerald-700' : 'text-slate-400'
                                  }`} title={row.rateSource}>
                                    {row.rateSource.startsWith('From Last') ? '🔄 Last bill' : 'Blank / Manual'}
                                  </span>
                                )}
                              </td>

                              {/* Amount */}
                              <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                                {row.amount ? `₹${row.amount}` : '—'}
                              </td>

                              {/* Delete */}
                              <td className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(row.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 font-bold text-sm transition cursor-pointer"
                                  title="Remove item"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-slate-100 px-3.5 py-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Total Products to Bill: {validItemsCount}</span>
                    <span>Est. Bill Subtotal: ₹{estimatedTotal.toFixed(2).replace(/\.00$/, '')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Raw Extracted Slip Text (0 Tokens to edit & re-parse!) */}
          {activeTab === 'TEXT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                    <span>📝</span>
                    <span>Extracted Slip Text / WhatsApp Order</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    All text read from the photo is preserved here. You can edit text, fix typos, or add items freely.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  0 Tokens Cost
                </span>
              </div>

              <textarea
                rows={9}
                value={rawSlipText}
                onChange={e => setRawSlipText(e.target.value)}
                placeholder={"e.g.\nKobi 4kg\nBhendi 3kg\nTomato 15kg\nPalak 5 juddi\nLahsun 1 pkt\nLemon 100"}
                className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400">
                  Tip: Supports Hindi/Marathi terms like &quot;kobi 4&quot;, &quot;juddi&quot;, &quot;pkt&quot;, &quot;kotmir&quot;.
                </span>
                <button
                  type="button"
                  onClick={handleReparseFromText}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⚡</span>
                  <span>Re-parse Text into Items Table (0 Tokens)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          {scannedItems.length > 0 && !isScanning && (
            <button
              type="button"
              onClick={handleApplyAsNewBill}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <span>✨ Create Fresh Bill ({validItemsCount} items)</span>
              <span>→</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
