import React, { useState, useContext } from 'react';
import { OutingType, OutingRecord, Student } from '../types';
import { AppContext } from '../App';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import { findBestMatch } from '../services/facialRecognitionService';
import Spinner from './Spinner';
import Alert from './Alert';

type Action = 'check-in' | 'check-out';
const MAX_SCAN_ATTEMPTS = 3;

const OutingKiosk: React.FC = () => {
  const { students, outingLogs, setOutingLogs } = useContext(AppContext);
  const [outingType, setOutingType] = useState<OutingType>(OutingType.LOCAL);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<Action | null>(null);
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [facialScanAttempts, setFacialScanAttempts] = useState(0);

  const handleFacialScanAction = (action: Action) => {
    setAlert(null);
    if (students.length === 0) {
        setAlert({ message: 'No students registered in the system. Please register a student first.', type: 'error' });
        return;
    }
    // Do NOT reset attempts here, to allow for multiple tries.
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
            setAlert({ message: `Facial scan failed after ${MAX_SCAN_ATTEMPTS} attempts. You can now try manual entry below.`, type: 'error' });
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
    };

    setOutingLogs(updatedLogs);
    setAlert({ message: `${student.name} checked in successfully. Welcome back!`, type: 'success' });
    setIsLoading(false);
  }
  
  const handleManualAction = (action: Action) => {
    setAlert(null);
    const trimmedRollNumber = rollNumberInput.trim().toUpperCase();

    if (!trimmedRollNumber) {
        setAlert({ message: 'Please enter a Roll Number.', type: 'error' });
        return;
    }
    
    setIsLoading(true);

    const matchedStudent = students.find(s => s.rollNumber.toUpperCase() === trimmedRollNumber);

    if (!matchedStudent) {
        setAlert({ message: `Student with Roll Number "${rollNumberInput}" not found.`, type: 'error' });
        setIsLoading(false);
        return;
    }
    
    setAlert({ message: `Identity verified: ${matchedStudent.name} (${matchedStudent.rollNumber})`, type: 'success' });

    setTimeout(() => {
        if (action === 'check-out') {
            handleCheckOut(matchedStudent);
        } else if (action === 'check-in') {
            handleCheckIn(matchedStudent);
        }
        setRollNumberInput('');
        setFacialScanAttempts(0); // Reset counter on successful manual entry
    }, 1500);
  };

  const handleNumpadClick = (value: string) => {
    if (isLoading) return;
    if (value === 'backspace') {
      setRollNumberInput(prev => prev.slice(0, -1));
    } else {
      setRollNumberInput(prev => (prev + value).slice(0, 10).toUpperCase());
    }
  };
  
  const handleOutingTypeChange = (type: OutingType) => {
    setOutingType(type);
    setFacialScanAttempts(0); // Reset attempts when outing type changes
    setAlert(null);
  };

  const NumpadButton: React.FC<{ onClick: () => void; children?: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`w-10 h-10 flex items-center justify-center rounded-md bg-slate-200 text-slate-800 text-xl font-semibold hover:bg-slate-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );

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

        {/* Animated Fallback Section */}
        <div className={`
            grid 
            transition-[grid-template-rows] duration-700 ease-in-out
            ${facialScanAttempts >= MAX_SCAN_ATTEMPTS ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
        `}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center my-6">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="p-4 border rounded-lg bg-slate-50 shadow-inner">
                <h3 className="font-semibold text-gray-800 mb-3 text-center">Manual Entry</h3>
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-full bg-white border border-slate-300 rounded-md shadow-sm h-16 flex items-center justify-center">
                        <p className="text-3xl tracking-widest text-gray-800 font-mono">
                            {rollNumberInput || <span className="text-gray-400">Roll Number</span>}
                        </p>
                    </div>
                    
                    <div className="flex justify-center items-center space-x-1">
                        {'1234567890'.split('').map(num => (
                            <NumpadButton key={num} onClick={() => handleNumpadClick(num)}>{num}</NumpadButton>
                        ))}
                        <NumpadButton onClick={() => handleNumpadClick('backspace')} className="text-2xl font-bold">
                            &times;
                        </NumpadButton>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleManualAction('check-out')}
                            disabled={isLoading || !rollNumberInput}
                            className="bg-red-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-red-600 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            <span>Check Out</span>
                        </button>
                        <button 
                            onClick={() => handleManualAction('check-in')}
                            disabled={isLoading || !rollNumberInput}
                            className="bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-xl hover:bg-green-600 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                            <span>Check In</span>
                        </button>
                    </div>
                </div>
            </div>
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