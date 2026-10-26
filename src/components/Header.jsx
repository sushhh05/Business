import React, { useState, useEffect } from 'react';

export default function Header({ activeTab, setActiveTab, recordsCount, catalogCount }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const activeClass = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 bg-white text-emerald-950 shadow-sm whitespace-nowrap';
  const inactiveClass = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 text-emerald-100 hover:bg-emerald-800/60 whitespace-nowrap';

  return (
    <header className="no-print bg-emerald-900 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md overflow-hidden shrink-0 border border-emerald-400/40">
            <img
              src="/icon-192.png"
              alt="Biroba Vegetable Suppliers"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = '/Vegetable.jpg'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-lg tracking-tight text-white leading-tight">
                BIROBA VEGETABLE SUPPLIERS
              </h1>
              <span className="hidden md:inline-block text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Daily Billing App
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-200 truncate max-w-[240px] sm:max-w-none">
              Prop.: Birappa B. Nigadi • Old Bhaji Market, Byculla, Mumbai-400 027
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 shadow flex items-center gap-1.5 animate-pulse shrink-0 cursor-pointer"
              title="Install App on Phone / Desktop"
            >
              <span>📲</span>
              <span>Install App</span>
            </button>
          )}

          <nav className="flex items-center gap-1 bg-emerald-950/70 p-1 rounded-xl border border-emerald-700/60 overflow-x-auto">
            <button type="button" onClick={() => setActiveTab('INVOICE')} className={activeTab === 'INVOICE' ? activeClass : inactiveClass}>
              <span>🧾</span>
              <span>Create Bill</span>
            </button>
            <button type="button" onClick={() => setActiveTab('SHEET')} className={activeTab === 'SHEET' ? activeClass : inactiveClass}>
              <span>📊</span>
              <span>Sheet View</span>
            </button>
            <button type="button" onClick={() => setActiveTab('RECORDS')} className={activeTab === 'RECORDS' ? activeClass : inactiveClass}>
              <span>🗂️</span>
              <span>Saved Records</span>
              <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">{recordsCount}</span>
            </button>
            <button type="button" onClick={() => setActiveTab('CATALOG')} className={activeTab === 'CATALOG' ? activeClass : inactiveClass}>
              <span>🥬</span>
              <span>Items List</span>
              <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">{catalogCount}</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
