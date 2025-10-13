import React, { useState, useContext } from 'react';
import { OutingType, OutingRecord, Student } from '../types';
import { AppContext } from '../App';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import BarcodeScanner from './BarcodeScanner';
import { findBestMatch } from '../services/facialRecognitionService';
import Spinner from './Spinner';
import Alert from './Alert';

type Action = 'check-in' | 'check-out';
const MAX_SCAN_ATTEMPTS = 3;

interface OutingKioskProps {
    gate: string;
}

const OutingKiosk: React.FC<OutingKioskProps> = ({ gate }) => {
  const { students, outingLogs, setOutingLogs } = useContext(AppContext);
  const [outingType, setOutingType] = useState<OutingType>(OutingType.LOCAL);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<Action | null>(null);
  const [facialScanAttempts, setFacialScanAttempts] = useState(0);

  const handleFacialScanAction = (action: Action) => {
    setAlert(null);
    if (students.length === 0) {
        setAlert({ message: 'No students registered in the system. Please register a student first.', type: 'error' });
        return;
    }
    setCurrentAction(action);
    setIsCameraOpen(true);
  };

  const onCapture = async (imageBase64: string) => {
    setIsCameraOpen(false);
    setIsLoading(true);
    setAlert({ message: 'Identifying student from facial scan... Please wait.', type: 'info' });

    const matchedStudent = await findBestMatch(imageBase64, students);

    if (!matchedStudent) {
        const newAttemptCount = facialScanAttempts + 1;
        setFacialScanAttempts(newAttemptCount);
        if (newAttemptCount < MAX_SCAN_ATTEMPTS) {
            setAlert({ message: `Scan failed. Please try again. (Attempt ${newAttemptCount}/${MAX_SCAN_ATTEMPTS})`, type: 'error' });
        } else {
            setAlert({ message: `Facial scan failed after ${MAX_SCAN_ATTEMPTS} attempts. Please use the barcode scanner as a fallback.`, type: 'error' });
        }
        setIsLoading(false);
        return;
    }

    setFacialScanAttempts(0); // Reset on success
    setAlert({ message: `Identity verified: ${matchedStudent.name} (${matchedStudent.rollNumber})`, type: 'success' });

    setTimeout(() => {
        if (currentAction === 'check-out') {
          handleCheckOut(matchedStudent);
        } else if (currentAction === 'check-in') {
          handleCheckIn(matchedStudent);
        }
    }, 1500);
  };
  
  const handleBarcodeScanned = (registrationNumber: string) => {
    setIsBarcodeScannerOpen(false);
    setIsLoading(true);
    setAlert({ message: 'Barcode scanned. Verifying identity...', type: 'info' });
  
    const matchedStudent = students.find(s => s.registrationNumber.toUpperCase() === registrationNumber.trim().toUpperCase());
  
    if (!matchedStudent) {
      setAlert({ message: `Student with Registration Number "${registrationNumber}" not found. Please contact an administrator.`, type: 'error' });
      setIsLoading(false);
      setFacialScanAttempts(0); // Reset to allow another full cycle if needed
      return;
    }
  
    setFacialScanAttempts(0); // Reset on success
    setAlert({ message: `Identity verified: ${matchedStudent.name} (${matchedStudent.rollNumber})`, type: 'success' });
  
    setTimeout(() => {
      if (currentAction === 'check-out') {
        handleCheckOut(matchedStudent);
      } else if (currentAction === 'check-in') {
        handleCheckIn(matchedStudent);
      }
    }, 1500);
  };

  const handleCheckOut = (student: Student) => {
    const hasActiveOuting = outingLogs.some(log => log.studentId === student.id && log.checkInTime === null);
    if (hasActiveOuting) {
        setAlert({ message: `${student.name} already has an active outing. Cannot check out again.`, type: 'error' });
        setIsLoading(false);
        return;
    }

    const newLog: OutingRecord = {
        id: crypto.randomUUID(),
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        gender: student.gender,
        studentType: student.studentType,
        outingType,
        checkOutTime: new Date().toISOString(),
        checkInTime: null,
        checkOutGate: gate,
        checkInGate: null,
    };

    setOutingLogs(prevLogs => [newLog, ...prevLogs]);
    setAlert({ message: `${student.name} checked out for ${outingType} outing successfully.`, type: 'success' });
    setIsLoading(false);
  }

  const handleCheckIn = (student: Student) => {
    const activeLogIndex = outingLogs.findIndex(
      log => log.studentId === student.id && log.outingType === outingType && log.checkInTime === null
    );

    if (activeLogIndex === -1) {
      setAlert({ message: `No active ${outingType} outing found for ${student.name}.`, type: 'error' });
      setIsLoading(false);
      return;
    }
    
    const updatedLogs = [...outingLogs];
    updatedLogs[activeLogIndex] = {
        ...updatedLogs[activeLogIndex],
        checkInTime: new Date().toISOString(),
        checkInGate: gate,
    };

    setOutingLogs(updatedLogs);
    setAlert({ message: `${student.name} checked in successfully. Welcome back!`, type: 'success' });
    setIsLoading(false);
  }
  
  const handleOutingTypeChange = (type: OutingType) => {
    setOutingType(type);
    setFacialScanAttempts(0); // Reset attempts when outing type changes
    setAlert(null);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl mx-auto relative">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Outing Kiosk</h2>
      
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex flex-col justify-center items-center z-20 rounded-lg">
            <Spinner />
            <p className="mt-4 text-lg font-semibold text-gray-700">Processing...</p>
        </div>
      )}
      {alert && <div className="mb-6"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}

      <div className="mb-8">
        <label className="block text-gray-700 font-medium mb-2 text-lg">1. Select Outing Type</label>
        <div className="flex space-x-4">
          {[OutingType.LOCAL, OutingType.NON_LOCAL].map(type => (
            <button
              key={type}
              onClick={() => handleOutingTypeChange(type)}
              className={`w-full text-lg font-semibold py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 shadow-sm ${
                outingType === type
                  ? 'bg-blue-600 text-white ring-blue-300'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 ring-gray-300'
              }`}
            >
              {type} Outing
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">
        <label className="block text-gray-700 font-medium mb-4 text-lg">2. Verify your identity</label>
        
        <div className="p-4 border rounded-lg bg-slate-50 shadow-inner">
            <h3 className="font-semibold text-gray-800 mb-3 text-center">Facial Recognition Scan</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleFacialScanAction('check-out')}
                disabled={isLoading}
                className="bg-red-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-red-600 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span>Check Out</span>
              </button>
              <button
                onClick={() => handleFacialScanAction('check-in')}
                disabled={isLoading}
                className="bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-green-600 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                <span>Check In</span>
              </button>
            </div>
        </div>

        {facialScanAttempts >= MAX_SCAN_ATTEMPTS && (
           <div className="mt-6">
             <div className="flex items-center my-4">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
             </div>
              <div className="p-4 border rounded-lg bg-slate-50 shadow-inner">
                <h3 className="font-semibold text-gray-800 mb-2 text-center">ID Card Scan</h3>
                <p className="text-center text-gray-600 mb-4">Facial scan failed. Please present your student ID card for barcode scanning.</p>
                 <button
                    onClick={() => { setAlert(null); setIsBarcodeScannerOpen(true); }}
                    disabled={isLoading || !currentAction}
                    className="w-full bg-indigo-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-indigo-600 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    <span>Scan Barcode</span>
                </button>
              </div>
            </div>
        )}
      </div>
      
      <Modal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} title="Facial Recognition Scan">
          <CameraCapture onCapture={onCapture} onClose={() => setIsCameraOpen(false)} />
      </Modal>

      <Modal isOpen={isBarcodeScannerOpen} onClose={() => setIsBarcodeScannerOpen(false)} title="Scan Student ID Barcode">
          <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setIsBarcodeScannerOpen(false)} />
      </Modal>
    </div>
  );
};

export default OutingKiosk;