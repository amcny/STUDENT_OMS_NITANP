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
        <div className="flex-shrink-0">
          <img
            src={student.faceImage}
            alt={`${student.name}'s profile`}
            className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-gray-200"
          />
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
            </dl>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StudentProfileModal;
