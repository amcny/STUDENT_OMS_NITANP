import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { OutingRecord, Student } from '../types';
import StudentProfileModal from './StudentProfileModal';

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
  const { outingLogs, students } = useContext(AppContext);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
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
        // FIX: Explicitly type valA and valB to allow for number assignment from getTime().
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-500">
                    No logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <StudentProfileModal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} student={selectedStudent} />
    </>
  );
};

export default Logbook;