# Student Outing Management System - Master Documentation

**Institute:** National Institute of Technology, Andhra Pradesh  
**Platform:** Web Application (React 19 + TypeScript + Firebase)  
**Version:** 3.0 (Cloud-Native & Cost-Optimized)  
**Architecture:** Serverless / Single Page Application (SPA)

---

## 1. Executive Summary

The **Student Outing Management System (SOMS)** is a cloud-native security platform designed to digitize, secure, and automate the movement of students and visitors at campus gates. 

Moving beyond simple logging, SOMS utilizes **Facial Recognition** for contactless student authentication, **Real-Time Cloud Synchronization** to link multiple gates (Front/Back) instantly, and **Intelligent Data Fetching** to minimize cloud costs while maintaining historical access.

---

## 2. Technical Stack

### Frontend
*   **Framework:** React 19 (Built with Vite)
*   **Language:** TypeScript 5.0+ (Strict type safety)
*   **Styling:** Tailwind CSS (Utility-first, responsive)
*   **State Management:** React Context API + Firebase Real-time Listeners

### Backend (Google Firebase)
*   **Authentication:** Firebase Auth (Email/Password with Custom Claims)
*   **Database:** Cloud Firestore (NoSQL, Real-time)
*   **Storage:** Firebase Storage (Object storage for biometric images)

### Specialized Libraries
*   **Biometrics:** `face-api.js` (TensorFlow.js based face detection/embedding)
*   **Reporting:** `jspdf` + `html2canvas` (Vector-quality PDF generation)
*   **Data Processing:** `xlsx` (SheetJS for Excel Import/Export)
*   **Visualization:** `chart.js` (Demographic analytics)

---

## 3. Database Architecture & Optimization Strategies

The system is architected specifically to balance **Real-Time Performance** with **Cost Efficiency** (minimizing Firestore Read/Write operations).

### 3.1. Firestore Collections
1.  **`students`**: Master records. Contains profile data, photo URLs, and 128-D face embeddings.
2.  **`outingLogs`**: Transactional records of student movements.
3.  **`visitorLogs`**: Transactional records of visitor entries.
4.  **`users`**: Audit trail of system logins (Gate/Admin).

### 3.2. "Smart Sync" Strategy (Cost Optimization)
To avoid downloading the entire history (which costs thousands of reads) every time the app loads, SOMS uses a hybrid listening strategy:

1.  **Initial Load / Refresh:**
    *   **Students:** Downloads all active students (Necessary for face recognition).
    *   **Outing Logs:** Listeners explicitly fetch **only** logs from the **last 7 days** AND any **currently active** outings (where `checkInTime == null`), regardless of age.
    *   **Visitor Logs:** Listeners fetch only logs from the **last 7 days**.
    
    *Result:* Instead of reading 50,000 historical logs on startup, the app reads only ~200 relevant logs, reducing costs by 99%.

2.  **Real-Time Updates (`onSnapshot`):**
    *   Once loaded, the app only pays for *changes*. If a student checks out, only **1 document read** is charged to all connected clients.

3.  **Archive Mode (On-Demand History):**
    *   Historical data (older than 7 days) is **not** loaded by default.
    *   Admins use "Archive Search" to request specific date ranges. These are "One-time Fetch" operations, meaning you only pay for the specific historical rows you view.

---

## 4. Authentication & Security Model

### 4.1. Role-Based Access Control (RBAC)
User roles are enforced via Email domain matching and Custom Claims.

| Role | Email Identity | Permissions |
| :--- | :--- | :--- |
| **Admin** | `admin.som@...` | Full Access: Manage Students, Bulk Delete, Edit Remarks, View All Data. |
| **Security** | `frontgate@...` / `backgate@...` | Operational Access: Kiosk, Logbook (Read/Write), Visitor Pass. **No Delete Permissions.** |

### 4.2. PIN Security Protocol
Destructive actions are protected by a hardcoded security PIN (`200405`) to prevent accidental data loss or unauthorized deletion by logged-in staff.
*   **Protected Actions:** Bulk Deletion, Single Record Deletion, Editing Historical Remarks.

---

## 5. Core Modules & Workflows

### 5.1. Dashboard
The command center providing a high-level overview.
*   **Live Metrics:** Real-time counters for "Currently Out", "Total Overdue", and "On Campus".
*   **Visual Analytics:** Doughnut charts breaking down outings by **Year** and **Hostel**.
*   **PDF Reporting:** Generates a formal, vector-quality PDF report on NIT Andhra Pradesh letterhead, including:
    *   Executive Summary.
    *   Hostel Occupancy Tables (Total Registered vs. Currently Out).
    *   Detailed Overdue List.

### 5.2. Student Registration (Biometrics)
*   **Inputs:** Supports manual entry or **Bulk Excel Import**.
*   **Photo Handling:**
    *   **Capture:** Webcam or File Upload.
    *   **Bulk Import:** Upload a folder of images named by Registration Number (e.g., `6222241.jpg`). The system automatically maps them to student records.
    *   **Processing:** `face-api.js` analyzes the image client-side to ensure a face is present and extracts the 128-D biometric descriptor before upload.

### 5.3. Smart Kiosk (Face Recognition)
A touch-free terminal for student check-in/out.
*   **Workflow:**
    1.  Student selects "Local" or "Non-Local".
    2.  Camera scans face.
    3.  System matches face vector against local student database (Euclidean distance < 0.5).
*   **Intelligent Logic (The "Blind Spot" Fix):**
    *   **Step 1 (Fast):** Checks local memory (recent 7 days) for an active outing.
    *   **Step 2 (Deep):** If not found locally, it performs a **targeted Firestore query** to check if the student has an active outing older than 7 days.
    *   **Result:** Prevents "Double Check-Outs" even if the previous record is old and not currently visible in the UI.

### 5.4. Outing Logbook
The central ledger.
*   **Views:**
    *   **Live View:** Shows last 7 days + All Active Outings.
    *   **Archive View:** Allows searching historical data by date range.
*   **Status Indicators:**
    *   **Yellow (Out):** Student is currently away.
    *   **Green (Completed):** Student has returned.
    *   **Red (Overdue):** 
        *   *Local:* Not back by 9:00 PM same day.
        *   *Non-Local:* Out for > 72 hours.
*   **Exports:**
    *   **Context-Aware Export:** 
        *   "Current View" (Free/Memory).
        *   "3 Months" / "1 Year" / "All Time" (Triggers DB Fetch).

### 5.5. Visitor Management (Gate Pass)
*   **Pass Generation:** Captures visitor details, vehicle no., and purpose.
*   **Printing:**
    *   **Thermal Mode (80mm):** Optimized receipt layout with Institute Logo, perfectly formatted for POS printers.
    *   **Standard Mode (A5):** Formal layout for standard printers.
*   **Tracking:** Logs entry/exit times and gates.

---

## 6. Operational Workflows (How-To)

### Bulk Deleting Old Data
1.  Navigate to **Logbook** or **Visitor Pass**.
2.  Click **Bulk Delete** (Admin only).
3.  Select Range (e.g., "Older than 3 months").
4.  **Mandatory Step:** You must click **Export** to save a backup Excel file.
5.  Click **Proceed to Delete** and enter PIN (`200405`).
6.  *System deletes records in batches to handle large datasets.*

### Handling "Blind Spot" Check-Ins
*   **Scenario:** A student left 10 days ago (record is archived) and returns today.
*   **Action:**
    1.  Student scans face at Kiosk.
    2.  Kiosk checks local data -> *Not found*.
    3.  Kiosk queries DB for `studentId + status:OUT`.
    4.  **Found!** System updates the old record with today's Check-In time.
    5.  The record immediately appears in the Logbook (because it was modified).

### Manual Corrections
*   If biometric fails or power was out:
    1.  Guard goes to Logbook -> **Manual Entry**.
    2.  Search Student by Name/Roll.
    3.  Click "Check Out" or "Check In".
    4.  System adds a special remark: *"Manual Check-In by Front Gate on [Date]"*.

---

## 7. Deployment & Environment

*   **Hosting:** Firebase Hosting (Recommended) or Vercel.
*   **Requirements:**
    *   **HTTPS:** Mandatory for Camera/Microphone access.
    *   **Browser:** Modern Chrome/Edge/Firefox/Safari.
*   **Performance:**
    *   Initial Load: ~1.5s (Dependent on internet speed for student list download).
    *   Face Match: ~100-300ms (Client-side).
    *   Sync Latency: < 1s (Firebase Real-time).
