export interface Student {
  id: string;
  name: string;
  branch: string;
  rollNumber: string;
  registrationNumber: string;
  year: string;
  gender: string;
  studentType: string;
  hostel: string; // Can be empty if studentType is 'Day-Scholar'
  roomNumber: string; // Can be empty if studentType is 'Day-Scholar'
  contactNumber: string;
  faceImage: string; // base64 data URL
  faceFeatures: number[]; // A vector representing facial features
}

export enum OutingType {
  LOCAL = 'Local',
  NON_LOCAL = 'Non-Local',
}

export interface OutingRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  year: string;
  gender: string;
  studentType: string;
  outingType: OutingType;
  checkOutTime: string; // ISO string
  checkInTime: string | null; // ISO string or null
  remarks?: string;
  checkOutGate: string;
  checkInGate: string | null;
}

export interface VisitorPassRecord {
  id: string;
  passNumber: string;
  date: string; // ISO string for the date part
  inTime: string; // ISO string
  outTime: string | null; // ISO string or null
  name: string;
  relation: string;
  mobileNumber: string;
  address: string;
  vehicleNumber?: string; // Optional
  whomToMeet: string;
  placeToVisit: string;
  personToMeetMobile?: string; // Optional
  purpose: string;
  gateName: string;
}


export type View = 'dashboard' | 'kiosk' | 'register' | 'logbook' | 'allStudents' | 'visitorPass';