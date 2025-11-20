import React, { useState, useContext } from 'react';
import { OutingType, OutingRecord, Student } from '../types';
import { AppContext } from '../App';
import * as firebaseService from '../services/firebaseService';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import { findBestMatch } from '../services/facialRecognitionService';
import Spinner from './Spinner';
import Alert from './Alert';

type Action = 'check-in' | 'check-out';
const MAX_SCAN_ATTEMPTS = 3;

interface OutingKioskProps {
    gate: string;
}

const OutingKiosk: React.FC<OutingKioskProps> = ({ gate }) => {
  const { students, outingLogs } = useContext(AppContext);
  const [outingType, setOutingType] = useState<OutingType>(OutingType.LOCAL);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<Action | null>(null);
  const [facialScanAttempts, setFacialScanAttempts] = useState(0);
  const [scanFailed, setScanFailed] = useState(false);

  const handleFacialScanAction = (action: Action) => {
    setAlert(null);
    if (students.length === 0) {
        setAlert({ message: 'No students registered in the system. Please register a student first.', type: 'error' });
        return;
    }
    setScanFailed(false);
    setCurrentAction(action);
    setIsCameraOpen(true);
    setFacialScanAttempts(0);
  };

  const handleRetryScan = () => {
    setAlert(null);
    setScanFailed(false);
    setIsCameraOpen(true);
  };

  const onCapture = async (imageBase64: string) => {
    setIsCameraOpen(false);
    setIsLoading(true);
    setAlert({ message: 'Identifying student from facial scan... Please wait.', type: 'info' });

    const matchedStudent = await findBestMatch(imageBase64, students);

    if (!matchedStudent) {
        setFacialScanAttempts(prevAttempts => {
            const newAttemptCount = prevAttempts + 1;
            if (newAttemptCount < MAX_SCAN_ATTEMPTS) {
                setAlert({ message: `Scan failed. Please try again. (Attempt ${newAttemptCount}/${MAX_SCAN_ATTEMPTS})`, type: 'error' });
                setScanFailed(true);
            } else {
                setAlert({ message: `Facial scan failed after ${MAX_SCAN_ATTEMPTS} attempts. Please contact an administrator for manual entry.`, type: 'error' });
                setScanFailed(false);
            }
            return newAttemptCount;
        });
        setIsLoading(false);
        return;
    }

    setFacialScanAttempts(0);
    setScanFailed(false);
    setAlert({ message: `Identity verified: ${matchedStudent.name} (${matchedStudent.rollNumber})`, type: 'success' });

    setTimeout(() => {
        if (currentAction === 'check-out') {
          handleCheckOut(matchedStudent);
        } else if (currentAction === 'check-in') {
          handleCheckIn(matchedStudent);
        }
    }, 1500);
  };

  const handleCheckOut = async (student: Student) => {
    const hasActiveOuting = outingLogs.some(log => log.studentId === student.id && log.checkInTime === null);
    if (hasActiveOuting) {
        setAlert({ message: `${student.name} already has an active outing. Cannot check out again.`, type: 'error' });
        setIsLoading(false);
        return;
    }

    const newLog: Omit<OutingRecord, 'id'> = {
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

    try {
        await firebaseService.addOutingLog(newLog);
        setAlert({ message: `${student.name} checked out for ${outingType} outing successfully.`, type: 'success' });
    } catch (error) {
        console.error("Check-out failed:", error);
        setAlert({ message: 'An error occurred during check-out.', type: 'error' });
    } finally {
        setIsLoading(false);
    }
  }

  const handleCheckIn = async (student: Student) => {
    const activeLog = outingLogs.find(
      log => log.studentId === student.id && log.outingType === outingType && log.checkInTime === null
    );

    if (!activeLog) {
      setAlert({ message: `No active ${outingType} outing found for ${student.name}.`, type: 'error' });
      setIsLoading(false);
      return;
    }
    
    const updateData = {
        checkInTime: new Date().toISOString(),
        checkInGate: gate,
    };

    try {
        await firebaseService.updateOutingLog(activeLog.id, updateData);
        setAlert({ message: `${student.name} checked in successfully. Welcome back!`, type: 'success' });
    } catch(error) {
        console.error("Check-in failed:", error);
        setAlert({ message: 'An error occurred during check-in.', type: 'error' });
    } finally {
        setIsLoading(false);
    }
  }
  
  const handleOutingTypeChange = (type: OutingType) => {
    setOutingType(type);
    setFacialScanAttempts(0);
    setScanFailed(false);
    setAlert(null);
  };

  return (
    <div className="bg-slate-50/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-slate-200 max-w-screen-xl mx-auto relative overflow-hidden">
      <div className="absolute top-0 right-0 -z-10 w-64 h-64 bg-blue-200/50 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -z-10 w-64 h-64 bg-emerald-200/50 rounded-full blur-3xl"></div>

      <div className="flex justify-center items-center gap-4 mb-8 pb-6 border-b border-slate-300">
          <img 
              src="https://mscnitanp.pages.dev/nitanp_logo.png" 
              alt="NIT Andhra Pradesh Logo" 
              className="h-20 w-20 flex-shrink-0"
          />
          <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-800">National Institute of Technology, Andhra Pradesh</h1>
              <p className="text-lg text-slate-600">Student Outing Management Kiosk</p>
          </div>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex flex-col justify-center items-center z-20 rounded-lg">
            <Spinner />
            <p className="mt-4 text-lg font-semibold text-gray-700">Processing...</p>
        </div>
      )}
      {alert && <div className="mb-6"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="block text-slate-800 font-semibold mb-2 text-lg text-center">1. Select Outing Type</label>
          <div className="p-1.5 bg-slate-200/80 rounded-xl flex space-x-1.5 max-w-sm mx-auto">
            {[OutingType.LOCAL, OutingType.NON_LOCAL].map(type => (
              <button
                key={type}
                onClick={() => handleOutingTypeChange(type)}
                className={`w-full text-lg font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  outingType === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white/60 text-slate-700 hover:bg-white'
                }`}
              >
                {type} Outing
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-slate-800 font-semibold mb-2 text-lg text-center">2. Verify your identity</label>
          <div className="p-6 bg-white/60 border border-white rounded-xl shadow-lg">
              <h3 className="font-semibold text-gray-800 mb-4 text-center text-base uppercase tracking-wider">Facial Recognition Scan</h3>
              {scanFailed ? (
                <button
                  onClick={handleRetryScan}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-br from-yellow-500 to-orange-500 text-white font-bold py-6 px-6 rounded-xl text-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:translate-y-0 flex items-center justify-center space-x-3 shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                  </svg>
                  <span>Try Again</span>
                </button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleFacialScanAction('check-out')}
                    disabled={isLoading}
                    className="bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold py-6 px-6 rounded-xl text-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:translate-y-0 flex items-center justify-center space-x-3 shadow-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M12.97 4.47a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
                    <span>Check Out</span>
                  </button>
                  <button
                    onClick={() => handleFacialScanAction('check-in')}
                    disabled={isLoading}
                    className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold py-6 px-6 rounded-xl text-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:translate-y-0 flex items-center justify-center space-x-3 shadow-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M11.03 4.47a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clipRule="evenodd" /></svg>
                    <span>Check In</span>
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>

      <Modal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} title="Facial Recognition Scan">
          <CameraCapture onCapture={onCapture} onClose={() => setIsCameraOpen(false)} />
      </Modal>
    </div>
  );
};

export default OutingKiosk;