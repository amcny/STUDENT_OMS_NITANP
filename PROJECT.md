# THESIS & PROJECT REPORT: STUDENT OUTING MANAGEMENT (SOM)

**Project Title:** Smart Student Outing Management System using Biometric Authentication  
**Institute:** National Institute of Technology, Andhra Pradesh  
**Department:** Electronics and Communication Engineering  
**Version:** 4.0 (Final Academic Release)

---

## ABSTRACT

The **Student Outing Management (SOM)** system is a comprehensive digital solution designed to modernize the campus security and hostel management infrastructure at NIT Andhra Pradesh. Traditionally, student movements (outings) are recorded in physical logbooks, which is a slow, error-prone, and insecure process. This project replaces the manual system with a **Touchless Biometric Kiosk** that uses Facial Recognition to authenticate students.

By integrating concepts of **Digital Image Processing (DIP)**, **Cloud Computing**, and **Database Management**, the SOM system captures live video, extracts unique facial feature vectors, and matches them against a central database in real-time. The system creates a tamper-proof digital log of every student who enters or leaves the campus. It is capable of handling thousands of students, generating automatic PDF reports, and enforcing strict security protocols. This report details the design, implementation, and operational logic of the entire system.

---

## CHAPTER 1: INTRODUCTION AND PROBLEM STATEMENT

### 1.1 The Current Scenario at NIT Andhra Pradesh
Currently, in our institute, when a student wants to go out of the campus (Local outing or Non-local outing), they have to approach the security gate. The security guard manually asks for the ID card, writes down the Roll Number, Name, Out-Time, and Purpose in a large physical ledger book. When the student returns, the guard has to search through hundreds of pages to find that specific entry and mark the "In-Time".

### 1.2 The Problem Statement
This manual process creates several critical issues:
1.  **Time Consumption:** During peak hours (like evenings or weekends), long queues form at the gate because writing details takes time.
2.  **Human Error:** Guards might write the wrong roll number or time. Sometimes, students write illegible handwriting.
3.  **Proxy & Security Breaches:** A student can easily give a fake roll number or sign on behalf of a friend ("Buddy Punching"). There is no way to strictly verify identity instantly.
4.  **Lack of Data Analysis:** If the Warden wants to know "How many students are currently outside?" or "Who is late/overdue?", they cannot find out without manually counting pages in the register.
5.  **Data Synchronization:** Information recorded at the Front Gate is not available at the Back Gate. If a student goes out from the Front and comes in via the Back, the record remains incomplete.

### 1.3 The Proposed Solution (SOM)
The Student Outing Management (SOM) system is a web-based application that runs on a tablet or computer at the security gates. It uses the camera to scan the student's face. Within 1 to 2 seconds, the system identifies the student, checks if they are allowed to go out, and automatically records the timestamp in a cloud database. It connects all gates (Front, Back, Admin) to a single central server, ensuring data is always synced.

---

## CHAPTER 2: RELEVANCE TO ELECTRONICS & COMMUNICATION ENGINEERING (ECE)

Although this is a software application, the core technology is deeply rooted in **Electronics and Communication Engineering** principles. As ECE students, we deal with signals, images, and data transmission. This project applies those concepts in a practical way:

### 2.1 Digital Image Processing (DIP)
The heart of this project is **Facial Recognition**. This is a classic application of Image Processing.
*   **Image Acquisition:** The camera (CMOS sensor) converts light into digital signals (pixels).
*   **Preprocessing:** The system takes the video stream frame-by-frame. It converts the RGB image into a format suitable for analysis.
*   **Feature Extraction:** We use a Deep Convolutional Neural Network (CNN) based on the **ResNet-34** architecture. This network analyzes the geometry of the face—distance between eyes, shape of the nose, jawline, etc.—and converts the face into a mathematical representation called a **128-dimensional vector** (Embedding).
*   **Vector Matching:** To recognize a face, we calculate the **Euclidean Distance** between the live face vector and the stored vectors. This is pure signal comparison logic.

### 2.2 Communication Systems
The system operates on a **Client-Server Architecture**.
*   **The Client (Edge):** The tablet at the gate performs the heavy image processing (Face detection and Vectorization). This is "Edge Computing".
*   **The Server (Cloud):** The data (timestamps, logs, names) is transmitted over the internet using **TCP/IP protocols** and **HTTPS requests**.
*   **Latency:** The system is optimized to transmit small JSON data packets to ensure communication happens in milliseconds, even on mobile networks.

### 2.3 Sensor Technology
The project relies on camera sensors for input. In the "Future Works" section, we also discuss interfacing this software with **Solenoid Locks** and **Turnstiles** using microcontrollers (like Raspberry Pi or Arduino), which is a core embedded systems application.

---

## CHAPTER 3: SYSTEM ARCHITECTURE AND TECH STACK

The project is built using modern, industry-standard technologies to ensure it is fast, reliable, and scalable.

### 3.1 The Frontend (User Interface)
*   **React Library (TypeScript):** We used React because it allows us to build a "Single Page Application" (SPA). This means the page doesn't reload every time you click a button, making it feel very fast like a mobile app.
*   **Tailwind CSS:** Used for styling. It ensures the app looks good on mobiles, tablets, and laptops automatically (Responsive Design).

### 3.2 The Biometric Engine
*   **face-api.js:** This is a JavaScript library built on top of **TensorFlow.js**. It allows us to run Machine Learning models directly in the browser. We use the **SSD MobileNet V1** model for detecting faces (finding where the face is) and a **ResNet** model for recognizing who the person is.

### 3.3 The Backend (Database & Server)
*   **Google Firebase:** We use Firebase as our "Backend-as-a-Service". It provides:
    *   **Firestore Database:** A NoSQL cloud database where student details and logs are stored. It is "Real-time", meaning if the Front Gate adds a log, the Back Gate sees it instantly without refreshing.
    *   **Firebase Storage:** Used to store the actual image files (photos) of the students.
    *   **Firebase Authentication:** Handles the secure login for Admins and Security guards.

---

## CHAPTER 4: DETAILED FUNCTIONAL FLOW AND MECHANISM

This section explains exactly how the application works, button by button.

### 4.1 Login Screen
*   **Screen:** A simple page asking for Email and Password.
*   **Mechanism:** When the user enters credentials (e.g., `frontgate.som@nitandhra.ac.in`) and clicks **"Sign In"**, the `signInWithEmailAndPassword` function from Firebase is called.
*   **Logic:** The system checks the database. If the email matches the "Admin" ID, it unlocks the full dashboard. If it matches a "Gate" ID, it records the login time and sets the system to "Security Mode" (restricting delete options).

### 4.2 The Dashboard (Home Screen)
*   **Screen:** Shows colorful cards with numbers (Total Students, Currently Out, etc.) and charts.
*   **Mechanism:**
    *   On loading, the app creates a "Listener" (`onSnapshot`) to the database. It downloads the live list of students and outing logs.
    *   **Calculation:** The app runs a loop in the background. It counts how many logs have an `OUT` status and updates the "Currently Out" number instantly.
    *   **"Generate Report" Button:**
        *   **Action:** When clicked, it calls the `generatePdfReport` function.
        *   **Logic:** It does NOT take a screenshot. Instead, it programmatically draws a PDF file using the `jspdf` library. It draws the NIT Andhra Pradesh logo, draws the tables, fills in the rows with the latest data, highlights overdue students in red, and then forces the browser to download the file as `OUTING_REPORT_date.pdf`.

### 4.3 Registration Module (Adding Students)
This is where we add students to the database. There are three ways to do this:

#### A. Single Student Registration
*   **Fields:** Name, Roll No, Branch, Hostel, Room No, etc.
*   **"Use Camera" Button:**
    *   **Action:** Opens a popup showing the live webcam feed.
    *   **Mechanism:** It uses `navigator.mediaDevices.getUserMedia` to access the hardware camera.
    *   **Capture:** When you click "Capture", it freezes the video frame.
    *   **Analysis (Critical Step):** The system immediately runs `extractFaceFeatures` on this captured image. If no face is found, it rejects the photo. If a face is found, it calculates the 128 numbers (vector) that define that face.
*   **"Register" Button:** Saves the text details to Firestore and uploads the photo to Firebase Storage.

#### B. Bulk Import (Excel)
*   **"Import from Excel" Button:**
    *   **Action:** Allows admin to select a `.xlsx` file containing hundreds of student details.
    *   **Logic:** It uses the `SheetJS` library to read the file. It checks every row. If a Roll Number already exists in the database, it marks it as "Skipped". If it's new, it adds it.
    *   **Batching:** To prevent crashing the database, it splits the list into small chunks (batches of 450 students) and uploads them one by one.

#### C. Bulk Photo Import
*   **"Import Photos" Button:**
    *   **Action:** Admin selects 500+ photos at once (filenames must be `RollNo.jpg`).
    *   **Deep Logic:** The system loops through every photo. For each photo, it runs the heavy AI model to find the face. It extracts the facial features. It then compresses the image (to save space) and uploads it.
    *   **Re-Import:** If a student already has a photo, the system skips them. We added a special **"Overwrite"** button that appears at the end, allowing the admin to force-update photos if needed.

### 4.4 The Outing Kiosk (The Main Gate Interface)
This is the screen used by students daily.

*   **Step 1: Select Type:** The student taps "Local Outing" or "Non-Local Outing".
*   **Step 2: Check-In/Out:** The student taps "Check Out" or "Check In".
*   **Step 3: Face Scan (The Mechanism):**
    *   The camera turns on. A countdown runs (1 second).
    *   The system captures the image.
    *   **Matching Algorithm:** It compares the captured face with **every** student in the database. It calculates the similarity score.
    *   **Confidence Gap Logic (Security):** If the system finds a match (e.g., Student A), it also checks the second closest match (Student B). If the difference between them is too small (meaning they look like twins), the system rejects the scan to be safe. This prevents false identification.
*   **Step 4: Verification:**
    *   If the match is successful, a **"Beep"** sound plays (using the browser's Audio Oscillator).
    *   A green message appears: "Identity Verified: Name (Roll No)".
*   **Step 5: Database Update:**
    *   The system checks rules: "Is this student already out?". If yes, it blocks them from checking out again.
    *   If rules are passed, it creates a new entry in the `outingLogs` collection with the current timestamp and gate name.

### 4.5 The Logbook (Digital Register)
*   **Live View:** Shows a table of all movements in the last 7 days.
*   **Archive Search:**
    *   **Mechanism:** Two date pickers (Start Date, End Date). When you click "Search Logs", the system queries the database for records strictly between those dates. This allows retrieving data from months ago.
*   **Manual Entry:**
    *   If a student's face isn't scanning (e.g., injury), the guard can type the Roll Number. A dropdown appears. The guard selects the student and clicks "Manual Check-Out". The system records this with a special remark: "Manual Entry by Guard".
*   **Bulk Delete (Security Feature):**
    *   **Button:** "Bulk Delete" (Only visible to Admin).
    *   **Mechanism:** When clicked, it asks for a **Security PIN**. The correct PIN is hardcoded as `200405`.
    *   **Logic:** Before deleting, the system forces an "Export to Excel" so data is never lost. Once exported, it permanently deletes old logs from the database to save space.

### 4.6 Visitor Gate Pass
*   **Form:** Fields for Visitor Name, Mobile, Vehicle No, Whom to Meet, etc.
*   **"Generate Pass" Button:** Saves the visitor data to the database.
*   **"Print" Button:**
    *   **Action:** Opens a print preview.
    *   **Thermal Print:** We created a specific layout that is 80mm wide. This is designed for small thermal receipt printers used at shops. It prints a slip with the Pass Number and Date.
*   **"Mark Out" Button:** When the visitor leaves, the guard clicks this. It records the exit time.

---

## CHAPTER 5: CODE LOGIC AND BACKEND IMPLEMENTATION

This section explains the technical code structure written in `services/firebaseService.ts` and `facialRecognitionService.ts`.

### 5.1 Database Schema (How data is organized)
We use a **NoSQL Document** structure.

1.  **Collection: `students`**
    *   Every document represents one student.
    *   Key Field: `faceFeatures` (This is an array of 128 numbers). We store the math, not just the image, so matching is fast.
    *   Field: `rollNumber` (Used as the unique identifier).

2.  **Collection: `outingLogs`**
    *   This stores the history.
    *   Fields: `studentId`, `checkOutTime`, `checkInTime`, `checkOutGate`, `checkInGate`, `status` (IN/OUT).
    *   **Indexing:** We enabled indexing on `checkOutTime` so we can quickly sort thousands of logs by date.

### 5.2 Key Algorithms Used

#### A. Euclidean Distance (For Face Matching)
In the code `findBestMatch`, we compare the captured vector ($A$) and stored vector ($B$) using this formula:
$$ Distance = \sqrt{ \sum (A_i - B_i)^2 } $$
If the Distance is **less than 0.45**, it is a match. If it is higher, it is not a match. We chose 0.45 as a "Strict Threshold" to ensure high security.

#### B. Smart Batching (For Bulk Uploads)
Google Firestore has a limit: you cannot write more than 500 documents at once.
**The Code Logic:**
```javascript
// Simplified explanation of the code
const chunkSize = 450;
for (let i = 0; i < allStudents.length; i += chunkSize) {
    const chunk = allStudents.slice(i, i + chunkSize);
    // Upload this chunk
    await batch.commit();
}
```
This loop cuts the list of students into small groups (chunks) of 450 and uploads them one by one. This ensures the app never crashes even if you upload 2000 students.

#### C. Debouncing (For Search)
In the search bar, when you type a name, the code waits for 300 milliseconds before searching. This prevents the app from freezing while you type.

---

## CHAPTER 6: ADVANTAGES AND DISADVANTAGES

### 6.1 Advantages for NIT Andhra Pradesh
1.  **Speed:** Verification takes less than 2 seconds. A manual entry takes 30-60 seconds. This eliminates queues at the gate.
2.  **Accuracy:** The biometrics cannot be faked. No one can sign for their friend.
3.  **Real-Time Sync:** If a student leaves via the Main Gate, the Back Gate security knows immediately that the student is "OUT".
4.  **Automatic Reports:** The Warden does not need to calculate anything. One click generates a PDF showing exactly who is overdue (late).
5.  **Cost Effective:** It requires only a tablet/PC and a webcam. No expensive fingerprint sensors or RFID cards (which students often lose) are needed.

### 6.2 Disadvantages
1.  **Lighting Dependency:** Since it uses a camera, if the gate area is very dark at night, the accuracy might drop. Good lighting is required.
2.  **Internet Requirement:** The system needs an active internet connection to talk to the cloud database. If the network is down, the sync stops (though we have error handling for this).

---

## CHAPTER 7: FUTURE WORKS

To improve this project further, we propose the following upgrades:

1.  **Hardware Integration (Turnstiles):** We can connect this software to a Raspberry Pi. When the face matches, the software sends a signal to a physical turnstile gate to open automatically.
2.  **Liveness Detection:** Currently, the system matches the face. In the future, we can add "Blink Detection" to ensure someone isn't just holding up a photo of a student to fool the camera.
3.  **SMS Alerts:** We can integrate the Twilio API. When a student checks out for a "Non-Local" outing, an automatic SMS can be sent to their parents.
4.  **Offline Mode:** We can implement a local database (PWA) so that even if the internet cuts off, the gate system keeps working and syncs later when the net comes back.
5.  **ANPR for Vehicles:** For the Visitor Pass system, we can add "Automatic Number Plate Recognition" to automatically read and record car numbers entering the campus.
6.  **Mobile App for Guards:** Instead of a PC, we can compile this into a React Native mobile app so guards can do spot-checks anywhere on the campus.

---

## CHAPTER 8: CONCLUSION

The **Smart Student Outing Management (SOM)** system successfully addresses the limitations of the traditional manual logbook method used at NIT Andhra Pradesh. By leveraging the power of **React, Firebase, and Artificial Intelligence**, we have created a solution that is fast, secure, and user-friendly.

From an engineering perspective, this project demonstrates the practical application of Signal Processing (Face vectors), Communication Protocols (Client-Server), and Database structuring. It provides the administration with powerful tools to monitor student safety and enforce campus discipline efficiently. The transition from a pen-and-paper model to this digital biometric model represents a significant step towards a "Smart Campus" environment.

---
**References:**
1.  *TensorFlow.js Documentation for Face API models.*
2.  *Google Firebase Documentation (Firestore, Auth, Storage).*
3.  *He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep Residual Learning for Image Recognition.*
4.  *SheetJS (XLSX) Library Documentation.*
