import React from 'react';
import Modal from './Modal';
import { VisitorPassRecord } from '../types';

interface GatePassPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: VisitorPassRecord | null;
}

const DetailItem: React.FC<{ label: string; value: string | undefined | null; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`break-inside-avoid mb-3 ${className}`}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-900 font-medium" title={value || ''}>{value || 'N/A'}</p>
  </div>
);

const PassLayout: React.FC<{ passData: VisitorPassRecord }> = ({ passData }) => {
  return (
    <div style={{ width: '100%' }} className="bg-white p-4 border-2 border-black aspect-[1.414/1] flex flex-col">
        <div className="flex-grow">
            <header className="flex items-center gap-4 border-b-2 border-black pb-2 text-gray-800">
                <svg className="w-16 h-16 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-5.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path d="M12 14l9-5-9-5-9 5 9 5z" transform="translate(0, 6)"></path></svg>
                <div className="text-center flex-grow">
                    <h2 className="text-xl font-bold">NATIONAL INSTITUTE OF TECHNOLOGY, ANDHRA PRADESH</h2>
                    <p className="text-xs font-semibold">TADEPALLIGUDEM - 534101</p>
                </div>
                <div className="w-16 h-16 flex-shrink-0"></div>
            </header>

            <h2 className="text-center text-xl font-bold my-2 p-1 bg-gray-800 text-white tracking-widest">VISITOR GATE PASS</h2>
            
            <div className="grid grid-cols-12 gap-x-4">
                <div className="col-span-8 space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 border-b pb-2">
                        <DetailItem label="Visitor Name" value={passData.name} />
                        <DetailItem label="Mobile Number" value={passData.mobileNumber} />
                        <DetailItem label="Relation" value={passData.relation} />
                        <DetailItem label="Vehicle Number" value={passData.vehicleNumber} />
                        <DetailItem label="Address" value={passData.address} className="col-span-2" />
                    </div>
                     <div>
                        <DetailItem label="Whom to Meet" value={passData.whomToMeet} />
                        <DetailItem label="Place to Visit" value={passData.placeToVisit} />
                         <DetailItem label="Purpose" value={passData.purpose} />
                    </div>
                </div>
                <div className="col-span-4 flex flex-col items-start justify-start border-l-2 pl-4 space-y-3">
                   <DetailItem label="Pass Number" value={passData.passNumber} />
                   <DetailItem label="Date" value={new Date(passData.date).toLocaleDateString()} />
                   <DetailItem label="Gate" value={passData.gateName} />
                </div>
            </div>
        </div>

        <footer className="border-t-2 border-black pt-2 flex-shrink-0">
            <div className="grid grid-cols-2 gap-x-4">
                <DetailItem label="In-Time" value={new Date(passData.inTime).toLocaleString()} />
                <DetailItem label="Out-Time" value={passData.outTime ? new Date(passData.outTime).toLocaleString() : ''} />
            </div>
            <div className="flex justify-between items-end mt-1">
                <div>
                     <p className="text-[10px] font-bold text-gray-600">Note: This pass is valid for single entry on the day of issue only.</p>
                     <p className="text-[10px] text-gray-500">Issued by: Security Office</p>
                </div>
                <div className="text-center">
                    <div className="h-8"></div>
                    <p className="text-xs border-t border-gray-500 px-8 pt-1">Authorised Signatory</p>
                </div>
            </div>
        </footer>
    </div>
  );
};

const GatePassPreviewModal: React.FC<GatePassPreviewModalProps> = ({ isOpen, onClose, passData }) => {
  if (!isOpen || !passData) return null;

  const handlePrint = () => {
    const printContentEl = document.getElementById('pass-layout-container');
    if (!printContentEl) {
      console.error("Could not find the pass content to print.");
      alert("An error occurred. Unable to print the pass.");
      return;
    }

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (!printWindow) {
      alert('Please allow pop-ups for this website to print the pass.');
      return;
    }

    const passHtml = printContentEl.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Visitor Pass</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body {
                margin: 0;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div style="width: 210mm; height: 148.5mm; page-break-after: always;">
            ${passHtml}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500); // A short delay ensures all styles from the CDN are applied before printing.
    };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Visitor Pass Preview" size="4xl">
      <div className="space-y-4">
        <div id="pass-layout-container">
          <PassLayout passData={passData} />
        </div>
        
        <div className="flex justify-end mt-4">
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
            <span>Print Pass</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GatePassPreviewModal;
