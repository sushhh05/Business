import React from 'react';
import { DEFAULT_CATALOG } from '../data/defaultCatalog';

export default function CatalogView({ catalog, setCatalog, onOpenAddVegetable, showToast }) {
  function updateVeg(id, updates) {
    setCatalog(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));
    showToast('Updated item');
  }

  function removeVeg(id, name) {
    if (!confirm(`Remove "${name}" from master catalog?`)) return;
    setCatalog(prev => prev.filter(v => v.id !== id));
    showToast(`Removed ${name}`);
  }

  function resetCatalog() {
    if (!confirm('Reset vegetable catalog to the original default 42 items?')) return;
    setCatalog(DEFAULT_CATALOG);
    showToast('Catalog reset to default 42 items');
  }

  return (
    <div className="no-print space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 text-base">Updated Master Vegetable List</h2>
          <p className="text-xs text-slate-500">Spellings have been updated and Turya is included. Add new items or set default rates below.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenAddVegetable} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition">
            + Add New Vegetable
          </button>
          <button type="button" onClick={resetCatalog} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition">
            Reset Default List
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4 w-14 text-center">No.</th>
                <th className="py-3 px-4">Vegetable Name (Particulars)</th>
                <th className="py-3 px-4 w-48">Default Calculation Mode</th>
                <th className="py-3 px-4 w-36 text-right">Default Rate (₹)</th>
                <th className="py-3 px-4 w-28 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {catalog.map((veg, idx) => (
                <tr key={veg.id} className="hover:bg-slate-50 transition border-b border-slate-100">
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-500 text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    <input
                      type="text"
                      value={veg.name}
                      onChange={e => updateVeg(veg.id, { name: e.target.value })}
                      className="w-full max-w-xs px-2 py-1 text-xs font-semibold rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <select
                      value={veg.mode}
                      onChange={e => updateVeg(veg.id, { mode: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-200 font-semibold bg-white"
                    >
                      <option value="per_kg">Kg × Rate</option>
                      <option value="per_100">Per 100 Pcs</option>
                      <option value="lump_sum">Direct Rs.</option>
                      <option value="free">Free / 0</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Optional"
                      value={veg.defaultRate || ''}
                      onChange={e => updateVeg(veg.id, { defaultRate: e.target.value })}
                      className="w-24 px-2 py-1 text-xs text-right font-semibold rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button type="button" onClick={() => removeVeg(veg.id, veg.name)} className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded font-semibold">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
