import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { OutingRecord, Student, OutingType } from '../types';
import StudentProfileModal from './StudentProfileModal';
import RemarksModal from './RemarksModal';
import ConfirmationModal from './ConfirmationModal';
import Alert from './Alert';
import CustomSelect from './CustomSelect';

// Allow TypeScript to recognize the XLSX global variable from the script tag
declare var XLSX: any;

type SortKey = 'studentName' | 'rollNumber' | 'year' | 'gender' | 'outingType' | 'checkOutTime' | 'checkInTime' | 'checkOutGate' | 'checkInGate';
type SortDirection = 'ascending' | 'descending';

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
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [logToDelete, setLogToDelete] = useState<OutingRecord | null>(null);
  const [logToEditRemarks, setLogToEditRemarks] = useState<OutingRecord | null>(null);
  const [logToToggleStatus, setLogToToggleStatus] = useState<OutingRecord | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'checkOutTime',
    direction: 'descending',
  });
  
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualOutingType, setManualOutingType] = useState<OutingType>(OutingType.LOCAL);
  const [manualEntryAlert, setManualEntryAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);


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

  const handleDeleteLog = () => {
    if (!logToDelete) return;
    setOutingLogs(prevLogs => prevLogs.filter(log => log.id !== logToDelete.id));
    setLogToDelete(null);
  };
  
  const handleConfirmStatusToggle = () => {
    if (!logToToggleStatus) return;
    setOutingLogs(prevLogs =>
        prevLogs.map(log => {
            if (log.id === logToToggleStatus.id) {
                const isReverting = !!log.checkInTime;
                return {
                    ...log,
                    checkInTime: isReverting ? null : new Date().toISOString(),
                    checkInGate: isReverting ? null : gate, 
                };
            }
            return log;
        })
    );
    setLogToToggleStatus(null);
  };

  const handleManualEntry = (action: 'check-out' | 'check-in') => {
    setManualEntryAlert(null);
    const term = manualSearchTerm.trim().toUpperCase();
    if (!term) {
        setManualEntryAlert({ message: "Please enter a student's Roll Number or Registration Number.", type: 'error'});
        return;
    }

    const student = students.find(s => s.rollNumber.toUpperCase() === term || s.registrationNumber.toUpperCase() === term);
    if (!student) {
        setManualEntryAlert({ message: `No student found with identifier "${manualSearchTerm}".`, type: 'error'});
        return;
    }

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
            remarks: 'Manual Entry by Admin'
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
        updatedLogs[activeLogIndex] = { ...updatedLogs[activeLogIndex], checkInTime: new Date().toISOString(), checkInGate: gate, remarks: updatedLogs[activeLogIndex].remarks ? `${updatedLogs[activeLogIndex].remarks}; Manual Check-In` : 'Manual Check-In by Admin' };
        setOutingLogs(updatedLogs);
        setManualEntryAlert({ message: `${student.name} checked in successfully.`, type: 'success'});
    }
    setManualSearchTerm('');
  };

  const sortedAndFilteredLogs = useMemo(() => {
    let filtered = outingLogs
      .filter(log => {
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
              log.rollNumber.toLowerCase().includes(term) ||
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
  }, [outingLogs, filter, searchTerm, sortConfig, studentMap]);

  const handleExportToExcel = () => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded.");
        alert("Could not export to Excel. The required library is missing.");
        return;
    }

    const dataToExport = sortedAndFilteredLogs.map(log => {
        const student = studentMap.get(log.studentId);
        return {
            "Student Name": log.studentName,
            "Roll Number": log.rollNumber,
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
            "Status": log.checkInTime ? 'Completed' : 'Out',
            "Remarks": log.remarks || '',
        };
    });

    if (dataToExport.length === 0) {
        alert("No data to export.");
        return;
    }

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

    XLSX.writeFile(workbook, "Student_Outing_Logbook.xlsx");
  };

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-screen-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Outing Logbook</h2>
        
        <div className="bg-slate-50 p-6 rounded-lg shadow-md mb-6 border border-slate-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Manual Gate Entry</h3>
            {manualEntryAlert && <div className="mb-4"><Alert message={manualEntryAlert.message} type={manualEntryAlert.type} onClose={() => setManualEntryAlert(null)} /></div>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                    <label htmlFor="manualSearch" className="block text-gray-700 font-medium mb-1">Student Roll/Reg. Number</label>
                    <input
                        id="manualSearch"
                        type="text"
                        placeholder="Enter Roll or Registration Number"
                        value={manualSearchTerm}
                        onChange={(e) => setManualSearchTerm(e.target.value)}
                        className="w-full uppercase px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                    />
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
                    <button onClick={() => handleManualEntry('check-out')} className="w-full bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition">Check Out</button>
                    <button onClick={() => handleManualEntry('check-in')} className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-600 transition">Check In</button>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('active')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'active' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Active Outings</button>
            <button onClick={() => setFilter('completed')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Completed</button>
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <SortableHeader label="Student Name" sortKey="studentName" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Roll Number" sortKey="rollNumber" sortConfig={sortConfig} onSort={handleSort} />
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
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                        <td 
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                        onClick={() => handleStudentClick(log.studentId)}
                        >
                        {log.studentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.rollNumber}</td>
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
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Out
                            </span>
                        )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" title={log.remarks}>
                            {log.remarks || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-4">
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
                  <td colSpan={13} className="text-center py-10 text-gray-500">
                    No logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <StudentProfileModal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} student={selectedStudent} />
      <RemarksModal
        isOpen={!!logToEditRemarks}
        onClose={() => setLogToEditRemarks(null)}
        log={logToEditRemarks}
        onSave={handleSaveRemarks}
      />
      <ConfirmationModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleDeleteLog}
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
    </>
  );
};

export default Logbook;