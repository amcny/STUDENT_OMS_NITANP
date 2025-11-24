
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
            <header className="border-b-2 border-black pb-2 text-gray-800">
                <div className="text-center">
                    <h2 className="text-xl font-bold">NATIONAL INSTITUTE OF TECHNOLOGY, ANDHRA PRADESH</h2>
                    <p className="text-xs font-semibold">TADEPALLIGUDEM - 534101</p>
                </div>
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
                        <div className="grid grid-cols-2 gap-x-4">
                             <DetailItem label="Whom to Meet" value={passData.whomToMeet} />
                             <DetailItem label="Person Type" value={passData.personType} />
                        </div>
                        <DetailItem label="Place to Visit" value={passData.placeToVisit} />
                        <DetailItem label="Purpose" value={passData.purpose} />
                    </div>
                </div>
                <div className="col-span-4 flex flex-col items-start justify-start border-l-2 pl-4 space-y-3">
                   <DetailItem label="Pass Number" value={passData.passNumber} />
                   {/* Date removed as per request */}
                </div>
            </div>
        </div>

        <footer className="border-t-2 border-black pt-2 flex-shrink-0">
            <div className="grid grid-cols-2 gap-x-4">
                 <div>
                    <DetailItem label="In-Time" value={new Date(passData.inTime).toLocaleString('en-IN')} />
                    <DetailItem label="In-Gate" value={passData.gateName} />
                </div>
                <div>
                    <DetailItem label="Out-Time" value={passData.outTime ? new Date(passData.outTime).toLocaleString('en-IN') : ''} />
                    <DetailItem label="Out-Gate" value={passData.outGateName} />
                </div>
            </div>
            <div className="flex justify-between items-end mt-1">
                <div>
                     <p className="text-[10px] font-bold text-gray-600">Note: This pass is valid for single entry on the day of issue only.</p>
                     <p className="text-[10px] text-gray-500">Issued by: Security Office</p>
                </div>
                <div className="text-center">
                    <div className="h-8"></div>
                    <p className="text-xs border-t border-black px-8 pt-1 text-black font-bold">Authorised Signatory</p>
                </div>
            </div>
        </footer>
    </div>
  );
};

const GatePassPreviewModal: React.FC<GatePassPreviewModalProps> = ({ isOpen, onClose, passData }) => {
  if (!isOpen || !passData) return null;

  const handleStandardPrint = () => {
    const printContentEl = document.getElementById('pass-layout-container');
    if (!printContentEl) return;

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
                margin: 1in;
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
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 1000);
  };

  const handleThermalPrint = () => {
    const printWindow = window.open('', '_blank', 'height=600,width=400');
    if (!printWindow) {
      alert('Please allow pop-ups.');
      return;
    }

    // Thermal Receipt Layout (80mm width)
    // Optimized for standard 80mm thermal printers with proper margins
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visitor Pass - Thermal</title>
          <style>
            @page {
                margin: 0;
                size: 80mm auto;
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 4mm 5mm; /* Top/Bottom: 4mm, Left/Right: 5mm for safe printing area */
                width: 80mm;
                box-sizing: border-box;
                font-size: 12px;
                color: black;
                line-height: 1.3;
                background: white;
            }
            .header { 
                text-align: center; 
                margin-bottom: 8px; 
                border-bottom: 2px solid black; 
                padding-bottom: 5px; 
            }
            .logo { 
                font-weight: 800; 
                font-size: 15px; 
                display: block; 
                margin-bottom: 2px;
                line-height: 1.2;
            }
            .sub { 
                font-size: 11px; 
                display: block; 
                color: #222;
            }
            .pass-title { 
                text-align: center; 
                font-weight: 900; 
                font-size: 16px; 
                margin: 10px 0; 
                border: 2px solid black; 
                padding: 6px; 
                background: #eee;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                text-transform: uppercase;
            }
            .section { 
                margin-bottom: 10px; 
                border-bottom: 1px dashed #444; 
                padding-bottom: 8px; 
            }
            .section:last-of-type {
                border-bottom: none;
            }
            .row { 
                display: flex; 
                margin-bottom: 3px;
                align-items: baseline;
            }
            .label { 
                font-weight: bold; 
                width: 35%; 
                flex-shrink: 0; 
                font-size: 11px; 
                text-transform: uppercase; 
                color: #333;
            }
            .value { 
                width: 65%; 
                word-wrap: break-word; 
                font-weight: 700; 
                font-size: 13px;
                color: black;
            }
            .footer { 
                text-align: center; 
                margin-top: 15px; 
                border-top: 2px solid black; 
                padding-top: 8px; 
                font-size: 11px; 
                font-weight: bold; 
            }
            
            @media print {
                body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <span class="logo">NIT ANDHRA PRADESH</span>
            <span class="sub">Tadepalligudem - 534101</span>
            <span class="sub" style="margin-top:4px;">${new Date().toLocaleString('en-IN')}</span>
          </div>

          <div class="pass-title">VISITOR PASS</div>

          <div class="section">
            <div class="row"><span class="label">Pass No:</span><span class="value" style="font-size:15px; font-weight:900;">${passData.passNumber}</span></div>
            <div class="row"><span class="label">Name:</span><span class="value" style="font-size:14px; font-weight:800; text-transform: uppercase;">${passData.name}</span></div>
            <div class="row"><span class="label">Phone:</span><span class="value">${passData.mobileNumber}</span></div>
            <div class="row"><span class="label">Relation:</span><span class="value">${passData.relation}</span></div>
            <div class="row"><span class="label">Vehicle:</span><span class="value">${passData.vehicleNumber || '-'}</span></div>
          </div>

          <div class="section">
            <div class="row"><span class="label">To Meet:</span><span class="value" style="font-size:13px; font-weight:700; text-transform: uppercase;">${passData.whomToMeet}</span></div>
            <div class="row"><span class="label">Type:</span><span class="value">${passData.personType}</span></div>
            <div class="row"><span class="label">Location:</span><span class="value">${passData.placeToVisit}</span></div>
            <div class="row"><span class="label">Purpose:</span><span class="value">${passData.purpose}</span></div>
          </div>
          
          <div class="section">
             <div class="row"><span class="label">In Gate:</span><span class="value">${passData.gateName}</span></div>
             <div class="row"><span class="label">In Time:</span><span class="value">${new Date(passData.inTime).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</span></div>
          </div>

          <div class="footer">
            <p style="margin-bottom: 25px;">Signature of Security</p>
            <p style="font-size: 10px; margin-bottom: 5px;">Valid for Single Entry Only</p>
            <p style="font-size: 10px; font-weight: normal;">Please return at gate while exiting</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Visitor Pass Preview" size="2xl">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex-1 overflow-auto p-1">
            <div id="pass-layout-container" className="min-w-[600px] mx-auto">
                 <PassLayout passData={passData} />
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-end gap-4 mt-4 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleThermalPrint}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
            <span>Thermal Print (80mm)</span>
          </button>

          <button
            onClick={handleStandardPrint}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
            <span>Standard Print (A5)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GatePassPreviewModal;
