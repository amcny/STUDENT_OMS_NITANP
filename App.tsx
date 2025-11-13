import React, { useState, createContext, useEffect } from 'react';
import Header from './components/Header';
import RegisterStudent from './components/RegisterStudent';
import OutingKiosk from './components/OutingKiosk';
import Logbook from './components/Logbook';
import Dashboard from './components/Dashboard';
import AllStudents from './components/AllStudents';
import VisitorGatePass from './components/VisitorGatePass';
import Footer from './components/Footer';
import Login from './components/Login';
import { Student, OutingRecord, View, VisitorPassRecord } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { STUDENTS_STORAGE_KEY, OUTING_LOGS_STORAGE_key, VISITOR_LOGS_STORAGE_KEY, GATE_STORAGE_KEY } from './constants';

interface AppContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  outingLogs: OutingRecord[];
  setOutingLogs: React.Dispatch<React.SetStateAction<OutingRecord[]>>;
  visitorLogs: VisitorPassRecord[];
  setVisitorLogs: React.Dispatch<React.SetStateAction<VisitorPassRecord[]>>;
}

export const AppContext = createContext<AppContextType>({
  students: [],
  setStudents: () => {},
  outingLogs: [],
  setOutingLogs: () => {},
  visitorLogs: [],
  setVisitorLogs: () => {},
});

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [students, setStudents] = useLocalStorage<Student[]>(STUDENTS_STORAGE_KEY, []);
  const [outingLogs, setOutingLogs] = useLocalStorage<OutingRecord[]>(OUTING_LOGS_STORAGE_key, []);
  const [visitorLogs, setVisitorLogs] = useLocalStorage<VisitorPassRecord[]>(VISITOR_LOGS_STORAGE_KEY, []);
  const [gate, setGate] = useLocalStorage<string | null>(GATE_STORAGE_KEY, null);
  const [isKioskOnlyMode, setIsKioskOnlyMode] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'kiosk') {
      setIsKioskOnlyMode(true);
    }
  }, []);

  const handleLogin = (gateName: string) => {
    setGate(gateName);
  };

  const handleLogout = () => {
    setGate(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'kiosk':
        return <OutingKiosk gate={gate!} />;
      case 'register':
        return <RegisterStudent />;
      case 'logbook':
        return <Logbook gate={gate!} />;
      case 'allStudents':
        return <AllStudents onViewChange={setCurrentView} />;
      case 'visitorPass':
        return <VisitorGatePass gate={gate!} />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  if (!gate) {
    return <Login onLogin={handleLogin} />;
  }

  const appContextValue = { students, setStudents, outingLogs, setOutingLogs, visitorLogs, setVisitorLogs };

  if (isKioskOnlyMode) {
    return (
      <AppContext.Provider value={appContextValue}>
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <OutingKiosk gate={gate} />
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Header currentView={currentView} onViewChange={setCurrentView} gate={gate} onLogout={handleLogout} />
        <main className="container mx-auto p-6 flex-grow">
          {renderView()}
        </main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;