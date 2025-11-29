# Student Outing Management System (SOMS) - Master Documentation

**Institute:** National Institute of Technology, Andhra Pradesh  
**Platform:** Web Application (React 19 + TypeScript + Firebase)  
**Version:** 4.0 (Enterprise Grade & Security Hardened)  
**Architecture:** Serverless SPA with Client-Side Biometrics & Batch Processing

---

## 1. Executive Summary

The **Student Outing Management System (SOMS)** is a comprehensive digital security platform for campus gate management. It automates student checkout/check-in using **AI-driven Facial Recognition**, manages visitor gate passes, and provides real-time analytics.

**Key Version 4.0 Upgrades:**
*   **Zero-Trust Biometrics:** Implementation of "Confidence Gap" logic and High-Res feature extraction to eliminate false positives.
*   **Programmatic Reporting:** Replaced screenshot-based reporting with pixel-perfect, vector-based PDF generation.
*   **Bulk Data Safety:** Introduction of "Smart Batching" (Chunking) to handle large Excel/Photo imports without hitting database limits, featuring a "Skip vs. Overwrite" workflow.
*   **Thermal Printing:** Native support for 80mm thermal receipt printers for visitor passes.

---

## 2. System Architecture

### 2.1. Hybrid Data Strategy ("Smart Sync")
To optimize Cloud Firestore costs while ensuring performance, the app uses a hybrid fetching strategy:
1.  **Students (Full Load):** All ~2500 student records (features & metadata) are loaded on startup into memory. This enables **instant** facial recognition without per-scan network latency.
2.  **Live Outing Logs (Partial Sync):** The app listens *only* to:
    *   Logs created in the **last 7 days**.
    *   Any log with status **"Active/Out"**, regardless of age.
3.  **Archived Logs (On-Demand):** Historical data (>7 days and completed) is kept cold in the database and only fetched via the **Archive Search** module.

### 2.2. The Biometric Pipeline (Zero-Trust)
Facial recognition runs entirely in the client browser using `face-api.js` (TensorFlow.js), preserving privacy and reducing server costs.

**The "Zero-Trust" Workflow:**
1.  **Capture:** Webcam captures a frame.
2.  **Detection:** SSD MobileNet V1 detects the face.
3.  **Extraction:** ResNet-34 computes a 128-dimensional Euclidean vector.
4.  **Verification (The 3-Step Check):**
    *   *Step A:* Find the mathematical "Best Match" in the student database.
    *   *Step B:* **Strict Threshold Check:** Distance must be `< 0.45` (Lower is better).
    *   *Step C:* **Confidence Gap Check:** The difference between the Best Match and the 2nd Best Match must be `> 0.05`. If two students look too similar, the system rejects *both* to prevent identity spoofing.

---

## 3. Detailed Module Breakdown

### 3.1. Authentication & Roles
*   **File:** `components/Login.tsx`
*   **Mechanism:** Firebase Auth (Email/Password).
*   **Gate Logic:** User email determines the "Gate Name" (e.g., `frontgate@...` -> "Front Gate").
*   **Roles:**
    *   `Admin`: Full CRUD access, Bulk Delete, Settings.
    *   `Security`: Operational access (Kiosk, Visitor). No deletion capabilities.

### 3.2. Dashboard & Reporting
*   **File:** `components/Dashboard.tsx`
*   **Stats:** Real-time counters for "Currently Out", "Overdue", "Local/Non-Local Today".
*   **Charts:** Doughnut charts for Outing Demographics (Year/Hostel).
*   **PDF Report Engine (`services/reportGeneratorService.ts`):**
    *   **Old Method:** `html2canvas` (Screenshot) - *Deprecated due to layout drift.*
    *   **New Method:** `jspdf` + `jspdf-autotable`.
    *   **Logic:** The report is drawn programmatically (lines, text, tables) coordinate-by-coordinate.
    *   **Features:**
        *   Auto-calculation of Hostel Occupancy.
        *   Precise "Overdue Analysis" table.
        *   Uses standard **Helvetica** font for professional compatibility.
        *   Two-column layout for Activity Stats.

### 3.3. Student Registration & Bulk Operations
*   **File:** `components/RegisterStudent.tsx`
*   **Single Registration:** Captures metadata and a photo.
*   **Bulk Excel Import:**
    *   **Logic:** Reads `.xlsx` files using SheetJS.
    *   **Duplicate Handling:** Separates entries into "New" and "Existing" (based on Roll No).
    *   **Overwrite Feature:** Users can click "Overwrite Skipped" to force-update existing students with Excel data.
    *   **Chunking:** Uses `firebaseService.ts` -> `addStudentsBatch` to split data into chunks of 450 records, bypassing Firestore's 500-write limit.
*   **Bulk Photo Import:**
    *   **Logic:** Matches filenames (e.g., `621234.jpg`) to Student Roll Numbers.
    *   **High-Res Analysis:** Extracts facial features from the **RAW** image file *before* compression to ensure maximum accuracy.
    *   **Compression:** Compresses image to 600x600 JPEG (80%) for storage *after* analysis.
    *   **Workflow:** Reports "Success", "Skipped (Already exists)", and "Analysis Failed (Blurry)". Allows "Overwrite & Re-import" for skipped files.

### 3.4. The Outing Kiosk
*   **File:** `components/OutingKiosk.tsx`
*   **Purpose:** The primary interface for students.
*   **Blind Spot Protection:** Before allowing a Check-Out, the system performs a deep DB query (`findAnyActiveOutingForStudent`) to ensure the student isn't already out (even if the log is old and not in the local cache).
*   **Retry Logic:** Allows 3 scan attempts before locking and suggesting manual entry.

### 3.5. The Logbook
*   **File:** `components/Logbook.tsx`
*   **Views:**
    *   **Live:** Last 7 days + Active.
    *   **Archive:** Date-range search (Server-side query).
*   **Manual Entry:** Searchable dropdown to manually check in/out students who fail biometrics.
*   **Bulk Delete (Admin Only):**
    *   **Requirement:** Admin must first **Export** the data to Excel.
    *   **Security:** Requires entering the PIN `200405` to confirm deletion.
    *   **Scope:** Options for "Older than 3 months", "6 months", "1 year".

### 3.6. Visitor Management
*   **File:** `components/VisitorGatePass.tsx`
*   **Pass Generation:** Auto-generates Pass IDs (e.g., `V-20231124-001`).
*   **Printing:**
    *   **Standard:** A5/A4 layout.
    *   **Thermal:** Optimized 80mm CSS layout with zero margins for POS printers.
*   **Tracking:** "Mark Out" button stamps timestamp and Out Gate.

---

## 4. Key Functions & Services

### `services/firebaseService.ts`
*   **`addStudentsBatch(students)`**: Splits an array of 2000 students into batches of 450 and commits them sequentially to prevent crashes.
*   **`updateStudentsBatch(updates)`**: Handles bulk overwrites safely.
*   **`onOutingLogsUpdate(callback)`**: Merges "Recent" (7 days) and "Active" (Status=Out) queries into a single unified stream.
*   **`getArchivedOutingLogs(start, end)`**: Performs compound queries for historical data.

### `services/facialRecognitionService.ts`
*   **`loadModels()`**: Asynchronously loads SSD MobileNet and ResNet weights.
*   **`extractFaceFeatures(base64)`**: Returns the 128-float array.
*   **`findBestMatch(image, students)`**:
    *   Iterates through all ~2500 students.
    *   Calculates Euclidean Distance.
    *   Applies **Confidence Gap** logic: `(2ndBest - Best) < 0.05 ? Reject : Accept`.

### `services/reportGeneratorService.ts`
*   **`generatePdfReport(data)`**:
    *   Fetches Logo (Base64).
    *   Draws Header (NIT Andhra Pradesh).
    *   Draws Stat Cards (Rectangles + Text).
    *   Generates Tables (AutoTable) with conditional formatting (Red for Overdue).
    *   Saves as `OUTING_REPORT_YYYY-MM-DD.pdf`.

---

## 5. File Manifest

| File Path | Description |
| :--- | :--- |
| `App.tsx` | Main entry point. Handles Routing, Auth state, Global Context, and Kiosk Mode. |
| `types.ts` | TypeScript interfaces for Student, OutingRecord, VisitorPassRecord, User. |
| `constants.ts` | Static data: Branches, Hostels, Dropdown options. |
| `firebase.ts` | Firebase App initialization and exports (Auth, DB, Storage). |
| `services/firebaseService.ts` | CRUD operations, Real-time listeners, Batching logic. |
| `services/facialRecognitionService.ts` | AI model loading, Feature extraction, Math logic for matching. |
| `services/reportGeneratorService.ts` | PDF generation logic. |
| `components/Login.tsx` | Gate login screen. |
| `components/Header.tsx` | Navigation bar. |
| `components/Footer.tsx` | Copyright footer. |
| `components/Dashboard.tsx` | Analytics, Charts, Report Trigger. |
| `components/RegisterStudent.tsx` | Single/Bulk Registration forms. |
| `components/OutingKiosk.tsx` | Student-facing scanner interface. |
| `components/Logbook.tsx` | Master record view, Archive search, Manual Entry. |
| `components/AllStudents.tsx` | Student database view, Edit/Delete, Bulk Selection. |
| `components/VisitorGatePass.tsx` | Visitor entry forms and logbook. |
| `components/GatePassPreviewModal.tsx` | Printable preview for visitor passes. |
| `components/EditStudentModal.tsx` | Form to edit student details/photo. |
| `components/StudentProfileModal.tsx` | Read-only student details view. |
| `components/StudentListModal.tsx` | Generic list view for dashboard clicks. |
| `components/CameraCapture.tsx` | Webcam handling component. |
| `components/CustomSelect.tsx` | Reusable styled dropdown. |
| `components/Modal.tsx` | Reusable modal wrapper. |
| `components/Alert.tsx` | Reusable notification banner. |
| `components/Spinner.tsx` | Loading indicator. |
| `components/ConfirmationModal.tsx` | Generic "Are you sure?" dialog. |
| `components/RemarksModal.tsx` | Dialog to add/edit remarks. |
| `components/ViewRemarksModal.tsx` | Read-only remarks view. |
| `components/charts/*.tsx` | Wrapper components for Chart.js (Bar, Line, Doughnut). |

---

## 6. Security Protocols

1.  **PIN Protection:** The PIN `200405` is hardcoded into `Logbook.tsx`, `AllStudents.tsx`, and `VisitorGatePass.tsx`. It acts as a client-side check before calling destructive Firebase functions.
2.  **Role-Based Rendering:** Components check `role === 'admin'` before rendering Delete buttons or Bulk Import tools.
3.  **Data Isolation:** "Security" role users cannot see or access the "Bulk Delete" features even if they knew the URL (protected by component logic).
