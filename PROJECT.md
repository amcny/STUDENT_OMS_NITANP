# Student Outing Management System (SOMS) - Master Documentation

**Institute:** National Institute of Technology, Andhra Pradesh  
**Platform:** Web Application (React 19 + TypeScript + Firebase)  
**Version:** 3.5 (Cloud-Native, Cost-Optimized & Production Ready)  
**Architecture:** Serverless Single Page Application (SPA)

---

## 1. Executive Summary

The **Student Outing Management System (SOMS)** is a mission-critical security platform designed to digitize, secure, and automate the movement of students and visitors at campus gates.

It replaces manual logbooks with **Biometric Facial Recognition**, ensures **Real-Time Synchronization** between multiple gates (Front/Back) using Cloud Firestore, and implements an intelligent **"Smart Sync"** architecture to minimize cloud costs while maintaining access to historical data.

---

## 2. Technical Stack & Architecture

### Frontend Layer
*   **Framework:** React 19 (Built with Vite for high performance).
*   **Language:** TypeScript 5.0+ (Strict typing for robustness).
*   **Styling:** Tailwind CSS (Utility-first design).
*   **State Management:** React Context API + Real-time Firebase Listeners.

### Backend Layer (Serverless)
*   **Authentication:** Firebase Auth (Email/Password) with Custom Claims for Role-Based Access Control (RBAC).
*   **Database:** Google Cloud Firestore (NoSQL, Real-time).
*   **Storage:** Firebase Storage (Object storage for high-res images).

### Specialized Modules
*   **AI/Biometrics:** `face-api.js` (TensorFlow.js) running entirely in the browser to perform face detection and feature extraction without server-side ML costs.
*   **Reporting:** `jspdf` + `html2canvas` for vector-quality PDF generation.
*   **Data Processing:** `xlsx` (SheetJS) for bulk Excel operations.

---

## 3. Database Strategy: "Smart Sync" & Cost Optimization

A critical challenge in cloud apps is billing based on "Reads". Loading 50,000 historical logs on startup would cost money every time a guard refreshes the page. SOMS solves this with a **Hybrid Data Fetching Strategy**.

### 3.1. The "Live" vs. "Archive" Architecture

| Data Type | Fetch Strategy | Billing Impact | Behavior |
| :--- | :--- | :--- | :--- |
| **Students** | **Full Load** | Moderate | Loads all active students (~2500) on startup to enable instant facial recognition. |
| **Outing Logs (Live)** | **Active + Recent** | **Low** | Listens only to logs from the **last 7 days** AND any **currently active** outings (regardless of age). |
| **Outing Logs (History)** | **On-Demand** | **Zero (Idle)** | Historical data is *never* loaded unless an Admin explicitly uses **Archive Search**. |
| **Visitor Logs** | **Recent Only** | **Low** | Listens to last 7 days. History available via Archive Search. |

### 3.2. Read/Write Cost Analysis
*   **Initial App Load:** ~2,700 Reads (2500 Students + ~200 Recent Logs).
*   **Steady State:** 0 Reads (Listen mode).
*   **Student Check-Out:** 1 Write (Create Doc) + 1 Read (Listener Update).
*   **Archive Search:** 1 Read per record found (e.g., searching "Last Month" costs ~2,000 reads one-time).
*   **Exporting Data:**
    *   *Current View:* 0 Reads (Uses memory).
    *   *Historical Export:* Costs 1 read per record fetched from DB.

---

## 4. Module Breakdown & Working Mechanism

### 4.1. Authentication & Security
*   **Gate Login:** Users log in as specific gates (e.g., `frontgate@...`).
*   **RBAC (Roles):**
    *   **Admin:** Full access (Delete, Edit Remarks, Bulk Operations).
    *   **Security:** Operational access (Check-In/Out, Visitor Pass). **No Delete permissions.**
*   **Security PIN:** A hardcoded PIN (`200405`) is required for destructive actions (Delete/Edit) to prevent accidental data loss.

### 4.2. Dashboard
*   **Real-time Metrics:** Displays "Currently Out", "Overdue", and "On Campus" counts derived instantly from the live `outingLogs` context.
*   **Demographics:** Interactive charts showing outings by **Year** and **Hostel**.
*   **PDF Report:** Generates a printable report on NIT Andhra Pradesh letterhead containing executive summaries, hostel occupancy tables, and detailed overdue lists.

### 4.3. Student Registration (Biometric Enrollment)
*   **Single Registration:** Captures student details and photo (Webcam/Upload).
*   **Image Compression Engine:**
    *   *Problem:* 5MB phone photos clog bandwidth.
    *   *Solution:* Client-side canvas compression resizes images to **600x600px JPEG (80% quality)**, reducing size to ~50KB before upload.
*   **Bulk Import:**
    *   **Excel:** Parses `.xlsx` for student metadata.
    *   **Photo Import:** Admins upload a folder of images named by Reg Number (e.g., `621234.jpg`). The system automatically matches them to students, extracts facial features, and uploads them to Firebase.

### 4.4. The Smart Kiosk (Core Operations)
This module handles student movement.

*   **Warm-Up Sequence:** On load, runs a "dummy" AI inference to compile WebGL shaders, preventing the UI from freezing during the first actual student scan.
*   **Facial Recognition:**
    1.  Captures frame.
    2.  Detects face & extracts 128-point vector.
    3.  Calculates Euclidean distance against all 2500 local student vectors.
    4.  Match found if distance < 0.5.
*   **Anti-Double Check-Out Logic (The "Blind Spot" Fix):**
    *   *Scenario:* Student checked out 10 days ago. The "Live" listener (7-day window) doesn't see it.
    *   *Fix:* When a student tries to check out, the system first checks local data. If clear, it performs a **targeted server-side query** (`findAnyActiveOutingForStudent`) to ensure no hidden active outings exist in the database history.

### 4.5. Outing Logbook
*   **Live View:** Default state. Shows recent activity. Fast & cheap.
*   **Archive Search:** Admin selects a date range. System performs a `getDocs` query to fetch historical data for auditing.
*   **Actions:**
    *   **Manual Entry:** Allows guards to manually check in/out students if biometrics fail.
    *   **Resolve Overdue:** Adds a remark to close an overdue flag.
    *   **Bulk Delete:** Admin can purge old logs (e.g., > 1 year) to keep the DB clean. Requires Export + PIN.

### 4.6. Visitor Management System
*   **Pass Generation:** Records visitor details, photo not required.
*   **Thermal Printing (New):**
    *   Generates an **80mm receipt** format.
    *   Includes Institute Logo, Pass No, Visitor Details, and Signature space.
    *   Optimized CSS (`@media print`) ensures margins are zeroed for thermal printers.
*   **Departure:** "Mark Out" button updates the `outTime` and `outGate`.

---

## 5. Database Schema (Firestore)

### Collection: `students`
```json
{
  "id": "auto-generated",
  "name": "STUDENT NAME",
  "rollNumber": "4212...",
  "registrationNumber": "9212...",
  "branch": "CSE",
  "year": "IV",
  "gender": "Male",
  "studentType": "Hosteller",
  "hostel": "Godavari",
  "roomNumber": "101",
  "contactNumber": "9876543210",
  "faceImage": "https://firebasestorage.../9212....jpg",
  "faceFeatures": [0.123, -0.456, ...], // 128 float array
  "updatedAt": "Timestamp"
}
```

### Collection: `outingLogs`
*Denormalized for performance (contains student details to avoid joins).*
```json
{
  "id": "auto-generated",
  "studentId": "ref-to-students",
  "studentName": "STUDENT NAME",
  "outingType": "Local" | "Non-Local",
  "checkOutTime": "Timestamp",
  "checkOutGate": "Front Gate",
  "checkInTime": "Timestamp" | null,
  "checkInGate": "Back Gate" | null,
  "remarks": "Manual entry...",
  "overdueResolved": boolean
}
```

### Collection: `visitorLogs`
```json
{
  "id": "auto-generated",
  "passNumber": "V-20231025-001",
  "name": "VISITOR NAME",
  "relation": "Parent",
  "whomToMeet": "STUDENT NAME",
  "inTime": "Timestamp",
  "gateName": "Front Gate",
  "outTime": "Timestamp" | null,
  "outGateName": "Front Gate" | null
}
```

---

## 6. Operational Guidelines

### A. Power Failure / System Restart
*   **Behavior:** When the system restarts, it performs a fresh fetch of Students and Recent Logs.
*   **Cost:** ~2700 Reads.
*   **Data Integrity:** No data is lost. Active outings from before the power cut are retrieved automatically.

### B. Handling "Blind Spot" Check-Ins
If a student returns after 15 days (outside the 7-day live window):
1.  They scan at the Kiosk.
2.  Kiosk checks local data -> Not found.
3.  Kiosk queries DB for `studentId + status=OUT`.
4.  **Found:** System updates the old record.
5.  **Result:** The check-in is successful, and the log reappears in the list.

### C. Bulk Data Import
1.  **Excel:** Use the downloadable template. Upload `.xlsx`.
2.  **Photos:** Ensure file names match Registration Numbers exactly (e.g., `123456.jpg`). Select all files and upload in the "Import Photos" section. The system handles matching and compression.

### D. Billing Management
*   **Refresh Rate:** Avoid frequent page refreshes during development to save reads.
*   **Exporting:** Only export "All Logs" when strictly necessary for auditing. Prefer "Current View" or "Last 3 Months".

---

## 7. Future Roadmap
*   **SMS Integration:** Trigger SMS to parents on Non-Local checkout.
*   **Biometric Visitor Pass:** Capture visitor photos for repeated entry verification.
*   **Offline Mode:** Implement partial PWA offline support using IndexedDB (Firestore Persistence).
