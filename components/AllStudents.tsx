import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Student, View } from '../types';
import StudentProfileModal from './StudentProfileModal';
import EditStudentModal from './EditStudentModal';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import { BRANCH_OPTIONS, YEAR_OPTIONS, GENDER_OPTIONS, STUDENT_TYPE_OPTIONS } from '../constants';


interface AllStudentsProps {
  onViewChange: (view: View) => void;
}

const AllStudents: React.FC<AllStudentsProps> = ({ onViewChange }) => {
  const { students, setStudents } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    year: 'All',
    branch: 'All',
    studentType: 'All',
    gender: 'All',
    missingPhoto: false,
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  
  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleMissingPhotoToggle = () => {
    setFilters(prev => ({ ...prev, missingPhoto: !prev.missingPhoto }));
  };

  const clearFilters = () => {
    setFilters({
      year: 'All',
      branch: 'All',
      studentType: 'All',
      gender: 'All',
      missingPhoto: false,
    });
    setSearchTerm('');
  };


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
    let filtered = students.filter(student => {
        if (filters.year !== 'All' && student.year !== filters.year) return false;
        if (filters.branch !== 'All' && student.branch !== filters.branch) return false;
        if (filters.studentType !== 'All' && student.studentType !== filters.studentType) return false;
        if (filters.gender !== 'All' && student.gender !== filters.gender) return false;
        if (filters.missingPhoto && student.faceImage !== null) return false;
        
        if (searchTerm) {
             return Object.values(student).some(value =>
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return true;
    });

    const yearOrder: { [key: string]: number } = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };

    filtered.sort((a, b) => {
      const yearA = yearOrder[a.year] || 0;
      const yearB = yearOrder[b.year] || 0;
      if (yearA !== yearB) return yearA - yearB;
      return a.registrationNumber.localeCompare(b.registrationNumber);
    });

    return filtered;
  }, [students, searchTerm, filters]);
  
  useEffect(() => {
    if (headerCheckboxRef.current) {
        const numSelected = selectedStudentIds.size;
        const numStudents = sortedAndFilteredStudents.length;
        const allSelected = numStudents > 0 && numSelected === numStudents;
        headerCheckboxRef.current.checked = allSelected;
        headerCheckboxRef.current.indeterminate = numSelected > 0 && !allSelected;
    }
  }, [selectedStudentIds, sortedAndFilteredStudents]);
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(new Set(sortedAndFilteredStudents.map(s => s.id)));
    } else {
      setSelectedStudentIds(new Set());
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
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <CustomSelect name="year" label="Year" options={['All', ...YEAR_OPTIONS]} value={filters.year} onChange={(name, val) => handleFilterChange(name, val)} />
                <div className="xl:col-span-2">
                    <CustomSelect name="branch" label="Branch" options={['All', ...BRANCH_OPTIONS]} value={filters.branch} onChange={(name, val) => handleFilterChange(name, val)} />
                </div>
                <CustomSelect name="studentType" label="Student Type" options={['All', ...STUDENT_TYPE_OPTIONS]} value={filters.studentType} onChange={(name, val) => handleFilterChange(name, val)} />
                <CustomSelect name="gender" label="Gender" options={['All', ...GENDER_OPTIONS]} value={filters.gender} onChange={(name, val) => handleFilterChange(name, val)} />
                 <div className="flex items-end">
                    <button onClick={clearFilters} className="w-full bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition duration-300">Clear Filters</button>
                </div>
            </div>
             <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search by name, roll no, etc..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input type="checkbox" checked={filters.missingPhoto} onChange={handleMissingPhotoToggle} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                    <span className="text-gray-700 font-medium">Show only students with missing photos</span>
                </label>
            </div>
        </div>
        
        {selectedStudentIds.size > 0 && (
          <div className="px-6 py-3 bg-sky-100/70 rounded-t-lg border-x border-t border-gray-200 flex justify-between items-center transition-all duration-300">
            <span className="font-semibold text-sky-800">{selectedStudentIds.size} selected</span>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-700 rounded-full transition-colors"
              title="Delete selected"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        <div className={`overflow-x-auto border ${selectedStudentIds.size > 0 ? 'rounded-b-lg border-t-0' : 'rounded-lg'}`}>
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3">
                    <div className="flex justify-center items-center">
                        <input 
                            type="checkbox" 
                            ref={headerCheckboxRef}
                            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            onChange={handleSelectAll}
                        />
                    </div>
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
                <tr 
                  key={student.id} 
                  className={`transition-colors duration-150 ${selectedStudentIds.has(student.id) ? 'bg-sky-100/70' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex justify-center items-center">
                        <input 
                            type="checkbox"
                            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={(e) => handleSelectOne(student.id, e.target.checked)}
                        />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative w-10 h-10">
                        {student.faceImage ? (
                            <img src={student.faceImage} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center" title="Biometric data missing. Please edit to add a photo.">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                </div>
                                <div className="absolute -top-1 -right-1" title="Photo missing">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 bg-white rounded-full" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedStudent(student)}>
                        {student.name}
                    </span>
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
              No students found matching your criteria.
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