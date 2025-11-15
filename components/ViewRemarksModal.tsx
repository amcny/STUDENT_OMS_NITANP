import React from 'react';
import Modal from './Modal';
import { OutingRecord } from '../types';

interface ViewRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: OutingRecord | null;
}

const ViewRemarksModal: React.FC<ViewRemarksModalProps> = ({ isOpen, onClose, log }) => {
  if (!isOpen || !log) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Remarks for ${log.studentName}`}>
      <div className="max-h-64 overflow-y-auto bg-slate-50 p-4 rounded-md border">
        <p className="text-gray-700 whitespace-pre-wrap">
          {log.remarks || 'No remarks have been added for this record.'}
        </p>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-semibold"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ViewRemarksModal;
