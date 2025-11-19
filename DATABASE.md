# Firebase Migration Plan & Data Architecture

## 1. Overview
This document outlines the strategic plan to migrate the **Student Outing Management System** from a standalone, browser-based LocalStorage architecture to a cloud-based **Google Firebase** infrastructure.

### Why Migrate?
1.  **Multi-Gate Synchronization:** Data will sync in real-time between "Front Gate" and "Back Gate".
2.  **Data Persistence:** Data will no longer be lost if the browser cache is cleared.
3.  **Scalability:** Moves heavy image storage out of the browser's limited memory.
4.  **Security:** Robust authentication and server-side security rules.

---

## 2. Target Architecture

### A. Firebase Services
We will utilize the following modules:
1.  **Firebase Authentication:** For secure Gate login (replacing hardcoded credentials).
2.  **Cloud Firestore (NoSQL Database):** To store student metadata, outing logs, and visitor logs.
3.  **Firebase Storage:** To store high-resolution student face images. **Critical:** Storing Base64 strings in LocalStorage/Firestore is inefficient. We will store the *File* in Storage and the *Download URL* in Firestore.

### B. Data Flow
*   **Read:** The app subscribes to Firestore collections (`onSnapshot`). Changes made at the Front Gate immediately reflect on the Back Gate's dashboard.
*   **Write:** Actions (Check-Out, Register) write to Firestore.
*   **Images:** During registration, the image is uploaded to Firebase Storage bucket `student-photos/{registrationNumber}.jpg`. The resulting URL is saved to the Student document.

---

## 3. New Database Schema (Firestore)

### Collection: `students`
*   **Document ID:** `studentId` (UUID)
*   **Fields:**
    *   `name` (string)
    *   `rollNumber` (string)
    *   `registrationNumber` (string)
    *   `branch`, `year`, `gender`, `studentType`, `hostel`, `roomNumber` (strings)
    *   `contactNumber` (string)
    *   `faceImageUrl` (string) **[CHANGED: Stores URL instead of Base64]**
    *   `faceFeatures` (array<number>) **[Kept in DB for fast matching]**
    *   `createdAt` (timestamp)

### Collection: `outingLogs`
*   **Document ID:** `logId` (UUID)
*   **Fields:**
    *   `studentId` (string)
    *   `studentName`, `rollNumber` (denormalized strings)
    *   `outingType` (string: 'Local' | 'Non-Local')
    *   `checkOutTime` (timestamp)
    *   `checkOutGate` (string)
    *   `checkInTime` (timestamp | null)
    *   `checkInGate` (string | null)
    *   `remarks` (string)
    *   `overdueResolved` (boolean)

### Collection: `visitorLogs`
*   **Document ID:** `logId` (UUID)
*   **Fields:**
    *   `passNumber` (string)
    *   `visitorName` (string)
    *   ... [Other visitor details]
    *   `inTime` (timestamp)
    *   `outTime` (timestamp | null)
    *   `gateName` (string)

---

## 4. Step-by-Step Migration Plan

### Phase 1: Project Setup & Configuration
1.  **Create Firebase Project:** Go to console.firebase.google.com and create a new project "NitAndhraOutingSystem".
2.  **Enable Services:**
    *   **Auth:** Enable "Email/Password" provider. Create users: `frontgate@nit.edu` and `backgate@nit.edu`.
    *   **Firestore:** Create database in production mode.
    *   **Storage:** Enable storage bucket.
3.  **Install SDK:** Run `npm install firebase`.
4.  **Initialize:** Create `src/firebaseConfig.ts` with API keys and export `db`, `auth`, and `storage`.

### Phase 2: Refactoring Authentication
1.  **Update `Login.tsx`:**
    *   Replace the hardcoded check with `signInWithEmailAndPassword(auth, email, password)`.
    *   Store the `user.uid` or email in a React Context to track which gate is logged in.
2.  **Update `Header.tsx`:** Implement `signOut(auth)` for the logout button.

### Phase 3: Service Layer Implementation
Create a `services/firebaseService.ts` file to abstract DB logic.
1.  **Student Service:**
    *   `addStudent(studentData, imageFile)`: Uploads image -> gets URL -> adds doc to Firestore.
    *   `getStudents()`: Uses `onSnapshot` to keep local state in sync.
    *   `updateStudent()`, `deleteStudent()`.
2.  **Log Service:**
    *   `checkOutStudent(student)`: Adds doc to `outingLogs`.
    *   `checkInStudent(logId)`: Updates doc in `outingLogs`.
    *   `getLogs()`: Real-time listener.

### Phase 4: Component Updates
1.  **`App.tsx`:** Remove `useLocalStorage`. Replace with `useEffect` hooks that subscribe to Firebase services and update the `AppContext`.
2.  **`RegisterStudent.tsx`:** Update `handleSubmit` to use the new `addStudent` service. It needs to handle the asynchronous image upload.
3.  **`Kiosk.tsx` & `Logbook.tsx`:** Replace local state manipulation with service calls (e.g., `checkOutStudent`).
4.  **`Dashboard.tsx`:** No major logic changes needed if `AppContext` is fed by Firebase data; the UI will update automatically.

### Phase 5: Data Migration (One-Time Script)
*Since we have existing data in LocalStorage, we need to migrate it.*
1.  Create a temporary button/component "Migrate Data".
2.  **Logic:**
    *   Read `localStorage.getItem('outing_management_students')`.
    *   Loop through students.
    *   Convert `faceImage` (Base64) to a Blob.
    *   Upload Blob to Firebase Storage -> Get URL.
    *   Write student object (with new URL) to Firestore.
    *   Repeat for Logs.
3.  Run this once, then clear LocalStorage.

### Phase 6: Security Rules (Firestore & Storage)
**Firestore Rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Only allow read/write if user is logged in (Gatekeeper)
      allow read, write: if request.auth != null;
    }
  }
}
```
**Storage Rules:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 5. Handling Large Biometric Data
*   **Challenge:** Face Descriptors (arrays of 128 floats) are required for matching.
*   **Solution:** We *will* store the `faceFeatures` array directly in the Firestore `students` document.
*   **Performance:** When `App.tsx` loads, it downloads all student metadata (~500KB for 1000 students). This is acceptable.
*   **Optimization:** If the student count exceeds 5,000, we will move `faceFeatures` to a separate collection and only load them into memory specifically for the Kiosk matching engine.

## 6. Offline Handling
*   Enable **Firestore Offline Persistence**:
    ```typescript
    import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";
    enableIndexedDbPersistence(db).catch((err) => { ... });
    ```
*   This ensures that if the internet cuts out at the gate, the guards can still Check-In/Check-Out. Data syncs automatically when connection is restored.
