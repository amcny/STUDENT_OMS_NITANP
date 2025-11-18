import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { OutingRecord, Student, OutingType } from '../types';
import StudentProfileModal from './StudentProfileModal';
import RemarksModal from './RemarksModal';
import ViewRemarksModal from './ViewRemarksModal';
import ConfirmationModal from './ConfirmationModal';
import Alert from './Alert';
import CustomSelect from './CustomSelect';
import Modal from './Modal';

// Allow TypeScript to recognize the XLSX global variable from the script tag
declare var XLSX: any;

type SortKey = 'studentName' | 'year' | 'gender' | 'outingType' | 'checkOutTime' | 'checkInTime' | 'checkOutGate' | 'checkInGate';
type SortDirection = 'ascending' | 'descending';

// --- Constants ---
const OVERDUE_HOURS_NON_LOCAL = 72; // 3 days
const SECURITY_PIN = '200405';

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  sortConfig: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === sortKey;
  const icon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕';

  return (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center">
        <span>{label}</span>
        <span className="ml-2 text-gray-400">{icon}</span>
      </div>
    </th>
  );
};

interface LogbookProps {
  gate: string;
}

const Logbook: React.FC<LogbookProps> = ({ gate }) => {
  const { outingLogs, students, setOutingLogs } = useContext(AppContext);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [logToDelete, setLogToDelete] = useState<OutingRecord | null>(null);
  const [logToEditRemarks, setLogToEditRemarks] = useState<OutingRecord | null>(null);
  const [logToViewRemarks, setLogToViewRemarks] = useState<OutingRecord | null>(null);
  const [logToToggleStatus, setLogToToggleStatus] = useState<OutingRecord | null>(null);
  const [logToResolve, setLogToResolve] = useState<OutingRecord | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'checkOutTime',
    direction: 'descending',
  });
  
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualOutingType, setManualOutingType] = useState<OutingType>(OutingType.LOCAL);
  const [manualEntryAlert, setManualEntryAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudentForManualEntry, setSelectedStudentForManualEntry] = useState<Student | null>(null);
  const manualSearchRef = useRef<HTMLDivElement>(null);

  // Unified PIN state management
  const [pinAction, setPinAction] = useState<{ action: 'singleDelete'; log: OutingRecord } | { action: 'bulkDelete' } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Bulk Delete State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteConfig, setBulkDeleteConfig] = useState<{
      range: '3m' | '6m' | '1y' | 'all';
      logs: OutingRecord[];
      hasExported: boolean;
  }>({ range: '3m', logs: [], hasExported: false });


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (manualSearchRef.current && !manualSearchRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const overdueLogs = useMemo(() => {
    const now = new Date();
    return outingLogs.filter(log => {
        // Not overdue if they've checked in or if the status has been manually resolved
        if (log.checkInTime !== null || log.overdueResolved) return false;

        const checkOutDate = new Date(log.checkOutTime);
        let deadline: Date;
        if (log.outingType === OutingType.LOCAL) {
            // Deadline is 9 PM on the day of checkout
            deadline = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate(), 21, 0, 0);
        } else {
             // Deadline is 72 hours after checkout
            deadline = new Date(checkOutDate.getTime() + OVERDUE_HOURS_NON_LOCAL * 60 * 60 * 1000);
        }
        return now > deadline;
    });
  }, [outingLogs]);

  // Effect to calculate logs for bulk deletion when modal opens or range changes
  useEffect(() => {
      if (!isBulkDeleteModalOpen) return;

      const now = new Date();
      const getCutoffDate = (range: string): Date | null => {
          const cutoff = new Date(now);
          switch (range) {
              case '3m': cutoff.setMonth(now.getMonth() - 3); return cutoff;
              case '6m': cutoff.setMonth(now.getMonth() - 6); return cutoff;
              case '1y': cutoff.setFullYear(now.getFullYear() - 1); return cutoff;
              case 'all': return null; // A null cutoff means delete all
              default: return new Date(); // Should not happen
          }
      };

      const cutoffDate = getCutoffDate(bulkDeleteConfig.range);
      
      const logsToPurge = cutoffDate === null
          ? outingLogs
          : outingLogs.filter(log => new Date(log.checkOutTime) < cutoffDate);

      setBulkDeleteConfig(prev => ({ ...prev, logs: logsToPurge, hasExported: false }));
  }, [isBulkDeleteModalOpen, bulkDeleteConfig.range, outingLogs]);

  const handleManualSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setManualSearchTerm(term);
    setSelectedStudentForManualEntry(null); // Clear selection when user types again

    if (term.length > 1) {
        const lowerTerm = term.toLowerCase();
        const filteredStudents = students.filter(student => 
            student.rollNumber.toLowerCase().includes(lowerTerm) || 
            student.registrationNumber.toLowerCase().includes(lowerTerm) ||
            student.name.toLowerCase().includes(lowerTerm)
        ).slice(0, 5); // Limit to 5 suggestions
        setSuggestions(filteredStudents);
        setShowSuggestions(true);
    } else {
        setSuggestions([]);
        setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (student: Student) => {
    setSelectedStudentForManualEntry(student);
    setManualSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const studentMap = useMemo(() => new Map<string, Student>(students.map(s => [s.id, s])), [students]);

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString();
  };
  
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleStudentClick = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
    }
  };

  const handleSaveRemarks = (logId: string, remarks: string) => {
    setOutingLogs(prevLogs =>
      prevLogs.map(log =>
        log.id === logId ? { ...log, remarks } : log
      )
    );
  };
  
  const handleConfirmStatusToggle = () => {
    if (!logToToggleStatus) return;
    setOutingLogs(prevLogs =>
        prevLogs.map(log => {
            if (log.id === logToToggleStatus.id) {
                const isReverting = !!log.checkInTime;
                if (isReverting) {
                    // Reverting to 'Out'
                    const newRemark = `Check-in reverted by ${gate} on ${new Date().toLocaleString()}`;
                    return {
                        ...log,
                        checkInTime: null,
                        checkInGate: null,
                        remarks: log.remarks ? `${log.remarks}; ${newRemark}` : newRemark,
                    };
                } else {
                    // Manual Check-In from actions column
                    const newRemark = `Manual Check-In by ${gate} on ${new Date().toLocaleString()}`;
                     return {
                        ...log,
                        checkInTime: new Date().toISOString(),
                        checkInGate: gate, 
                        remarks: log.remarks ? `${log.remarks}; ${newRemark}` : newRemark,
                    };
                }
            }
            return log;
        })
    );
    setLogToToggleStatus(null);
  };

  const handleConfirmResolveOverdue = () => {
    if (!logToResolve) return;

    setOutingLogs(prevLogs => {
      return prevLogs.map(log => {
        if (log.id === logToResolve.id) {
          const newRemark = `Overdue status resolved by ${gate} on ${new Date().toLocaleString()}.`;
          return {
            ...log,
            overdueResolved: true,
            remarks: log.remarks ? `${log.remarks}; ${newRemark}` : newRemark,
          };
        }
        return log;
      });
    });

    setLogToResolve(null);
  };

  const handleManualEntry = (action: 'check-out' | 'check-in') => {
    setManualEntryAlert(null);
    if (!selectedStudentForManualEntry) {
        setManualEntryAlert({ message: "Please search for and select a student first.", type: 'error'});
        return;
    }

    const student = selectedStudentForManualEntry;

    if (action === 'check-out') {
        const hasActiveOuting = outingLogs.some(log => log.studentId === student.id && log.checkInTime === null);
        if (hasActiveOuting) {
            setManualEntryAlert({ message: `${student.name} already has an active outing.`, type: 'error' });
            return;
        }

        const newLog: OutingRecord = {
            id: crypto.randomUUID(),
            studentId: student.id, studentName: student.name, rollNumber: student.rollNumber,
            year: student.year, gender: student.gender, studentType: student.studentType,
            outingType: manualOutingType, checkOutTime: new Date().toISOString(),
            checkInTime: null, checkOutGate: gate, checkInGate: null,
            remarks: `Manual Check-Out by ${gate} on ${new Date().toLocaleString()}`
        };
        setOutingLogs(prev => [newLog, ...prev]);
        setManualEntryAlert({ message: `${student.name} checked out successfully.`, type: 'success'});

    } else { // Check-in
        const activeLogIndex = outingLogs.findIndex(log => 
            log.studentId === student.id && 
            log.checkInTime === null &&
            log.outingType === manualOutingType
        );

        if (activeLogIndex === -1) {
            const otherActiveOuting = outingLogs.find(log => log.studentId === student.id && log.checkInTime === null);
            if (otherActiveOuting) {
                 setManualEntryAlert({ message: `${student.name} has an active '${otherActiveOuting.outingType}' outing. Please select the correct outing type to check them in.`, type: 'error' });
            } else {
                 setManualEntryAlert({ message: `No active '${manualOutingType}' outing found for ${student.name}.`, type: 'error' });
            }
            return;
        }

        const updatedLogs = [...outingLogs];
        const newRemark = `Manual Check-In by ${gate} on ${new Date().toLocaleString()}`;
        updatedLogs[activeLogIndex] = { ...updatedLogs[activeLogIndex], checkInTime: new Date().toISOString(), checkInGate: gate, remarks: updatedLogs[activeLogIndex].remarks ? `${updatedLogs[activeLogIndex].remarks}; ${newRemark}` : newRemark };
        setOutingLogs(updatedLogs);
        setManualEntryAlert({ message: `${student.name} checked in successfully.`, type: 'success'});
    }
    setSelectedStudentForManualEntry(null);
  };

  const sortedAndFilteredLogs = useMemo(() => {
    const overdueIds = new Set(overdueLogs.map(l => l.id));
    let filtered = outingLogs
      .filter(log => {
        if (filter === 'overdue') return overdueIds.has(log.id);
        if (filter === 'active') return log.checkInTime === null;
        if (filter === 'completed') return log.checkInTime !== null;
        return true;
      })
      .filter(log => {
          const term = searchTerm.toLowerCase();
          const student = studentMap.get(log.studentId);
          const hostel = log.studentType === 'Hosteller' ? (student?.hostel || '') : '';
          const room = log.studentType === 'Hosteller' ? (student?.roomNumber || '') : '';
          return (
              log.studentName.toLowerCase().includes(term) ||
              log.year.toLowerCase().includes(term) ||
              log.gender.toLowerCase().includes(term) ||
              hostel.toLowerCase().includes(term) ||
              room.toLowerCase().includes(term) ||
              log.studentType.toLowerCase().includes(term) ||
              (log.checkOutGate && log.checkOutGate.toLowerCase().includes(term)) ||
              (log.checkInGate && log.checkInGate.toLowerCase().includes(term))
          );
      });

    filtered.sort((a, b) => {
        const key = sortConfig.key;
        let valA: string | number | null = a[key];
        let valB: string | number | null = b[key];

        if (key === 'checkInTime' || key === 'checkInGate') {
            if (valA === null && valB !== null) return sortConfig.direction === 'ascending' ? 1 : -1;
            if (valA !== null && valB === null) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA === null && valB === null) return 0;
        }

        if (key === 'checkOutTime' || key === 'checkInTime') {
            valA = new Date(valA as string).getTime();
            valB = new Date(valB as string).getTime();
        }

        if (valA! < valB!) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA! > valB!) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return filtered;
  }, [outingLogs, filter, searchTerm, sortConfig, studentMap, overdueLogs]);

  const exportLogs = (logsToExport: OutingRecord[], fileName: string) => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded.");
        alert("Could not export to Excel. The required library is missing.");
        return false;
    }

    if (logsToExport.length === 0) {
        alert("No data to export.");
        return false;
    }

    const dataToExport = logsToExport.map(log => {
        const student = studentMap.get(log.studentId);
        return {
            "Student Name": log.studentName,
            "Registration Number": student?.registrationNumber || 'N/A',
            "Branch": student?.branch || 'N/A',
            "Year": log.year,
            "Gender": log.gender,
            "Contact Number": student?.contactNumber || 'N/A',
            "Student Type": log.studentType,
            "Hostel": log.studentType === 'Hosteller' ? (student?.hostel || 'N/A') : 'Day-Scholar',
            "Room Number": log.studentType === 'Hosteller' ? (student?.roomNumber || 'N/A') : 'Day-Scholar',
            "Outing Type": log.outingType,
            "Check-Out Time": formatDateTime(log.checkOutTime),
            "Check-Out Gate": log.checkOutGate,
            "Check-In Time": formatDateTime(log.checkInTime),
            "Check-In Gate": log.checkInGate || 'N/A',
            "Status": log.checkInTime ? 'Completed' : (overdueLogs.some(ol => ol.id === log.id) ? 'Overdue' : 'Out'),
            "Remarks": log.remarks || '',
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Outing Logs");

    const colWidths = Object.keys(dataToExport[0]).map(key => ({
        wch: Math.max(
            key.length,
            ...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length)
        ) + 2
    }));
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, fileName);
    return true;
  };

  const handleExportToExcel = () => {
    exportLogs(sortedAndFilteredLogs, "Student_Outing_Logbook.xlsx");
  };

  // Bulk Delete Handlers
  const handleExportForDeletion = () => {
    const success = exportLogs(
        bulkDeleteConfig.logs,
        `DELETION_EXPORT_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    if (success) {
        setBulkDeleteConfig(prev => ({ ...prev, hasExported: true }));
    }
  };
  
  const handleProceedToPin = () => {
    setPinAction({ action: 'bulkDelete' });
    setIsBulkDeleteModalOpen(false);
    setPinError('');
    setPinInput('');
  };
  
  const handlePinConfirm = () => {
    if (pinInput !== SECURITY_PIN) {
        setPinError('Incorrect PIN. Please try again.');
        setPinInput('');
        return;
    }
    
    let deletedCount = 0;

    if (pinAction?.action === 'singleDelete') {
        setOutingLogs(prev => prev.filter(log => log.id !== pinAction.log.id));
        deletedCount = 1;
    } else if (pinAction?.action === 'bulkDelete') {
        const idsToDelete = new Set(bulkDeleteConfig.logs.map(log => log.id));
        setOutingLogs(prev => prev.filter(log => !idsToDelete.has(log.id)));
        deletedCount = idsToDelete.size;
        setBulkDeleteConfig({ range: '3m', logs: [], hasExported: false });
    }
  
    setManualEntryAlert({
        message: `${deletedCount} log(s) have been permanently deleted.`,
        type: 'success',
    });
  
    // Reset PIN state
    setPinAction(null);
    setPinInput('');
    setPinError('');
  };

  const handlePinModalClose = () => {
    setPinAction(null);
    setPinInput('');
    setPinError('');
  };


  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-screen-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Outing Logbook</h2>
        
        {overdueLogs.length > 0 && filter !== 'overdue' && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-md">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-red-800">{overdueLogs.length} Student(s) are Overdue</h3>
                <p className="text-red-700 text-sm">
                  Click the "Overdue" filter to view them all and resolve their status from the actions column.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 p-6 rounded-lg shadow-md mb-6 border border-slate-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Manual Gate Entry</h3>
            {manualEntryAlert && <div className="mb-4"><Alert message={manualEntryAlert.message} type={manualEntryAlert.type} onClose={() => setManualEntryAlert(null)} /></div>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2" ref={manualSearchRef}>
                    <label htmlFor="manualSearch" className="block text-gray-700 font-medium mb-1">
                        {selectedStudentForManualEntry ? 'Selected Student' : 'Search Student (Name/Roll/Reg. No)'}
                    </label>
                    
                    {selectedStudentForManualEntry ? (
                        <div className="flex items-center p-2 bg-blue-100 border border-blue-300 rounded-md">
                            {selectedStudentForManualEntry.faceImage ? (
                                <img src={selectedStudentForManualEntry.faceImage} alt={selectedStudentForManualEntry.name} className="w-10 h-10 rounded-full object-cover mr-3" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                </div>
                            )}
                            <div className="flex-grow">
                                <p className="font-semibold text-blue-900">{selectedStudentForManualEntry.name}</p>
                                <p className="text-sm text-blue-700">{selectedStudentForManualEntry.rollNumber}</p>
                            </div>
                            <button onClick={() => setSelectedStudentForManualEntry(null)} className="text-red-500 hover:text-red-700 font-bold text-xl ml-2">&times;</button>
                        </div>
                    ) : (
                         <div className="relative">
                            <input
                                id="manualSearch"
                                type="text"
                                placeholder="Start typing to search..."
                                value={manualSearchTerm}
                                onChange={handleManualSearchChange}
                                autoComplete="off"
                                className="w-full uppercase px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    <ul>
                                        {suggestions.map(student => (
                                            <li 
                                                key={student.id} 
                                                className="p-2 hover:bg-blue-50 cursor-pointer flex items-center space-x-3"
                                                onClick={() => handleSuggestionClick(student)}
                                            >
                                                {student.faceImage ? (
                                                    <img src={student.faceImage} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-800">{student.name}</p>
                                                    <p className="text-sm text-gray-500">{student.rollNumber}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                         </div>
                    )}
                </div>
                <div>
                     <CustomSelect 
                        name="manualOutingType" 
                        label="Outing Type" 
                        options={[OutingType.LOCAL, OutingType.NON_LOCAL]} 
                        value={manualOutingType} 
                        onChange={(_, value) => setManualOutingType(value as OutingType)}
                    />
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => handleManualEntry('check-out')} 
                        className="w-full bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition disabled:bg-gray-400"
                        disabled={!selectedStudentForManualEntry}
                    >
                        Check Out
                    </button>
                    <button 
                        onClick={() => handleManualEntry('check-in')} 
                        className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-600 transition disabled:bg-gray-400"
                        disabled={!selectedStudentForManualEntry}
                    >
                        Check In
                    </button>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('active')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'active' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Active Outings</button>
            <button onClick={() => setFilter('completed')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Completed</button>
            <button onClick={() => setFilter('overdue')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'overdue' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Overdue ({overdueLogs.length})</button>
          </div>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search Logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white"
            />
             <button
              onClick={handleExportToExcel}
              className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Export current view to Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Export</span>
            </button>
            <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                title="Bulk delete old logs"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                </svg>
                <span>Bulk Delete</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <SortableHeader label="Student Name" sortKey="studentName" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Year" sortKey="year" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Hostel/Room</th>
                <SortableHeader label="Outing Type" sortKey="outingType" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-Out Time" sortKey="checkOutTime" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-Out Gate" sortKey="checkOutGate" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-In Time" sortKey="checkInTime" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-In Gate" sortKey="checkInGate" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredLogs.length > 0 ? (
                sortedAndFilteredLogs.map((log: OutingRecord) => {
                  const student = studentMap.get(log.studentId);
                  const isOverdue = overdueLogs.some(overdueLog => overdueLog.id === log.id);

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                        <td 
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                        onClick={() => handleStudentClick(log.studentId)}
                        >
                        {log.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.year}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.studentType === 'Hosteller' ? `${student?.hostel || 'N/A'} / ${student?.roomNumber || 'N/A'}` : 'Day-Scholar'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.outingType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.checkOutTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.checkOutGate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.checkInTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.checkInGate || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.checkInTime ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Completed
                            </span>
                        ) : (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isOverdue ? 'Overdue' : 'Out'}
                            </span>
                        )}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate ${log.remarks ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                          title={log.remarks ? "Click to view full remarks" : "No remarks"}
                          onClick={() => log.remarks && setLogToViewRemarks(log)}
                        >
                          {log.remarks || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-4">
                                {isOverdue && (
                                     <button onClick={() => setLogToResolve(log)} className="text-gray-500 hover:text-green-600 transition-colors" title="Resolve Overdue">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                        </svg>
                                    </button>
                                )}
                                {log.checkInTime ? (
                                    <button onClick={() => setLogToToggleStatus(log)} className="text-gray-500 hover:text-yellow-600 transition-colors" title="Revert to 'Out'">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>
                                    </button>
                                ) : (
                                    <button onClick={() => setLogToToggleStatus(log)} className="text-gray-500 hover:text-green-600 transition-colors" title="Manual Check-In">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    </button>
                                )}
                                <button onClick={() => setLogToEditRemarks(log)} className="text-gray-500 hover:text-indigo-600 transition-colors" title="Edit Remarks">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                </button>
                                <button onClick={() => setLogToDelete(log)} className="text-gray-500 hover:text-red-600 transition-colors" title="Delete Log">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-gray-500">
                    No logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <StudentProfileModal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} student={selectedStudent} />
      <ViewRemarksModal
        isOpen={!!logToViewRemarks}
        onClose={() => setLogToViewRemarks(null)}
        log={logToViewRemarks}
      />
      <RemarksModal
        isOpen={!!logToEditRemarks}
        onClose={() => setLogToEditRemarks(null)}
        log={logToEditRemarks}
        onSave={handleSaveRemarks}
      />
      <ConfirmationModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={() => setPinAction({ action: 'singleDelete', log: logToDelete! })}
        title="Delete Outing Log"
        message={
          <span>
            Are you sure you want to delete the outing record for{' '}
            <strong className="text-gray-900">{logToDelete?.studentName}</strong> ({logToDelete?.rollNumber})? This action cannot be undone.
          </span>
        }
      />
      <ConfirmationModal
        isOpen={!!logToToggleStatus}
        onClose={() => setLogToToggleStatus(null)}
        onConfirm={handleConfirmStatusToggle}
        title="Confirm Status Change"
        message={
          <span>
            Are you sure you want to {logToToggleStatus?.checkInTime ? "revert this log to 'Out'" : "manually check-in"} the student{' '}
            <strong className="text-gray-900">{logToToggleStatus?.studentName}</strong>?
          </span>
        }
        confirmButtonText="Confirm"
        confirmButtonClassName="bg-blue-600 hover:bg-blue-700"
      />
       <ConfirmationModal
        isOpen={!!logToResolve}
        onClose={() => setLogToResolve(null)}
        onConfirm={handleConfirmResolveOverdue}
        title="Resolve Overdue Status"
        message={
        <span>
            Are you sure you want to resolve the overdue status for <strong className="text-gray-900">{logToResolve?.studentName}</strong>? 
            A remark will be added to their log. This cannot be undone.
        </span>
        }
        confirmButtonText="Confirm Resolve"
        confirmButtonClassName="bg-green-600 hover:bg-green-700"
      />

    {/* Bulk Delete Modals */}
    <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Bulk Log Deletion">
      <div className="space-y-6">
          {/* Step 1: Range Selection */}
          <div>
              <div className="flex items-center space-x-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full text-lg">1</span>
                  <h4 className="font-semibold text-xl text-gray-800">Select Deletion Range</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['3m', '6m', '1y', 'all'] as const).map(range => {
                      const descriptions = { '3m': 'Older than 3 months', '6m': 'Older than 6 months', '1y': 'Older than 1 year', 'all': 'All logs' };
                      return (
                          <label key={range} className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${bulkDeleteConfig.range === range ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white hover:bg-gray-50 border-gray-300'}`}>
                              <input
                                  type="radio"
                                  name="deleteRange"
                                  value={range}
                                  checked={bulkDeleteConfig.range === range}
                                  onChange={() => setBulkDeleteConfig(prev => ({ ...prev, range }))}
                                  className="sr-only" // Hide the default radio button
                              />
                              <span className="font-semibold text-gray-800">{descriptions[range]}</span>
                          </label>
                      );
                  })}
              </div>
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-lg font-semibold text-red-800">
                        This will permanently delete <strong className="font-bold text-red-900">{bulkDeleteConfig.logs.length}</strong> log record(s).
                    </p>
                </div>
              </div>
          </div>

          {/* Step 2: Export */}
          <div>
              <div className="flex items-center space-x-3 mb-3">
                  <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.logs.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
                  <h4 className="font-semibold text-xl text-gray-800">Export for Archiving (Required)</h4>
              </div>
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                  <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                          <h4 className="font-bold">Important!</h4>
                          <p className="text-sm">Once logs are deleted, they cannot be recovered. You must export the data for your records before proceeding.</p>
                      </div>
                  </div>
              </div>
              <button 
                  onClick={handleExportForDeletion} 
                  disabled={bulkDeleteConfig.logs.length === 0}
                  className="mt-3 w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400 flex items-center justify-center space-x-2"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H7V7a3 3 0 013-3z" />
                  </svg>
                  <span>Export {bulkDeleteConfig.logs.length} Records</span>
              </button>
          </div>

          {/* Step 3: Delete */}
          <div>
              <div className="flex items-center space-x-3 mb-3">
                  <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.hasExported ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
                  <h4 className="font-semibold text-xl text-gray-800">Confirm Deletion</h4>
              </div>
              <button 
                  onClick={handleProceedToPin} 
                  disabled={!bulkDeleteConfig.hasExported || bulkDeleteConfig.logs.length === 0}
                  className="w-full bg-red-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  title={!bulkDeleteConfig.hasExported ? "Please export the logs first" : ""}
              >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                   </svg>
                   <span>Proceed to Delete...</span>
              </button>
          </div>
      </div>
    </Modal>
    
    <Modal isOpen={!!pinAction} onClose={handlePinModalClose} title="Security Verification" size="sm">
        <div className="space-y-4">
            <p className="text-gray-700 text-center">
              {pinAction?.action === 'singleDelete'
                ? 'To confirm this deletion, please enter the security PIN.'
                : (
                    <span>
                        To confirm the deletion of <strong className="text-red-600">{bulkDeleteConfig.logs.length}</strong> log(s), please enter the security PIN.
                    </span>
                )
              }
            </p>

            <input 
                type="password"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                className="w-full text-center tracking-widest text-2xl px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
            />

            {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}

            <div className="flex justify-end space-x-4 pt-4">
                <button onClick={handlePinModalClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                <button onClick={handlePinConfirm} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Confirm & Delete</button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default Logbook;