# Firebase Backend & Database Migration Plan

This document outlines the complete plan for migrating the Student Outing Management System from its current `localStorage`-based architecture to a robust, scalable, and real-time backend using **Google Firebase**. This "serverless" approach eliminates the need for manual backend development and provides a professional-grade infrastructure at no cost for the project's scale.

---

## 1. Firebase Services to Be Used

We will leverage the following integrated Firebase services:

| Service                 | Purpose                                                                                                                              | Key Benefit                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Cloud Firestore**     | A real-time NoSQL database to store all student profiles, outing logs, and visitor pass records.                                     | Live data synchronization across all clients (Kiosk, Admin) without refreshes. |
| **Firebase Storage**    | A secure and scalable object storage service for hosting all student facial images.                                                  | Efficiently stores binary files (images) instead of costly base64 strings.   |
| **Firebase Authentication** | A complete user authentication system to manage secure logins for gate security personnel.                                           | Handles all aspects of user sign-in, session management, and security.       |
| **Cloud Functions**     | (Optional/Future) A serverless compute environment to run backend code in response to events, such as performing facial recognition. | Secures sensitive logic and allows for more complex, trusted operations.     |

---

## 2. Data Structure & Collections (Firestore)

Our database will be structured into three primary top-level collections.

### a. `students` Collection

This collection will store the profile of every registered student.

-   **Document ID:** Auto-generated unique ID (`student.id`).
-   **Document Fields:**
    -   `name`: (string) e.g., "JANE DOE"
    -   `rollNumber`: (string) e.g., "B20CS001" - **Should be indexed for querying.**
    -   `registrationNumber`: (string) e.g., "6222241" - **Should be indexed for querying.**
    -   `contactNumber`: (string) e.g., "9876543210"
    -   `branch`: (string) e.g., "Computer Science & Engg."
    -   `year`: (string) e.g., "III"
    -   `gender`: (string) e.g., "Female"
    -   `studentType`: (string) e.g., "Hosteller"
    -   `hostel`: (string) e.g., "Krishnaveni"
    -   `roomNumber`: (string) e.g., "F-214"
    -   `faceImageUrl`: (string) A public URL pointing to the student's image in Firebase Storage. This replaces storing the base64 string.
    -   `faceFeatures`: (array of numbers) The 128-D vector for facial recognition.
    -   `createdAt`: (timestamp) Server timestamp for when the student was registered.

### b. `outingLogs` Collection

This collection will track every student outing event.

-   **Document ID:** Auto-generated unique ID (`outingRecord.id`).
-   **Document Fields:**
    -   `studentId`: (string) The document ID of the student from the `students` collection. **Index this field.**
    -   `studentName`: (string) Denormalized for quick display in the logbook.
    -   `rollNumber`: (string) Denormalized for quick display.
    -   `outingType`: (string) "Local" or "Non-Local".
    -   `checkOutTime`: (timestamp) Firestore Timestamp object for precise, queryable time.
    -   `checkInTime`: (timestamp | null) Initially `null`. Updated on check-in. **Index this field.**
    -   `checkOutGate`: (string) e.g., "Front Gate"
    -   `checkInGate`: (string | null)
    -   `remarks`: (string, optional) Any notes added by the admin/guard.

### c. `visitorLogs` Collection

This collection will store records for every visitor pass generated.

-   **Document ID:** Auto-generated unique ID (`visitorPassRecord.id`).
-   **Document Fields:**
    -   `passNumber`: (string) e.g., "V20231027-001". **Index this field.**
    -   `date`: (timestamp) The date of the visit (for daily filtering).
    -   `inTime`: (timestamp) The exact time of entry.
    -   `outTime`: (timestamp | null) The exact time of departure. **Index this field.**
    -   `name`: (string) Visitor's name.
    -   `mobileNumber`: (string) Visitor's contact number.
    -   `address`: (string)
    -   `vehicleNumber`: (string, optional)
    -   `whomToMeet`: (string) Name of the person being visited.
    -   `placeToVisit`: (string) e.g., "Godavari Hostel", "Admin Building"
    -   `purpose`: (string)
    -   `gateName`: (string) Entry gate name.
    -   `outGateName`: (string | null) Exit gate name.

---

## 3. File Structure (Firebase Storage)

All student images will be stored in a single, organized folder.

-   **Bucket:** Default Firebase Storage bucket.
-   **Folder Path:** `/student_photos/`
-   **File Naming Convention:** `{registrationNumber}.jpg` (e.g., `6222241.jpg`). This provides a simple, predictable path to retrieve or update a student's photo.

---

## 4. Authentication & Security

### a. User Management (Firebase Authentication)

-   We will create user accounts using the **Email/Password** provider.
-   **Example Users:**
    -   `frontgate@nitanp.ac.in` (Password: `securepassword123`)
    -   `backgate@nitanp.ac.in` (Password: `securepassword123`)
-   The client-side login form will be updated to use the `signInWithEmailAndPassword` Firebase SDK method.

### b. Security Rules

These are critical for protecting the data. They will be configured in the Firebase console.

-   **Firestore Rules (`firestore.rules`):**
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Allow read/write access to all collections only if the user is authenticated.
        match /{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }
    ```
-   **Storage Rules (`storage.rules`):**
    ```
    rules_version = '2';
    service firebase.storage {
      match /b/{bucket}/o {
        // Allow read/write access to the student_photos folder only for authenticated users.
        match /student_photos/{fileName} {
          allow read, write: if request.auth != null;
        }
      }
    }
    ```

---

## 5. Step-by-Step Migration & Implementation Plan

1.  **Firebase Project Setup:**
    -   Create a new project on the [Firebase Console](https://console.firebase.google.com/).
    -   Enable Firestore, Firebase Storage, and Firebase Authentication.
    -   Obtain the project configuration keys to add to the React application.

2.  **Frontend Integration:**
    -   Add the Firebase SDK to the project (`npm install firebase`).
    -   Initialize Firebase in `App.tsx` or a dedicated `firebase.ts` config file.

3.  **Refactor Authentication:**
    -   Update `Login.tsx` to use `signInWithEmailAndPassword` instead of the hardcoded logic.
    -   On successful login, store the user object from Firebase in the app's state.
    -   Implement a `onAuthStateChanged` listener in `App.tsx` to manage session persistence.

4.  **Refactor Data Layer (from `localStorage` to Firebase):**
    -   The `AppContext` will be the central point of interaction with Firebase.
    -   Replace `useLocalStorage` hooks. The context will now fetch initial data using `getDocs` and listen for real-time updates using `onSnapshot` from the Firestore collections.
    -   All `setStudents`, `setOutingLogs`, and `setVisitorLogs` calls will be replaced with Firestore SDK methods (`addDoc`, `updateDoc`, `deleteDoc`).

5.  **Update Core Components:**
    -   **`RegisterStudent.tsx`:**
        -   On form submission, upload the `faceImage` to Firebase Storage at the path `/student_photos/{registrationNumber}.jpg`.
        -   After a successful upload, get the `downloadURL` of the image.
        -   Create a new document in the `students` collection in Firestore, saving the `downloadURL` in the `faceImageUrl` field along with all other student data.
    -   **`OutingKiosk.tsx` & `Logbook.tsx`:**
        -   Queries to check for active outings will use Firestore's `where()` clause (e.g., `where("studentId", "==", student.id)`, `where("checkInTime", "==", null)`).
        -   Check-in/check-out operations will be `addDoc` or `updateDoc` calls.
    -   **`AllStudents.tsx`:**
        -   The student list will be populated by a real-time listener on the `students` collection.
        -   Editing a student will involve updating a Firestore document and, if the photo is changed, replacing the image in Storage.
        -   Deleting a student will delete their Firestore document and their corresponding image from Storage.

This migration transforms the application from a single-user, browser-based tool into a secure, multi-user, real-time system ready for production use.
