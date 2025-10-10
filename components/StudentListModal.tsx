import React, { useState } from 'react';
import { Student } from '../types';
import Modal from './Modal';
import StudentProfileModal from './StudentProfileModal';

interface StudentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  title: string;
}

const StudentListModal: React.FC<StudentListModalProps> = ({ isOpen, onClose, students, title }) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
  };

  const handleProfileClose = () => {
    setSelectedStudent(null);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        {students.length > 0 ? (
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {students.map(student => (
              <li key={student.id} className="p-4 hover:bg-gray-100 cursor-pointer flex items-center space-x-4" onClick={() => handleStudentClick(student)}>
                <img className="h-12 w-12 rounded-full object-cover" src={student.faceImage} alt={student.name} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">{student.rollNumber}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500 py-8">No students to display.</p>
        )}
      </Modal>

      <StudentProfileModal 
        isOpen={!!selectedStudent} 
        onClose={handleProfileClose}
        student={selectedStudent} 
      />
    </>
  );
};

export default StudentListModal;
