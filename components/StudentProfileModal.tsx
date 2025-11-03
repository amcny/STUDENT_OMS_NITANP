import React from 'react';
import { Student } from '../types';
import Modal from './Modal';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ isOpen, onClose, student }) => {
  if (!student) return null;

  const detailItem = (label: string, value: string | undefined) => (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || 'N/A'}</dd>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student Profile">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0 mx-auto">
          {student.faceImage ? (
            <img
              src={student.faceImage}
              alt={`${student.name}'s profile`}
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center border-4 border-gray-200" title="Biometric data missing">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
            </div>
          )}
        </div>
        <div className="flex-grow">
          <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
          <p className="text-sm text-gray-500">{student.rollNumber}</p>
          <div className="mt-4 border-t border-gray-200">
            <dl className="divide-y divide-gray-200">
              {detailItem('Registration No.', student.registrationNumber)}
              {detailItem('Branch', student.branch)}
              {detailItem('Year', student.year)}
              {detailItem('Gender', student.gender)}
              {detailItem('Contact', student.contactNumber)}
              {detailItem('Student Type', student.studentType)}
              {student.studentType === 'Hosteller' && detailItem('Hostel', student.hostel)}
              {student.studentType === 'Hosteller' && detailItem('Room Number', student.roomNumber)}
            </dl>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StudentProfileModal;