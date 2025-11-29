import React, { useContext, useMemo, useState, useRef } from 'react';
import { AppContext } from '../App';
import StudentListModal from './StudentListModal';
import { Student, View, OutingType, OutingRecord } from '../types';
import DoughnutChart from './charts/DoughnutChart';
import Spinner from './Spinner';
import { generatePdfReport } from '../services/reportGeneratorService';

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
    
    const localOutingStudentIds = new Set<string>();
    const nonLocalOutingStudentIds = new Set<string>();
    
    outingLogs.forEach(log => {
        if (isToday(log.checkOutTime)) {
            if (log.outingType === OutingType.LOCAL) localOutingStudentIds.add(log.studentId);
            if (log.outingType === OutingType.NON_LOCAL) nonLocalOutingStudentIds.add(log.studentId);
        }
    });
    
    const localOutingsToday = localOutingStudentIds.size;
    const nonLocalOutingsToday = nonLocalOutingStudentIds.size;

    const visitorsToday = visitorLogs.filter(log => log.date.startsWith(todayStr)).length;

    return { localOutingsToday, nonLocalOutingsToday, visitorsToday };
  }, [outingLogs, visitorLogs]);

  const getDistribution = (studentList: Student[], key: keyof Student) => {
      const dist = new Map<string, number>();
      studentList.forEach(s => {
          const val = (s[key] as string) || 'Unknown';
          dist.set(val, (dist.get(val) || 0) + 1);
      });
      return new Map([...dist.entries()].sort());
  };

  const demographicsOut = useMemo(() => {
      return {
          byHostel: getDistribution(studentsOnOuting.filter(s => s.studentType === 'Hosteller'), 'hostel'),
      };
  }, [studentsOnOuting]);

  const hostelOccupancy = useMemo(() => {
      const totalPerHostel = new Map<string, number>();
      students.forEach(s => {
          if (s.studentType === 'Hosteller' && s.hostel) {
              totalPerHostel.set(s.hostel, (totalPerHostel.get(s.hostel) || 0) + 1);
          }
      });
      const outPerHostel = demographicsOut.byHostel;
      const occupancyData: Array<{ hostel: string; total: number; out: number; present: number }> = [];
      const sortedHostels = Array.from(totalPerHostel.keys()).sort();
      sortedHostels.forEach(hostel => {
          const total = totalPerHostel.get(hostel) || 0;
          const out = outPerHostel.get(hostel) || 0;
          occupancyData.push({ hostel, total, out, present: total - out });
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

  const demographicsToday = useMemo(() => {
      return {
          byYear: getDistribution(studentsOutToday, 'year'),
          byHostel: getDistribution(studentsOutToday.filter(s => s.studentType === 'Hosteller'), 'hostel'),
      };
  }, [studentsOutToday]);

  const demographicChartData = useMemo(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];
    const createChartData = (counts: Map<string, number>) => {
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return {
            labels: sorted.map(e => e[0]),
            datasets: [{ data: sorted.map(e => e[1]), backgroundColor: colors }]
        };
    };
    return { byYear: createChartData(demographicsToday.byYear), byHostel: createChartData(demographicsToday.byHostel) };
  }, [demographicsToday]);

  const reportData = useMemo(() => ({
      totalStudents: students.length,
      onOutingCount: studentsOnOuting.length,
      overdueLogs,
      todaysStats,
      hostelOccupancy,
      hostelOccupancyTotals,
      studentMap
  }), [students.length, studentsOnOuting.length, overdueLogs, todaysStats, hostelOccupancy, hostelOccupancyTotals, studentMap]);

  const handleGenerateReportClick = async () => {
    setIsGeneratingReport(true);
    try {
        await generatePdfReport(reportData);
    } catch (error) {
        console.error("Failed to generate report:", error);
        alert("An error occurred while generating the report. Please check the console for details.");
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleOpenModal = (title: string, studentList: Student[]) => {
    setModalTitle(title);
    setModalStudents(studentList);
    setIsListModalOpen(true);
  };
  
  const handleChartClick = (category: 'year' | 'hostel', label: string) => {
    const filteredStudents = studentsOutToday.filter(s => (category === 'year' ? s.year : s.hostel) === label);
    handleOpenModal(`Today's Outing Students from ${label} (${category})`, filteredStudents);
  };

  const totalStudents = students.length;
  const onOutingCount = studentsOnOuting.length;

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
        <button
            onClick={handleGenerateReportClick}
            disabled={isGeneratingReport}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:bg-gray-400"
        >
            {isGeneratingReport ? <><Spinner /> Processing...</> : 'Generate Report'}
        </button>
      </div>

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
