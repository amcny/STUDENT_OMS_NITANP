import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Student, View } from '../types';
import StudentProfileModal from './StudentProfileModal';
import EditStudentModal from './EditStudentModal';
import ConfirmationModal from './ConfirmationModal';

interface AllStudentsProps {
  onViewChange: (view: View) => void;
}

const AllStudents: React.FC<AllStudentsProps> = ({ onViewChange }) => {
  const { students, setStudents } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
  };

  const handleDeleteStudent = () => {
    if (!studentToDelete) return;
    setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
    setStudentToDelete(null); // Close modal after deletion
  };
  
  const handleBulkDelete = () => {
    setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
    setSelectedStudentIds(new Set());
    setIsBulkDeleteModalOpen(false);
  };


  const sortedAndFilteredStudents = useMemo(() => {
    let filtered = students.filter(student =>
      Object.values(student).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    const yearOrder: { [key: string]: number } = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };

    filtered.sort((a, b) => {
      const yearA = yearOrder[a.year] || 0;
      const yearB = yearOrder[b.year] || 0;

      if (yearA !== yearB) {
        return yearA - yearB;
      }

      return a.registrationNumber.localeCompare(b.registrationNumber);
    });

    return filtered;
  }, [students, searchTerm]);
  
  useEffect(() => {
    if (headerCheckboxRef.current) {
        const numSelected = selectedStudentIds.size;
        const numStudents = sortedAndFilteredStudents.length;
        headerCheckboxRef.current.checked = numSelected > 0 && numSelected === numStudents;
        headerCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numStudents;
    }
  }, [selectedStudentIds, sortedAndFilteredStudents]);
  
  const handleSelectAll = () => {
    if (headerCheckboxRef.current?.checked) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(sortedAndFilteredStudents.map(s => s.id)));
    }
  };

  const handleSelectOne = (studentId: string, isChecked: boolean) => {
    setSelectedStudentIds(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
            newSet.add(studentId);
        } else {
            newSet.delete(studentId);
        }
        return newSet;
    });
  };

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-screen-2xl mx-auto">
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
        <div className="mb-6 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search all students..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white"
          />
          {selectedStudentIds.size > 0 && (
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{selectedStudentIds.size} student(s) selected</span>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition duration-300 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3">
                    <input 
                        type="checkbox" 
                        ref={headerCheckboxRef}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onChange={handleSelectAll}
                    />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Photo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Registration Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredStudents.map(student => (
                <tr key={student.id} className={`hover:bg-gray-50 transition-colors duration-150 ${selectedStudentIds.has(student.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        checked={selectedStudentIds.has(student.id)}
                        onChange={(e) => handleSelectOne(student.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    {student.faceImage ? (
                        <img src={student.faceImage} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center" title="Biometric data missing">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                        <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedStudent(student)}>
                            {student.name}
                        </span>
                        {!student.faceImage && (
                            <div title="Biometric data missing. Please edit to capture photo.">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.22 3.001-1.742 3.001H4.42c-1.522 0-2.492-1.667-1.742-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.registrationNumber}</td>
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
        allStudents={students}
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
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedStudentIds.size} Students`}
        message={`Are you sure you want to delete the ${selectedStudentIds.size} selected students? This action cannot be undone.`}
      />
    </>
  );
};

export default AllStudents;