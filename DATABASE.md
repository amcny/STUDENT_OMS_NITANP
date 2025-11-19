# Data Architecture & Database Documentation

## 1. Architectural Overview

The **Student Outing Management System** employs a **Client-Side, Serverless Data Architecture**. Unlike traditional web applications that rely on a remote SQL or NoSQL database (like MySQL or MongoDB), this system runs entirely within the user's browser.

### Core Philosophy: "The Browser is the Database"

*   **Persistence Layer:** The application utilizes the browser's **LocalStorage API**. This is a key-value store that persists data across browser sessions (even after the tab or window is closed).
*   **State Management:** React Context (`AppContext`) acts as the "In-Memory Database." When the application loads, it hydrates this state from LocalStorage. When data changes, it synchronizes back to LocalStorage.
*   **Offline Capability:** Since there is no network dependency for database calls, the application is fully functional offline (once assets are cached).

---

## 2. Services & Libraries Used for Data Management

The following technologies facilitate data handling, transformation, and persistence:

1.  **Window.localStorage (Native API):**
    *   *Role:* The physical storage medium.
    *   *Capacity:* Typically ~5MB - 10MB per origin (domain) depending on the browser.
    *   *Format:* Stores data as serialized JSON strings.

2.  **React Context API:**
    *   *Role:* The active data manager. It distributes data (Students, Logs) to all components (Dashboard, Kiosk, Logbook) without prop drilling.

3.  **Custom Hook (`useLocalStorage`):**
    *   *Role:* The "Driver" or "ORM". It handles the reading/parsing of JSON from storage on initialization and automatically serializes/writes updates whenever the state changes.

4.  **face-api.js (TensorFlow.js):**
    *   *Role:* Data Processor. It converts raw image pixels into a **128-dimensional array (Floating Point Vector)** known as a "Face Descriptor."
    *   *Storage Impact:* This vector is stored in the `students` collection and is used for mathematical comparison (Euclidean distance) during Kiosk scanning.

5.  **SheetJS (xlsx):**
    *   *Role:* Data Migration & Backup. It allows the system to export JSON data into `.xlsx` files (Backup) and parse Excel files back into JSON (Bulk Import).

---

## 3. Data Flow Process

### A. Initialization (Read Operation)
1.  **App Launch:** The user opens the application.
2.  **Hook Trigger:** `useLocalStorage` hooks fire for `students`, `outingLogs`, and `visitorLogs`.
3.  **Fetch:** The hook calls `window.localStorage.getItem('key')`.
4.  **Parse:** The JSON string is parsed into JavaScript Objects/Arrays.
5.  **Hydrate:** The parsed data is loaded into the React State (`AppContext`).
6.  **Render:** The UI components (Dashboard, Tables) render using this in-memory data.

### B. Transaction/Update (Write Operation)
*Example: A student checks out at the Kiosk.*
1.  **Input:** Facial recognition identifies the student.
2.  **Logic:** A new `OutingRecord` object is created in memory.
3.  **State Update:** `setOutingLogs` is called to append the new record.
4.  **Re-render:** The React UI updates immediately to show the new status.
5.  **Synchronization:** The `useLocalStorage` `useEffect` detects the state change.
6.  **Serialize:** The updated array is converted to a JSON string (`JSON.stringify`).
7.  **Persist:** `window.localStorage.setItem` writes the string to the browser's disk.

---

## 4. Database Schema (Collections)

The data is organized into four primary "tables" (Keys in LocalStorage).

### Collection 1: `outing_management_students`
*   **Description:** The master registry of all students.
*   **Structure:** Array of Objects.

| Field | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID (String)` | Primary Key. Generated via `crypto.randomUUID()`. |
| `name` | `String` | Student Name (Uppercased). |
| `rollNumber` | `String` | Unique University Roll No. |
| `registrationNumber` | `String` | Unique Registration No. (Used for photo mapping). |
| `branch` | `String` | Academic Branch (e.g., CSE, ECE). |
| `year` | `String` | Academic Year (I, II, III, IV). |
| `gender` | `String` | 'Male' or 'Female'. |
| `studentType` | `String` | 'Hosteller' or 'Day-Scholar'. |
| `hostel` | `String` | Hostel Name (Nullable if Day-Scholar). |
| `roomNumber` | `String` | Room Number (Nullable if Day-Scholar). |
| `contactNumber` | `String` | Phone number. |
| `faceImage` | `Base64 String` | The visual image of the face (for UI display). **High Storage Cost.** |
| `faceFeatures` | `Array<Number>` | The calculated AI vector for face matching. |

### Collection 2: `outing_management_logs`
*   **Description:** Transactional history of student movements.
*   **Structure:** Array of Objects.
*   **Relationship:** Linked to `students` via `studentId`.

| Field | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID (String)` | Primary Key. |
| `studentId` | `UUID (String)` | Foreign Key to Student table. |
| `studentName` | `String` | *Denormalized* for performance. |
| `rollNumber` | `String` | *Denormalized* for quick search. |
| `outingType` | `Enum` | 'Local' or 'Non-Local'. |
| `checkOutTime` | `ISO 8601 String` | Timestamp of departure. |
| `checkOutGate` | `String` | Name of the gate used for exit. |
| `checkInTime` | `ISO 8601 String` | Timestamp of return. `null` if currently OUT. |
| `checkInGate` | `String` | Name of the gate used for entry. `null` if currently OUT. |
| `remarks` | `String` | Administrative notes or manual entry flags. |
| `overdueResolved`| `Boolean` | Flag if an overdue status was manually cleared. |

### Collection 3: `visitor_management_logs`
*   **Description:** Registry of visitor gate passes.
*   **Structure:** Array of Objects.

| Field | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID (String)` | Primary Key. |
| `passNumber` | `String` | Generated ID (Format: V[YYYYMMDD]-[SEQ]). |
| `date` | `String` | Date string (YYYY-MM-DD). |
| `name` | `String` | Visitor Name. |
| `relation` | `String` | Relation to student/staff. |
| `mobileNumber` | `String` | Visitor contact. |
| `vehicleNumber` | `String` | (Optional) License plate. |
| `whomToMeet` | `String` | Name of host. |
| `placeToVisit` | `String` | Campus location. |
| `inTime` | `ISO 8601 String` | Entry Timestamp. |
| `outTime` | `ISO 8601 String` | Exit Timestamp (`null` if inside). |
| `gateName` | `String` | Entry Gate. |
| `outGateName` | `String` | Exit Gate. |

### Collection 4: `outing_management_gate`
*   **Description:** Session Persistence.
*   **Structure:** String (Primitive).
*   **Value:** Name of the currently logged-in gate (e.g., "Front Gate", "Back Gate").

---

## 5. Key Constraints & Logic

1.  **Uniqueness:**
    *   `rollNumber` and `registrationNumber` must be unique across the `students` collection. This is enforced by application logic during registration.
2.  **Active Outing Constraint:**
    *   A student cannot `Check-Out` if they already have an active log (where `checkInTime` is `null`).
    *   A student cannot `Check-In` if they do not have an active log matching the selected `OutingType`.
3.  **Overdue Logic (Computed):**
    *   Overdue status is *not* stored in the database (except for the resolved flag). It is calculated at runtime:
        *   **Local:** Overdue if `Date.now() > Today 9:00 PM`.
        *   **Non-Local:** Overdue if `Date.now() > CheckOutTime + 72 Hours`.

---

## 6. Backup & Scalability Strategy

Since LocalStorage is volatile (cleared if the user wipes browser data) and has limited size:

1.  **Export to Excel (Backup):**
    *   The system provides a feature to dump the entire `outingLogs` or `visitorLogs` array into an `.xlsx` file.
    *   **Process:** Application State -> JSON -> SheetJS -> Excel File Download.
2.  **Bulk Delete (Purge):**
    *   To free up storage space, the system allows Bulk Deletion of old logs (e.g., older than 3 months).
    *   This process enforces an "Export before Delete" rule to ensure data archiving.
3.  **Image Optimization:**
    *   Face images are the largest data consumers. In a production migration, these would be moved to a cloud storage bucket (AWS S3 / Firebase Storage), storing only the URL in the database.
