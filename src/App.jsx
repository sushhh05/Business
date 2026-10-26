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
  loadRecords,
  saveRecords,
  loadCustomCustomers,
  saveCustomCustomers,
  getAllRestaurants,
  getTodayISO,
  SAMPLE_BT_INVOICE,
  computeRecordGrandTotal
} from './utils/storage';
import { saveInvoiceToSheet } from './utils/sheetsApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('INVOICE'); // INVOICE, SHEET, RECORDS, CATALOG
  const [catalog, setCatalog] = useState(loadCatalog);
  const [records, setRecords] = useState(loadRecords);
  const [customCustomers, setCustomCustomers] = useState(loadCustomCustomers);

  // Active bill state
  const [billData, setBillData] = useState(() => {
    const initialRec = records[0] || SAMPLE_BT_INVOICE;
    return {
      recordId: initialRec.recordId,
      invoiceNo: initialRec.invoiceNo || '101',
      customerName: initialRec.customerName || 'BT',
      date: initialRec.date || getTodayISO(),
      paymentStatus: initialRec.paymentStatus || 'Credit / Unpaid',
      tempoHire: initialRec.tempoHire || '',
      items: initialRec.items || {}
    };
  });

  // Modal states
  const [isAddCustModalOpen, setIsAddCustModalOpen] = useState(false);
  const [isAddVegModalOpen, setIsAddVegModalOpen] = useState(false);
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
    saveRecords(records);
  }, [records]);

  useEffect(() => {
    saveCustomCustomers(customCustomers);
  }, [customCustomers]);

  const restaurantsList = getAllRestaurants(customCustomers);

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

    const orderedItems = {};
    catalog.forEach(v => {
      const it = billData.items[v.id];
      if (it && ((it.weight && parseFloat(it.weight) > 0) || (it.amount && parseFloat(it.amount) > 0))) {
        orderedItems[v.id] = it;
      }
    });

    if (Object.keys(orderedItems).length === 0) {
      showToast('⚠️ Please enter at least 1 vegetable');
      return;
    }

    const recToSave = {
      recordId: billData.recordId || `rec_${Date.now()}`,
      invoiceNo: billData.invoiceNo || getNextInvoiceNumber(),
      customerName: billData.customerName.trim(),
      date: billData.date || getTodayISO(),
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

    setBillData(prev => ({ ...prev, recordId: recToSave.recordId }));
    showToast(`✅ Saved bill #${recToSave.invoiceNo} for ${recToSave.customerName}`);

    // Sync to Google Sheets in background
    saveInvoiceToSheet(recToSave, catalog).then(result => {
      if (result.ok) {
        showToast(`📊 Synced to Google Sheets (${result.tabResult?.action || 'saved'})`);
      } else {
        console.warn('Sheets sync skipped:', result.error);
      }
    });
  }

  function handleNewBlankBill() {
    const blankItems = {};
    catalog.forEach(v => {
      blankItems[v.id] = { weight: '', rate: v.defaultRate || '', amount: '', mode: v.mode || 'per_kg' };
    });
    setBillData({
      recordId: `rec_${Date.now()}`,
      invoiceNo: getNextInvoiceNumber(),
      customerName: '',
      date: getTodayISO(),
      paymentStatus: 'Credit / Unpaid',
      tempoHire: '',
      items: blankItems
    });
    showToast('✨ Started fresh blank bill');
  }

  function handleLoadSampleBill() {
    setBillData({
      recordId: SAMPLE_BT_INVOICE.recordId,
      invoiceNo: SAMPLE_BT_INVOICE.invoiceNo,
      customerName: SAMPLE_BT_INVOICE.customerName,
      date: SAMPLE_BT_INVOICE.date,
      paymentStatus: SAMPLE_BT_INVOICE.paymentStatus,
      tempoHire: SAMPLE_BT_INVOICE.tempoHire,
      items: SAMPLE_BT_INVOICE.items
    });
    showToast('📂 Loaded sample BT invoice');
  }

  function handleEditRecordInBill(record) {
    const filledItems = {};
    catalog.forEach(v => {
      if (record.items && record.items[v.id]) {
        filledItems[v.id] = { ...record.items[v.id] };
      } else {
        filledItems[v.id] = { weight: '', rate: v.defaultRate || '', amount: '', mode: v.mode || 'per_kg' };
      }
    });

    setBillData({
      recordId: record.recordId,
      invoiceNo: record.invoiceNo || '101',
      customerName: record.customerName || '',
      date: record.date || getTodayISO(),
      paymentStatus: record.paymentStatus || 'Credit / Unpaid',
      tempoHire: record.tempoHire || '',
      items: filledItems
    });

    setActiveTab('INVOICE');
    showToast(`✏️ Loaded bill #${record.invoiceNo} for editing`);
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
      setBillData(prev => ({ ...prev, customerName: customer }));
    }
    setActiveTab('INVOICE');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        recordsCount={records.length}
        catalogCount={catalog.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4">
        {activeTab === 'INVOICE' && (
          <BillEntry
            catalog={catalog}
            billData={billData}
            setBillData={setBillData}
            restaurantsList={restaurantsList}
            onOpenAddCustomCustomer={() => setIsAddCustModalOpen(true)}
            onOpenAddVegetable={() => setIsAddVegModalOpen(true)}
            onSaveBill={handleSaveBill}
            onNewBlankBill={handleNewBlankBill}
            onLoadSampleBill={handleLoadSampleBill}
            onOpenExportModal={() => setExportModalBill(billData)}
            showToast={showToast}
          />
        )}

        {activeTab === 'SHEET' && (
          <SheetView
            records={records}
            setRecords={setRecords}
            restaurantsList={restaurantsList}
            catalog={catalog}
            onEditRecordInBill={handleEditRecordInBill}
            onDuplicateForToday={handleDuplicateForToday}
            onDeleteRecord={handleDeleteRecord}
            onOpenPdfForRecord={rec => setExportModalBill(rec)}
            onStartNewBillForCustomer={handleStartNewBillForCustomer}
            showToast={showToast}
          />
        )}

        {activeTab === 'RECORDS' && (
          <RecordsView
            records={records}
            setRecords={setRecords}
            restaurantsList={restaurantsList}
            catalog={catalog}
            onEditRecord={handleEditRecordInBill}
            onDuplicateRecord={handleDuplicateForToday}
            onDeleteRecord={handleDeleteRecord}
            onOpenPdf={rec => setExportModalBill(rec)}
            showToast={showToast}
          />
        )}

        {activeTab === 'CATALOG' && (
          <CatalogView
            catalog={catalog}
            setCatalog={setCatalog}
            onOpenAddVegetable={() => setIsAddVegModalOpen(true)}
            showToast={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <AddCustomCustomerModal
        isOpen={isAddCustModalOpen}
        onClose={() => setIsAddCustModalOpen(false)}
        onSave={newCust => {
          if (!customCustomers.includes(newCust) && !restaurantsList.includes(newCust)) {
            setCustomCustomers(prev => [...prev, newCust]);
          }
          setBillData(prev => ({ ...prev, customerName: newCust }));
          setIsAddCustModalOpen(false);
          showToast(`✅ Added & selected: ${newCust}`);
        }}
      />

      <AddVegetableModal
        isOpen={isAddVegModalOpen}
        onClose={() => setIsAddVegModalOpen(false)}
        onSave={newVeg => {
          setCatalog(prev => [...prev, newVeg]);
          setIsAddVegModalOpen(false);
          showToast(`✅ Added ${newVeg.name} to catalog`);
        }}
      />

      <ExportModal
        isOpen={Boolean(exportModalBill)}
        onClose={() => setExportModalBill(null)}
        billData={exportModalBill}
        catalog={catalog}
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
