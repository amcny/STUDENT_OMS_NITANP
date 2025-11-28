import { db, storage } from '../firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  Timestamp,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Student, OutingRecord, VisitorPassRecord, UserProfile, OutingType } from '../types';

// --- Helper Functions for Data Conversion ---

/**
 * Converts client-side data (with ISO date strings) to a format suitable for Firestore (with Timestamps).
 * It also adds `createdAt` and `updatedAt` timestamps.
 * @param data - The object to be converted.
 */
const toFirestore = (data: any) => {
  const firestoreData: { [key: string]: any } = { ...data, updatedAt: serverTimestamp() };
  
  // Convert specific string fields to Timestamps
  ['checkOutTime', 'checkInTime', 'inTime', 'outTime', 'date', 'lastLogin'].forEach(field => {
    if (firestoreData[field] && typeof firestoreData[field] === 'string') {
      firestoreData[field] = Timestamp.fromDate(new Date(firestoreData[field]));
    }
  });

  // Add createdAt only if it's a new document (id is not present)
  if (!data.id) {
    firestoreData.createdAt = serverTimestamp();
  } else {
    delete firestoreData.id; // Don't store the ID as a field in the document
  }
  
  return firestoreData;
};

/**
 * Converts data retrieved from Firestore (with Timestamps) to the client-side format (with ISO date strings).
 * @param doc - The Firestore document snapshot.
 */
const fromFirestore = <T extends {id: string}>(doc: any): T => {
  const data = doc.data();
  const clientData: any = { id: doc.id };

  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      clientData[key] = data[key].toDate().toISOString();
    } else {
      clientData[key] = data[key];
    }
  }
  return clientData as T;
};


// --- Real-time Data Listeners ---

export const onStudentsUpdate = (callback: (students: Student[]) => void) => {
  const studentsCollection = collection(db, 'students');
  return onSnapshot(studentsCollection, snapshot => {
    const studentsList = snapshot.docs.map(doc => fromFirestore<Student>(doc));
    callback(studentsList);
  });
};

/**
 * OPTIMIZED LISTENER: Fetches two sets of data and merges them.
 * 1. All outing logs from the last 7 days for historical context.
 * 2. All currently active logs (checkInTime is null), regardless of age.
 * This ensures the logbook is performant while always showing ongoing outings.
 */
export const onOutingLogsUpdate = (callback: (logs: OutingRecord[]) => void) => {
  const logsCollection = collection(db, 'outingLogs');
  let activeLogs: OutingRecord[] = [];
  let recentLogs: OutingRecord[] = [];

  const mergeAndCallback = () => {
      const combined = new Map<string, OutingRecord>();
      // Add all logs from both lists to the map.
      // The map automatically handles duplicates (e.g., a log that is both active and recent).
      activeLogs.forEach(log => combined.set(log.id, log));
      recentLogs.forEach(log => combined.set(log.id, log));
      
      // Sort the final list by checkOutTime descending before sending to UI
      const sortedLogs = Array.from(combined.values()).sort((a, b) => 
          new Date(b.checkOutTime).getTime() - new Date(a.checkOutTime).getTime()
      );
      
      callback(sortedLogs);
  };

  // Query 1: All active logs (ongoing)
  const activeQuery = query(logsCollection, where('checkInTime', '==', null));
  const unsubscribeActive = onSnapshot(activeQuery, snapshot => {
      activeLogs = snapshot.docs.map(doc => fromFirestore<OutingRecord>(doc));
      mergeAndCallback();
  });

  // Query 2: All recent logs (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentQuery = query(
      logsCollection, 
      where('checkOutTime', '>=', Timestamp.fromDate(sevenDaysAgo))
  );
  const unsubscribeRecent = onSnapshot(recentQuery, snapshot => {
      recentLogs = snapshot.docs.map(doc => fromFirestore<OutingRecord>(doc));
      mergeAndCallback();
  });

  // Return a function that unsubscribes from both listeners
  return () => {
      unsubscribeActive();
      unsubscribeRecent();
  };
};

/**
 * Fetches historical outing logs for a specific date range.
 * Used for the "Archive Search" feature in the Logbook.
 * @param startDate Start date of the range (inclusive)
 * @param endDate End date of the range (inclusive)
 */
export const getArchivedOutingLogs = async (startDate: Date, endDate: Date): Promise<OutingRecord[]> => {
    const logsCollection = collection(db, 'outingLogs');
    
    // Ensure endDate includes the full day (set to end of day)
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
        logsCollection,
        where('checkOutTime', '>=', Timestamp.fromDate(startDate)),
        where('checkOutTime', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('checkOutTime', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => fromFirestore<OutingRecord>(doc));
};


/**
 * OPTIMIZED LISTENER: Only fetches visitor logs from the last 7 days.
 */
export const onVisitorLogsUpdate = (callback: (logs: VisitorPassRecord[]) => void) => {
  const logsCollection = collection(db, 'visitorLogs');

  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogsQuery = query(
    logsCollection,
    where('inTime', '>=', Timestamp.fromDate(sevenDaysAgo)),
    orderBy('inTime', 'desc')
  );

  return onSnapshot(recentLogsQuery, snapshot => {
    const logsList = snapshot.docs.map(doc => fromFirestore<VisitorPassRecord>(doc));
    callback(logsList);
  });
};

/**
 * Fetches historical visitor logs for a specific date range.
 * Used for the "Archive Search" feature in the Visitor Logbook.
 * @param startDate Start date of the range (inclusive)
 * @param endDate End date of the range (inclusive)
 */
export const getArchivedVisitorLogs = async (startDate: Date, endDate: Date): Promise<VisitorPassRecord[]> => {
    const logsCollection = collection(db, 'visitorLogs');
    
    // Ensure endDate includes the full day (set to end of day)
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
        logsCollection,
        where('inTime', '>=', Timestamp.fromDate(startDate)),
        where('inTime', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('inTime', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => fromFirestore<VisitorPassRecord>(doc));
};

// --- User/Auth Management ---

export const recordUserLogin = async (uid: string, email: string, role: string, gateName: string): Promise<string | null> => {
    const userRef = doc(db, 'users', uid);
    
    try {
        // 1. Get the document first to retrieve the *previous* login time
        const docSnap = await getDoc(userRef);
        let previousLogin: string | null = null;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.lastLogin instanceof Timestamp) {
                previousLogin = data.lastLogin.toDate().toISOString();
            }
        }

        // 2. Update with the *current* login time
        await setDoc(userRef, {
            email,
            role,
            gateName,
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        return previousLogin;
    } catch (error) {
        console.error("Error recording user login:", error);
        return null;
    }
};


// --- Student Management ---

export const addStudent = async (studentData: Omit<Student, 'id' | 'faceImage'>, faceImageBase64: string) => {
  // Use Roll Number for storage filename now
  const storageRef = ref(storage, `student_photos/${studentData.rollNumber}.jpg`);
  await uploadString(storageRef, faceImageBase64, 'data_url');
  const photoUrl = await getDownloadURL(storageRef);
  
  const studentPayload = { ...studentData, faceImage: photoUrl };
  await addDoc(collection(db, 'students'), toFirestore(studentPayload));
};

export const updateStudent = async (studentId: string, studentData: Partial<Student>, newFaceImageBase64?: string | null) => {
    let photoUrl = studentData.faceImage;
    if (newFaceImageBase64) {
        // Use Roll Number for storage filename now
        const storageRef = ref(storage, `student_photos/${studentData.rollNumber}.jpg`);
        await uploadString(storageRef, newFaceImageBase64, 'data_url');
        photoUrl = await getDownloadURL(storageRef);
    }
    const finalData = { ...studentData, faceImage: photoUrl };
    await updateDoc(doc(db, 'students', studentId), toFirestore(finalData));
};

export const deleteStudent = async (student: Student) => {
    // Delete photo from storage first
    if (student.faceImage) {
        try {
            const photoRef = ref(storage, student.faceImage);
            await deleteObject(photoRef);
        } catch (error: any) {
           // If file doesn't exist, it's not a critical error, so we can ignore it.
           if (error.code !== 'storage/object-not-found') {
               console.error("Error deleting student photo from storage:", error);
           }
        }
    }
    // Delete student document from firestore
    await deleteDoc(doc(db, 'students', student.id));
};

export const addStudentsBatch = async (studentsData: Omit<Student, 'id'>[]) => {
    const batch = writeBatch(db);
    const studentsCollection = collection(db, 'students');
    studentsData.forEach(student => {
        const newDocRef = doc(studentsCollection);
        batch.set(newDocRef, toFirestore(student));
    });
    await batch.commit();
};

export const updateStudentPhotoByRollNo = async (rollNo: string, faceImageBase64: string, features: number[]) => {
    const q = query(collection(db, 'students'), where('rollNumber', '==', rollNo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error(`Student with Roll Number ${rollNo} not found.`);
    }

    const studentDoc = querySnapshot.docs[0];
    const storageRef = ref(storage, `student_photos/${rollNo}.jpg`);
    await uploadString(storageRef, faceImageBase64, 'data_url');
    const photoUrl = await getDownloadURL(storageRef);

    await updateDoc(studentDoc.ref, toFirestore({
        id: studentDoc.id,
        faceImage: photoUrl,
        faceFeatures: features,
    }));
};

export const deleteStudentsBatch = async (students: Student[]) => {
    const batch = writeBatch(db);
    for (const student of students) {
        // Delete photo from storage
        if (student.faceImage) {
            try {
                const photoRef = ref(storage, student.faceImage);
                await deleteObject(photoRef);
            } catch (error: any) {
                if (error.code !== 'storage/object-not-found') {
                    console.error(`Error deleting photo for ${student.name}:`, error);
                }
            }
        }
        // Add document deletion to batch
        batch.delete(doc(db, 'students', student.id));
    }
    await batch.commit();
};


// --- Outing Log Management ---
export const addOutingLog = async (logData: Omit<OutingRecord, 'id'>) => {
    await addDoc(collection(db, 'outingLogs'), toFirestore(logData));
};

export const updateOutingLog = async (logId: string, logData: Partial<OutingRecord>) => {
    await updateDoc(doc(db, 'outingLogs', logId), toFirestore({id: logId, ...logData}));
};

export const deleteOutingLog = async (logId: string) => {
    await deleteDoc(doc(db, 'outingLogs', logId));
};

export const deleteOutingLogsBatch = async (logIds: string[]) => {
    const batch = writeBatch(db);
    logIds.forEach(id => {
        batch.delete(doc(db, 'outingLogs', id));
    });
    await batch.commit();
};

/**
 * Performs a targeted query to find a specific type of active outing for a student.
 * This is used as a fallback for the Kiosk check-in when an outing is older than the 7-day live listener window.
 */
export const findActiveOutingForStudent = async (studentId: string, outingType: OutingType): Promise<OutingRecord | null> => {
    const logsCollection = collection(db, 'outingLogs');
    const q = query(
        logsCollection,
        where('studentId', '==', studentId),
        where('outingType', '==', outingType),
        where('checkInTime', '==', null),
        limit(1) // There should only ever be one active log of a specific type
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return fromFirestore<OutingRecord>(querySnapshot.docs[0]);
};

/**
 * Performs a targeted query to find ANY active outing for a student, regardless of type.
 * This is used by the Kiosk check-out process to prevent a student from having multiple concurrent active outings.
 */
export const findAnyActiveOutingForStudent = async (studentId: string): Promise<OutingRecord | null> => {
    const logsCollection = collection(db, 'outingLogs');
    const q = query(
        logsCollection,
        where('studentId', '==', studentId),
        where('checkInTime', '==', null),
        limit(1) // If there's any active log, we just need one to block the action.
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return fromFirestore<OutingRecord>(querySnapshot.docs[0]);
};


// --- Visitor Log Management ---
export const addVisitorLog = async (logData: Omit<VisitorPassRecord, 'id'>) => {
    await addDoc(collection(db, 'visitorLogs'), toFirestore(logData));
};

export const updateVisitorLog = async (logId: string, logData: Partial<VisitorPassRecord>) => {
    await updateDoc(doc(db, 'visitorLogs', logId), toFirestore({ id: logId, ...logData }));
};

export const deleteVisitorLog = async (logId: string) => {
    await deleteDoc(doc(db, 'visitorLogs', logId));
};

export const deleteVisitorLogsBatch = async (logIds: string[]) => {
    const batch = writeBatch(db);
    logIds.forEach(id => {
        batch.delete(doc(db, 'visitorLogs', id));
    });
    await batch.commit();
};