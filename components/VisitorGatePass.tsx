import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { VisitorPassRecord } from '../types';
import Alert from './Alert';
import ConfirmationModal from './ConfirmationModal';
import GatePassPreviewModal from './GatePassPreviewModal';

// Allow TypeScript to recognize the XLSX global variable from the script tag
declare var XLSX: any;

const INITIAL_FORM_DATA = {
  name: '',
  relation: '',
  mobileNumber: '',
  address: '',
  vehicleNumber: '',
  whomToMeet: '',
  placeToVisit: '',
  personToMeetMobile: '',
  purpose: '',
};

type SortKey = 'name' | 'inTime' | 'outTime' | 'whomToMeet' | 'gateName' | 'outGateName';
type SortDirection = 'ascending' | 'descending';

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  sortConfig: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === sortKey;
  const icon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕';
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center">
        <span>{label}</span><span className="ml-2 text-gray-400">{icon}</span>
      </div>
    </th>
  );
};

interface VisitorGatePassProps {
    gate: string;
}

const VisitorGatePass: React.FC<VisitorGatePassProps> = ({ gate }) => {
    const { visitorLogs, setVisitorLogs } = useContext(AppContext);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Logbook states
    const [filter, setFilter] = useState<'all' | 'inside' | 'departed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'inTime', direction: 'descending' });
    
    // Modal states
    const [passToPreview, setPassToPreview] = useState<VisitorPassRecord | null>(null);
    const [logToMarkOut, setLogToMarkOut] = useState<VisitorPassRecord | null>(null);
    const [logToDelete, setLogToDelete] = useState<VisitorPassRecord | null>(null);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const uppercaseFields = ['name', 'relation', 'address', 'vehicleNumber', 'whomToMeet', 'placeToVisit', 'purpose'];
        const processedValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const generatePassNumber = () => {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const todayLogs = visitorLogs.filter(log => log.date === today.toISOString().slice(0, 10));
        const nextId = (todayLogs.length + 1).toString().padStart(3, '0');
        return `V${dateStr}-${nextId}`;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotification(null);

        try {
            const now = new Date();
            const newPass: VisitorPassRecord = {
                id: crypto.randomUUID(),
                passNumber: generatePassNumber(),
                date: now.toISOString().slice(0, 10),
                inTime: now.toISOString(),
                outTime: null,
                gateName: gate,
                outGateName: null,
                ...formData,
            };

            setVisitorLogs(prev => [newPass, ...prev]);
            setNotification({ message: 'Visitor pass generated successfully!', type: 'success' });
            setFormData(INITIAL_FORM_DATA);
            setPassToPreview(newPass); // Open preview modal
        } catch (error) {
            console.error("Error generating pass:", error);
            setNotification({ message: 'Failed to generate pass. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString();
    };
    
    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleConfirmMarkOut = () => {
        if (!logToMarkOut) return;
        setVisitorLogs(prev => prev.map(log => log.id === logToMarkOut.id ? { ...log, outTime: new Date().toISOString(), outGateName: gate } : log));
        setLogToMarkOut(null);
    };

    const handleDeleteLog = () => {
        if (!logToDelete) return;
        setVisitorLogs(prev => prev.filter(log => log.id !== logToDelete.id));
        setLogToDelete(null);
    };

    const sortedAndFilteredLogs = useMemo(() => {
        return visitorLogs
          .filter(log => {
            if (filter === 'inside') return log.outTime === null;
            if (filter === 'departed') return log.outTime !== null;
            return true;
          })
          .filter(log => {
              const term = searchTerm.toLowerCase();
              return Object.values(log).some(val => String(val).toLowerCase().includes(term));
          })
          .sort((a, b) => {
            const key = sortConfig.key;
            let valA = a[key as keyof VisitorPassRecord];
            let valB = b[key as keyof VisitorPassRecord];
            
            // Handle nulls for sortable fields that can be null
            if (key === 'outTime' || key === 'outGateName') {
                const directionMultiplier = sortConfig.direction === 'ascending' ? 1 : -1;
                if (valA === null && valB !== null) return 1 * directionMultiplier;
                if (valA !== null && valB === null) return -1 * directionMultiplier;
                if (valA === null && valB === null) return 0;
            }

            if (key === 'inTime' || key === 'outTime') {
                valA = new Date(valA as string).getTime();
                valB = new Date(valB as string).getTime();
            }

            if (valA! < valB!) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA! > valB!) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
          });
    }, [visitorLogs, filter, searchTerm, sortConfig]);
    
    const handleExportToExcel = () => {
        if (typeof XLSX === 'undefined') {
            console.error("XLSX library is not loaded.");
            window.alert("Could not export to Excel. The required library is missing.");
            return;
        }

        const dataToExport = sortedAndFilteredLogs.map(log => {
            return {
                "Pass Number": log.passNumber,
                "Date": new Date(log.date).toLocaleDateString(),
                "Visitor Name": log.name,
                "Relation": log.relation,
                "Mobile Number": log.mobileNumber,
                "Address": log.address,
                "Vehicle Number": log.vehicleNumber || 'N/A',
                "Whom to Meet": log.whomToMeet,
                "Person's Mobile": log.personToMeetMobile || 'N/A',
                "Place to Visit": log.placeToVisit,
                "Purpose of Visit": log.purpose,
                "In-Time": formatDateTime(log.inTime),
                "Out-Time": formatDateTime(log.outTime),
                "In-Gate": log.gateName,
                "Out-Gate": log.outGateName || 'N/A',
                "Status": log.outTime ? 'Departed' : 'On Campus',
            };
        });

        if (dataToExport.length === 0) {
            window.alert("No data to export.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Visitor Logs");

        const colWidths = Object.keys(dataToExport[0]).map(key => ({
            wch: Math.max(
                key.length,
                ...dataToExport.map(row => (row[key as keyof typeof row] || '').toString().length)
            ) + 2
        }));
        worksheet["!cols"] = colWidths;

        XLSX.writeFile(workbook, "Visitor_Logbook.xlsx");
    };


    const baseFieldClasses = "w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-5xl mx-auto">
                <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Create Visitor Gate Pass</h2>
                {notification && <div className="mb-6"><Alert message={notification.message} type={notification.type} onClose={() => setNotification(null)} /></div>}
                
                <form onSubmit={handleSubmit} className="space-y-8">
                    <section>
                        <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Visitor's Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border">
                            <div><label className="block text-gray-700 font-medium mb-1">Full Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Relation</label><input type="text" name="relation" value={formData.relation} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} placeholder="e.g., PARENT, SIBLING, FRIEND"/></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Mobile Number</label><input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} required className={baseFieldClasses} /></div>
                            <div className="md:col-span-2"><label className="block text-gray-700 font-medium mb-1">Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Vehicle Number (Optional)</label><input type="text" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} className={`${baseFieldClasses} uppercase`} /></div>
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Purpose of Visit</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border">
                            <div><label className="block text-gray-700 font-medium mb-1">Whom to Meet</label><input type="text" name="whomToMeet" value={formData.whomToMeet} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Place to Visit</label><input type="text" name="placeToVisit" value={formData.placeToVisit} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Person's Mobile (Optional)</label><input type="tel" name="personToMeetMobile" value={formData.personToMeetMobile} onChange={handleInputChange} className={baseFieldClasses} /></div>
                            <div className="md:col-span-2"><label className="block text-gray-700 font-medium mb-1">Purpose</label><textarea name="purpose" value={formData.purpose} onChange={handleInputChange} required rows={3} className={`${baseFieldClasses} uppercase`}></textarea></div>
                        </div>
                    </section>
                    <div className="mt-8 border-t pt-6"><button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 text-lg flex justify-center items-center disabled:bg-blue-400 disabled:cursor-wait">{isSubmitting ? 'Submitting...' : 'Generate & Preview Pass'}</button></div>
                </form>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Visitor Logbook</h2>
                 <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
                  <div className="flex space-x-2">
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>All</button>
                    <button onClick={() => setFilter('inside')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'inside' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}>On Campus</button>
                    <button onClick={() => setFilter('departed')} className={`px-4 py-2 text-sm font-medium rounded-md ${filter === 'departed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>Departed</button>
                  </div>
                  <div className="flex items-center space-x-4 w-full md:w-auto">
                    <input type="text" placeholder="Search Logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 bg-gray-100" />
                    <button
                        onClick={handleExportToExcel}
                        className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                        title="Export current view to Excel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>Export</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Pass No.</th>
                                <SortableHeader label="Visitor Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Whom to Meet" sortKey="whomToMeet" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="In Time" sortKey="inTime" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="In Gate" sortKey="gateName" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Out Time" sortKey="outTime" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Out Gate" sortKey="outGateName" sortConfig={sortConfig} onSort={handleSort} />
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sortedAndFilteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{log.passNumber}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{log.whomToMeet}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.inTime)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{log.gateName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(log.outTime)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{log.outGateName || 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {log.outTime ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Departed</span> : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">On Campus</span>}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-4">
                                            {!log.outTime && <button onClick={() => setLogToMarkOut(log)} className="text-green-600 hover:text-green-900" title="Mark as Out">✓ Out</button>}
                                            <button onClick={() => setPassToPreview(log)} className="text-blue-600 hover:text-blue-900" title="Reprint Pass">🖨️ Print</button>
                                            <button onClick={() => setLogToDelete(log)} className="text-red-600 hover:text-red-900" title="Delete Log">🗑️ Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sortedAndFilteredLogs.length === 0 && <div className="text-center py-10 text-gray-500">No visitor logs found.</div>}
                </div>
            </div>

            <GatePassPreviewModal isOpen={!!passToPreview} onClose={() => setPassToPreview(null)} passData={passToPreview} />

            <ConfirmationModal isOpen={!!logToMarkOut} onClose={() => setLogToMarkOut(null)} onConfirm={handleConfirmMarkOut} title="Confirm Departure" message={<span>Are you sure you want to mark <strong>{logToMarkOut?.name}</strong> as departed?</span>} confirmButtonText="Confirm" confirmButtonClassName="bg-green-600 hover:bg-green-700" />
            <ConfirmationModal isOpen={!!logToDelete} onClose={() => setLogToDelete(null)} onConfirm={handleDeleteLog} title="Delete Visitor Log" message={<span>Are you sure you want to delete the pass for <strong>{logToDelete?.name}</strong>? This action cannot be undone.</span>} />

        </div>
    );
};

export default VisitorGatePass;