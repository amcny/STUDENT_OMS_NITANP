

import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Student, View } from '../types';
import StudentProfileModal from './StudentProfileModal';
import EditStudentModal from './EditStudentModal';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './CustomSelect';
import * as firebaseService from '../services/firebaseService';
import { BRANCH_OPTIONS, YEAR_OPTIONS, GENDER_OPTIONS, STUDENT_TYPE_OPTIONS } from '../constants';
import Modal from './Modal';

// Allow global XLSX var from CDN
declare var XLSX: any;

const SECURITY_PIN = '200405';

interface AllStudentsProps {
  onViewChange: (view: View) => void;
}

const AllStudents: React.FC<AllStudentsProps> = ({ onViewChange }) => {
  const { students, role } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    year: 'All',
    branch: 'All',
    studentType: 'All',
    gender: 'All',
    missingPhoto: false,
    incompleteData: false,
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteConfig, setBulkDeleteConfig] = useState<{
      students: Student[];
      hasExported: boolean;
  }>({ students: [], hasExported: false });
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);

  const [pinAction, setPinAction] = useState<{ action: 'singleDelete'; student: Student } | { action: 'bulkDelete' } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  
  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxFilterToggle = (name: 'missingPhoto' | 'incompleteData') => {
    setFilters(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const clearFilters = () => {
    setFilters({
      year: 'All',
      branch: 'All',
      studentType: 'All',
      gender: 'All',
      missingPhoto: false,
      incompleteData: false,
    });
    setSearchTerm('');
  };

  const handleUpdateStudent = async (updatedStudent: Student, newPhotoBase64?: string | null) => {
    await firebaseService.updateStudent(updatedStudent.id, updatedStudent, newPhotoBase64);
  };
  
  const handlePinConfirm = async () => {
    if (pinInput !== SECURITY_PIN) {
        setPinError('Incorrect PIN. Please try again.');
        setPinInput('');
        return;
    }

    try {
        if (pinAction?.action === 'singleDelete') {
            await firebaseService.deleteStudent(pinAction.student);
        } else if (pinAction?.action === 'bulkDelete') {
            const studentsToDelete = students.filter(s => selectedStudentIds.has(s.id));
            await firebaseService.deleteStudentsBatch(studentsToDelete);
            setSelectedStudentIds(new Set());
            setIsBulkSelectMode(false);
        }
    } catch (error) {
        console.error("Deletion failed:", error);
        // Optionally show an alert to the user
    }

    setPinAction(null);
    setPinInput('');
    setPinError('');
  };

  const handlePinModalClose = () => {
      setPinAction(null);
      setPinInput('');
      setPinError('');
  };

  const handleCancelBulkSelect = () => {
    setIsBulkSelectMode(false);
    setSelectedStudentIds(new Set());
  };

  // Helper to identify missing fields
  const getMissingFields = (student: Student): string[] => {
      const missing: string[] = [];
      if (!student.name) missing.push('Name');
      if (!student.rollNumber) missing.push('Roll No');
      if (!student.branch) missing.push('Branch');
      if (!student.year) missing.push('Year');
      if (!student.gender) missing.push('Gender');
      if (!student.contactNumber) missing.push('Contact');
      if (!student.studentType) missing.push('Student Type');
      
      if (student.studentType === 'Hosteller') {
          if (!student.hostel) missing.push('Hostel');
          if (!student.roomNumber) missing.push('Room No');
      }
      return missing;
  };

  const sortedAndFilteredStudents = useMemo(() => {
    let filtered = students.filter(student => {
        if (filters.year !== 'All' && student.year !== filters.year) return false;
        if (filters.branch !== 'All' && student.branch !== filters.branch) return false;
        if (filters.studentType !== 'All' && student.studentType !== filters.studentType) return false;
        if (filters.gender !== 'All' && student.gender !== filters.gender) return false;
        if (filters.missingPhoto && student.faceImage !== null) return false;
        
        if (filters.incompleteData) {
            const missing = getMissingFields(student);
            if (missing.length === 0) return false;
        }
        
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
      return a.rollNumber.localeCompare(b.rollNumber);
    });

    return filtered;
  }, [students, searchTerm, filters]);
  
  useEffect(() => {
    if (isBulkSelectMode && headerCheckboxRef.current) {
        const numSelected = selectedStudentIds.size;
        const numStudents = sortedAndFilteredStudents.length;
        const allSelected = numStudents > 0 && numSelected === numStudents;
        headerCheckboxRef.current.checked = allSelected;
        headerCheckboxRef.current.indeterminate = numSelected > 0 && !allSelected;
    }
  }, [selectedStudentIds, sortedAndFilteredStudents, isBulkSelectMode]);
  
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

    const handleInitiateBulkDelete = () => {
        const studentsToDelete = sortedAndFilteredStudents.filter(s => selectedStudentIds.has(s.id));
        setBulkDeleteConfig({ students: studentsToDelete, hasExported: false });
        setIsBulkDeleteModalOpen(true);
    };

    const exportStudents = (studentsToExport: Student[], fileName: string): boolean => {
        if (typeof XLSX === 'undefined') {
            console.error("XLSX library is not loaded.");
            alert("Could not export to Excel. The required library is missing.");
            return false;
        }
        if (studentsToExport.length === 0) {
            alert("No students selected to export.");
            return false;
        }
        const dataToExport = studentsToExport.map(student => ({
            "Name": student.name,
            "Roll Number": student.rollNumber,
            "Branch": student.branch,
            "Year": student.year,
            "Gender": student.gender,
            "Student Type": student.studentType,
            "Hostel": student.hostel || 'N/A',
            "Room Number": student.roomNumber || 'N/A',
            "Contact Number": student.contactNumber,
            "Photo URL": student.faceImage || 'N/A',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Student Records");

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

    const handleExportForDeletion = () => {
        const success = exportStudents(
            bulkDeleteConfig.students,
            `DELETION_EXPORT_Students_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
        if (success) {
            setBulkDeleteConfig(prev => ({ ...prev, hasExported: true }));
        }
    };
    
    const handleProceedToPin = () => {
        setIsBulkDeleteModalOpen(false);
        setPinAction({ action: 'bulkDelete' });
        setPinError('');
        setPinInput('');
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
                <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filters.missingPhoto} onChange={() => handleCheckboxFilterToggle('missingPhoto')} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                        <span className="text-gray-700 font-medium">Missing Photo</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input type="checkbox" checked={filters.incompleteData} onChange={() => handleCheckboxFilterToggle('incompleteData')} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                        <span className="text-gray-700 font-medium">Incomplete Data</span>
                    </label>
                </div>
            </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-700">
                {isBulkSelectMode
                    ? `${selectedStudentIds.size} student(s) selected`
                    : `${sortedAndFilteredStudents.length} Students Found`
                }
            </h3>
            <div className="flex items-center space-x-4">
                {isBulkSelectMode ? (
                    <>
                        <button
                            onClick={handleInitiateBulkDelete}
                            disabled={selectedStudentIds.size === 0}
                            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400"
                            title="Delete selected students"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete Selected</span>
                        </button>
                        <button
                            onClick={handleCancelBulkSelect}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    role === 'admin' && (
                        <button
                            onClick={() => setIsBulkSelectMode(true)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            <span>Bulk Select</span>
                        </button>
                    )
                )}
            </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                {isBulkSelectMode && (
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
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Photo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                {role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAndFilteredStudents.map(student => {
                  const missingFields = getMissingFields(student);
                  return (
                    <tr 
                      key={student.id} 
                      className={`transition-colors duration-150 ${isBulkSelectMode && selectedStudentIds.has(student.id) ? 'bg-sky-100/70' : 'hover:bg-gray-50'}`}
                    >
                      {isBulkSelectMode && (
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
                      )}
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
                        <div className="flex items-center">
                            <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedStudent(student)}>
                                {student.name}
                            </span>
                            {missingFields.length > 0 && (
                                <div className="ml-2 relative group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 cursor-help" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        Missing: {missingFields.join(', ')}
                                    </div>
                                </div>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.rollNumber || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.branch || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.year || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.contactNumber || '-'}</td>
                      {role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-4">
                            <button onClick={() => setStudentToEdit(student)} className="text-gray-500 hover:text-indigo-600 transition-colors" title="Edit Student">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                            </button>
                            <button onClick={() => setPinAction({ action: 'singleDelete', student })} className="text-gray-500 hover:text-red-600 transition-colors" title="Delete Student">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                            </button>
                            </div>
                        </td>
                      )}
                    </tr>
                  )
              })}
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
      
    <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Bulk Student Deletion">
        <div className="space-y-6">
            <div>
                <div className="flex items-center space-x-3 mb-3">
                    <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full text-lg">1</span>
                    <h4 className="font-semibold text-xl text-gray-800">Confirm Selection</h4>
                </div>
                <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                    <div className="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-lg font-semibold text-red-800">
                            This will permanently delete <strong className="font-bold text-red-900">{bulkDeleteConfig.students.length}</strong> selected student record(s).
                        </p>
                    </div>
                </div>
            </div>
            <div>
                <div className="flex items-center space-x-3 mb-3">
                    <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.students.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
                    <h4 className="font-semibold text-xl text-gray-800">Export for Archiving (Required)</h4>
                </div>
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                    <div className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h4 className="font-bold">Important!</h4>
                            <p className="text-sm">Once records are deleted, they cannot be recovered. You must export the data for your records before proceeding.</p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={handleExportForDeletion} 
                    disabled={bulkDeleteConfig.students.length === 0}
                    className="mt-3 w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400 flex items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H7V7a3 3 0 013-3z" />
                    </svg>
                    <span>Export {bulkDeleteConfig.students.length} Records</span>
                </button>
            </div>
            <div>
                <div className="flex items-center space-x-3 mb-3">
                    <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.hasExported ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
                    <h4 className="font-semibold text-xl text-gray-800">Confirm Deletion</h4>
                </div>
                <button 
                    onClick={handleProceedToPin} 
                    disabled={!bulkDeleteConfig.hasExported || bulkDeleteConfig.students.length === 0}
                    className="w-full bg-red-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    title={!bulkDeleteConfig.hasExported ? "Please export the records first" : ""}
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
              {pinAction?.action === 'singleDelete' ? (
                  <span>
                      To confirm the deletion of <strong className="text-red-600">{pinAction.student.name}</strong>, please enter the security PIN.
                  </span>
              ) : (
                  <span>
                      To confirm the deletion of <strong className="text-red-600">{selectedStudentIds.size}</strong> student(s), please enter the security PIN.
                  </span>
              )}
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
                <button onClick={handlePinConfirm} className={`px-6 py-2 text-white rounded-lg font-semibold bg-red-600 hover:bg-red-700`}>
                    Confirm & Delete
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default AllStudents;