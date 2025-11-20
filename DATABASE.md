# Firebase Cloud Architecture & Implementation Plan

## 1. Architecture Overview

This document outlines the complete plan to migrate the **Student Outing Management System** from a browser `localStorage` architecture to a scalable, real-time, and secure serverless backend using the **Google Firebase** platform. This transition is designed to support all existing UI features and workflows while enabling critical new capabilities like multi-gate data synchronization, robust data persistence, and automated background tasks.

### Core Firebase Services
1.  **Firebase Authentication:** Secure, role-based identity management for Gate Security personnel and Administrators.
2.  **Cloud Firestore:** A real-time, NoSQL database serving as the single source of truth for all student, outing, and visitor data.
3.  **Firebase Storage:** Scalable object storage for hosting high-resolution student photographs, moving them out of the browser's memory.
4.  **Cloud Functions:** Server-side logic for data automation, integrity, and securing sensitive operations.

---

## 2. Service-by-Service Breakdown

### A. Firebase Authentication
*   **Purpose:** Replaces the current hardcoded `FRONTGATE`/`BACKGATE` login with a managed, secure authentication system.
*   **Method:** Email/Password Sign-in.
*   **User Roles & Access Control:**
    *   We will leverage **Custom Claims** to assign roles and metadata to users upon creation. This allows our Security Rules and Cloud Functions to enforce permissions.
    *   **Admin Role (`role: 'admin'`)**: Can perform all actions, including managing student data and system settings.
    *   **Security Role (`role: 'security'`)**: Can perform day-to-day operations like managing outings and visitors. Their writes are associated with their assigned gate.
    *   **Gate Assignment (Custom Claim `gate: 'Front Gate'`)**: The user's assigned gate name is stored in their auth token, ensuring all actions are correctly attributed.

### B. Cloud Firestore (Database)
*   **Purpose:** The central database for all application data. It replaces `localStorage` entirely.
*   **Key Feature:** Its real-time nature is paramount. When a student checks out at the Front Gate, the app running at the Back Gate will see this status update instantly via Firestore's `onSnapshot` listeners, ensuring perfect synchronization.

### C. Firebase Storage
*   **Purpose:** Stores binary files, specifically student photos. This dramatically improves application performance by offloading large Base64 image strings from the browser's memory and `localStorage`.
*   **Workflow:**
    1.  During registration, the student's photo is uploaded directly to a Firebase Storage bucket.
    2.  Storage provides a permanent `downloadURL` for the uploaded file.
    3.  This lightweight `downloadURL` string is what gets stored in the student's Firestore document, not the image data itself.

### D. Cloud Functions (Server-Side Logic & Automation)
*   **Purpose:** Executes backend code in response to events, ensuring data integrity, automation, and security for sensitive operations.
*   **Planned Functions:**
    1.  **`onStudentUpdate` (Firestore Trigger):** When a student's document is updated (e.g., name change), this function automatically propagates those changes to the denormalized fields in all associated `outingLogs`. This keeps the logbook view consistent without expensive data lookups.
    2.  **`onStudentDelete` (Firestore Trigger):** When a student document is deleted, this function performs a cascading delete: it removes the student's photo from Firebase Storage and queries/deletes all their associated `outingLogs` and `visitorLogs` (if applicable), ensuring no orphaned data remains.
    3.  **`checkOverdueStatus` (Scheduled Cron Job):** Runs automatically every hour. It queries all outing logs with a status of "OUT" and applies the overdue logic (9 PM for Local, 72h for Non-Local). If a log is overdue, the function updates its document, setting an `isOverdue` flag to `true`. This guarantees accurate overdue flagging 24/7, independent of any client application being open.
    4.  **`verifyPinAndExecute` (Callable Function):** This is the secure gateway for all PIN-protected actions (deleting students, deleting logs, editing remarks). The client UI sends the action type and the entered PIN to this function. The function validates the PIN against a securely stored value and, if valid, executes the database operation with administrative privileges. This prevents any possibility of bypassing security on the client.

---

## 3. Firestore Data Model (Schema)

### Collection: `students`
*   **Document ID:** Auto-generated Firestore ID
*   **Purpose:** Stores the master record for every student.
*   **Fields:**
    *   `name` (string)
    *   `rollNumber` (string)
    *   `registrationNumber` (string) - **Must be unique.** An index should be created for this field.
    *   `branch` (string)
    *   `year` (string)
    *   `gender` (string)
    *   `studentType` (string)
    *   `hostel` (string, nullable)
    *   `roomNumber` (string, nullable)
    *   `contactNumber` (string)
    *   `photoUrl` (string) - Public URL from Firebase Storage.
    *   `faceFeatures` (array<number>) - 128-element facial recognition vector.
    *   `createdAt` (timestamp)
    *   `updatedAt` (timestamp)

### Collection: `outingLogs`
*   **Document ID:** Auto-generated Firestore ID
*   **Purpose:** A time-series log of all student movements. Heavily denormalized for performant querying in the Logbook view.
*   **Fields:**
    *   `studentId` (string) - *Reference to the `students` document ID.*
    *   `outingType` (string: "Local" | "Non-Local")
    *   `checkOutTime` (timestamp) - **Indexed for sorting.**
    *   `checkOutGate` (string)
    *   `checkInTime` (timestamp | null) - **Indexed for sorting.**
    *   `checkInGate` (string | null)
    *   `status` (string: "OUT" | "IN") - *Helps in quickly querying active outings.*
    *   `isOverdue` (boolean) - *Managed by the `checkOverdueStatus` Cloud Function.*
    *   `overdueResolved` (boolean)
    *   `remarks` (string, nullable)
    *   *--- Denormalized Student Data for Fast Reads ---*
    *   `studentName` (string)
    *   `rollNumber` (string)
    *   `registrationNumber` (string)
    *   `year` (string)
    *   `gender` (string)
    *   `studentType` (string)
    *   `hostel` (string, nullable)

### Collection: `visitorLogs`
*   **Document ID:** Auto-generated Firestore ID
*   **Purpose:** A time-series log of all visitor entries.
*   **Fields:**
    *   `passNumber` (string)
    *   `name` (string)
    *   `relation` (string)
    *   `mobileNumber` (string)
    *   `address` (string)
    *   `vehicleNumber` (string, nullable)
    *   `whomToMeet` (string)
    *   `placeToVisit` (string)
    *   `personToMeetMobile` (string, nullable)
    *   `purpose` (string)
    *   `inTime` (timestamp) - **Indexed for sorting.**
    *   `gateName` (string)
    *   `outTime` (timestamp | null)
    *   `outGateName` (string | null)

---

## 4. Firebase Storage Structure

A simple, flat structure is sufficient and efficient.

*   **Bucket Root:** `gs://<your-project-id>.appspot.com`
    *   `/student_photos/{registrationNumber}.jpg`
        *   *Example:* `/student_photos/6222241.jpg`
        *   Using the unique Registration Number as the filename prevents duplicates and makes it easy to locate a student's photo.

---

## 5. Security Model

Security will be enforced via **Firestore Security Rules**, which are evaluated on the server before any data operation is allowed. The default policy is to deny all access.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check for authenticated users with a specific role
    function isRole(role) {
      return request.auth != null && request.auth.token.role == role;
    }

    // Students can be read by any authenticated staff, but only modified by admins.
    match /students/{studentId} {
      allow read: if request.auth != null;
      allow write: if isRole('admin'); // create, update, delete
    }

    // Outing logs can be created/updated by security staff. Deletion is blocked.
    match /outingLogs/{logId} {
      allow read: if request.auth != null;
      allow create, update: if isRole('security') || isRole('admin');
      allow delete: if false; // Deletion is only allowed via the secure Cloud Function.
    }

    // Visitor logs follow the same pattern as outing logs.
    match /visitorLogs/{logId} {
      allow read: if request.auth != null;
      allow create, update: if isRole('security') || isRole('admin');
      allow delete: if false; // Deletion is only allowed via the secure Cloud Function.
    }
  }
}
```

---

## 6. Implementation & Data Migration Plan

### Step 1: Firebase Project Setup
1.  Create a new project in the Firebase Console.
2.  Register a new Web App and copy the configuration object.
3.  Store the configuration in a `src/firebaseConfig.ts` file.
4.  Enable **Authentication** (Email/Password), **Firestore**, and **Storage**.

### Step 2: Authentication Refactor
1.  In the Firebase Console, manually create the user accounts for gate security and admins (e.g., `frontgate@nitandhra.ac.in`).
2.  Use the Firebase Admin SDK or a script to set their custom claims (`role`, `gate`).
3.  Update `Login.tsx` to use `firebase/auth`'s `signInWithEmailAndPassword` method instead of the hardcoded logic.

### Step 3: Service Layer Implementation
1.  Create a new service layer (e.g., `services/firebaseService.ts`) that encapsulates all Firestore and Storage interactions.
2.  This service will expose functions like `getStudentsStream()`, `addStudent(data, photoFile)`, `checkOutStudent(studentId, gateName)`, `deleteLogWithPin(logId, pin)`, etc.
3.  Refactor all components (`RegisterStudent`, `Logbook`, etc.) to call these service functions instead of using the `useLocalStorage` hook. The `AppContext` will now be populated by real-time listeners from this service.

### Step 4: One-Time Data Migration
A utility script or a temporary admin page will be created to perform the one-time migration from `localStorage` to Firebase.
1.  **Read Data:** Load all students, outing logs, and visitor logs from `localStorage`.
2.  **Migrate Students:**
    *   For each student, convert their `faceImage` (Base64) into a `Blob`.
    *   Upload the `Blob` to Firebase Storage at `/student_photos/{registrationNumber}.jpg`.
    *   Get the `downloadURL`.
    *   Create a new document in the `students` collection in Firestore with the student's data and the new `photoUrl`.
3.  **Migrate Logs:**
    *   For each outing and visitor log, create a new document in the corresponding Firestore collection.
    *   Ensure all date strings from `localStorage` are converted into proper Firestore `Timestamp` objects.
4.  **Verification:** After migration, verify the data in the Firebase Console. Once confirmed, the migration code can be removed and `localStorage` can be cleared.

---

## 7. Benefits of This Architecture

1.  **Real-Time Synchronization:** All connected clients (Front Gate, Back Gate, Admin Dashboard) are always in sync.
2.  **Data Persistence & Safety:** Data is securely stored in the cloud, eliminating the risk of data loss from browser cache clearing or hardware failure.
3.  **Scalability:** The serverless architecture scales automatically to handle any number of students, logs, and concurrent users.
4.  **Performance:** The application will be faster and more responsive as it no longer needs to load and hold hundreds of megabytes of image data in the browser's memory.
5.  **Automation & Integrity:** Cloud Functions work 24/7 to maintain data consistency and perform routine tasks like overdue checks, ensuring the system is always accurate.
6.  **Enhanced Security:** Moving sensitive operations to secure Cloud Functions and enforcing access with Security Rules makes the application vastly more secure than the current client-side model.
