# PostgreSQL & pgvector Setup Guide for Beginners

This guide provides a direct, step-by-step plan to set up and connect a real database for this project, replacing the current local storage system.

---

### Step 1: Install PostgreSQL

The easiest way is using a graphical installer which includes **pgAdmin**, a user-friendly management tool.

1.  **Download:** Go to the [PostgreSQL download page](https://www.postgresql.org/download/) and select your operating system (Windows, macOS, Linux).
2.  **Install:** Run the installer. **Remember the password you set for the `postgres` user**—you will need it. Keep all other settings as default.
3.  **pgAdmin:** The installer also adds the **pgAdmin** application, which you'll use to see and manage your data.

---

### Step 2: Create Your Database

1.  **Open pgAdmin:** Find and open the pgAdmin app.
2.  **Connect:** It will ask for the password you created during installation.
3.  **Create Database:**
    *   In the left-hand browser panel, right-click on **Databases**.
    *   Select **Create** -> **Database...**.
    *   Enter `outing_management` as the **Database name** and click **Save**.

---

### Step 3: Create Your Tables

This step sets up the structure inside your database to hold students, outing logs, and visitor passes.

1.  **Open Query Tool:**
    *   In the left panel, find your new `outing_management` database.
    *   Right-click on it and select **Query Tool**.
2.  **Run SQL Commands:** Copy the entire block of code below, paste it into the Query Tool, and click the **"Execute/Run" button** (a lightning bolt icon).

```sql
-- Enable the pgvector extension for facial recognition
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the 'students' table to store profiles
-- 'face_features vector(128)' is the special field for facial data.
CREATE TABLE students (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    year VARCHAR(10) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    student_type VARCHAR(50) NOT NULL,
    hostel VARCHAR(100),
    room_number VARCHAR(50),
    contact_number VARCHAR(20) NOT NULL,
    face_image TEXT NOT NULL, -- Stores base64 image string
    face_features vector(128) NOT NULL -- Stores the 128-point face vector
);

-- Create the 'outing_logs' table to track student movements
CREATE TABLE outing_logs (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    year VARCHAR(10) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    student_type VARCHAR(50) NOT NULL,
    outing_type VARCHAR(50) NOT NULL,
    check_out_time TIMESTAMPTZ NOT NULL,
    check_in_time TIMESTAMPTZ,
    remarks TEXT,
    check_out_gate VARCHAR(100) NOT NULL,
    check_in_gate VARCHAR(100)
);

-- Create the 'visitor_logs' table for visitor gate passes
CREATE TABLE visitor_logs (
    id UUID PRIMARY KEY,
    pass_number VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    in_time TIMESTAMPTZ NOT NULL,
    out_time TIMESTAMPTZ,
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    vehicle_number VARCHAR(50),
    whom_to_meet VARCHAR(255) NOT NULL,
    place_to_visit VARCHAR(255) NOT NULL,
    person_to_meet_mobile VARCHAR(20),
    purpose TEXT NOT NULL,
    gate_name VARCHAR(100) NOT NULL
);
```

**Your database is now fully set up and ready.**

---

### Step 4: The Full-Stack Plan (From Local Storage to Backend)

Here is the high-level plan to connect your app to the new database.

#### **A. Create a Backend Server**

Your browser app (frontend) cannot talk directly to a database for security reasons. You need a middleman: a **backend server**.

*   **What to do:** Create a simple **Node.js** server using the **Express** framework. Since Node.js uses JavaScript, you won't need to learn a completely new language. This server will be a separate project/folder.

#### **B. Connect the Backend to PostgreSQL**

*   **What to do:** In your Node.js project, install a package called `node-postgres` (or `pg`). This library allows your Node.js code to connect to and run commands on your PostgreSQL database. You will use a "connection string" like `postgresql://postgres:YOUR_PASSWORD@localhost:5432/outing_management` to log in.

#### **C. Create API Endpoints**

Think of endpoints as specific URLs on your backend server that your frontend can call to request or send data.

*   **What to do:** In your Node.js/Express server, create these endpoints:
    *   `GET /api/students`: Fetch all students from the database.
    *   `POST /api/students`: Receive new student data from the registration form, generate the face vector, and save it all to the `students` table in the database.
    *   `GET /api/outing-logs`: Fetch all outing logs.
    *   `POST /api/kiosk/scan`: This is the key one. The frontend sends the captured face image. The backend extracts the features, runs the `pgvector` similarity search query against the database (`SELECT ... ORDER BY face_features <=> $1 LIMIT 1`), and returns the matched student.
    *   Create similar endpoints for updating logs (check-in/out) and managing visitor passes.

#### **D. Modify the Frontend App**

Finally, you will update your React components to talk to your new backend instead of local storage.

*   **What to do:**
    1.  Remove the `useLocalStorage` hook.
    2.  In `App.tsx`, instead of initializing state from local storage, use a `useEffect` hook with `fetch` to call `GET /api/students` (and logs) from your backend to load initial data.
    3.  In `RegisterStudent.tsx`, the `handleSubmit` function will no longer add a student to local state directly. Instead, it will use `fetch` to `POST` the form data and face image to your `/api/students` endpoint on the backend.
    4.  Repeat this pattern for all other components: every place that reads from or writes to local storage now needs to be changed to a `fetch` call to the appropriate backend API endpoint.
