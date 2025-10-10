import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Student, View } from '../types';
import StudentProfileModal from './StudentProfileModal';
import EditStudentModal from './EditStudentModal';
import ConfirmationModal from './ConfirmationModal';

type SortKey = 'name' | 'rollNumber' | 'branch' | 'year';
type SortDirection = 'ascending' | 'descending';

interface AllStudentsProps {
  onViewChange: (view: View) => void;
}

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

const AllStudents: React.FC<AllStudentsProps> = ({ onViewChange }) => {
  const { students, setStudents } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'ascending',
  });

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
  };

  const handleDeleteStudent = () => {
    if (!studentToDelete) return;
    setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
    setStudentToDelete(null); // Close modal after deletion
  };


  const sortedAndFilteredStudents = useMemo(() => {
    let filtered = students.filter(student =>
      Object.values(student).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [students, searchTerm, sortConfig]);

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Student Database</h2>
            <button
              onClick={() => onViewChange('dashboard')}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition duration-300 flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
        </div>
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search all students..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Photo</th>
                <SortableHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Roll Number" sortKey="rollNumber" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Year" sortKey="year" sortConfig={sortConfig} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4">
                    <img src={student.faceImage} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedStudent(student)}>
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.branch}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.year}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.contactNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-4">
                      <button onClick={() => setStudentToEdit(student)} className="text-gray-500 hover:text-indigo-600 transition-colors" title="Edit Student">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                      </button>
                      <button onClick={() => setStudentToDelete(student)} className="text-gray-500 hover:text-red-600 transition-colors" title="Delete Student">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedAndFilteredStudents.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No students found.
            </div>
          )}
        </div>
      </div>
      <StudentProfileModal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} student={selectedStudent} />
      
      <EditStudentModal 
        isOpen={!!studentToEdit}
        onClose={() => setStudentToEdit(null)}
        student={studentToEdit}
        onSave={handleUpdateStudent}
        existingRollNumbers={students.map(s => s.rollNumber)}
      />
      <ConfirmationModal
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={handleDeleteStudent}
        title="Delete Student"
        message={
          <span>
            Are you sure you want to delete the student{' '}
            <strong className="text-gray-900">{studentToDelete?.name}</strong>? This action cannot be undone.
          </span>
        }
      />
    </>
  );
};

export default AllStudents;