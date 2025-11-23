
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { VisitorPassRecord } from '../types';
import * as firebaseService from '../services/firebaseService';
import Alert from './Alert';
import ConfirmationModal from './ConfirmationModal';
import GatePassPreviewModal from './GatePassPreviewModal';
import Modal from './Modal';

// Allow TypeScript to recognize the XLSX global variable from the script tag
declare var XLSX: any;

const SECURITY_PIN = '200405';

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
    const { visitorLogs, role } = useContext(AppContext);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [filter, setFilter] = useState<'all' | 'inside' | 'departed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'inTime', direction: 'descending' });
    
    const [passToPreview, setPassToPreview] = useState<VisitorPassRecord | null>(null);
    const [logToMarkOut, setLogToMarkOut] = useState<VisitorPassRecord | null>(null);
    const [logToDelete, setLogToDelete] = useState<VisitorPassRecord | null>(null);
    
    // State to hold the log specifically for the PIN step, ensuring it persists after ConfirmationModal closes
    const [pinAction, setPinAction] = useState<{ action: 'singleDelete'; log: VisitorPassRecord } | { action: 'bulkDelete' } | null>(null);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    // Bulk Delete State
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [bulkDeleteConfig, setBulkDeleteConfig] = useState<{
        range: '3m' | '6m' | '1y' | 'all';
        logs: VisitorPassRecord[];
        hasExported: boolean;
    }>({ range: '3m', logs: [], hasExported: false });

    const topRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (notification && topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [notification]);

    // Update logs for bulk deletion based on range
    useEffect(() => {
      if (!isBulkDeleteModalOpen) return;
      const now = new Date();
      const getCutoffDate = (range: string): Date | null => {
          const cutoff = new Date(now);
          switch (range) {
              case '3m': cutoff.setMonth(now.getMonth() - 3); return cutoff;
              case '6m': cutoff.setMonth(now.getMonth() - 6); return cutoff;
              case '1y': cutoff.setFullYear(now.getFullYear() - 1); return cutoff;
              case 'all': return null;
              default: return new Date();
          }
      };
      const cutoffDate = getCutoffDate(bulkDeleteConfig.range);
      const logsToPurge = cutoffDate === null ? visitorLogs : visitorLogs.filter(log => new Date(log.inTime) < cutoffDate);
      setBulkDeleteConfig(prev => ({ ...prev, logs: logsToPurge, hasExported: false }));
    }, [isBulkDeleteModalOpen, bulkDeleteConfig.range, visitorLogs]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setNotification(null);

        try {
            const now = new Date();
            const newPassData = {
                passNumber: generatePassNumber(),
                date: now.toISOString().slice(0, 10),
                inTime: now.toISOString(),
                outTime: null,
                gateName: gate,
                outGateName: null,
                ...formData,
            };
            
            // Show preview immediately using the entered data. 
            // This prevents issues where the app might fetch an older/incorrect log 
            // if the database update is slow or if there's an ID collision.
            setPassToPreview({ id: 'new-temp-id', ...newPassData });

            await firebaseService.addVisitorLog(newPassData);
            
            setNotification({ message: 'Visitor pass generated successfully!', type: 'success' });
            setFormData(INITIAL_FORM_DATA);
        } catch (error) {
            console.error("Error generating pass:", error);
            setNotification({ message: 'Failed to generate pass. Please try again.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString('en-IN');
    };
    
    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleConfirmMarkOut = async () => {
        if (!logToMarkOut) return;
        await firebaseService.updateVisitorLog(logToMarkOut.id, { outTime: new Date().toISOString(), outGateName: gate });
        setLogToMarkOut(null);
    };
    
    const handleProceedToPin = () => {
        if (logToDelete) {
            setPinAction({ action: 'singleDelete', log: logToDelete });
        }
    };

    const handleBulkDeleteProceedToPin = () => {
        setPinAction({ action: 'bulkDelete' });
        setIsBulkDeleteModalOpen(false);
        setPinError('');
        setPinInput('');
    };

    const handlePinVerify = async () => {
        if (pinInput !== SECURITY_PIN) {
            setPinError('Incorrect PIN. Please try again.');
            setPinInput('');
            return;
        }
        
        if (!pinAction) return;
        
        try {
            if (pinAction.action === 'singleDelete') {
                await firebaseService.deleteVisitorLog(pinAction.log.id);
                setNotification({ message: `Visitor log for ${pinAction.log.name} deleted successfully.`, type: 'success' });
            } else if (pinAction.action === 'bulkDelete') {
                const idsToDelete = bulkDeleteConfig.logs.map(log => log.id);
                await firebaseService.deleteVisitorLogsBatch(idsToDelete);
                setBulkDeleteConfig({ range: '3m', logs: [], hasExported: false });
                setNotification({ message: `${idsToDelete.length} visitor logs deleted successfully.`, type: 'success' });
            }
        } catch (error) {
            console.error("Failed to delete log:", error);
            setNotification({ message: 'Failed to delete visitor log(s). You may not have permission.', type: 'error' });
        } finally {
            setPinAction(null);
            setPinInput('');
            setPinError('');
        }
    };
    
    const handleClosePinModal = () => {
        setPinAction(null);
        setPinInput('');
        setPinError('');
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
            
            if (key === 'outTime' || key === 'outGateName') {
                const directionMultiplier = sortConfig.direction === 'ascending' ? 1 : -1;
                if (valA === null && valB !== null) return 1 * directionMultiplier;
                if (valA !== null && valB === null) return -1 * directionMultiplier;
                if (valA === null && valB === null) return 0;
            }

            if (key === 'inTime' || key === 'outTime') {
                const timeA = valA ? new Date(valA as string).getTime() : 0;
                const timeB = valB ? new Date(valB as string).getTime() : 0;
                if (timeA < timeB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (timeA > timeB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }

            if (String(valA) < String(valB)) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (String(valA) > String(valB)) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
          });
    }, [visitorLogs, filter, searchTerm, sortConfig]);
    
    const exportVisitorLogs = (logsToExport: VisitorPassRecord[], fileName: string) => {
        if (typeof XLSX === 'undefined') {
            console.error("XLSX library is not loaded.");
            window.alert("Could not export to Excel. The required library is missing.");
            return false;
        }

        if (logsToExport.length === 0) {
            window.alert("No data to export.");
            return false;
        }

        const dataToExport = logsToExport.map(log => {
            return {
                "Pass Number": log.passNumber,
                "Date": new Date(log.date).toLocaleDateString('en-IN'),
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

        XLSX.writeFile(workbook, fileName);
        return true;
    };

    const handleExportToExcel = () => {
        exportVisitorLogs(sortedAndFilteredLogs, "Visitor_Logbook.xlsx");
    };

    const handleExportForDeletion = () => {
        const success = exportVisitorLogs(
            bulkDeleteConfig.logs,
            `DELETION_EXPORT_VisitorLogs_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
        if (success) {
            setBulkDeleteConfig(prev => ({ ...prev, hasExported: true }));
        }
    };


    const baseFieldClasses = "w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

    return (
        <div className="space-y-8">
            <div ref={topRef} className="bg-white p-8 rounded-lg shadow-xl max-w-screen-2xl mx-auto">
                <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Create Visitor Gate Pass</h2>
                {notification && <div className="mb-6"><Alert message={notification.message} type={notification.type} onClose={() => setNotification(null)} /></div>}
                
                <form onSubmit={handleSubmit} className="space-y-8">
                    <section>
                        <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Visitor's Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-lg border">
                            <div><label className="block text-gray-700 font-medium mb-1">Full Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Relation</label><input type="text" name="relation" value={formData.relation} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} placeholder="e.g., PARENT, SIBLING, FRIEND"/></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Mobile Number</label><input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} required className={baseFieldClasses} /></div>
                            <div className="lg:col-span-2"><label className="block text-gray-700 font-medium mb-1">Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Vehicle Number (Optional)</label><input type="text" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} className={`${baseFieldClasses} uppercase`} /></div>
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Purpose of Visit</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-lg border">
                            <div><label className="block text-gray-700 font-medium mb-1">Whom to Meet</label><input type="text" name="whomToMeet" value={formData.whomToMeet} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Place to Visit</label><input type="text" name="placeToVisit" value={formData.placeToVisit} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                            <div><label className="block text-gray-700 font-medium mb-1">Person's Mobile (Optional)</label><input type="tel" name="personToMeetMobile" value={formData.personToMeetMobile} onChange={handleInputChange} className={baseFieldClasses} /></div>
                            <div className="lg:col-span-3"><label className="block text-gray-700 font-medium mb-1">Purpose</label><textarea name="purpose" value={formData.purpose} onChange={handleInputChange} required rows={3} className={`${baseFieldClasses} uppercase`}></textarea></div>
                        </div>
                    </section>
                    <div className="mt-8 border-t pt-6"><button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 text-lg flex justify-center items-center disabled:bg-blue-400 disabled:cursor-wait">{isSubmitting ? 'Submitting...' : 'Generate & Preview Pass'}</button></div>
                </form>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg max-w-screen-2xl mx-auto">
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
                    {role === 'admin' && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                            title="Bulk delete old logs"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                            <span>Bulk Delete</span>
                        </button>
                    )}
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
                                            {role === 'admin' && (
                                                <button onClick={() => setLogToDelete(log)} className="text-red-600 hover:text-red-900" title="Delete Log">🗑️ Delete</button>
                                            )}
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
            
            <ConfirmationModal 
                isOpen={!!logToDelete} 
                onClose={() => setLogToDelete(null)} 
                onConfirm={handleProceedToPin} 
                title="Delete Visitor Log" 
                message={<span>Are you sure you want to delete the pass for <strong>{logToDelete?.name}</strong>? This action cannot be undone.</span>} 
            />

            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Bulk Visitor Log Deletion">
              <div className="space-y-6">
                  <div>
                      <div className="flex items-center space-x-3 mb-3">
                          <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full text-lg">1</span>
                          <h4 className="font-semibold text-xl text-gray-800">Select Deletion Range</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(['3m', '6m', '1y', 'all'] as const).map(range => {
                              const descriptions = { '3m': 'Older than 3 months', '6m': 'Older than 6 months', '1y': 'Older than 1 year', 'all': 'All logs' };
                              return (
                                  <label key={range} className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${bulkDeleteConfig.range === range ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white hover:bg-gray-50 border-gray-300'}`}>
                                      <input
                                          type="radio"
                                          name="deleteRange"
                                          value={range}
                                          checked={bulkDeleteConfig.range === range}
                                          onChange={() => setBulkDeleteConfig(prev => ({ ...prev, range }))}
                                          className="sr-only"
                                      />
                                      <span className="font-semibold text-gray-800">{descriptions[range]}</span>
                                  </label>
                              );
                          })}
                      </div>
                      <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                        <div className="flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-lg font-semibold text-red-800">
                                This will permanently delete <strong className="font-bold text-red-900">{bulkDeleteConfig.logs.length}</strong> visitor log record(s).
                            </p>
                        </div>
                      </div>
                  </div>
                  <div>
                      <div className="flex items-center space-x-3 mb-3">
                          <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.logs.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
                          <h4 className="font-semibold text-xl text-gray-800">Export for Archiving (Required)</h4>
                      </div>
                      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
                          <div className="flex items-start">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <div>
                                  <h4 className="font-bold">Important!</h4>
                                  <p className="text-sm">Once logs are deleted, they cannot be recovered. You must export the data for your records before proceeding.</p>
                              </div>
                          </div>
                      </div>
                      <button 
                          onClick={handleExportForDeletion} 
                          disabled={bulkDeleteConfig.logs.length === 0}
                          className="mt-3 w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400 flex items-center justify-center space-x-2"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H7V7a3 3 0 013-3z" />
                          </svg>
                          <span>Export {bulkDeleteConfig.logs.length} Records</span>
                      </button>
                  </div>
                  <div>
                      <div className="flex items-center space-x-3 mb-3">
                          <span className={`flex items-center justify-center w-8 h-8 font-bold rounded-full text-lg ${bulkDeleteConfig.hasExported ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
                          <h4 className="font-semibold text-xl text-gray-800">Confirm Deletion</h4>
                      </div>
                      <button 
                          onClick={handleBulkDeleteProceedToPin} 
                          disabled={!bulkDeleteConfig.hasExported || bulkDeleteConfig.logs.length === 0}
                          className="w-full bg-red-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                          title={!bulkDeleteConfig.hasExported ? "Please export the logs first" : ""}
                      >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                           </svg>
                           <span>Proceed to Delete...</span>
                      </button>
                  </div>
              </div>
            </Modal>
            
            <Modal isOpen={!!pinAction} onClose={handleClosePinModal} title="Security Verification" size="sm">
                <div className="space-y-4">
                    <p className="text-gray-700 text-center">
                        {pinAction?.action === 'singleDelete' ? (
                            <span>To confirm deletion of this visitor log, please enter the security PIN.</span>
                        ) : (
                            <span>To confirm the deletion of <strong className="text-red-600">{bulkDeleteConfig.logs.length}</strong> visitor log(s), please enter the security PIN.</span>
                        )}
                    </p>
                    <input 
                        type="password"
                        value={pinInput}
                        onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                        className="w-full text-center tracking-widest text-2xl px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={6}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handlePinVerify()}
                    />
                    {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}
                    <div className="flex justify-end space-x-4 pt-4">
                        <button onClick={handleClosePinModal} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                        <button onClick={handlePinVerify} className={`px-6 py-2 text-white rounded-lg hover:bg-red-700 font-semibold ${pinAction?.action === 'singleDelete' ? 'bg-red-600' : 'bg-red-600'}`}>
                            {pinAction?.action === 'singleDelete' ? 'Verify & Delete' : 'Confirm & Delete'}
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default VisitorGatePass;
