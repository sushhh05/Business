import React, { useState } from 'react';
import { generateVectorInvoicePdfBytes } from '../utils/pdfGenerator';
import { formatDateDisplay } from '../utils/storage';

export function AddCustomCustomerModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  function handleSubmit() {
    const val = name.trim().toUpperCase();
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
            <span>Add Custom Restaurant</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant / Hotel Name *</label>
            <input
              type="text"
              placeholder="e.g. HOTEL SAMRAT"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase"
            />
            <p className="text-[11px] text-slate-400 mt-1">This will be added to your customer options and create a dedicated tab in Sheet View.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Cancel</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold">Save &amp; Select</button>
        </div>
      </div>
    </div>
  );
}

export function AddVegetableModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('per_kg');
  const [rate, setRate] = useState('');

  if (!isOpen) return null;

  function handleSubmit() {
    const vName = name.trim();
    if (!vName) return;
    onSave({
      id: `v_${Date.now()}`,
      name: vName,
      mode,
      defaultRate: rate.trim()
    });
    setName('');
    setRate('');
    setMode('per_kg');
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="font-bold text-slate-800 text-base">Add Vegetable to List</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vegetable Name *</label>
            <input
              type="text"
              placeholder="e.g. Broccoli, Zucchini, Sweet Corn"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Billing Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="per_kg">Weight × Rate (Kg)</option>
                <option value="per_100">Per 100 Pcs (like Lemon)</option>
                <option value="lump_sum">Direct Amount (Lump Sum)</option>
                <option value="free">Complimentary / Free</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Default Rate (₹)</label>
              <input
                type="number"
                step="any"
                placeholder="Optional"
                value={rate}
                onChange={e => setRate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Cancel</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold">Add Vegetable</button>
        </div>
      </div>
    </div>
  );
}

export function ExportModal({ isOpen, onClose, billData, catalog, showToast }) {
  if (!isOpen || !billData) return null;

  const { invoiceNo, customerName, date, paymentStatus, tempoHire, items } = billData;

  const orderedItemsList = [];
  catalog.forEach(v => {
    const it = items[v.id];
    if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
      orderedItemsList.push({
        name: v.name,
        weight: it.weight,
        rate: it.rate,
        amount: it.amount,
        mode: it.mode || v.mode
      });
    }
  });

  let sub = 0;
  orderedItemsList.forEach(it => {
    const a = parseFloat(it.amount);
    if (!isNaN(a)) sub += a;
  });
  const grandTotal = sub + (parseFloat(tempoHire) || 0);

  function downloadPdf() {
    try {
      const bytes = generateVectorInvoicePdfBytes({
        invoiceNo: invoiceNo || '101',
        customerName: customerName || 'Customer',
        date,
        paymentStatus,
        tempoHire: parseFloat(tempoHire) || 0,
        grandTotal,
        itemsList: orderedItemsList
      });

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Biroba_Bill_${invoiceNo || '101'}_${(customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}_${formatDateDisplay(date).replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📥 Downloaded PDF file!');
    } catch (e) {
      console.error(e);
      showToast('⚠️ Error generating PDF');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <span>📄</span>
            <span>Download Invoice #{invoiceNo} ({customerName})</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center space-y-3">
          <p className="text-xs text-slate-600">The PDF receipt will be generated directly using clean vector graphics with authentic Biroba Vegetable Suppliers branding.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={downloadPdf}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm transition flex items-center gap-2"
            >
              <span>📥</span>
              <span>Download .PDF File</span>
            </button>
            <button
              type="button"
              onClick={() => { onClose(); window.print(); }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm shadow-sm transition flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
