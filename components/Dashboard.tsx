
import React, { useContext, useMemo, useState, useRef } from 'react';
import { AppContext } from '../App';
import StudentListModal from './StudentListModal';
import { Student, View, OutingType, OutingRecord } from '../types';
import DoughnutChart from './charts/DoughnutChart';
import Spinner from './Spinner';

// Allow global vars from CDNs
declare var jspdf: any;
declare var html2canvas: any;

const OVERDUE_HOURS_NON_LOCAL = 72; // 3 days

interface StatCardProps {
  title: string;
  value: number;
  icon?: React.ReactElement;
  onClick?: () => void;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, onClick, color }) => (
  <div
    className={`p-6 rounded-lg shadow-lg text-white transform hover:scale-105 transition-transform duration-300 ${onClick ? 'cursor-pointer' : ''} ${color}`}
    onClick={onClick}
  >
    <div className={`flex items-center ${icon ? 'justify-between' : 'justify-start'}`}>
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-4xl font-bold">{value}</p>
      </div>
      {icon && <div className="text-5xl opacity-80">{icon}</div>}
    </div>
  </div>
);

interface DashboardProps {
    onViewChange: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const { students, outingLogs, visitorLogs } = useContext(AppContext);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalStudents, setModalStudents] = useState<Student[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // --- Memoized Data Processing ---

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const studentsOnOuting = useMemo(() => {
    const onOutingIds = new Set(
      outingLogs.filter(log => log.checkInTime === null).map(log => log.studentId)
    );
    return students.filter(student => onOutingIds.has(student.id));
  }, [outingLogs, students]);

  const studentsOutToday = useMemo(() => {
    const today = new Date();
    const isToday = (isoString: string) => {
        const date = new Date(isoString);
        return date.getFullYear() === today.getFullYear() &&
               date.getMonth() === today.getMonth() &&
               date.getDate() === today.getDate();
    };
    const ids = new Set(
        outingLogs.filter(log => isToday(log.checkOutTime)).map(log => log.studentId)
    );
    return students.filter(s => ids.has(s.id));
  }, [outingLogs, students]);

  const overdueLogs = useMemo(() => {
    const now = new Date();
    return outingLogs.filter(log => {
        if (log.checkInTime !== null || log.overdueResolved) return false;

        const checkOutDate = new Date(log.checkOutTime);
        let deadline: Date;
        if (log.outingType === OutingType.LOCAL) {
            deadline = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate(), 21, 0, 0);
        } else {
            deadline = new Date(checkOutDate.getTime() + OVERDUE_HOURS_NON_LOCAL * 60 * 60 * 1000);
        }
        return now > deadline;
    });
  }, [outingLogs]);

  const todaysStats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const isToday = (isoString: string) => {
        const date = new Date(isoString);
        return date.getFullYear() === today.getFullYear() &&
               date.getMonth() === today.getMonth() &&
               date.getDate() === today.getDate();
    };
    
    let localOutingsToday = 0;
    let nonLocalOutingsToday = 0;
    
    outingLogs.forEach(log => {
        if (isToday(log.checkOutTime)) {
            if (log.outingType === OutingType.LOCAL) localOutingsToday++;
            if (log.outingType === OutingType.NON_LOCAL) nonLocalOutingsToday++;
        }
    });

    const visitorsToday = visitorLogs.filter(log => log.date === todayStr).length;

    return { localOutingsToday, nonLocalOutingsToday, visitorsToday };
  }, [outingLogs, visitorLogs]);

  // --- Aggregation for Report ---

  const getDistribution = (studentList: Student[], key: keyof Student) => {
      const dist = new Map<string, number>();
      studentList.forEach(s => {
          const val = (s[key] as string) || 'Unknown';
          dist.set(val, (dist.get(val) || 0) + 1);
      });
      return new Map([...dist.entries()].sort());
  };

  const getOverdueDistribution = (logs: OutingRecord[], key: 'year' | 'hostel') => {
      const dist = new Map<string, number>();
      logs.forEach(log => {
          let val = 'Unknown';
          if (key === 'year') val = log.year;
          if (key === 'hostel') {
               const s = studentMap.get(log.studentId);
               val = s?.hostel || 'Day-Scholar';
          }
          dist.set(val, (dist.get(val) || 0) + 1);
      });
      return new Map([...dist.entries()].sort());
  };

  // Used for Report (Currently Out)
  const demographicsOut = useMemo(() => {
      return {
          byYear: getDistribution(studentsOnOuting, 'year'),
          byHostel: getDistribution(studentsOnOuting.filter(s => s.studentType === 'Hosteller'), 'hostel'),
      };
  }, [studentsOnOuting]);

  // Used for Report (Hostel Occupancy)
  const hostelOccupancy = useMemo(() => {
      // 1. Calculate Total Registered per Hostel
      const totalPerHostel = new Map<string, number>();
      students.forEach(s => {
          if (s.studentType === 'Hosteller' && s.hostel) {
              totalPerHostel.set(s.hostel, (totalPerHostel.get(s.hostel) || 0) + 1);
          }
      });

      // 2. Get Currently Out (already calculated)
      const outPerHostel = demographicsOut.byHostel;

      // 3. Build consolidated data
      const occupancyData: Array<{ hostel: string; total: number; out: number; present: number }> = [];
      
      // Sort hostels alphabetically
      const sortedHostels = Array.from(totalPerHostel.keys()).sort();

      sortedHostels.forEach(hostel => {
          const total = totalPerHostel.get(hostel) || 0;
          const out = outPerHostel.get(hostel) || 0;
          const present = total - out;
          occupancyData.push({ hostel, total, out, present });
      });

      return occupancyData;
  }, [students, demographicsOut.byHostel]);

  // Used for Dashboard Charts (Total activity today)
  const demographicsToday = useMemo(() => {
      return {
          byYear: getDistribution(studentsOutToday, 'year'),
          byHostel: getDistribution(studentsOutToday.filter(s => s.studentType === 'Hosteller'), 'hostel'),
      };
  }, [studentsOutToday]);

  const demographicsOverdue = useMemo(() => {
      return {
          byYear: getOverdueDistribution(overdueLogs, 'year'),
          byHostel: getOverdueDistribution(overdueLogs.filter(l => l.studentType === 'Hosteller'), 'hostel'),
      };
  }, [overdueLogs]);


  // --- Chart Data for Dashboard View ---

  const demographicChartData = useMemo(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];
    const createChartData = (counts: Map<string, number>) => {
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(e => e[0]),
            datasets: [{ data: sorted.map(e => e[1]), backgroundColor: colors }]
        };
    };

    return {
        byYear: createChartData(demographicsToday.byYear),
        byHostel: createChartData(demographicsToday.byHostel),
    };
  }, [demographicsToday]);

  // --- Handlers ---
  
  const handleOpenModal = (title: string, studentList: Student[]) => {
    setModalTitle(title);
    setModalStudents(studentList);
    setIsListModalOpen(true);
  };
  
  const handleChartClick = (category: 'year' | 'hostel', label: string) => {
    const filteredStudents = studentsOutToday.filter(s => {
        if(category === 'year') return s.year === label;
        if(category === 'hostel') return s.hostel === label;
        return false;
    });
    handleOpenModal(`Today's Outing Students from ${label} (${category})`, filteredStudents);
  };

  const handleGenerateReport = async () => {
    if (!reportRef.current || typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        alert('Report generation library is not available.');
        return;
    }
    
    setIsGeneratingReport(true);
    const dashboardElement = reportRef.current;
    
    // Save original styles to restore later (though we force specific states)
    const originalVisibility = dashboardElement.style.visibility;
    const originalPosition = dashboardElement.style.position;
    const originalLeft = dashboardElement.style.left;
    const originalTop = dashboardElement.style.top;
    const originalZIndex = dashboardElement.style.zIndex;

    // Make visible for capture, but fixed and behind everything to prevent layout shift and user visibility
    dashboardElement.style.visibility = 'visible';
    dashboardElement.style.position = 'fixed';
    dashboardElement.style.left = '0';
    dashboardElement.style.top = '0';
    dashboardElement.style.zIndex = '-10000';
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Allow render

    try {
        const canvas = await html2canvas(dashboardElement, {
            scale: 2,
            useCORS: true,
            logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;
        
        let heightInPdf = pdfWidth / ratio;
        let widthInPdf = pdfWidth;
        
        if (heightInPdf > pdfHeight) {
             const scaleFactor = pdfHeight / heightInPdf;
             heightInPdf = pdfHeight - 20;
             widthInPdf = widthInPdf * scaleFactor;
        }

        pdf.addImage(imgData, 'PNG', 0, 0, widthInPdf, heightInPdf);
        pdf.save(`Outing_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("An error occurred while generating the report.");
    } finally {
        // Restore to hidden state off-screen
        dashboardElement.style.visibility = 'hidden';
        dashboardElement.style.position = 'fixed'; 
        dashboardElement.style.left = '-9999px';
        dashboardElement.style.top = '0';
        dashboardElement.style.zIndex = '-10000';
        setIsGeneratingReport(false);
    }
  };

  const totalStudents = students.length;
  const onOutingCount = studentsOnOuting.length;

  // Helper to render small distribution tables
  const SimpleTable = ({ data, labelHeader, valueHeader }: { data: Map<string, number>, labelHeader: string, valueHeader: string }) => (
      <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead className="bg-gray-100">
              <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 uppercase text-xs tracking-wider">{labelHeader}</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-700 uppercase text-xs tracking-wider">{valueHeader}</th>
              </tr>
          </thead>
          <tbody>
              {Array.from(data.entries()).map(([key, val]) => (
                  <tr key={key} className="even:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 text-gray-800 font-medium">{key}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-gray-800 font-bold">{val}</td>
                  </tr>
              ))}
               {data.size === 0 && <tr><td colSpan={2} className="border border-gray-300 px-3 py-2 text-center text-gray-500 italic">No data</td></tr>}
          </tbody>
      </table>
  );

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
        <div className="flex items-center gap-4">
             <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:bg-gray-400"
            >
                {isGeneratingReport ? <><Spinner /> Generating...</> : 'Generate Report'}
            </button>
        </div>
      </div>
      
      {/* --- HIDDEN REPORT TEMPLATE --- */}
      <div
        ref={reportRef}
        className="bg-white p-8 text-gray-900 antialiased"
        style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            visibility: 'hidden', 
            position: 'fixed', 
            top: 0, 
            left: '-9999px',
            zIndex: -10000,
            lineHeight: '1.2', // Fixes vertical drift in html2canvas
            fontFamily: 'Arial, sans-serif' // Ensures font consistency
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
             <img src="https://mscnitanp.pages.dev/nitanp_logo.png" alt="Logo" className="h-16 object-contain" />
             <div className="text-right">
                 <h1 className="text-xl font-bold uppercase tracking-wider leading-none">Student Outing Report</h1>
                 <p className="text-sm text-gray-600 mt-1">NIT Andhra Pradesh</p>
                 <p className="text-sm font-semibold mt-1">Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
             </div>
        </div>

        {/* 1. Executive Summary */}
        <div className="mb-8">
            <h3 className="text-lg font-bold text-blue-800 border-l-4 border-blue-600 pl-2 mb-3 uppercase flex items-center">1. Executive Summary</h3>
            <div className="grid grid-cols-4 gap-4">
                <div className="border border-gray-200 p-3 rounded bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Total Students</p>
                    <p className="text-3xl font-bold text-gray-800 leading-none mt-1">{totalStudents}</p>
                </div>
                <div className="border border-yellow-200 p-3 rounded bg-yellow-50">
                    <p className="text-xs text-yellow-700 uppercase font-semibold">Currently Out</p>
                    <p className="text-3xl font-bold text-yellow-700 leading-none mt-1">{onOutingCount}</p>
                </div>
                <div className="border border-red-200 p-3 rounded bg-red-50">
                    <p className="text-xs text-red-700 uppercase font-semibold">Total Overdue</p>
                    <p className="text-3xl font-bold text-red-700 leading-none mt-1">{overdueLogs.length}</p>
                </div>
                <div className="border border-green-200 p-3 rounded bg-green-50">
                    <p className="text-xs text-green-700 uppercase font-semibold">On Campus</p>
                    <p className="text-3xl font-bold text-green-700 leading-none mt-1">{totalStudents - onOutingCount}</p>
                </div>
            </div>
        </div>

        {/* 2. Current Demographics */}
        <div className="mb-8">
             <h3 className="text-lg font-bold text-blue-800 border-l-4 border-blue-600 pl-2 mb-4 uppercase flex items-center">2. Demographics (Currently Out)</h3>
             <div className="grid grid-cols-2 gap-8">
                 <div>
                     <h4 className="font-bold text-gray-700 mb-2 text-sm text-center uppercase">By Year</h4>
                     <SimpleTable data={demographicsOut.byYear} labelHeader="Year" valueHeader="Students Out" />
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-700 mb-2 text-sm text-center uppercase">By Hostel</h4>
                     <SimpleTable data={demographicsOut.byHostel} labelHeader="Hostel" valueHeader="Students Out" />
                 </div>
             </div>
        </div>

        {/* 3. Overdue Analysis */}
        <div className="mb-8">
             <h3 className="text-lg font-bold text-red-800 border-l-4 border-red-600 pl-2 mb-4 uppercase flex items-center">3. Overdue Analysis</h3>
             <div className="grid grid-cols-2 gap-8 mb-6">
                 <div>
                     <h4 className="font-bold text-gray-700 mb-2 text-sm text-center uppercase">Overdue by Year</h4>
                     <SimpleTable data={demographicsOverdue.byYear} labelHeader="Year" valueHeader="Overdue Count" />
                 </div>
                 <div>
                     <h4 className="font-bold text-gray-700 mb-2 text-sm text-center uppercase">Overdue by Hostel</h4>
                     <SimpleTable data={demographicsOverdue.byHostel} labelHeader="Hostel" valueHeader="Overdue Count" />
                 </div>
             </div>

             <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase border-b border-gray-300 pb-1">Detailed Overdue List ({overdueLogs.length})</h4>
             <table className="w-full border-collapse border border-gray-300 text-xs">
                 <thead className="bg-red-50">
                     <tr>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Name</th>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Roll No</th>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Year</th>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Hostel</th>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Out Time</th>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-red-900 uppercase tracking-wider">Type</th>
                     </tr>
                 </thead>
                 <tbody>
                     {overdueLogs.slice(0, 10).map(log => {
                          const s = studentMap.get(log.studentId);
                          return (
                            <tr key={log.id} className="even:bg-gray-50">
                                <td className="border border-gray-300 px-3 py-2 font-bold text-gray-800">{log.studentName}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">{log.rollNumber}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">{log.year}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">{s?.hostel || '-'}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">{new Date(log.checkOutTime).toLocaleString()}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">{log.outingType}</td>
                            </tr>
                          );
                     })}
                     {overdueLogs.length > 10 && (
                         <tr>
                             <td colSpan={6} className="border border-gray-300 px-3 py-2 text-center text-gray-500 italic">
                                 ...and {overdueLogs.length - 10} more students.
                             </td>
                         </tr>
                     )}
                     {overdueLogs.length === 0 && (
                         <tr><td colSpan={6} className="border border-gray-300 px-3 py-4 text-center text-green-600 font-medium">No overdue students.</td></tr>
                     )}
                 </tbody>
             </table>
        </div>
        
        {/* 4. Hostel Occupancy Status */}
        <div className="mb-6">
             <h3 className="text-lg font-bold text-slate-800 border-l-4 border-slate-600 pl-2 mb-4 uppercase flex items-center">4. Hostel Occupancy Status</h3>
             <table className="w-full border-collapse border border-gray-300 text-xs">
                 <thead className="bg-slate-100">
                     <tr>
                         <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-700 uppercase tracking-wider">Hostel Name</th>
                         <th className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-700 uppercase tracking-wider">Total Registered</th>
                         <th className="border border-gray-300 px-3 py-2 text-right font-bold text-yellow-700 uppercase tracking-wider">Currently Out</th>
                         <th className="border border-gray-300 px-3 py-2 text-right font-bold text-green-700 uppercase tracking-wider">Currently Present</th>
                     </tr>
                 </thead>
                 <tbody>
                    {hostelOccupancy.map(row => (
                        <tr key={row.hostel} className="even:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 font-bold text-gray-800">{row.hostel}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right text-gray-800">{row.total}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right text-yellow-600 font-semibold">{row.out}</td>
                            <td className="border border-gray-300 px-3 py-2 text-right text-green-600 font-bold">{row.present}</td>
                        </tr>
                    ))}
                    {hostelOccupancy.length === 0 && (
                        <tr><td colSpan={4} className="border border-gray-300 px-3 py-4 text-center text-gray-500 italic">No hostel data available.</td></tr>
                    )}
                 </tbody>
             </table>
        </div>
        
        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-400 flex justify-between text-xs text-gray-500">
             <p>Generated automatically by Outing Management System</p>
             <p>Page 1 of 1</p>
        </div>
      </div>
      {/* --- END REPORT TEMPLATE --- */}


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Students" value={totalStudents} onClick={() => onViewChange('allStudents')} color="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatCard title="Currently Out" value={onOutingCount} onClick={() => handleOpenModal('Students Currently Out', studentsOnOuting)} color="bg-gradient-to-br from-yellow-500 to-yellow-600" />
        <StatCard title="On Campus" value={totalStudents - onOutingCount} color="bg-gradient-to-br from-green-500 to-green-600" />
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Today's Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Local Outings Today" value={todaysStats.localOutingsToday} color="bg-gradient-to-br from-teal-500 to-cyan-600" />
            <StatCard title="Non-Local Outings Today" value={todaysStats.nonLocalOutingsToday} color="bg-gradient-to-br from-purple-500 to-violet-600" />
            <StatCard title="Visitors Today" value={todaysStats.visitorsToday} color="bg-gradient-to-br from-slate-500 to-slate-600" />
        </div>
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg border">
        <h3 className="text-xl font-bold mb-4 text-center text-gray-800">Today's Outing Demographics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h4 className="text-center font-semibold mb-2 text-gray-700">Demographics by Year</h4>
              {demographicChartData.byYear.datasets[0].data.length > 0 ? (
                <DoughnutChart data={demographicChartData.byYear} onClick={(label) => handleChartClick('year', label)} />
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">No data available for today.</div>
              )}
            </div>
            <div>
              <h4 className="text-center font-semibold mb-2 text-gray-700">Demographics by Hostel</h4>
              {demographicChartData.byHostel.datasets[0].data.length > 0 ? (
                <DoughnutChart data={demographicChartData.byHostel} onClick={(label) => handleChartClick('hostel', label)} />
              ) : (
                 <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">No data available for today.</div>
              )}
            </div>
        </div>
      </div>

      <StudentListModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} students={modalStudents} title={modalTitle} />
    </div>
    </>
  );
};

export default Dashboard;
