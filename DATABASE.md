# PostgreSQL & pgvector Setup Guide for Beginners

This guide provides a direct, step-by-step plan to set up the database for this project.

### Step 1: Install PostgreSQL

The easiest way to get started is with a graphical installer which includes a user-friendly management tool called **pgAdmin**.

1.  **Download:** Go to the [PostgreSQL download page](https://www.postgresql.org/download/) and select your operating system (Windows, macOS, Linux).
2.  **Install:** Run the installer. **Remember the password you set for the `postgres` user** during installation. You will need it. Keep all other settings as default.
3.  **pgAdmin:** The installer will also install **pgAdmin**, which is a GUI application you will use to manage the database.

### Step 2: Create Your Database

1.  **Open pgAdmin:** Find and open the pgAdmin application.
2.  **Connect to Server:** It will ask for the password you created during installation to connect to your local PostgreSQL server.
3.  **Create Database:**
    *   In the left-hand browser panel, right-click on **Databases**.
    *   Select **Create** -> **Database...**.
    *   Enter `outing_management` as the **Database name** and click **Save**.

### Step 3: Enable Vector Extension & Create Tables

1.  **Open Query Tool:**
    *   In the left panel, find your new `outing_management` database.
    *   Right-click on it and select **Query Tool**. This opens a text editor where you can run commands.
2.  **Run Commands:** Copy the entire SQL script below, paste it into the Query Tool, and click the "Execute/Run" button (usually a lightning bolt icon).

```sql
-- Step 3.1: Enable the pgvector extension
-- This adds the special 'vector' data type for facial recognition.
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 3.2: Create the 'students' table
-- This stores student profiles. 'face_features vector(128)' is the crucial part
-- for storing the 128-dimensional facial data.
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

-- Step 3.3: Create the 'outing_logs' table
-- This table tracks every time a student checks in or out.
-- 'student_id' links back to the 'students' table.
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

-- Step 3.4: Create the 'visitor_logs' table
-- This stores records for all non-student visitors.
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

### Step 4: How Your Backend Will Use It (The Concept)

You will use a Node.js library like `pg` or `node-postgres` to connect to this database.

1.  **Connection:** Your backend code will use a "connection string" to log in to the database. It looks like this:
    `postgresql://postgres:YOUR_PASSWORD@localhost:5432/outing_management`

2.  **Registering a Student (INSERT):** When a new student is registered, your backend will run a SQL `INSERT` command to save their data, including the facial feature vector.

    *Example Concept:*
    `INSERT INTO students (id, name, ..., face_features) VALUES ($1, $2, ..., '[1.23, -0.45, ...]')`

3.  **Facial Recognition (SELECT):** This is the most important part. To find a student, your backend will search for the vector that is most similar to the one from the camera. The `<=>` operator from `pgvector` does this very fast.

    *Example Concept (Finding the closest match):*
    `SELECT *, face_features <=> '[0.98, -0.12, ...]' AS distance FROM students ORDER BY distance LIMIT 1;`

This query calculates the "distance" between the scanned face and every face in the database and gives you the closest one.