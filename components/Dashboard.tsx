import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import StudentListModal from './StudentListModal';
import { Student, View, OutingType } from '../types';

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
  const { students, outingLogs } = useContext(AppContext);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalStudents, setModalStudents] = useState<Student[]>([]);

  const studentsOnOuting = useMemo(() => {
    const onOutingIds = new Set(
      outingLogs.filter(log => log.checkInTime === null).map(log => log.studentId)
    );
    return students.filter(student => onOutingIds.has(student.id));
  }, [outingLogs, students]);
  
  const todaysOutings = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const studentMap = new Map(students.map(s => [s.id, s]));
    const localOutingStudentIds = new Set<string>();
    const nonLocalOutingStudentIds = new Set<string>();

    outingLogs.forEach(log => {
      if (new Date(log.checkOutTime) >= todayStart) {
        if (log.outingType === OutingType.LOCAL) {
          localOutingStudentIds.add(log.studentId);
        } else if (log.outingType === OutingType.NON_LOCAL) {
          nonLocalOutingStudentIds.add(log.studentId);
        }
      }
    });

    const localStudents = Array.from(localOutingStudentIds).map(id => studentMap.get(id)).filter((s): s is Student => !!s);
    const nonLocalStudents = Array.from(nonLocalOutingStudentIds).map(id => studentMap.get(id)).filter((s): s is Student => !!s);

    return {
      localStudents,
      nonLocalStudents
    };
  }, [outingLogs, students]);

  const totalStudents = students.length;
  const onOutingCount = studentsOnOuting.length;

  const handleOpenModal = (title: string, studentList: Student[]) => {
    setModalTitle(title);
    setModalStudents(studentList);
    setIsListModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsListModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Registered Students"
          value={totalStudents}
          onClick={() => onViewChange('allStudents')}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          title="Students Currently Out"
          value={onOutingCount}
          onClick={() => handleOpenModal('Students Currently Out', studentsOnOuting)}
          color="bg-gradient-to-br from-yellow-500 to-yellow-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
        />
        <StatCard
          title="Students on Campus"
          value={totalStudents - onOutingCount}
          color="bg-gradient-to-br from-green-500 to-green-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
        />
        <StatCard
          title="Local Outings Today"
          value={todaysOutings.localStudents.length}
          onClick={() => handleOpenModal('Students on Local Outing Today', todaysOutings.localStudents)}
          color="bg-gradient-to-br from-teal-500 to-teal-600"
        />
        <StatCard
          title="Non-Local Outings Today"
          value={todaysOutings.nonLocalStudents.length}
          onClick={() => handleOpenModal('Students on Non-Local Outing Today', todaysOutings.nonLocalStudents)}
          color="bg-gradient-to-br from-indigo-500 to-indigo-600"
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Students Currently on Outing</h3>
        {studentsOnOuting.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {studentsOnOuting.slice(0, 5).map(student => (
              <li key={student.id} className="py-3 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  {student.faceImage ? (
                    <img className="h-10 w-10 rounded-full object-cover" src={student.faceImage} alt={student.name} />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">{student.rollNumber} &bull; Year {student.year} &bull; {student.gender}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-600">
                  {outingLogs.find(log => log.studentId === student.id && !log.checkInTime)?.outingType} Outing
                </span>
              </li>
            ))}
            {studentsOnOuting.length > 5 && (
              <li className="pt-4 text-center">
                <button onClick={() => handleOpenModal('Students Currently Out', studentsOnOuting)} className="text-blue-600 hover:underline font-medium">
                  View All {studentsOnOuting.length} Students
                </button>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-center text-gray-500 py-4">All students are currently on campus.</p>
        )}
      </div>

      <StudentListModal 
        isOpen={isListModalOpen}
        onClose={handleCloseModal}
        students={modalStudents}
        title={modalTitle}
      />
    </div>
  );
};

export default Dashboard;