# Student Outing Management System - Project Documentation

**Institute:** National Institute of Technology, Andhra Pradesh  
**Platform:** Web Application (React/TypeScript)

## 1. Executive Summary

The **Student Outing Management System** is a comprehensive digital solution designed to modernize campus security and student movement tracking. It replaces traditional paper logbooks with a biometric-enabled, automated system that tracks student outings (Local/Non-Local) and visitor entries in real-time.

The system features **Facial Recognition** for rapid identification, a robust **Dashboard** for analytics, and a secure **Logbook** for auditing.

---

## 2. Core Features

### A. Dashboard & Analytics
*   **Real-time Stats:** Displays count of Total Students, Currently Out, Overdue, and On-Campus.
*   **Visual Analytics:** Doughnut charts showing demographics of students currently out (by Year and Hostel).
*   **Daily Activity:** Trackers for Local Outings, Non-Local Outings, and Visitor counts for the current day.
*   **Report Generation:**
    *   Generates a professional PDF report (NIT Andhra Pradesh letterhead).
    *   Includes Executive Summary, Demographics Tables, Overdue Analysis, and a Detailed Overdue List.
    *   Report generation runs in the background without disrupting the UI.

### B. Facial Recognition Kiosk
*   **Contactless Entry/Exit:** Students interact with a self-service kiosk.
*   **AI-Powered Identity:** Uses `face-api.js` (TensorFlow.js) to match live camera feed against the registered database.
*   **Workflow:**
    1.  Select Outing Type (Local/Non-Local).
    2.  Scan Face.
    3.  System auto-detects `Check-Out` (if on campus) or `Check-In` (if out).
*   **Fallback:** Retry logic allows up to 3 attempts before suggesting manual entry.

### C. Student Database & Registration
*   **Registration:** Supports single student entry or Bulk Import via Excel.
*   **Photo Import:** Bulk import of student photos mapped by Registration Number.
*   **Biometrics:** Captures facial embeddings (128-point vector) during registration.
*   **Management:** 
    *   Search/Filter by Year, Branch, Gender, Hostel.
    *   Edit student details (Update photo/info).
    *   **Bulk Delete:** Select multiple students to delete (Protected by PIN).

### D. Digital Logbook
*   **Live Tracking:** View all active and completed outings.
*   **Overdue Logic:**
    *   *Local Outing:* Overdue if not back by 9:00 PM same day.
    *   *Non-Local Outing:* Overdue after 72 hours.
    *   Visual indicators (Red/Yellow/Green status).
*   **Manual Actions:** Security guards can manually Check-In/Check-Out students if biometrics fail.
*   **Remarks:** Add/Edit remarks for specific logs (Protected by PIN).
*   **Bulk Operations:** Export logs to Excel and Bulk Delete old logs (Protected by PIN).

### E. Visitor Gate Pass Management
*   **Pass Generation:** Digital form to record visitor details, purpose, and person to meet.
*   **Printable Pass:** Generates a formatted Gate Pass Receipt for printing.
*   **Tracking:** Logs entry time and marks exit time upon departure.
*   **Security:** Deleting a visitor log requires PIN verification.

---

## 3. Workflows

### Security & Permissions
*   **Login:** Gate-specific login (Front Gate / Back Gate).
*   **PIN Protection:** Critical actions (Deleting logs, Bulk deletions, Editing remarks) require the security PIN: `200405`.

### Student Outing Flow
1.  Student approaches Kiosk.
2.  Selects "Local" or "Non-Local".
3.  Looks at Camera -> Face Verified.
4.  **System Action:** Creates 'Check-Out' record with timestamp.
5.  Student returns -> Scans Face -> **System Action:** Updates record with 'Check-In' timestamp.

### Report Generation Flow
1.  Administrator clicks "Generate Report" on Dashboard.
2.  System aggregates data (Demographics, Overdue lists).
3.  Renders a hidden, high-resolution view of the report.
4.  Converts view to PDF using `html2canvas` and `jspdf`.
5.  Downloads `Outing_Report_YYYY-MM-DD.pdf`.

---

## 4. Technical Stack

*   **Frontend Framework:** React 19 (Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **State Management:** React Context API
*   **Persistence:** Browser LocalStorage (No backend server required for this version).
*   **Key Libraries:**
    *   `face-api.js`: Client-side facial recognition.
    *   `xlsx`: Excel file import/export.
    *   `jspdf` & `html2canvas`: PDF Report generation.
    *   `chart.js` & `react-chartjs-2`: Data visualization.

## 5. Deployment & Usage
*   The application is designed to run in a modern web browser (Chrome/Edge/Firefox).
*   **Permissions:** Requires Camera permission for Registration and Kiosk features.
*   **Offline Capable:** Once loaded, the core logic functions without internet (except for loading CDN scripts initially).

---

## 6. Future Roadmap (Potential Enhancements)
*   **Backend Migration:** Move from LocalStorage to Firebase/Supabase for multi-gate real-time synchronization.
*   **SMS Alerts:** Integrate Twilio/Fast2SMS to send text alerts to parents for overdue students.
*   **Barcode Integration:** Enable barcode scanning for student ID cards as a fallback to facial recognition.
