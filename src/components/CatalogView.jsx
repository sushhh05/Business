import React, { useState } from 'react';
import { DEFAULT_CATALOG, DEFAULT_FRUIT_CATALOG } from '../data/defaultCatalog';

export default function CatalogView({
  catalog,
  setCatalog,
  fruitCatalog = DEFAULT_FRUIT_CATALOG,
  setFruitCatalog,
  onOpenAddVegetable,
  showToast
}) {
  const [categoryTab, setCategoryTab] = useState('VEGETABLES'); // 'VEGETABLES' | 'FRUITS'
  const [search, setSearch] = useState('');

  const isFruit = categoryTab === 'FRUITS';
  const currentList = isFruit ? fruitCatalog : catalog;
  const setCurrentList = isFruit ? setFruitCatalog : setCatalog;

  const filteredList = currentList.filter(item => {
    if (!search) return true;
    const q = search.trim().toLowerCase();
    return item.name.toLowerCase().includes(q);
  });

  function updateItem(id, updates) {
    if (setCurrentList) {
      setCurrentList(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));
      showToast('Updated item');
    }
  }

  function removeItem(id, name) {
    if (!confirm(`Remove "${name}" from ${isFruit ? 'fruits' : 'vegetables'} master catalog?`)) return;
    if (setCurrentList) {
      setCurrentList(prev => prev.filter(v => v.id !== id));
      showToast(`Removed ${name}`);
    }
  }

  function resetCatalog() {
    const count = isFruit ? 18 : 42;
    const typeLabel = isFruit ? 'fruits' : 'vegetables';
    if (!confirm(`Reset ${typeLabel} catalog to the original default ${count} items?`)) return;
    if (isFruit && setFruitCatalog) {
      setFruitCatalog(DEFAULT_FRUIT_CATALOG);
      showToast(`Fruit catalog reset to default ${count} items`);
    } else if (!isFruit && setCatalog) {
      setCatalog(DEFAULT_CATALOG);
      showToast(`Vegetable catalog reset to default ${count} items`);
    }
  }

  return (
    <div className="no-print space-y-4">
      {/* Top Banner & Category Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {isFruit ? '🍎 Master Fruits Catalog (18 Items)' : '🥬 Master Vegetables Catalog (42 Items)'}
            </h2>
            <p className="text-xs text-slate-500">
              Configure default calculation modes and default rates for daily restaurant billing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenAddVegetable(isFruit ? 'Fruit' : 'Vegetable')}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>➕</span>
              <span>Add Custom {isFruit ? 'Fruit' : 'Vegetable'}</span>
            </button>
            <button
              type="button"
              onClick={resetCatalog}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition"
            >
              Reset Default {isFruit ? 'Fruits (18)' : 'Veg (42)'}
            </button>
          </div>
        </div>

        {/* Category Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setCategoryTab('VEGETABLES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                !isFruit ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🥬</span>
              <span>Vegetables ({catalog.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab('FRUITS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isFruit ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🍎</span>
              <span>Fruits ({fruitCatalog.length})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder={`Search ${isFruit ? 'fruit' : 'vegetable'} (e.g. ${isFruit ? 'Water Melon, Banana, Kiwi' : 'Flower, Tomato, Turya'})...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="py-3 px-4 w-14 text-center">No.</th>
                <th className="py-3 px-4">{isFruit ? 'Fruit' : 'Vegetable'} Name (Particulars)</th>
                <th className="py-3 px-4 w-52">Default Calculation Mode</th>
                <th className="py-3 px-4 w-40 text-right">Default Rate (₹)</th>
                <th className="py-3 px-4 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredList.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-100">
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-500 text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateItem(item.id, { name: e.target.value })}
                      className="w-full max-w-xs px-2.5 py-1 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <select
                      value={item.mode}
                      onChange={e => updateItem(item.id, { mode: e.target.value })}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 font-semibold bg-white"
                    >
                      <option value="per_kg">Kg × Rate</option>
                      <option value="per_100">Per 100 Pcs</option>
                      <option value="lump_sum">Direct Rs. (Lump Sum)</option>
                      <option value="free">Complimentary / Free</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Optional"
                      value={item.defaultRate || ''}
                      onChange={e => updateItem(item.id, { defaultRate: e.target.value })}
                      className="w-28 px-2.5 py-1 text-xs sm:text-sm text-right font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.name)}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-400 italic text-xs">
                    No {isFruit ? 'fruits' : 'vegetables'} match "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
