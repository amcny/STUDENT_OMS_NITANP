import React, { useRef } from 'react';
import Modal from './Modal';
import { VisitorPassRecord } from '../types';

// Inform TypeScript about the global variables from script tags
declare var jspdf: any;
declare var html2canvas: any;

interface GatePassPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  passData: VisitorPassRecord | null;
}

const GatePassPreviewModal: React.FC<GatePassPreviewModalProps> = ({ isOpen, onClose, passData }) => {
  const passRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !passData) return null;

  const handlePrint = async () => {
    const elementToCapture = passRef.current;
    if (!elementToCapture) return;

    try {
      // Wait for all fonts in the document to be loaded and ready.
      // This is the most reliable way to prevent layout shifts from font loading.
      await document.fonts.ready;
      
      // A minimal extra delay can help ensure the browser has completed its final paint cycle.
      await new Promise(resolve => setTimeout(resolve, 50));

      const canvas = await html2canvas(elementToCapture, {
          scale: 3, // Higher scale for better resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          // Use the element's exact dimensions for a more accurate capture
          width: elementToCapture.offsetWidth,
          height: elementToCapture.offsetHeight,
          removeContainer: true,
      });

      const imgData = canvas.toDataURL('image/png');
      // Create a portrait A4 PDF
      const pdf = new jspdf.jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
      });

      const a4Width = 210;
      // Half of A4 height for an A5 landscape area
      const a4HalfHeight = 148.5;

      // Margins for the content within the A5 area
      const margin = 10;
      const contentWidth = a4Width - (margin * 2);
      const contentHeight = a4HalfHeight - (margin * 2);

      const canvasAspectRatio = canvas.width / canvas.height;
      let imgWidth = contentWidth;
      let imgHeight = imgWidth / canvasAspectRatio;

      // If the calculated height exceeds the available content area, resize based on height instead
      if (imgHeight > contentHeight) {
          imgHeight = contentHeight;
          imgWidth = imgHeight * canvasAspectRatio;
      }

      // Center the image within the top A5 portion of the A4 page
      const x = (a4Width - imgWidth) / 2;
      const y = margin; // Place it at the top margin

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
          printWindow.onload = () => {
              printWindow.print();
          }
      } else {
          alert("Please allow popups for this website to print the pass.");
      }
    } catch (error) {
        console.error("Printing failed:", error);
        alert("Sorry, an error occurred while trying to print the pass.");
    }
  };
  
  const DetailItem: React.FC<{ label: string; value: string | undefined | null; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`break-inside-avoid mb-3 ${className}`}>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-900 font-medium" title={value || ''}>{value || 'N/A'}</p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Visitor Pass Preview" size="4xl">
      <div className="space-y-4">
        {/* The layout is now a direct, robust flex column to prevent content shifts */}
        <div ref={passRef} className="bg-white p-4 border-2 border-black aspect-[1.414/1] flex flex-col" style={{ width: '100%' }}>
            {/* This div will take up all available vertical space, pushing the footer down */}
            <div className="flex-grow">
                <header className="flex items-center gap-4 border-b-2 border-black pb-2 text-gray-800">
                    <svg className="w-16 h-16 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-5.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path d="M12 14l9-5-9-5-9 5 9 5z" transform="translate(0, 6)"></path></svg>
                    <div className="text-center flex-grow">
                        <h1 className="text-xl font-bold">NATIONAL INSTITUTE OF TECHNOLOGY, ANDHRA PRADESH</h1>
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
                         <div className="grid grid-cols-2 gap-x-4">
                            <DetailItem label="Whom to Meet" value={passData.whomToMeet} />
                            <DetailItem label="Place to Visit" value={passData.placeToVisit} />
                             <DetailItem label="Purpose" value={passData.purpose} className="col-span-2"/>
                        </div>
                    </div>
                    <div className="col-span-4 flex flex-col items-start justify-start border-l-2 pl-4 space-y-3">
                       <DetailItem label="Pass Number" value={passData.passNumber} />
                       <DetailItem label="Date" value={new Date(passData.date).toLocaleDateString()} />
                       <DetailItem label="Gate" value={passData.gateName} />
                    </div>
                </div>
            </div>

            {/* This footer will not shrink and is guaranteed to stay at the bottom */}
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