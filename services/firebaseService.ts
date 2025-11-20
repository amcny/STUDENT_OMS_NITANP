import { db, storage } from '../firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  Timestamp,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Student, OutingRecord, VisitorPassRecord } from '../types';

// --- Helper Functions for Data Conversion ---

/**
 * Converts client-side data (with ISO date strings) to a format suitable for Firestore (with Timestamps).
 * It also adds `createdAt` and `updatedAt` timestamps.
 * @param data - The object to be converted.
 */
const toFirestore = (data: any) => {
  const firestoreData: { [key: string]: any } = { ...data, updatedAt: serverTimestamp() };
  
  // Convert specific string fields to Timestamps
  ['checkOutTime', 'checkInTime', 'inTime', 'outTime', 'date'].forEach(field => {
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

export const onOutingLogsUpdate = (callback: (logs: OutingRecord[]) => void) => {
  const logsCollection = collection(db, 'outingLogs');
  return onSnapshot(logsCollection, snapshot => {
    const logsList = snapshot.docs.map(doc => fromFirestore<OutingRecord>(doc));
    callback(logsList);
  });
};

export const onVisitorLogsUpdate = (callback: (logs: VisitorPassRecord[]) => void) => {
  const logsCollection = collection(db, 'visitorLogs');
  return onSnapshot(logsCollection, snapshot => {
    const logsList = snapshot.docs.map(doc => fromFirestore<VisitorPassRecord>(doc));
    callback(logsList);
  });
};

// --- Student Management ---

export const addStudent = async (studentData: Omit<Student, 'id' | 'faceImage'>, faceImageBase64: string) => {
  const storageRef = ref(storage, `student_photos/${studentData.registrationNumber}.jpg`);
  await uploadString(storageRef, faceImageBase64, 'data_url');
  const photoUrl = await getDownloadURL(storageRef);
  
  const studentPayload = { ...studentData, faceImage: photoUrl };
  await addDoc(collection(db, 'students'), toFirestore(studentPayload));
};

export const updateStudent = async (studentId: string, studentData: Partial<Student>, newFaceImageBase64?: string | null) => {
    let photoUrl = studentData.faceImage;
    if (newFaceImageBase64) {
        const storageRef = ref(storage, `student_photos/${studentData.registrationNumber}.jpg`);
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

export const updateStudentPhotoByRegNo = async (regNo: string, faceImageBase64: string, features: number[]) => {
    const q = query(collection(db, 'students'), where('registrationNumber', '==', regNo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error(`Student with Registration Number ${regNo} not found.`);
    }

    const studentDoc = querySnapshot.docs[0];
    const storageRef = ref(storage, `student_photos/${regNo}.jpg`);
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