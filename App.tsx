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
import { STUDENTS_STORAGE_KEY, OUTING_LOGS_STORAGE_key, VISITOR_LOGS_STORAGE_KEY } from './constants';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

// --- Firebase Initialization ---
// Moved to module scope and exported to ensure a single instance is used across the app.
const firebaseConfig = {
  apiKey: "AIzaSyDYwa8CFx1eiGBpdfWP5OaFyD_Sq07Sh7Y",
  authDomain: "somnitanp.firebaseapp.com",
  projectId: "somnitanp",
  storageBucket: "somnitanp.firebasestorage.app",
  messagingSenderId: "1072085106820",
  appId: "1:1072085106820:web:898f64557be5ebb0b702d1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// -----------------------------

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

interface AuthState {
    gate: string | null;
    isLoading: boolean;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [students, setStudents] = useLocalStorage<Student[]>(STUDENTS_STORAGE_KEY, []);
  const [outingLogs, setOutingLogs] = useLocalStorage<OutingRecord[]>(OUTING_LOGS_STORAGE_key, []);
  const [visitorLogs, setVisitorLogs] = useLocalStorage<VisitorPassRecord[]>(VISITOR_LOGS_STORAGE_KEY, []);
  const [authState, setAuthState] = useState<AuthState>({ gate: null, isLoading: true });
  const [isKioskOnlyMode, setIsKioskOnlyMode] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'kiosk') {
      setIsKioskOnlyMode(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user && user.email) {
            const emailPrefix = user.email.split('@')[0].toLowerCase();
            let gateName: string;
            if (emailPrefix === 'frontgate') {
                gateName = 'Front Gate';
            } else if (emailPrefix === 'backgate') {
                gateName = 'Back Gate';
            } else {
                // Handle any other authenticated user by creating a display name.
                // This prevents getting stuck on the login page for valid users
                // that aren't the main gate accounts.
                gateName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
            }
            setAuthState({ gate: gateName, isLoading: false });
        } else {
            setAuthState({ gate: null, isLoading: false });
        }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
        await signOut(auth);
        setCurrentView('dashboard'); // Reset to dashboard on logout
    } catch (error) {
        console.error("Error signing out: ", error);
    }
  };

  const renderView = () => {
    if (!authState.gate) return null;
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'kiosk':
        return <OutingKiosk gate={authState.gate} />;
      case 'register':
        return <RegisterStudent />;
      case 'logbook':
        return <Logbook gate={authState.gate} />;
      case 'allStudents':
        return <AllStudents onViewChange={setCurrentView} />;
      case 'visitorPass':
        return <VisitorGatePass gate={authState.gate} />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  if (authState.isLoading) {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="border-8 border-gray-200 border-t-blue-500 rounded-full w-16 h-16 animate-spin"></div>
        </div>
    );
  }

  if (!authState.gate) {
    return <Login />;
  }

  const appContextValue = { students, setStudents, outingLogs, setOutingLogs, visitorLogs, setVisitorLogs };

  if (isKioskOnlyMode) {
    return (
      <AppContext.Provider value={appContextValue}>
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <OutingKiosk gate={authState.gate} />
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Header currentView={currentView} onViewChange={setCurrentView} gate={authState.gate} onLogout={handleLogout} />
        <main className="container mx-auto p-6 flex-grow">
          {renderView()}
        </main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;
