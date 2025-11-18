# Firebase Backend Architecture Documentation

This document provides a comprehensive technical overview of the Google Firebase backend architecture for the **Student Outing Management System**. 

The transition from local storage to this cloud architecture is what enables **Multiple Kiosks** (e.g., separate lanes for Boys/Girls) to operate simultaneously while sharing a single, synchronized source of truth.

---

## 1. Architecture Overview

The application utilizes a "Serverless" model. The frontend (React) communicates directly with Firebase services.

| Service | Functionality | Role in Multi-Kiosk Setup |
| :--- | :--- | :--- |
| **Cloud Firestore** | NoSQL Real-time Database | Acts as the "Central Brain." When Kiosk A updates a record, Kiosk B sees it efficiently. Handles concurrent read/writes from multiple gates. |
| **Firebase Storage** | Blob/File Storage | Stores high-resolution student face images. Eliminates the browser storage limits allowing for thousands of high-quality face registrations. |
| **Firebase Auth** | Authentication | Secures the kiosks. Ensures only authorized security personnel can access the system. |

---

## 2. Cloud Firestore: Database Schema

The database is divided into three primary collections.

### A. `students` Collection
*Master record of all registered students.*

*   **Document ID:** UUID (e.g., `9b1deb4d-3b7d-4bad...`)
*   **Fields:**
    *   `name` (string): Full name (uppercase).
    *   `rollNumber` (string): Unique university roll number. **(Indexed)**
    *   `registrationNumber` (string): Unique registration ID. **(Indexed)**
    *   `branch` (string): e.g., "Computer Science".
    *   `year` (string): e.g., "IV".
    *   `gender` (string): "Male" or "Female".
    *   `studentType` (string): "Hosteller" or "Day-Scholar".
    *   `hostel` (string | null): Hostel name.
    *   `roomNumber` (string | null): Room identifier.
    *   `contactNumber` (string): Phone number.
    *   `faceImageUrl` (string): HTTP URL pointing to the image in Firebase Storage.
    *   `faceFeatures` (array<number>): The 128-dimensional vector embedding for facial recognition.
    *   `createdAt` (timestamp): Registration date.

### B. `outingLogs` Collection
*Transactional record of every movement. Designed for high-speed writes from multiple kiosks.*

*   **Document ID:** UUID
*   **Fields:**
    *   `studentId` (string): Reference to `students` document ID. **(Indexed)**
    *   `studentName` (string): Denormalized for faster logbook rendering.
    *   `rollNumber` (string): Denormalized for search.
    *   `year` (string): Denormalized for filtering.
    *   `gender` (string): Denormalized for filtering.
    *   `studentType` (string): Denormalized for filtering.
    *   `outingType` (string): "Local" or "Non-Local".
    *   `checkOutTime` (timestamp): Time of departure. **(Indexed for time-range queries)**
    *   `checkOutGate` (string): e.g., "Front Gate - Lane 1".
    *   `checkInTime` (timestamp | null): Time of return. If `null`, student is "OUT".
    *   `checkInGate` (string | null): e.g., "Back Gate".
    *   `remarks` (string | null): Notes or manual override comments.
    *   `overdueResolved` (boolean): Flag if an overdue entry was manually cleared.

### C. `visitorLogs` Collection
*Records for non-student guests.*

*   **Document ID:** UUID
*   **Fields:**
    *   `passNumber` (string): e.g., "V20231027-001".
    *   `name` (string): Visitor name.
    *   `mobileNumber` (string): Visitor contact.
    *   `whomToMeet` (string): Student or Faculty name.
    *   `purpose` (string): Reason for visit.
    *   `inTime` (timestamp): Entry time.
    *   `outTime` (timestamp | null): Exit time.
    *   `gateName` (string): Entry Gate.
    *   `outGateName` (string | null): Exit Gate.

---

## 3. Cloud Storage Structure

To keep the database fast, actual image files are stored here, and only the link is stored in the database.

*   **Bucket:** Default Firebase Bucket
*   **Path:** `/student-faces/{registrationNumber}.jpg`
*   **Access Control:** Images are readable only by authenticated users (Kiosks/Admin).

---

## 4. Security Rules (Firestore & Storage)

To ensure data privacy and system integrity, the following rules are applied:

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents only if the user is logged in
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

```javascript
// Storage Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Allow access to images only if the user is logged in
      allow read, write: if request.auth != null;
    }
  }
}
```

## 5. Implementation Guide for Multiple Kiosks

To deploy multiple kiosks (e.g., Lane 1 & Lane 2) using this architecture:

1.  **Deployment:** Host the React application (e.g., via Firebase Hosting, Vercel, or Netlify).
2.  **Hardware:** Set up separate devices for each lane.
3.  **Access:** Log in to both devices using the gate credentials.
4.  **Operation:**
    *   **Device A (Boys Lane)** scans a student. The app uploads the log to the `outingLogs` collection in Firestore.
    *   **Device B (Girls Lane)** queries the *same* `outingLogs` collection.
    *   **Result:** If a student checks out at Device A, Device B instantly knows they are "OUT" preventing double check-outs or data mismatch.
