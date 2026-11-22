import React, { useState, useEffect } from 'react';

export default function Header({
  activeTab,
  setActiveTab,
  recordsCount,
  catalogCount,
  pendingSyncCount = 0,
  onRetrySync,
  isOnline = true
}) {
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

  const activeClass = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 bg-white text-slate-900 shadow-xs whitespace-nowrap cursor-pointer';
  const inactiveClass = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800/80 whitespace-nowrap cursor-pointer';

  return (
    <header className="no-print bg-slate-950 text-white border-b border-slate-800/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0 border border-slate-200">
            <img
              src="/icon-192.png"
              alt="Biroba Vegetable Suppliers"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = '/Vegetable.jpg'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white leading-tight">
                BIROBA VEGETABLE SUPPLIERS
              </h1>
              <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-slate-700">
                Invoicing System
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[240px] sm:max-w-none">
              Prop.: Birappa B. Nigadi • Old Bhaji Market, Byculla, Mumbai 400 027
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-0.5 sm:pb-0">
          {!isOnline && (
            <span
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0"
              title="You are currently offline. Invoices are safely stored and queued."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
              <span>Offline Mode</span>
            </span>
          )}

          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={onRetrySync}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/50 shadow-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              title="Click to retry syncing queued invoices to Google Sheets"
            >
              <span>☁️</span>
              <span>{pendingSyncCount} Pending Sync</span>
            </button>
          )}

          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs flex items-center gap-1.5 animate-pulse shrink-0 cursor-pointer"
              title="Install App on Phone / Desktop"
            >
              <span>📲</span>
              <span>Install App</span>
            </button>
          )}

          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto">
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
              <span className="bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">{recordsCount}</span>
            </button>
            <button type="button" onClick={() => setActiveTab('CATALOG')} className={activeTab === 'CATALOG' ? activeClass : inactiveClass}>
              <span>🥬</span>
              <span>Items Catalog</span>
              <span className="bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">{catalogCount}</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
