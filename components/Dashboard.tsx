import React, { useContext, useMemo, useState, useRef } from 'react';
import { AppContext } from '../App';
import StudentListModal from './StudentListModal';
import { Student, View, OutingType, VisitorPassRecord } from '../types';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import DoughnutChart from './charts/DoughnutChart';
import Spinner from './Spinner';

// Allow global vars from CDNs
declare var jspdf: any;
declare var html2canvas: any;

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

// --- Constants ---
const OVERDUE_HOURS_NON_LOCAL = 72; // 3 days

interface DashboardProps {
    onViewChange: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const { students, outingLogs, visitorLogs } = useContext(AppContext);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalStudents, setModalStudents] = useState<Student[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'last7' | 'last30'>('last7');
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

  const overdueStudents = useMemo(() => {
    const now = new Date();
    const overdueLogs = outingLogs.filter(log => {
        // Not overdue if they've checked in
        if (log.checkInTime !== null) return false;

        if (log.outingType === OutingType.LOCAL) {
            const checkOutDate = new Date(log.checkOutTime);
            // Deadline is 9 PM on the day of checkout
            const deadline = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate(), 21, 0, 0);
            return now > deadline;
        }

        if (log.outingType === OutingType.NON_LOCAL) {
            const checkOutTime = new Date(log.checkOutTime).getTime();
            const hoursPassed = (now.getTime() - checkOutTime) / (1000 * 60 * 60);
            return hoursPassed > OVERDUE_HOURS_NON_LOCAL;
        }

        return false;
    });

    const overdueStudentIds = new Set(overdueLogs.map(log => log.studentId));
    return students.filter(student => overdueStudentIds.has(student.id));
  }, [outingLogs, students]);
  
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

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const rangeStart = new Date();
    
    if (timeRange === 'today') {
        rangeStart.setHours(0, 0, 0, 0);
    } else if (timeRange === 'last7') {
        rangeStart.setDate(now.getDate() - 7);
        rangeStart.setHours(0, 0, 0, 0);
    } else { // last30
        rangeStart.setDate(now.getDate() - 30);
        rangeStart.setHours(0, 0, 0, 0);
    }

    return outingLogs.filter(log => new Date(log.checkOutTime) >= rangeStart);
  }, [outingLogs, timeRange]);

  const outingDataForRange = useMemo(() => {
    const studentIdsInOuting = new Set<string>();
    filteredLogs.forEach(log => studentIdsInOuting.add(log.studentId));
    const studentsInOuting = Array.from(studentIdsInOuting).map(id => studentMap.get(id)).filter((s): s is Student => !!s);
    return {
        students: studentsInOuting,
        logs: filteredLogs
    };
  }, [filteredLogs, studentMap]);

  // --- Chart Data ---

  const outingTrendsData = useMemo(() => {
    const dateCounts = new Map<string, Set<string>>();
    const labels: string[] = [];
    const now = new Date();
    
    const rangeDays = timeRange === 'today' ? 1 : (timeRange === 'last7' ? 7 : 30);
    for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(label);
        dateCounts.set(label, new Set());
    }

    filteredLogs.forEach(log => {
        const dateLabel = new Date(log.checkOutTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if(dateCounts.has(dateLabel)) {
            dateCounts.get(dateLabel)!.add(log.studentId);
        }
    });

    const data = labels.map(label => dateCounts.get(label)?.size || 0);
    return { labels, datasets: [{ label: 'Unique Students Out', data, borderColor: 'rgb(59, 130, 246)', tension: 0.1, fill: false }] };
  }, [filteredLogs, timeRange]);

  const peakHoursData = useMemo(() => {
    const hours = Array(24).fill(0).map((_, i) => `${i}:00`);
    const checkOuts = Array(24).fill(0);
    const checkIns = Array(24).fill(0);
    
    filteredLogs.forEach(log => {
        const outHour = new Date(log.checkOutTime).getHours();
        checkOuts[outHour]++;
        if (log.checkInTime) {
            const inHour = new Date(log.checkInTime).getHours();
            checkIns[inHour]++;
        }
    });
    
    return {
        labels: hours,
        datasets: [
            { label: 'Check-outs', data: checkOuts, backgroundColor: 'rgba(239, 68, 68, 0.7)' },
            { label: 'Check-ins', data: checkIns, backgroundColor: 'rgba(34, 197, 94, 0.7)' }
        ]
    };
  }, [filteredLogs]);

  const demographicData = useMemo(() => {
    const students = outingDataForRange.students;
    const yearCounts = new Map<string, number>();
    const hostelCounts = new Map<string, number>();

    students.forEach(s => {
        yearCounts.set(s.year, (yearCounts.get(s.year) || 0) + 1);
        if (s.studentType === 'Hosteller') {
            hostelCounts.set(s.hostel, (hostelCounts.get(s.hostel) || 0) + 1);
        }
    });
    
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];
    const createChartData = (counts: Map<string, number>) => {
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(e => e[0]),
            datasets: [{ data: sorted.map(e => e[1]), backgroundColor: colors }]
        };
    };

    return {
        byYear: createChartData(yearCounts),
        byHostel: createChartData(hostelCounts),
    };
  }, [outingDataForRange.students]);

  // --- Handlers ---
  
  const handleOpenModal = (title: string, studentList: Student[]) => {
    setModalTitle(title);
    setModalStudents(studentList);
    setIsListModalOpen(true);
  };
  
  const handleChartClick = (category: 'year' | 'hostel', label: string) => {
    const filteredStudents = outingDataForRange.students.filter(s => {
        if(category === 'year') return s.year === label;
        if(category === 'hostel') return s.hostel === label;
        return false;
    });
    handleOpenModal(`Students from ${label} (${category})`, filteredStudents);
  };

  const handleGenerateReport = async () => {
    if (!reportRef.current || typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        alert('Report generation library is not available.');
        return;
    }
    
    setIsGeneratingReport(true);
    const dashboardElement = reportRef.current;
    
    // Temporarily ensure the report element is fully visible for capture
    const originalVisibility = dashboardElement.style.visibility;
    const originalPosition = dashboardElement.style.position;
    dashboardElement.style.visibility = 'visible';
    dashboardElement.style.position = 'static';
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Allow charts to render

    try {
        const canvas = await html2canvas(dashboardElement, {
            scale: 2, // Increase resolution
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
        const widthInPdf = pdfWidth - 20; // with margin
        const heightInPdf = widthInPdf / ratio;

        pdf.addImage(imgData, 'PNG', 10, 10, widthInPdf, heightInPdf);
        pdf.save(`Daily_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("An error occurred while generating the report.");
    } finally {
        dashboardElement.style.visibility = originalVisibility;
        dashboardElement.style.position = originalPosition;
        setIsGeneratingReport(false);
    }
  };

  const totalStudents = students.length;
  const onOutingCount = studentsOnOuting.length;

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
        <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg shadow p-1 flex space-x-1">
                {(['today', 'last7', 'last30'] as const).map(range => (
                    <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${timeRange === range ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>
                        {range === 'today' ? 'Today' : range === 'last7' ? 'Last 7 Days' : 'Last 30 Days'}
                    </button>
                ))}
            </div>
             <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:bg-gray-400"
            >
                {isGeneratingReport ? <><Spinner /> Generating...</> : 'Generate Report'}
            </button>
        </div>
      </div>
      
      {/* This component will be used for PDF generation */}
      <div
        ref={reportRef}
        className="absolute -left-[9999px] top-auto p-8 bg-white"
        style={{ width: '1200px', visibility: 'hidden' }}
      >
        <h2 className="text-3xl font-bold text-gray-800 text-center mb-4">Daily Outing Summary - {new Date().toLocaleDateString()}</h2>
        <div className="grid grid-cols-3 gap-6 mb-8">
            <StatCard title="Total Students" value={totalStudents} color="bg-blue-500" />
            <StatCard title="Currently Out" value={onOutingCount} color="bg-yellow-500" />
            <StatCard title="On Campus" value={totalStudents - onOutingCount} color="bg-green-500" />
        </div>
        <div className="grid grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md border"><h3 className="text-xl font-bold mb-4">Outing Trends ({timeRange.replace('last', 'Last ')} Days)</h3><LineChart data={outingTrendsData} /></div>
            <div className="bg-white p-6 rounded-lg shadow-md border"><h3 className="text-xl font-bold mb-4">Peak Activity Hours</h3><BarChart data={peakHoursData} /></div>
        </div>
        {overdueStudents.length > 0 && <div className="mt-8">
            <h3 className="text-xl font-bold mb-4 text-red-600">Overdue Students ({overdueStudents.length})</h3>
            <ul className="grid grid-cols-3 gap-4">
                {overdueStudents.map(s => <li key={s.id} className="p-2 border rounded-md text-sm">{s.name} ({s.rollNumber})</li>)}
            </ul>
        </div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value={totalStudents} onClick={() => onViewChange('allStudents')} color="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatCard title="Currently Out" value={onOutingCount} onClick={() => handleOpenModal('Students Currently Out', studentsOnOuting)} color="bg-gradient-to-br from-yellow-500 to-yellow-600" />
        <StatCard title="On Campus" value={totalStudents - onOutingCount} color="bg-gradient-to-br from-green-500 to-green-600" />
        <StatCard title="Unique Students Out" value={outingDataForRange.students.length} onClick={() => handleOpenModal(`Students Out (${timeRange.replace('last', 'Last ')} Days)`, outingDataForRange.students)} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Today's Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Local Outings Today" value={todaysStats.localOutingsToday} color="bg-gradient-to-br from-teal-500 to-cyan-600" />
            <StatCard title="Non-Local Outings Today" value={todaysStats.nonLocalOutingsToday} color="bg-gradient-to-br from-purple-500 to-violet-600" />
            <StatCard title="Visitors Today" value={todaysStats.visitorsToday} color="bg-gradient-to-br from-slate-500 to-slate-600" />
        </div>
      </div>

      {overdueStudents.length > 0 && (
        <div className="mt-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-md hover:shadow-lg transition cursor-pointer" onClick={() => handleOpenModal('Overdue Students', overdueStudents)}>
            <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <div>
                    <h3 className="text-lg font-bold text-red-800">{overdueStudents.length} Student(s) Overdue</h3>
                    <p className="text-red-700 text-sm">A student on a local outing is marked overdue if not checked in by 9 PM. Click to view.</p>
                </div>
            </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-lg border"><h3 className="text-xl font-bold mb-4 text-center text-gray-800">Outing Trends ({timeRange.replace('last', 'Last ')} Days)</h3><LineChart data={outingTrendsData} /></div>
        <div className="bg-white p-6 rounded-lg shadow-lg border"><h3 className="text-xl font-bold mb-4 text-center text-gray-800">Peak Activity Hours</h3><BarChart data={peakHoursData} /></div>
      </div>
      
      <div className="mt-8 bg-white p-6 rounded-lg shadow-lg border">
        <h3 className="text-xl font-bold mb-4 text-center text-gray-800">Outing Demographics ({timeRange.replace('last', 'Last ')} Days)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h4 className="text-center font-semibold mb-2 text-gray-700">Demographics by Year</h4>
              {demographicData.byYear.datasets[0].data.length > 0 ? (
                <DoughnutChart data={demographicData.byYear} onClick={(label) => handleChartClick('year', label)} />
              ) : (
                <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">No data available for this period.</div>
              )}
            </div>
            <div>
              <h4 className="text-center font-semibold mb-2 text-gray-700">Demographics by Hostel</h4>
              {demographicData.byHostel.datasets[0].data.length > 0 ? (
                <DoughnutChart data={demographicData.byHostel} onClick={(label) => handleChartClick('hostel', label)} />
              ) : (
                 <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500">No data available for this period.</div>
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