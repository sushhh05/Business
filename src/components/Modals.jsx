import React, { useState } from 'react';
import { generateVectorInvoicePdfBytes } from '../utils/pdfGenerator';
import { formatDateDisplay } from '../utils/storage';

export function AddCustomCustomerModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  function handleSubmit() {
    const val = name.trim();
    if (!val) return;
    onSave(val);
    setName('');
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span>🏪</span>
            <span>Add Custom Restaurant / Customer</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant / Hotel Name *</label>
            <input
              type="text"
              placeholder="e.g. HOTEL SAMRAT or SAI DARSHAN"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase"
            />
            <p className="text-[11px] text-slate-400 mt-1">This will be added to your customer options and create a dedicated tab in Sheet View.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">Cancel</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">Save &amp; Select</button>
        </div>
      </div>
    </div>
  );
}

export function AddVegetableModal({ isOpen, onClose, onSave, itemType = 'Vegetable' }) {
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('kg'); // 'kg', 'pkt_kg', 'bundle_kg', '100pcs_kg', 'pcs', 'free'
  const [rate, setRate] = useState('');

  if (!isOpen) return null;

  const isFruit = itemType === 'Fruit';

  function handleSubmit() {
    const vName = name.trim();
    if (!vName) return;

    let unit = 'kg';
    let unitOptions = null;
    let mode = 'per_kg';

    if (unitType === 'kg') {
      unit = 'kg';
      mode = 'per_kg';
    } else if (unitType === 'pkt_kg') {
      unit = 'pkt';
      unitOptions = ['pkt', 'kg'];
      mode = 'per_kg';
    } else if (unitType === 'bundle_kg') {
      unit = 'bundle';
      unitOptions = ['bundle', 'kg'];
      mode = 'per_kg';
    } else if (unitType === '100pcs_kg') {
      unit = '100 pcs';
      unitOptions = ['100 pcs', 'kg'];
      mode = 'per_100';
    } else if (unitType === 'pcs') {
      unit = 'pcs';
      unitOptions = ['pcs', 'kg'];
      mode = 'lump_sum';
    } else if (unitType === 'free') {
      unit = 'kg';
      mode = 'free';
    }

    onSave({
      id: `${isFruit ? 'f' : 'v'}_${Date.now()}`,
      name: vName,
      unit,
      unitOptions,
      mode,
      defaultRate: rate.trim(),
      category: isFruit ? 'FRUITS' : 'VEGETABLES'
    });
    setName('');
    setRate('');
    setUnitType('kg');
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="font-bold text-slate-800 text-base">
            {isFruit ? '🍎 Add Fruit to List' : '🥬 Add Vegetable to List'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {isFruit ? 'Fruit Name *' : 'Vegetable Name *'}
            </label>
            <input
              type="text"
              placeholder={isFruit ? 'e.g. Dragon Fruit, Pomegranate, Grapes' : 'e.g. Button Mushroom, Zucchini, Sweet Corn'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity / Unit Type</label>
              <select
                value={unitType}
                onChange={e => setUnitType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="kg">kg (Standard Kilogram)</option>
                <option value="pkt_kg">pkt &amp; kg dropdown (Mushrooms/Garlic)</option>
                <option value="bundle_kg">bundle &amp; kg dropdown (Spinach/Mint/Greens)</option>
                <option value="100pcs_kg">100 pcs &amp; kg dropdown (Lemon/Lime)</option>
                <option value="pcs">pcs (Per piece / Lump sum)</option>
                <option value="free">Complimentary / Free</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Default Rate (Rs)</label>
              <input
                type="number"
                step="any"
                placeholder="Optional"
                value={rate}
                onChange={e => setRate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">Cancel</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
            {isFruit ? 'Add Fruit' : 'Add Vegetable'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportModal({ isOpen, onClose, billData, catalog, showToast }) {
  if (!isOpen || !billData) return null;

  const { invoiceNo, customerName, date, paymentStatus, tempoHire, items, billCategory } = billData;

  const orderedItems = (catalog || [])
    .filter(v => {
      const it = (items || {})[v.id];
      return it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0));
    })
    .map(v => {
      const it = items[v.id] || {};
      return {
        id: v.id,
        name: v.name,
        weight: it.weight,
        rate: it.rate,
        amount: it.amount,
        mode: it.mode || v.mode,
        unit: it.unit || v.unit || (it.mode === 'per_100' ? '100 pcs' : 'kg')
      };
    });

  let subtotal = 0;
  orderedItems.forEach(it => {
    const a = parseFloat(it.amount);
    if (!isNaN(a)) subtotal += a;
  });
  const grandTotal = Math.round((subtotal + (parseFloat(tempoHire) || 0)) * 100) / 100;

  function handleDownloadVectorPdf() {
    try {
      const bytes = generateVectorInvoicePdfBytes({
        invoiceNo,
        customerName,
        date,
        paymentStatus,
        tempoHire,
        grandTotal,
        itemsList: orderedItems,
        billCategory
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Biroba_Invoice_${invoiceNo || 'bill'}_${(customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📄 Downloaded single-page vector PDF invoice');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('❌ Failed to generate vector PDF');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span>📄</span>
            <span>Export Invoice PDF</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <p><strong className="text-slate-900">Invoice No:</strong> #{invoiceNo || '-'}</p>
          <p><strong className="text-slate-900">Customer:</strong> {customerName || '-'}</p>
          <p><strong className="text-slate-900">Total Due:</strong> Rs {grandTotal}</p>
          <p className="text-slate-400 text-[11px] pt-1">
            Generates a crisp single-page PDF with centered corporate layout matching your reference document.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">Cancel</button>
          <button type="button" onClick={handleDownloadVectorPdf} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
            Download Single-Page PDF
          </button>
        </div>
      </div>
    </div>
  );
}
