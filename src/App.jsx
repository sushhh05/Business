import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BillEntry from './components/BillEntry';
import SheetView from './components/SheetView';
import RecordsView from './components/RecordsView';
import CatalogView from './components/CatalogView';
import { AddCustomCustomerModal, AddVegetableModal, ExportModal } from './components/Modals';
import {
  loadCatalog,
  saveCatalog,
  loadFruitCatalog,
  saveFruitCatalog,
  loadRecords,
  saveRecords,
  loadCustomCustomers,
  saveCustomCustomers,
  loadActiveDraft,
  saveActiveDraft,
  loadLastActiveTab,
  saveLastActiveTab,
  getAllRestaurants,
  getTodayISO,
  SAMPLE_BT_INVOICE,
  SAMPLE_LOCOMO_FRUIT_INVOICE,
  computeRecordGrandTotal
} from './utils/storage';
import { saveInvoiceToSheet } from './utils/sheetsApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('INVOICE'); // INVOICE, SHEET, RECORDS, CATALOG
  const [mobileTab, setMobileTab] = useState('EDIT'); // EDIT, PREVIEW
  const [catalog, setCatalog] = useState(loadCatalog);
  const [fruitCatalog, setFruitCatalog] = useState(loadFruitCatalog);
  const [records, setRecords] = useState(loadRecords);
  const [customCustomers, setCustomCustomers] = useState(loadCustomCustomers);

  // Active bill draft state with persistence: loads in-progress draft from localStorage
  const [billData, setBillData] = useState(() => {
    const defaultInitial = records[0] || SAMPLE_BT_INVOICE;
    return loadActiveDraft(defaultInitial);
  });

  // Modal states
  const [isAddCustModalOpen, setIsAddCustModalOpen] = useState(false);
  const [isAddVegModalOpen, setIsAddVegModalOpen] = useState(false);
  const [addModalItemType, setAddModalItemType] = useState('Vegetable');
  const [exportModalBill, setExportModalBill] = useState(null);

  // Toast banner state
  const [toastMsg, setToastMsg] = useState('');
  const [toastTimer, setToastTimer] = useState(null);

  function showToast(msg) {
    setToastMsg(msg);
    if (toastTimer) clearTimeout(toastTimer);
    const timer = setTimeout(() => setToastMsg(''), 3000);
    setToastTimer(timer);
  }

  // Persist state changes
  useEffect(() => {
    saveCatalog(catalog);
  }, [catalog]);

  useEffect(() => {
    saveFruitCatalog(fruitCatalog);
  }, [fruitCatalog]);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  useEffect(() => {
    saveCustomCustomers(customCustomers);
  }, [customCustomers]);

  // Continuously auto-save bill draft whenever user enters or edits any field
  useEffect(() => {
    saveActiveDraft(billData);
  }, [billData]);

  // Pagehide/beforeunload persistence guarantee for mobile and desktop exits
  useEffect(() => {
    function flushState() {
      saveActiveDraft(billData);
      saveRecords(records);
    }
    window.addEventListener('beforeunload', flushState);
    window.addEventListener('pagehide', flushState);
    return () => {
      window.removeEventListener('beforeunload', flushState);
      window.removeEventListener('pagehide', flushState);
    };
  }, [billData, records]);

  // Route parser for browser history & hash integration
  function parseHash(hashStr) {
    const clean = (hashStr || '').replace(/^#\/?/, '').trim();
    if (!clean) return { tab: 'INVOICE', sub: 'EDIT', modal: null };

    const [pathPart, queryPart] = clean.split('?');
    const params = new URLSearchParams(queryPart || '');
    const modal = params.get('modal');

    const segments = pathPart.split('/');
    const first = (segments[0] || '').toUpperCase();
    const second = (segments[1] || '').toUpperCase();

    let tab = 'INVOICE';
    if (['INVOICE', 'SHEET', 'RECORDS', 'CATALOG'].includes(first)) {
      tab = first;
    }

    let sub = 'EDIT';
    if (tab === 'INVOICE' && second === 'PREVIEW') {
      sub = 'PREVIEW';
    }

    return { tab, sub, modal };
  }

  function navigateTo(tab, sub = 'EDIT', modal = null) {
    let newHash = tab.toLowerCase();
    if (tab === 'INVOICE' && sub === 'PREVIEW') {
      newHash += '/preview';
    }
    if (modal) {
      newHash += `?modal=${modal}`;
    }
    if (window.location.hash.replace(/^#\/?/, '') !== newHash) {
      window.location.hash = newHash;
    }
  }

  // Handle route changes via hash (supports browser/hardware back and forward)
  useEffect(() => {
    function syncFromHash() {
      const route = parseHash(window.location.hash);
      setActiveTab(route.tab);
      setMobileTab(route.sub);
      saveLastActiveTab(route.tab);

      // If modal was removed via Back button, close all modals
      if (!route.modal) {
        setExportModalBill(null);
        setIsAddCustModalOpen(false);
        setIsAddVegModalOpen(false);
      }
    }

    window.addEventListener('hashchange', syncFromHash);

    // Initial route setup
    if (window.location.hash) {
      syncFromHash();
    } else {
      const lastTab = loadLastActiveTab();
      navigateTo(lastTab, 'EDIT');
    }

    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Accidental exit protection: Double-back to exit on root screen
  useEffect(() => {
    let lastBackPressTime = 0;

    // Set base sentinel in history
    if (!window.history.state || !window.history.state.birobaRoot) {
      window.history.replaceState({ birobaRoot: true }, '');
      window.history.pushState({ birobaActive: true }, '', window.location.hash || '#invoice');
    }

    function handlePopState(e) {
      if (e.state && e.state.birobaRoot) {
        const now = Date.now();
        if (now - lastBackPressTime < 2500) {
          window.history.back();
        } else {
          lastBackPressTime = now;
          showToast('⚠️ Press BACK again to exit • Draft is safely saved');
          window.history.pushState({ birobaActive: true }, '', window.location.hash || '#invoice');
        }
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const restaurantsList = getAllRestaurants(customCustomers);
  const combinedCatalog = [...catalog, ...fruitCatalog];
  const currentBillCatalog = billData.billCategory === 'FRUITS' ? fruitCatalog : catalog;

  function getNextInvoiceNumber() {
    let max = 100;
    records.forEach(r => {
      const p = parseInt(String(r.invoiceNo).replace(/\D/g, ''), 10);
      if (!isNaN(p) && p > max) max = p;
    });
    return String(max + 1);
  }

  function handleSaveBill() {
    if (!billData.customerName.trim()) {
      showToast('⚠️ Please enter a customer name');
      return;
    }

    const isFruit = billData.billCategory === 'FRUITS';
    const activeCat = isFruit ? fruitCatalog : catalog;

    const orderedItems = {};
    activeCat.forEach(v => {
      const it = billData.items[v.id];
      if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
        orderedItems[v.id] = it;
      }
    });

    if (Object.keys(orderedItems).length === 0) {
      showToast(`⚠️ Please enter at least 1 ${isFruit ? 'fruit' : 'vegetable'}`);
      return;
    }

    const recToSave = {
      recordId: billData.recordId || `rec_${Date.now()}`,
      invoiceNo: billData.invoiceNo || getNextInvoiceNumber(),
      customerName: billData.customerName.trim(),
      date: billData.date || getTodayISO(),
      billCategory: isFruit ? 'FRUITS' : 'VEGETABLES',
      paymentStatus: billData.paymentStatus || 'Credit / Unpaid',
      tempoHire: parseFloat(billData.tempoHire) || 0,
      items: orderedItems
    };

    setRecords(prev => {
      const existingIdx = prev.findIndex(r => r.recordId === recToSave.recordId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = recToSave;
        return copy;
      }
      return [recToSave, ...prev];
    });

    const updatedBill = { ...billData, recordId: recToSave.recordId };
    setBillData(updatedBill);
    saveActiveDraft(updatedBill);
    showToast(`✅ Saved ${isFruit ? 'fruit' : 'vegetable'} bill #${recToSave.invoiceNo} for ${recToSave.customerName}`);

    // Sync to Google Sheets in background
    saveInvoiceToSheet(recToSave, activeCat).then(result => {
      if (result.ok) {
        showToast(`📊 Synced to Google Sheets (${result.tabResult?.action || 'saved'})`);
      } else {
        console.warn('Sheets sync skipped:', result.error);
      }
    });
  }

  function handleNewBlankBill(targetCategory) {
    const isFruit = (targetCategory || billData.billCategory) === 'FRUITS';
    const activeCat = isFruit ? fruitCatalog : catalog;
    const blankItems = {};
    activeCat.forEach(v => {
      blankItems[v.id] = { weight: '', rate: v.defaultRate || '', amount: '', mode: v.mode || 'per_kg' };
    });
    const blankBill = {
      recordId: `rec_${Date.now()}`,
      invoiceNo: getNextInvoiceNumber(),
      customerName: '',
      date: getTodayISO(),
      billCategory: isFruit ? 'FRUITS' : 'VEGETABLES',
      paymentStatus: 'Credit / Unpaid',
      tempoHire: '',
      items: blankItems
    };
    setBillData(blankBill);
    saveActiveDraft(blankBill);
    showToast(`✨ Started fresh blank ${isFruit ? 'fruit' : 'vegetable'} bill`);
  }

  function handleLoadSampleBill() {
    const sample = {
      recordId: SAMPLE_BT_INVOICE.recordId,
      invoiceNo: SAMPLE_BT_INVOICE.invoiceNo,
      customerName: SAMPLE_BT_INVOICE.customerName,
      date: SAMPLE_BT_INVOICE.date,
      billCategory: 'VEGETABLES',
      paymentStatus: SAMPLE_BT_INVOICE.paymentStatus,
      tempoHire: SAMPLE_BT_INVOICE.tempoHire,
      items: SAMPLE_BT_INVOICE.items
    };
    setBillData(sample);
    saveActiveDraft(sample);
    showToast('📂 Loaded sample BT vegetable invoice');
  }

  function handleLoadFruitSampleBill() {
    const sample = {
      recordId: SAMPLE_LOCOMO_FRUIT_INVOICE.recordId,
      invoiceNo: SAMPLE_LOCOMO_FRUIT_INVOICE.invoiceNo,
      customerName: SAMPLE_LOCOMO_FRUIT_INVOICE.customerName,
      date: SAMPLE_LOCOMO_FRUIT_INVOICE.date,
      billCategory: 'FRUITS',
      paymentStatus: SAMPLE_LOCOMO_FRUIT_INVOICE.paymentStatus,
      tempoHire: SAMPLE_LOCOMO_FRUIT_INVOICE.tempoHire,
      items: SAMPLE_LOCOMO_FRUIT_INVOICE.items
    };
    setBillData(sample);
    saveActiveDraft(sample);
    showToast('📂 Loaded sample LOCOMO fruit invoice');
  }

  function handleEditRecordInBill(record) {
    const isFruit = record.billCategory === 'FRUITS';
    const activeCat = isFruit ? fruitCatalog : catalog;
    const filledItems = {};
    activeCat.forEach(v => {
      if (record.items && record.items[v.id]) {
        filledItems[v.id] = { ...record.items[v.id] };
      } else {
        filledItems[v.id] = { weight: '', rate: v.defaultRate || '', amount: '', mode: v.mode || 'per_kg' };
      }
    });

    const editBill = {
      recordId: record.recordId,
      invoiceNo: record.invoiceNo || '101',
      customerName: record.customerName || '',
      date: record.date || getTodayISO(),
      billCategory: isFruit ? 'FRUITS' : 'VEGETABLES',
      paymentStatus: record.paymentStatus || 'Credit / Unpaid',
      tempoHire: record.tempoHire || '',
      items: filledItems
    };

    setBillData(editBill);
    saveActiveDraft(editBill);

    navigateTo('INVOICE', 'EDIT');
    showToast(`✏️ Loaded ${isFruit ? 'fruit' : 'vegetable'} bill #${record.invoiceNo} for editing`);
  }

  function handleDuplicateForToday(recordId) {
    const orig = records.find(r => r.recordId === recordId);
    if (!orig) return;
    const clone = JSON.parse(JSON.stringify(orig));
    clone.recordId = `rec_${Date.now()}`;
    clone.invoiceNo = getNextInvoiceNumber();
    clone.date = getTodayISO();
    clone.paymentStatus = 'Credit / Unpaid';
    setRecords(prev => [clone, ...prev]);
    handleEditRecordInBill(clone);
    showToast(`📋 Copied invoice #${clone.invoiceNo} for ${clone.customerName} today!`);
  }

  function handleDeleteRecord(recordId) {
    const target = records.find(r => r.recordId === recordId);
    if (!target) return;
    if (!confirm(`Delete invoice #${target.invoiceNo} for ${target.customerName}?`)) return;
    setRecords(prev => prev.filter(r => r.recordId !== recordId));
    showToast(`🗑️ Deleted bill #${target.invoiceNo}`);
  }

  function handleStartNewBillForCustomer(customer) {
    handleNewBlankBill();
    if (customer) {
      setBillData(prev => {
        const updated = { ...prev, customerName: customer };
        saveActiveDraft(updated);
        return updated;
      });
    }
    navigateTo('INVOICE', 'EDIT');
  }

  // Modal handlers integrated with browser history
  function handleOpenAddCustModal() {
    setIsAddCustModalOpen(true);
    navigateTo(activeTab, mobileTab, 'add-cust');
  }

  function handleCloseAddCustModal() {
    setIsAddCustModalOpen(false);
    if (window.location.hash.includes('modal=')) {
      window.history.back();
    }
  }

  function handleOpenAddVegModal(itemType = 'Vegetable') {
    setAddModalItemType(itemType);
    setIsAddVegModalOpen(true);
    navigateTo(activeTab, mobileTab, 'add-item');
  }

  function handleCloseAddVegModal() {
    setIsAddVegModalOpen(false);
    if (window.location.hash.includes('modal=')) {
      window.history.back();
    }
  }

  function handleOpenExportModal(bill) {
    setExportModalBill(bill);
    navigateTo(activeTab, mobileTab, 'export');
  }

  function handleCloseExportModal() {
    setExportModalBill(null);
    if (window.location.hash.includes('modal=')) {
      window.history.back();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTo(tab, 'EDIT')}
        recordsCount={records.length}
        catalogCount={catalog.length + fruitCatalog.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4">
        {activeTab === 'INVOICE' && (
          <BillEntry
            catalog={currentBillCatalog}
            billData={billData}
            setBillData={setBillData}
            restaurantsList={restaurantsList}
            onOpenAddCustomCustomer={handleOpenAddCustModal}
            onOpenAddVegetable={handleOpenAddVegModal}
            onSaveBill={handleSaveBill}
            onNewBlankBill={handleNewBlankBill}
            onLoadSampleBill={handleLoadSampleBill}
            onLoadFruitSampleBill={handleLoadFruitSampleBill}
            onOpenExportModal={() => handleOpenExportModal(billData)}
            mobileTab={mobileTab}
            setMobileTab={(tab) => navigateTo('INVOICE', tab)}
            showToast={showToast}
          />
        )}

        {activeTab === 'SHEET' && (
          <SheetView
            records={records}
            setRecords={setRecords}
            restaurantsList={restaurantsList}
            catalog={combinedCatalog}
            onEditRecordInBill={handleEditRecordInBill}
            onDuplicateForToday={handleDuplicateForToday}
            onDeleteRecord={handleDeleteRecord}
            onOpenPdfForRecord={rec => handleOpenExportModal(rec)}
            onStartNewBillForCustomer={handleStartNewBillForCustomer}
            showToast={showToast}
          />
        )}

        {activeTab === 'RECORDS' && (
          <RecordsView
            records={records}
            setRecords={setRecords}
            restaurantsList={restaurantsList}
            catalog={combinedCatalog}
            onEditRecord={handleEditRecordInBill}
            onDuplicateRecord={handleDuplicateForToday}
            onDeleteRecord={handleDeleteRecord}
            onOpenPdf={rec => handleOpenExportModal(rec)}
            showToast={showToast}
          />
        )}

        {activeTab === 'CATALOG' && (
          <CatalogView
            catalog={catalog}
            setCatalog={setCatalog}
            fruitCatalog={fruitCatalog}
            setFruitCatalog={setFruitCatalog}
            onOpenAddVegetable={handleOpenAddVegModal}
            showToast={showToast}
          />
        )}
      </main>

      {/* Modals with browser back button support */}
      <AddCustomCustomerModal
        isOpen={isAddCustModalOpen}
        onClose={handleCloseAddCustModal}
        onSave={newCust => {
          if (!customCustomers.includes(newCust) && !restaurantsList.includes(newCust)) {
            setCustomCustomers(prev => [...prev, newCust]);
          }
          setBillData(prev => ({ ...prev, customerName: newCust }));
          handleCloseAddCustModal();
          showToast(`✅ Added & selected: ${newCust}`);
        }}
      />

      <AddVegetableModal
        isOpen={isAddVegModalOpen}
        itemType={addModalItemType}
        onClose={handleCloseAddVegModal}
        onSave={newVeg => {
          if (newVeg.category === 'FRUITS') {
            setFruitCatalog(prev => [...prev, newVeg]);
            showToast(`✅ Added ${newVeg.name} to fruit catalog`);
          } else {
            setCatalog(prev => [...prev, newVeg]);
            showToast(`✅ Added ${newVeg.name} to vegetable catalog`);
          }
          handleCloseAddVegModal();
        }}
      />

      <ExportModal
        isOpen={Boolean(exportModalBill)}
        onClose={handleCloseExportModal}
        billData={exportModalBill}
        catalog={exportModalBill?.billCategory === 'FRUITS' ? fruitCatalog : catalog}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="no-print fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
