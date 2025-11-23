
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

  const hostelOccupancyTotals = useMemo(() => {
      return hostelOccupancy.reduce((acc, curr) => ({
          total: acc.total + curr.total,
          out: acc.out + curr.out,
          present: acc.present + curr.present
      }), { total: 0, out: 0, present: 0 });
  }, [hostelOccupancy]);

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
    
    // Prepare element for capture
    dashboardElement.style.visibility = 'visible';
    dashboardElement.style.position = 'fixed';
    dashboardElement.style.left = '0';
    dashboardElement.style.top = '0';
    dashboardElement.style.zIndex = '50';
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Allow render

    try {
        const canvas = await html2canvas(dashboardElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0, // Crucial: Prevents vertical shift based on current scroll
            windowWidth: 210 * 3.78, // approx A4 width in pixels
            windowHeight: 297 * 3.78,
            onclone: (clonedDoc: any) => {
                const clonedElement = clonedDoc.body.querySelector('#report-container');
                if(clonedElement) {
                   clonedElement.style.transform = 'none';
                }
            }
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
        
        // Calculate aspect ratio
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

  // Helper to render small distribution tables with stricter styling
  const SimpleTable = ({ data, labelHeader, valueHeader }: { data: Map<string, number>, labelHeader: string, valueHeader: string }) => (
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                  <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', verticalAlign: 'middle' }}>{labelHeader}</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', verticalAlign: 'middle' }}>{valueHeader}</th>
              </tr>
          </thead>
          <tbody>
              {Array.from(data.entries()).map(([key, val], index) => (
                  <tr key={key} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#1f2937', fontWeight: 500, verticalAlign: 'middle' }}>{key}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', color: '#1f2937', fontWeight: 'bold', verticalAlign: 'middle' }}>{val}</td>
                  </tr>
              ))}
               {data.size === 0 && <tr><td colSpan={2} style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', verticalAlign: 'middle' }}>No data</td></tr>}
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
        id="report-container"
        ref={reportRef}
        style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            backgroundColor: 'white',
            padding: '20mm',
            color: '#111827',
            visibility: 'hidden', 
            position: 'fixed', 
            top: 0, 
            left: '-9999px',
            zIndex: -10000,
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
            textRendering: 'geometricPrecision',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #1f2937', paddingBottom: '16px', marginBottom: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src="https://mscnitanp.pages.dev/nitanp_logo.png" alt="Logo" style={{ height: '64px', width: '64px', objectFit: 'contain', marginRight: '16px' }} />
                <div>
                    <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1.2', margin: 0 }}>National Institute of Technology</h1>
                    <p style={{ fontSize: '14px', color: '#4b5563', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Andhra Pradesh</p>
                </div>
             </div>
             <div style={{ textAlign: 'right' }}>
                 <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1f2937', margin: 0 }}>Outing Report</h2>
                 <p style={{ fontSize: '14px', fontWeight: 500, marginTop: '4px', color: '#374151', margin: 0 }}>{new Date().toLocaleDateString()}</p>
                 <p style={{ fontSize: '12px', color: '#4b5563', margin: 0 }}>{new Date().toLocaleTimeString()}</p>
             </div>
        </div>

        {/* 1. Executive Summary */}
        <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a', borderBottom: '2px solid #1e40af', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>1. Executive Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {/* STRICT LAYOUT: Explicit inline styles for reliable rendering */}
                <div style={{ border: '1px solid #d1d5db', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>Total Students</p>
                    <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', lineHeight: 1, margin: 0, marginTop: '4px' }}>{totalStudents}</p>
                </div>
                <div style={{ border: '1px solid #fcd34d', backgroundColor: '#fffbeb', borderRadius: '4px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#b45309', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>Currently Out</p>
                    <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#b45309', lineHeight: 1, margin: 0, marginTop: '4px' }}>{onOutingCount}</p>
                </div>
                <div style={{ border: '1px solid #fca5a5', backgroundColor: '#fef2f2', borderRadius: '4px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#b91c1c', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>Total Overdue</p>
                    <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#b91c1c', lineHeight: 1, margin: 0, marginTop: '4px' }}>{overdueLogs.length}</p>
                </div>
                <div style={{ border: '1px solid #86efac', backgroundColor: '#f0fdf4', borderRadius: '4px', padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#15803d', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>On Campus</p>
                    <p style={{ fontSize: '30px', fontWeight: 'bold', color: '#15803d', lineHeight: 1, margin: 0, marginTop: '4px' }}>{totalStudents - onOutingCount}</p>
                </div>
            </div>
        </div>

        {/* 2. Current Demographics */}
        <div style={{ marginBottom: '32px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e3a8a', borderBottom: '2px solid #1e40af', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>2. Demographics (Currently Out)</h3>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' }}>
                 <div>
                     <h4 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' }}>By Year</h4>
                     <SimpleTable data={demographicsOut.byYear} labelHeader="Year" valueHeader="Students Out" />
                 </div>
                 <div>
                     <h4 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' }}>By Hostel</h4>
                     <SimpleTable data={demographicsOut.byHostel} labelHeader="Hostel" valueHeader="Students Out" />
                 </div>
             </div>
        </div>

        {/* 3. Overdue Analysis */}
        <div style={{ marginBottom: '32px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b', borderBottom: '2px solid #b91c1c', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>3. Overdue Analysis</h3>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', marginBottom: '16px' }}>
                 <div>
                     <h4 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' }}>Overdue by Year</h4>
                     <SimpleTable data={demographicsOverdue.byYear} labelHeader="Year" valueHeader="Overdue Count" />
                 </div>
                 <div>
                     <h4 style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase' }}>Overdue by Hostel</h4>
                     <SimpleTable data={demographicsOverdue.byHostel} labelHeader="Hostel" valueHeader="Overdue Count" />
                 </div>
             </div>

             <h4 style={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>Detailed Overdue List ({overdueLogs.length})</h4>
             <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', fontSize: '12px' }}>
                 <thead style={{ backgroundColor: '#fef2f2' }}>
                     <tr>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Name</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Roll No</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Year</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Hostel</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Out Time</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#7f1d1d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Type</th>
                     </tr>
                 </thead>
                 <tbody>
                     {overdueLogs.slice(0, 10).map((log, index) => {
                          const s = studentMap.get(log.studentId);
                          return (
                            <tr key={log.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', fontWeight: 'bold', color: '#1f2937', verticalAlign: 'middle' }}>{log.studentName}</td>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#374151', verticalAlign: 'middle' }}>{log.rollNumber}</td>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#374151', verticalAlign: 'middle' }}>{log.year}</td>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#374151', verticalAlign: 'middle' }}>{s?.hostel || '-'}</td>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#374151', verticalAlign: 'middle' }}>{new Date(log.checkOutTime).toLocaleString()}</td>
                                <td style={{ border: '1px solid #d1d5db', padding: '6px', color: '#374151', verticalAlign: 'middle' }}>{log.outingType}</td>
                            </tr>
                          );
                     })}
                     {overdueLogs.length > 10 && (
                         <tr>
                             <td colSpan={6} style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', verticalAlign: 'middle' }}>
                                 ...and {overdueLogs.length - 10} more students.
                             </td>
                         </tr>
                     )}
                     {overdueLogs.length === 0 && (
                         <tr><td colSpan={6} style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'center', color: '#16a34a', fontWeight: 500, verticalAlign: 'middle' }}>No overdue students.</td></tr>
                     )}
                 </tbody>
             </table>
        </div>
        
        {/* 4. Hostel Occupancy Status */}
        <div style={{ marginBottom: '16px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', borderBottom: '2px solid #4b5563', paddingBottom: '4px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>4. Hostel Occupancy Status</h3>
             <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', fontSize: '12px' }}>
                 <thead style={{ backgroundColor: '#f3f4f6' }}>
                     <tr>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', verticalAlign: 'middle' }}>Hostel Name</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', verticalAlign: 'middle' }}>Total Registered</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase', verticalAlign: 'middle' }}>Currently Out</th>
                         <th style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#15803d', textTransform: 'uppercase', verticalAlign: 'middle' }}>Currently Present</th>
                     </tr>
                 </thead>
                 <tbody>
                    {hostelOccupancy.map((row, index) => (
                        <tr key={row.hostel} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            <td style={{ border: '1px solid #d1d5db', padding: '6px', fontWeight: 'bold', color: '#1f2937', verticalAlign: 'middle' }}>{row.hostel}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', color: '#1f2937', verticalAlign: 'middle' }}>{row.total}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', color: '#d97706', fontWeight: 600, verticalAlign: 'middle' }}>{row.out}</td>
                            <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', color: '#16a34a', fontWeight: 'bold', verticalAlign: 'middle' }}>{row.present}</td>
                        </tr>
                    ))}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: '#e5e7eb', borderTop: '2px solid #9ca3af' }}>
                         <td style={{ border: '1px solid #d1d5db', padding: '6px', fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', verticalAlign: 'middle' }}>Total</td>
                         <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#111827', verticalAlign: 'middle' }}>{hostelOccupancyTotals.total}</td>
                         <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#92400e', verticalAlign: 'middle' }}>{hostelOccupancyTotals.out}</td>
                         <td style={{ border: '1px solid #d1d5db', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: '#166534', verticalAlign: 'middle' }}>{hostelOccupancyTotals.present}</td>
                    </tr>
                    {hostelOccupancy.length === 0 && (
                        <tr><td colSpan={4} style={{ border: '1px solid #d1d5db', padding: '16px', textAlign: 'center', color: '#6b7280', fontStyle: 'italic', verticalAlign: 'middle' }}>No hostel data available.</td></tr>
                    )}
                 </tbody>
             </table>
        </div>
        
        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #9ca3af', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
             <p style={{ margin: 0 }}>Generated automatically by Outing Management System</p>
             <p style={{ margin: 0 }}>Page 1 of 1</p>
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
