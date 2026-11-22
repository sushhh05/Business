# 🥬 Biroba Vegetable Suppliers — Master Project Documentation & Change Log

> **MANDATORY INSTRUCTION FOR ALL DEVELOPERS & AI ASSISTANTS**:
> Whenever you make changes, bug fixes, UI updates, or add new features to this repository, you **MUST** record them in the [Change Log & Version History](#-change-log--version-history) section at the bottom of this document with the date, files modified, and a clear summary of what was changed and why.

---

## 📌 Table of Contents
1. [Project Overview & Business Context](#-project-overview--business-context)
2. [Tech Stack & Architecture](#-tech-stack--architecture)
3. [Repository Anatomy & File Reference](#-repository-anatomy--file-reference)
4. [Key Functional Modules & Logic](#-key-functional-modules--logic)
5. [Data Models & Persistence](#-data-models--persistence)
6. [Google Sheets Integration Guide](#-google-sheets-integration-guide)
7. [Running & Deploying the Project](#-running--deploying-the-project)
8. [Change Log & Version History](#-change-log--version-history)

---

## 🏢 Project Overview & Business Context

- **Business Name**: Biroba Vegetable Suppliers
- **Proprietor**: Birappa B. Nigadi
- **Location**: Old Bhaji Market, Byculla, Mumbai - 400 027
- **Contact**: 9892406958 / 8451869058
- **Core Purpose**: Digital replacement for physical carbon-copy paper bill books for daily wholesale supply of fresh vegetables and fruits to restaurants and hotels in Mumbai (*e.g., Bhagat Tarachand, Sai Darshan, Surya, Sai Sagar, Locomo, etc.*).
- **Primary Capabilities**:
  1. High-speed billing data entry optimized for morning vegetable market workflows.
  2. Instant pixel-perfect WhatsApp invoice image sharing (Retina canvas rendering).
  3. Zero-dependency vector PDF and thermal/A4 receipt printing.
  4. Real-time background sync to customer-specific Google Sheets tabs and a master ledger.
  5. 100% offline-capable PWA installable on mobile phones and desktops.

---

## ⚙️ Tech Stack & Architecture

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** (`react` / `react-dom` 19.0.0) | Functional components with hooks (`useState`, `useEffect`, `useRef`) |
| **Bundler & Dev Server** | **Vite 6** (`@vitejs/plugin-react` 4.3.4) | Ultra-fast HMR and bundle optimization |
| **PWA & Offline** | `vite-plugin-pwa` 2.0.0 + `workbox-window` | Auto-updating Service Worker, manifest, offline caching |
| **Styling** | **Tailwind CSS** (via CDN in `index.html` + utility classes) | Mobile-responsive emerald wholesale mandi theme |
| **Invoice Image Engine** | **HTML5 2D Canvas** (`src/utils/whatsappImageShare.js`) | Direct 2x Retina rendering without DOM screenshot artifacts |
| **PDF Engine** | **Raw Vector PDF Generator** (`src/utils/pdfGenerator.js`) | Custom PDF byte generation (zero external bundle weight) |
| **Local Sync Server** | **Node.js Express 5** (`server.cjs`) | Proxied via Vite at `/api/*` on port 3001 |
| **Cloud Serverless** | **Vercel Functions** (`api/save-invoice.js`, `vercel.json`) | Cloud sync for production deployment |
| **Spreadsheet Sync** | **Googleapis v188** (Google Sheets API v4) | Authenticated via Google Service Account |

---

## 📂 Repository Anatomy & File Reference

```
c:\Users\susha\OneDrive\Desktop\Business\
├── api/
│   ├── health.js                       # Cloud health check endpoint
│   └── save-invoice.js                 # Vercel serverless function for Google Sheets sync
├── public/                             # Public static assets & PWA icons
│   ├── favicon.ico
│   ├── icon-192.png                    # PWA App Icon (192x192)
│   ├── icon-512.png                    # PWA App Icon (512x512)
│   ├── icon-maskable-512.png           # Maskable Android icon
│   ├── apple-touch-icon.png            # iOS Home Screen icon
│   └── Vegetable.jpg                   # Fallback branding image
├── scripts/                            # Google Sheets administrative scripts
│   ├── add_restaurant_tabs.cjs         # Batch sheet tab creation & formatting
│   ├── inspect_sheet.cjs               # Reads and verifies sheet schema
│   └── update_sheet_columns.cjs        # Adjusts column definitions and styling
├── src/
│   ├── components/
│   │   ├── BillEntry.jsx               # Main billing interface & live preview
│   │   ├── CatalogView.jsx             # Vegetables & Fruits catalog manager
│   │   ├── Header.jsx                  # Navigation bar & PWA install trigger
│   │   ├── Modals.jsx                  # Add Customer, Add Item & Export modals
│   │   ├── RecordsView.jsx             # Historical invoices ledger & CSV exporter
│   │   └── SheetView.jsx               # Restaurant account statements & date filters
│   ├── data/
│   │   ├── defaultCatalog.js           # 42 vegetables & 18 fruits master lists
│   │   └── restaurants.js              # Predefined hotel/restaurant list
│   ├── utils/
│   │   ├── pdfGenerator.js             # High-speed Vector PDF bytes compiler
│   │   ├── sheetsApi.js                # Frontend client for /api/save-invoice
│   │   ├── storage.js                  # LocalStorage helpers, models & formatters
│   │   └── whatsappImageShare.js       # Retina Canvas generator & Web Share API
│   ├── App.jsx                         # Main application state & route orchestrator
│   └── main.jsx                        # React root entry point
├── .gitignore                          # Excludes node_modules, dist, and Google key files
├── business-512417-*.json              # Google Cloud Service Account Key (KEEP PRIVATE)
├── index.html                          # Root HTML, fonts, Tailwind CDN & print styles
├── package.json                        # Dependencies and npm scripts
├── PROJECT_DOCUMENTATION.md            # Master documentation & change log (THIS FILE)
├── README.md                           # Quick-start summary
├── server.cjs                          # Local Node.js Express server for Sheets sync
├── vercel.json                         # Vercel routing and deployment config
└── vite.config.js                      # Vite plugins, proxy, and PWA manifest
```

---

## 💡 Key Functional Modules & Logic

### 1. Bill Entry & Calculation (`src/components/BillEntry.jsx`)
- **Vegetable vs Fruit Pad**: Toggle between Vegetables (42 items) and Fruits (18 items).
- **Calculation Modes**:
  - `per_kg`: `Amount = Weight (kg) × Rate`.
  - `per_100`: `Amount = (Weight / 100) × Rate` (used for Lemon & Lime).
  - `lump_sum`: Fixed lump-sum price, bypasses rate calculation (*Dudhi, Pineapple, etc.*).
  - `free`: Zero charge (*Kadi Patta*).
- **Auto-rate Lookup**: When a quantity is typed, the system automatically inserts the default catalog rate if the rate is currently blank or 0.
- **Fast Keyboard Navigation**:
  - <kbd>Enter</kbd> / <kbd>Tab</kbd> advances from `Quantity` to `Rate` to `Amount`.
  - Pressing <kbd>Enter</kbd> or <kbd>Tab</kbd> on `Amount` jumps directly to the `Quantity` cell of the next row.
  - Arrow keys (<kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>←</kbd>, <kbd>→</kbd>) allow grid navigation.

### 2. Live Bill Preview & Exports
- **Physical Slip Styling**: Includes traditional Devanagari mantras (`|| श्री महालिंगराया प्रसन्न ||`), red and green typography, customer name, date, invoice number, itemized rows, tempo charges, and grand total.
- **WhatsApp Share**:
  - Generates a 2x Retina PNG via HTML5 Canvas (`src/utils/whatsappImageShare.js`).
  - Calls `navigator.share({ files: [blob] })` on mobile browsers.
  - Falls back to automatic image download + WhatsApp Web url link on desktop.
- **Vector PDF Generator**:
  - `generateVectorInvoicePdfBytes` in `src/utils/pdfGenerator.js` creates an exact vector PDF invoice with no pixel blur.
  - `generateVectorStatementPdfBytes` creates multi-invoice account statements.

### 3. Google Sheets Synchronization
- Each invoice is saved into **two sheets** in Google Spreadsheet `13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M`:
  1. **Restaurant Specific Tab** (e.g. `SAI DARSHAN`): Stores Date, Invoice No, Total, Tempo Hire, Grand Total, Payment Status, and Notes. If the invoice already exists, it updates in-place; otherwise, appends a new row.
  2. **Daily Invoice Ledger**: Appends the master record with an itemized string summary (`Flower:4kg@Rs.42 | Tomato:15kg@Rs.22...`).

### 4. Camera AI Slip Scanner & Fuzzy Matching
- **Camera / Photo Capture**: Users can tap "📸 Scan Slip (AI)" or paste photos directly (<kbd>Ctrl+V</kbd>) from mobile or WhatsApp.
- **Multimodal AI Vision**: Powered by Google Gemini 3.5 Flash Vision (`gemini-3.5-flash`), reading informal cursive handwriting, rough paper notes, and WhatsApp order messages.
- **Vegetable Slang & Misspelling Tolerant**:
  - Automatically translates Mumbai market Hindi/Marathi slang (e.g. `kobi`, `patta gobhi`, `bhendi`, `adrak`, `aale`, `kotmir`, `dhaniya`, `lahsun`, `palak juddi`, `batata`, `kanda`, `shimla mirch`, `nimbu`) to standard catalog items.
  - Computes Levenshtein and string similarity distances to correct typos seamlessly.
- **Auto-Unit & Hotel Resolution**:
  - Automatically matches hotels (e.g. "SURYA HOTEL" $\rightarrow$ `SURYA`, "Sai Darsan" $\rightarrow$ `SAI DARSHAN`).
  - Sets accurate units (`kg`, `bundle`, `pkt`, `100 pcs`).
- **Direct Invoice Autofill**: Pre-populates all items and quantities into the draft, pulls catalog default rates, and lets the user only review/confirm rates.

### 5. Data Safety & Accidental Exit Prevention
- Active bills are continuously saved to `localStorage` under `biroba_active_bill_draft_v2`.
- Window `pagehide` and `beforeunload` listeners ensure drafts survive browser reloads or tab closures.
- Android hardware back button is intercepted using browser history `popstate` to prevent accidental loss of work.

---

## 💾 Data Models & Persistence

### 1. Invoice Record Object (`rec`)
```javascript
{
  recordId: "rec_1730000000000",
  invoiceNo: "101",
  customerName: "BHAGAT TARACHAND",
  date: "2026-10-20",               // YYYY-MM-DD
  billCategory: "VEGETABLES",        // "VEGETABLES" | "FRUITS"
  paymentStatus: "Credit / Unpaid",  // "Credit / Unpaid" | "Paid"
  tempoHire: 50,                     // Delivery / Tempo cost in Rs.
  items: {
    "v1": { weight: "4", rate: "42", amount: "168", mode: "per_kg" },
    "v21": { weight: "1", rate: "", amount: "", mode: "free" },
    "v29": { weight: "2", rate: "", amount: "80", mode: "lump_sum" }
  }
}
```

### 2. Catalog Item Object
```javascript
{
  id: "v1",                          // Unique ID (e.g. v1..v42, f1..f18)
  name: "Flower",                    // Display Name
  mode: "per_kg",                    // "per_kg" | "per_100" | "lump_sum" | "free"
  defaultRate: "42",                 // Default rate in Rs.
  category: "VEGETABLES"             // "VEGETABLES" | "FRUITS"
}
```

### 3. LocalStorage Keys
- `biroba_veg_catalog_v1`: Master vegetable catalog
- `biroba_fruit_catalog_v1`: Master fruit catalog
- `biroba_invoice_records_v1`: Saved invoices array
- `biroba_custom_customers_v2`: User-added custom restaurants
- `biroba_active_bill_draft_v2`: Current in-progress bill
- `biroba_last_active_tab_v1`: Last active tab (`INVOICE`, `SHEET`, `RECORDS`, `CATALOG`)

---

## 🚀 Running & Deploying the Project

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run both the Sheets sync server (port 3001) and Vite frontend (port 5173)
npm run dev:all

# Alternatively, run them in separate terminals:
# Terminal 1:
npm run dev:server
# Terminal 2:
npm run dev
```

### Production Deployment (Vercel)
1. Push repository to GitHub.
2. In Vercel Project Settings $\rightarrow$ Environment Variables:
   - `SPREADSHEET_ID`: `13IhVAiVcsjZAMVXZP5x95b96cM_ggD1qIlr0pD7Po-M`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Base64 string or JSON string of your Google Cloud Service Account private key.
3. Deploy. The `vercel.json` rewrites automatically route `/api/*` to the serverless functions in `/api`.

---

## 📝 Change Log & Version History

> **RULE**: Add every new update, bug fix, or feature at the top of this table when modifying the project.

| Date | Author / Agent | Files Modified | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **2026-11-22** | Antigravity AI | `src/utils/storage.js`, `biroba_billing_v2.html`, `biroba_vegetable_suppliers_daily_billing_record_system.html`, `PROJECT_DOCUMENTATION.md` | Contact Info Update: Updated secondary phone number from `7400106277` to `7039601937` across `COMPANY_INFO`, propagating seamlessly to the live bill preview, PDF invoices, WhatsApp share cards, and statement headers. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/components/ScanSlipModal.jsx`, `index.html`, `PROJECT_DOCUMENTATION.md` | Mobile Responsive View & Input Legibility Fix: Resolved digit truncation and hidden numbers when typing quantities on mobile phones. Added global CSS in `index.html` removing number input spinners and internal margin wasted by browser controls. Added `overflow-x-auto` with a robust `min-w-[500px]` table boundary in BillEntry to prevent narrow viewports from collapsing columns into unreadable slivers. On mobile screens (<640px), hid redundant separate `#` column and rendered the sequence index inline alongside product names, liberating 40px of screen space. Expanded Qty input to `min-w-[72px]` (up to `w-28`), Rate to `min-w-[62px]`, Amount to `min-w-[68px]`, added `inputMode="decimal"` for instant mobile numeric keypads with decimals, set bold readable text (`text-base sm:text-sm font-bold`), and added prominent emerald border highlights for entered items. Mirrored improvements in ScanSlipModal. |
| **2026-11-22** | Antigravity AI | `src/data/defaultCatalog.js`, `src/utils/fuzzyMatcher.js`, `src/utils/storage.js`, `PROJECT_DOCUMENTATION.md` | Catalog Reordering: Physical Printed Slip Sequence 1-41 Alignment: Reordered the master vegetable catalog to match the user's physical printed slip exactly from 1 to 41 (Flower, Kobi, Bendi, Tomato Big, Tamato Small, Carrot, Cucumber, Beans, Beet, Chilly, Ginger, Brinjal, Lemon, Kothimbir, Pudina, Methi, Suva, Palak, Salad Patta, Celery, Kadi Patta, Hara Kanda, Tondali, Capsicum, Potato, Onion, Garlic, Coconut, Dudhi, Muli, Karela, Gawar/Matar, Chawli, Red Bhopla, Drum Stick, Suran, Kohala, Madrasi Kakadi, Mushroom, Baby Corn, Red/Yellow Capsicum). Appended the remaining 14 catalog vegetables below item 41. Added `v55` (Beet) and printed chit spellings (`Mull`, `Tondall`, `Baby Con.`, `Tamato Small`) to `fuzzyMatcher.js`. Upgraded catalog storage key to `biroba_veg_catalog_v5` and implemented automatic migration in `loadCatalog()` that orders defaults according to the printed slip sequence while preserving user-added custom products at the end. |
| **2026-11-22** | Antigravity AI | `src/components/Modals.jsx`, `PROJECT_DOCUMENTATION.md` | Fix: Missing `useEffect` import in Modals.jsx: Added `useEffect` to React named imports in `src/components/Modals.jsx` to resolve the `ReferenceError: useEffect is not defined` identified by the newly introduced ErrorBoundary on production deployments. |
| **2026-11-22** | Antigravity AI | `vercel.json`, `vite.config.js`, `package.json`, `index.html`, `src/main.jsx`, `PROJECT_DOCUMENTATION.md` | Fix: Vercel White Screen Resolution: Fixed blank screen on Vercel deployment caused by aggressive catch-all rewrites intercepting `.js` and static asset chunks as HTML. Updated `vercel.json` with scoped SPA negative-lookahead rewrite `/(?!api|assets|.*\\..*)` to protect assets and `/api` serverless routes; added `base: '/'` to `vite.config.js`; moved Vite and PWA plugins to `dependencies` to guarantee installation under `NODE_ENV=production`; removed duplicate manifest link; and added React 19 `ErrorBoundary` with reload/reset fallback in `main.jsx`. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/components/Modals.jsx`, `src/App.jsx`, `PROJECT_DOCUMENTATION.md` | Feat: In-Invoice Add Product Option: Added seamless product creation while actively preparing an invoice. Users can now click "+ Add Product" from the invoice header toolbar, the search/filter bar, or directly from the bottom/empty-state of the billing table. The enhanced `AddVegetableModal` allows selecting custom quantity unit dropdowns (`kg`, `pkt & kg`, `bundle & kg`, `100 pcs & kg`, `pcs`), optional initial bill quantity, and rate, immediately adding the product to the catalog and the live invoice. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/components/ScanSlipModal.jsx`, `src/App.jsx`, `src/utils/storage.js`, `PROJECT_DOCUMENTATION.md` | Strict Restaurant Last Rate Policy: Completely removed catalog default rate auto-fill. Rates now populate ONLY when quantities are filled and a restaurant is selected, strictly fetching rates from that restaurant's recently/last generated bill (`getCustomerLastRates`). If it is a restaurant's first bill or the item was not billed previously, rates strictly remain blank for manual entry. Selecting a new customer dynamically recalculates rates for entered quantities as per their past bills. Bumped draft storage key to purge legacy drafts. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/utils/pdfGenerator.js`, `src/utils/whatsappImageShare.js`, `PROJECT_DOCUMENTATION.md` | Header Redesign: Removed large "INVOICE" heading across the live preview, vector PDF, and WhatsApp image canvas. Promoted company name "Biroba Vegetable Suppliers" to the primary header position in prominent invoice title size, with company tagline ("All kinds of fresh vegetables and fruits, wholesale suppliers") shifted cleanly to the subsequent line. |
| **2026-11-22** | Antigravity AI | `src/App.jsx`, `src/utils/storage.js`, `PROJECT_DOCUMENTATION.md` | Clean Startup: Removed prefilled/demo initial bill on app launch. App now opens to a completely clean, fresh blank bill ready for customer selection and billing; purged legacy demo draft from localStorage. |
| **2026-11-22** | Antigravity AI | `src/utils/storage.js`, `src/components/ScanSlipModal.jsx`, `src/components/BillEntry.jsx`, `server.cjs`, `api/save-invoice.js`, `PROJECT_DOCUMENTATION.md` | Fix: Dynamic Lemon Unit Rate Calculation: Refined `computeRowAmount` so when Lemon is selected as `kg`, amount is strictly calculated as `weight * rate` per kg. When selected as `100 pcs`, it calculates as per 100 pcs (`(qty / 100) * rate` for piece counts $\ge 10$, or `qty * rate` for hundreds count $< 10$). Synchronized across BillEntry, ScanSlipModal, and Google Sheets ledger. |
| **2026-11-22** | Antigravity AI | `src/components/ScanSlipModal.jsx`, `src/components/BillEntry.jsx`, `src/utils/storage.js`, `src/utils/fuzzyMatcher.js`, `src/utils/geminiVision.js`, `src/App.jsx`, `server.cjs`, `api/scan-chit.js`, `PROJECT_DOCUMENTATION.md` | Feat: Fresh Bill Isolation, Restaurant Historical Rate Auto-Fill & Low-Token Slip Text Mode: Fixed scanned bill creation so it completely clears previous bill products and starts fresh with only photo items. Implemented restaurant-specific rate auto-fill via `getCustomerLastRates` pulling the latest rates charged to that hotel in previous bills (with catalog fallback). Added 0-token editable slip text panel with instant local re-parser, and downscaled images (1024px, 0.75 quality) with Flash-Lite model priority to minimize token consumption. |
| **2026-11-22** | Antigravity AI | `src/components/ScanSlipModal.jsx`, `src/utils/geminiVision.js`, `src/utils/fuzzyMatcher.js`, `src/components/BillEntry.jsx`, `server.cjs`, `api/scan-chit.js`, `.env`, `PROJECT_DOCUMENTATION.md` | Feat: Camera AI Slip Scanner & Indian Vegetable Fuzzy Matching: Added one-tap mobile camera & photo upload slip scanner powered by Gemini 3.5 Flash Vision. Implemented high-accuracy fuzzy matching engine with full Mumbai wholesale market synonym dictionary (Hindi/Marathi slang like kobi, bhendi, adrak, kotmir, lahsun, juddi) and auto hotel matching; extracted quantities auto-fill invoices with catalog default rates applied. |
| **2026-11-22** | Antigravity AI | `src/data/restaurants.js`, `src/data/defaultCatalog.js`, `src/utils/whatsappImageShare.js`, `src/components/Modals.jsx`, `src/utils/storage.js`, `PROJECT_DOCUMENTATION.md` | Customer List Refinement: Removed `'Powai (पवई)'` from predefined customer list, default invoice samples, canvas fallbacks, and added sanitization filter in `getAllRestaurants` to prevent any cached/stale Powai entries from appearing in UI customer pills or dropdowns while preserving `ICHIMI VEGETABLES POWAI`. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/data/restaurants.js`, `src/data/defaultCatalog.js`, `src/utils/storage.js`, `src/utils/pdfGenerator.js`, `src/components/Modals.jsx`, `PROJECT_DOCUMENTATION.md` | Customer List & Single-Page Layout: Restored all 15 customer options with quick-select pills & dropdown; set all default vegetables to kg; added bundle unit for greens (coriander, spinach, mint) and pkt/kg dropdown for mushrooms & garlic; added custom unit selector when adding products; guaranteed strictly single-page centered invoice for PDF download & WhatsApp sharing matching `INVOICE.pdf`. |
| **2026-11-22** | Antigravity AI | `src/components/BillEntry.jsx`, `src/utils/whatsappImageShare.js`, `src/utils/pdfGenerator.js`, `src/utils/storage.js`, `src/data/defaultCatalog.js`, `src/data/restaurants.js`, `src/components/Header.jsx`, `index.html`, `PROJECT_DOCUMENTATION.md` | Major UI Redesign: Transformed application interface and invoice layout to match modern corporate invoice reference (`INVOICE.pdf`). Added unit support (kg, pkt, pcs), dynamic Amount-in-Words, 2-page vector PDF generation, updated phone numbers (9892406958 / 7400106277), and sample Powai invoice. |
| **2026-11-22** | Antigravity AI | `PROJECT_DOCUMENTATION.md`, `README.md` | Created master documentation file & updated README to establish ongoing change-tracking workflow. |
| **2026-10-28** | Sushant | `src/components/BillEntry.jsx`, `src/utils/whatsappImageShare.js`, `src/utils/pdfGenerator.js` | UI: Removed red fruit invoice slip badge from live preview, WhatsApp image, and PDF for uniform slip branding. |
| **2026-10-28** | Sushant | `src/components/BillEntry.jsx` | UI: Removed sample invoice quick-load buttons from BillEntry header to eliminate accidental demo data insertion. |
| **2026-10-28** | Sushant | `src/components/BillEntry.jsx`, `src/data/defaultCatalog.js`, `src/components/SheetView.jsx` | Feat: Added Fruit Invoice pad support with 18 standard wholesale fruit items, switcher, and statement exports. |
| **2026-10-28** | Sushant | `server.cjs`, `api/save-invoice.js`, `src/components/SheetView.jsx` | Fix: Removed "Items Ordered" column from individual restaurant Google Sheets tabs and balanced SheetView columns. |
| **2026-10-27** | Sushant | `src/components/SheetView.jsx`, `src/utils/pdfGenerator.js` | Feat: Added date range from-to selection, quick preset buttons (10 days, 30 days, this month), and Statement PDF export. |
| **2026-10-27** | Sushant | `src/components/BillEntry.jsx` | Feat: Auto-fetch default rate from master catalog when quantity is entered if rate is empty or 0. |
| **2026-10-26** | Sushant | `src/App.jsx`, `src/utils/storage.js` | Fix: Browser back button history navigation and draft auto-save persistence via beforeunload & pagehide. |
| **2026-10-26** | Sushant | `src/components/BillEntry.jsx` | Fix: Made Enter and Tab keys on Amount field navigate directly to the next row's Quantity column. |
| **2026-10-26** | Sushant | `src/utils/whatsappImageShare.js` | Fix: Replaced DOM screenshot approach with pixel-perfect HTML5 2D Canvas engine to eliminate line overlapping on WhatsApp images. |
| **2026-10-26** | Sushant | `api/save-invoice.js`, `api/health.js`, `vercel.json` | Feat: Added Vercel serverless functions for zero-configuration cloud deployment of Google Sheets sync. |
| **2026-10-26** | Sushant | Entire repository | Initial Release: Migrated standalone single-file HTML billing system to React 19 + Vite PWA with Google Sheets sync. |
