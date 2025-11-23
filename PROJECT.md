# Student Outing Management System - Comprehensive Project Documentation

**Institute:** National Institute of Technology, Andhra Pradesh
**Platform:** Web Application (React 19 + TypeScript + Firebase)
**Version:** 2.1 (Cloud-Connected & Production Ready)

---

## 1. Project Overview

The **Student Outing Management System** is a mission-critical security application designed to digitize and automate the tracking of student movements (Outing) and visitor entries at campus gates. It replaces manual paper logbooks with a cloud-synchronized, biometric-enabled platform.

The system ensures real-time data consistency across multiple gates (Front Gate, Back Gate) and the Administration office using **Google Firebase**. It features client-side facial recognition for students and a rapid pass generation system for visitors with thermal printing support.

---

## 2. Technical Architecture

### Core Stack
*   **Frontend Framework:** React 18+ (built with Vite).
*   **Language:** TypeScript (Strict typing for robust logic).
*   **Styling:** Tailwind CSS (Utility-first, responsive design).
*   **State Management:** React Context API (`AppContext`) + Firebase Real-time Listeners.
*   **Backend:** Firebase (Serverless).

### Backend Services (Firebase)
*   **Authentication:** Firebase Auth (Email/Password) for role-based access.
*   **Database:** Cloud Firestore (NoSQL, Real-time synchronization).
*   **Storage:** Firebase Storage (Hosting student biometric images).

### Critical Libraries
*   **Biometrics:** `face-api.js` (TensorFlow.js based client-side face detection and recognition).
*   **Reporting:** `html2canvas` + `jspdf` (High-fidelity PDF generation).
*   **Data Handling:** `xlsx` (SheetJS) for Excel import/export.
*   **Visualization:** `chart.js` for analytics.

---

## 3. Authentication & Security

### 3.1. User Roles & Access
The system differentiates between two primary roles determined by the login email:
1.  **Admin (`admin`):**
    *   Email: `admin.som@nitandhra.ac.in`
    *   Access: Full system access, Student Registration, Database Management, Bulk Deletion, Edit Remarks.
2.  **Security (`security`):**
    *   Emails: `frontgate...`, `backgate...`
    *   Access: Operational access to Kiosk, Logbooks, and Visitor Pass generation.
    *   Restrictions: Cannot delete logs or modify student data without PIN authorization.

### 3.2. Automatic Gate Assignment
*   Login logic automatically parses the email address to determine the "Gate Name" (e.g., `frontgate` -> "Front Gate").
*   This Gate Name is tagged on every record created (Check-Out Gate, Check-In Gate, Visitor Entry Gate).
*   **Session Tracking:** Records the `Last Login` timestamp in Firestore for audit purposes.

### 3.3. PIN Protection Strategy
Critical destructive or sensitive actions are protected by a hardcoded security PIN.
*   **PIN Code:** `200405`
*   **Protected Actions:**
    *   Deleting a Student record (Single or Bulk).
    *   Deleting an Outing Log (Single or Bulk).
    *   Deleting a Visitor Log (Single or Bulk).
    *   Editing historical Remarks in the Logbook.

---

## 4. Module: Dashboard

The command center for administrators, providing a high-level view of campus activity.

### 4.1. Real-Time Statistics (Cards)
*   **Total Students:** Count of all registered profiles.
*   **Currently Out:** Live count of students who have checked out but not checked in.
*   **On Campus:** Calculated as `Total - Out`.
*   **Local Outings Today:** Count of 'Local' type outings initiated today.
*   **Non-Local Outings Today:** Count of 'Non-Local' type outings initiated today.
*   **Visitors Today:** Count of visitor passes issued today.
*   *Interaction:* Clicking "Currently Out" opens a modal listing those specific students.

### 4.2. Analytics Charts
*   **Demographics by Year:** Doughnut chart showing the distribution of students currently out by their academic year (I, II, III, IV).
*   **Demographics by Hostel:** Doughnut chart showing which hostels have the most students out.

### 4.3. PDF Report Generation (Hidden Render)
*   **Function:** Generates a formal status report on NIT Andhra Pradesh letterhead.
*   **Technical Implementation:**
    *   Renders a dedicated HTML template strictly off-screen (`left: -10000px`).
    *   Uses **explicit inline styles** (pixels/mm) instead of CSS classes to ensure `html2canvas` captures the layout perfectly without text shifting.
    *   Captures at 2x scale for high DPI clarity.
    *   Generates an **A4 size PDF** with no margins.
*   **Content:**
    1.  **Executive Summary:** Key metrics grid.
    2.  **Demographics:** Tables breakdown by Year and Hostel.
    3.  **Overdue Analysis:** Summary tables + A detailed list of the first 10 overdue students.
    4.  **Hostel Occupancy:** Detailed table showing Total Registered, Currently Out, and Currently Present for every hostel.

---

## 5. Module: Student Registration (Admin Only)

### 5.1. Single Student Registration
*   **Fields:** Name, Roll No, Registration No, Branch, Year, Gender, Student Type (Hosteller/Day-Scholar), Hostel/Room, Contact.
*   **Input Normalization:** All text inputs are forced to **UPPERCASE**.
*   **Biometrics:**
    *   **Capture:** Live camera feed or file upload.
    *   **Processing:** Extracts a 128-float vector (Face Descriptor) using `face-api.js`.
    *   **Validation:** Prevents registration if no face is detected.
    *   **Storage:** Uploads image to Firebase Storage; saves URL and Vector to Firestore.

### 5.2. Bulk Operations
*   **Excel Import:** Parses `.xlsx` files to batch create student records.
    *   Checks for duplicate Registration Numbers before insertion.
    *   Mandatory Columns: `name`, `registrationNumber`.
*   **Photo Import:** Allows uploading a folder of images.
    *   **Mapping Logic:** Matches images to students based on filename (e.g., `6222241.jpg` maps to Reg No `6222241`).
    *   **Process:** Automatically detects faces, extracts embeddings, uploads to Storage, and updates the student record in Firestore.

---

## 6. Module: Kiosk (Facial Recognition)

A touch-free interface for students to check themselves in or out.

### 6.1. Workflow
1.  **Selection:** Student selects "Local Outing" or "Non-Local Outing".
2.  **Scan:** Camera activates.
3.  **Identification:**
    *   Captures frame and extracts face descriptor.
    *   Calculates Euclidean distance against *all* registered student descriptors.
    *   **Threshold:** Matches if distance < `0.5`.
4.  **Logic:**
    *   **Check-Out:** If student has no active log -> Creates new `Check-Out` record.
    *   **Check-In:** If student has an active log matching the type -> Updates it with `Check-In` time.
    *   **Block:** Cannot check out if already marked as "Out".
5.  **Feedback:**
    *   Success: Green alert with Name/Roll No.
    *   Failure: Retry prompt (Max 3 attempts).

---

## 7. Module: Outing Logbook

The central ledger for monitoring student movements.

### 7.1. Data Presentation
*   **Sortable Table:** Sort by Name, Year, Time, Gate, etc.
*   **Date Formatting:** Strict `en-IN` locale (`DD/MM/YYYY, HH:MM:SS`).
*   **Filtering:** Active (Out), Completed (In), Overdue.
*   **Search:** Global text search across all columns.

### 7.2. Status & Overdue Logic
*   **Overdue Rules:**
    *   **Local Outing:** Overdue if not back by **9:00 PM** on the same day.
    *   **Non-Local Outing:** Overdue if time exceeding **72 hours**.
*   **Indicators:**
    *   Yellow: Active (Out).
    *   Green: Completed (Returned).
    *   Red: Overdue.

### 7.3. Manual Operations
*   **Manual Entry:** Sidebar for guards to search students by name/roll and manually toggle Check-In/Check-Out (used if biometrics fail).
*   **Status Revert:** Ability to "Revert" a Check-In (if clicked by mistake) or Force Check-In.
*   **Resolve Overdue:** Adds a system remark confirming security acknowledgement.

### 7.4. Bulk Maintenance (Admin Only)
*   **Bulk Delete:**
    *   **Ranges:** Older than 3 months, 6 months, 1 year, or All.
    *   **Safeguard:** **Mandatory Excel Export** before the "Delete" button becomes active.
    *   **Security:** Requires PIN Verification (`200405`).
    *   **Action:** Batch deletes documents from Firestore.

---

## 8. Module: Student Database (All Students)

### 8.1. Management
*   **Table View:** Lists all students with biometric status indicators.
*   **Filters:** Year, Branch, Gender, "Missing Photo", "Incomplete Data".
*   **Editing:** Modal to update text details or retake/upload new photo. Updates re-calculate face descriptors automatically.

### 8.2. Deletion
*   **Single:** Via action menu (Requires PIN).
*   **Bulk:**
    *   Select multiple students via checkboxes.
    *   Click "Delete Selected".
    *   Requires PIN Verification.
    *   *Cascade:* Deletes Firestore document AND Storage image.

---

## 9. Module: Visitor Gate Pass

A complete visitor management suite tailored for both thermal and standard printing.

### 9.1. Pass Generation
*   **Form:** Captures Name, Relation, Phone, Address, Vehicle No, Whom to Meet, Place, Purpose.
*   **Pass Number:** Auto-generated format: `V[YYYYMMDD]-[Sequence]` (e.g., `V20231027-005`).

### 9.2. Preview & Printing
*   **Preview Logic:** Displays the **live form data** immediately upon submission, bypassing database latency to ensure the preview is always correct.
*   **Thermal Print (Receipt):** Optimized CSS for **80mm** width paper.
    *   Monospace font (`Courier New`).
    *   Zero margins.
    *   Concise layout for speed.
*   **Standard Print:** A5/Letter size layout with header/footer for formal use.

### 9.3. Tracking & Exit
*   **Logbook:** Tracks Entry Time (Gate Name) and Exit Time (Out Gate Name).
*   **Mark Exit:** One-click "Out" button stamps the current time and gate.
*   **Bulk Delete:** Follows the strict **Range -> Export -> PIN** workflow.
*   **Single Delete:** Admin-only, PIN protected.

---

## 10. Data Standards & Localization

*   **Date Format:** All dates displayed in `DD/MM/YYYY` (en-IN).
*   **Time Format:** `12-hour` format with AM/PM.
*   **Input Handling:**
    *   Text fields auto-capitalize.
    *   Phone numbers allow numeric input only.
*   **Responsiveness:**
    *   Dashboard and Logbooks adapt to Tablet/Desktop.
    *   Kiosk is fully responsive.
    *   Modals handle small screens via scrollable containers.

---

## 11. Deployment

*   **Hosting:** Static hosting (Vercel/Netlify/Firebase Hosting).
*   **Environment:** Requires **HTTPS** context for Camera access.
*   **Browser:** Optimized for Chrome/Edge (latest versions).
