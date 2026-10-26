# 🥬 Biroba Vegetable Suppliers — Daily Billing, Invoicing & Sheets Sync PWA

A modern, mobile-friendly **Progressive Web App (PWA)** designed for wholesale vegetable suppliers and hotel vegetable supply operations. 

Built with React 19, Tailwind CSS, Vite, and Node.js with live Google Sheets synchronization.

---

## ✨ Features

- **🧾 Instant Daily Bill Generator**: Create and format itemized bills for wholesale and hotel customers.
- **👁️ Live Mobile Bill Preview**: Responsive bill preview styled like an authentic physical invoice slip with Biroba branding.
- **📲 Direct WhatsApp Invoice Image Sharing**: Automatically renders and attaches crisp invoice images directly to WhatsApp using the Web Share API.
- **📊 Real-Time Google Sheets Sync**: Saves invoice records into both the restaurant's dedicated sheet tab and the master *Daily Invoice Ledger*.
- **📱 Installable PWA**: Installable on Android and iOS home screens with standalone offline support and custom vegetable app icon.
- **📄 Vector PDF Export & Direct Thermal Printing**: Generate vector PDF invoices or print directly with standard A4 / thermal paper formats.
- **🥦 Custom Customer & Vegetable Catalog Management**: Add custom hotel/restaurant names and vegetable items with custom rates on the fly.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Google Sheets Sync (Optional)
Place your Google Cloud Service Account JSON key in the project root:
```
business-512417-*.json
```
Ensure your Google Service Account has Editor permissions on your Google Spreadsheet.

### 3. Run the Development Server
To run both the React PWA frontend and the Google Sheets sync server:
```bash
# Terminal 1 — Sheets sync server
npm run dev:server

# Terminal 2 — Vite PWA frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📱 Mobile Access (PWA)

When connected to the same Wi-Fi network, open your computer's local IP on your phone:
```
http://<your-local-ip>:5173
```
- **Android**: Tap the **📲 Install App** button in the header or select **Add to Home screen** in Chrome.
- **iOS**: Tap **Share** ➡️ **Add to Home Screen** in Safari.

---

## 🛡️ License & Confidentiality
Proprietary software for **Biroba Vegetable Suppliers** (Prop.: Birappa B. Nigadi, Byculla, Mumbai).
