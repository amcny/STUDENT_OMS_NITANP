import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { OutingRecord, Student } from '../types';
import StudentProfileModal from './StudentProfileModal';
import RemarksModal from './RemarksModal';
import ConfirmationModal from './ConfirmationModal';

type SortKey = 'studentName' | 'rollNumber' | 'year' | 'gender' | 'outingType' | 'checkOutTime' | 'checkInTime';
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

const Logbook: React.FC = () => {
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
                return {
                    ...log,
                    checkInTime: log.checkInTime ? null : new Date().toISOString()
                };
            }
            return log;
        })
    );
    setLogToToggleStatus(null);
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
          return (
              log.studentName.toLowerCase().includes(term) ||
              log.rollNumber.toLowerCase().includes(term) ||
              log.year.toLowerCase().includes(term) ||
              log.gender.toLowerCase().includes(term) ||
              log.studentType.toLowerCase().includes(term)
          );
      });

    filtered.sort((a, b) => {
        const key = sortConfig.key;
        let valA: string | number | null = a[key];
        let valB: string | number | null = b[key];

        if (key === 'checkInTime') {
            if (valA === null && valB !== null) return sortConfig.direction === 'ascending' ? 1 : -1;
            if (valA !== null && valB === null) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA === null && valB === null) return 0;
        }

        if (key === 'checkOutTime' || key === 'checkInTime') {
            valA = new Date(valA as string).getTime();
            valB = new Date(valB as string).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return filtered;
  }, [outingLogs, filter, searchTerm, sortConfig]);

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Outing Logbook</h2>

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
            <button onClick={() => setFilter('active')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'active' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Active Outings</button>
            <button onClick={() => setFilter('completed')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Completed</button>
          </div>
          <div className="relative w-full md:w-auto">
            <input
              type="text"
              placeholder="Search Student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <SortableHeader label="Student Name" sortKey="studentName" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Roll Number" sortKey="rollNumber" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Year" sortKey="year" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Gender" sortKey="gender" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Student Type</th>
                <SortableHeader label="Outing Type" sortKey="outingType" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-Out Time" sortKey="checkOutTime" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Check-In Time" sortKey="checkInTime" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Remarks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredLogs.length > 0 ? (
                sortedAndFilteredLogs.map((log: OutingRecord) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                      onClick={() => handleStudentClick(log.studentId)}
                    >
                      {log.studentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.rollNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.gender}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.studentType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.outingType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.checkOutTime)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.checkInTime)}</td>
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
                ))
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