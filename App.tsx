import React, { useState, createContext } from 'react';
import Header from './components/Header';
import RegisterStudent from './components/RegisterStudent';
import OutingKiosk from './components/OutingKiosk';
import Logbook from './components/Logbook';
import Dashboard from './components/Dashboard';
import AllStudents from './components/AllStudents';
import Footer from './components/Footer';
import { Student, OutingRecord, View } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { STUDENTS_STORAGE_KEY, OUTING_LOGS_STORAGE_key } from './constants';

interface AppContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  outingLogs: OutingRecord[];
  setOutingLogs: React.Dispatch<React.SetStateAction<OutingRecord[]>>;
}

export const AppContext = createContext<AppContextType>({
  students: [],
  setStudents: () => {},
  outingLogs: [],
  setOutingLogs: () => {},
});

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [students, setStudents] = useLocalStorage<Student[]>(STUDENTS_STORAGE_KEY, []);
  const [outingLogs, setOutingLogs] = useLocalStorage<OutingRecord[]>(OUTING_LOGS_STORAGE_key, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'kiosk':
        return <OutingKiosk />;
      case 'register':
        return <RegisterStudent />;
      case 'logbook':
        return <Logbook />;
      case 'allStudents':
        return <AllStudents onViewChange={setCurrentView} />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <AppContext.Provider value={{ students, setStudents, outingLogs, setOutingLogs }}>
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Header currentView={currentView} onViewChange={setCurrentView} />
        <main className="container mx-auto p-6 flex-grow">
          {renderView()}
        </main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;