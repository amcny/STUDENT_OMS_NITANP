import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { OutingRecord } from '../types';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (logId: string, remarks: string) => void;
  log: OutingRecord | null;
}

const RemarksModal: React.FC<RemarksModalProps> = ({ isOpen, onClose, onSave, log }) => {
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (log) {
      setRemarks(log.remarks || '');
    }
  }, [log]);

  if (!isOpen || !log) return null;

  const handleSave = () => {
    onSave(log.id, remarks);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Remarks for ${log.studentName}`}>
      <div>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={5}
          className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white"
          placeholder="Enter remarks here..."
          aria-label="Remarks"
        />
      </div>
      <div className="flex justify-end space-x-4 mt-4">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
        >
          Save
        </button>
      </div>
    </Modal>
  );
};

export default RemarksModal;
