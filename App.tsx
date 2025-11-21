
import React, { useState, createContext, useEffect, useRef } from 'react';
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
import { auth } from './firebase'; 
import { onAuthStateChanged, signOut, User as FirebaseUser, Unsubscribe } from 'firebase/auth';
import { onStudentsUpdate, onOutingLogsUpdate, onVisitorLogsUpdate, recordUserLogin } from './services/firebaseService';

type UserRole = 'admin' | 'security';

interface AppContextType {
  students: Student[];
  outingLogs: OutingRecord[];
  visitorLogs: VisitorPassRecord[];
  role: UserRole | null;
}

export const AppContext = createContext<AppContextType>({
  students: [],
  outingLogs: [],
  visitorLogs: [],
  role: null,
});

interface AuthState {
    gate: string | null;
    isLoading: boolean;
    role: UserRole | null;
    lastLoginTime: string | null;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [outingLogs, setOutingLogs] = useState<OutingRecord[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorPassRecord[]>([]);
  const [authState, setAuthState] = useState<AuthState>({ gate: null, isLoading: true, role: null, lastLoginTime: null });
  const [isKioskOnlyMode, setIsKioskOnlyMode] = useState(false);

  // Refs to hold unsubscribe functions to ensure they persist across renders and can be cleaned up
  const unsubscribeStudentsRef = useRef<Unsubscribe | null>(null);
  const unsubscribeOutingLogsRef = useRef<Unsubscribe | null>(null);
  const unsubscribeVisitorLogsRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'kiosk') {
      setIsKioskOnlyMode(true);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user && user.email) {
        // --- USER IS LOGGED IN ---
        const email = user.email.toLowerCase();
        let gateName: string;
        let role: UserRole;

        if (email === 'admin.som@nitandhra.ac.in') {
            role = 'admin';
            gateName = 'Admin';
        } else {
            role = 'security';
            if (email === 'frontgate.som@nitandhra.ac.in') {
                gateName = 'Front Gate';
            } else if (email === 'backgate.som@nitandhra.ac.in') {
                gateName = 'Back Gate';
            } else {
                const emailPrefix = email.split('@')[0];
                gateName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
            }
        }

        // Record Login and get Previous Login Time
        const prevLogin = await recordUserLogin(user.uid, email, role, gateName);

        setAuthState({ gate: gateName, isLoading: false, role, lastLoginTime: prevLogin });

        // --- START DATA LISTENERS (SEQUENTIALLY AFTER AUTH) ---
        // We only start them if we are sure we are authenticated to prevent permission errors
        if (!unsubscribeStudentsRef.current) {
            unsubscribeStudentsRef.current = onStudentsUpdate(setStudents);
        }
        if (!unsubscribeOutingLogsRef.current) {
            unsubscribeOutingLogsRef.current = onOutingLogsUpdate(setOutingLogs);
        }
        if (!unsubscribeVisitorLogsRef.current) {
            unsubscribeVisitorLogsRef.current = onVisitorLogsUpdate(setVisitorLogs);
        }

      } else {
        // --- USER IS LOGGED OUT ---
        setAuthState({ gate: null, isLoading: false, role: null, lastLoginTime: null });

        // --- CLEANUP DATA LISTENERS ---
        if (unsubscribeStudentsRef.current) {
            unsubscribeStudentsRef.current();
            unsubscribeStudentsRef.current = null;
        }
        if (unsubscribeOutingLogsRef.current) {
            unsubscribeOutingLogsRef.current();
            unsubscribeOutingLogsRef.current = null;
        }
        if (unsubscribeVisitorLogsRef.current) {
            unsubscribeVisitorLogsRef.current();
            unsubscribeVisitorLogsRef.current = null;
        }

        // Clear local data for security
        setStudents([]);
        setOutingLogs([]);
        setVisitorLogs([]);
      }
    });

    return () => {
      unsubscribeAuth();
      // Cleanup on unmount
      if (unsubscribeStudentsRef.current) unsubscribeStudentsRef.current();
      if (unsubscribeOutingLogsRef.current) unsubscribeOutingLogsRef.current();
      if (unsubscribeVisitorLogsRef.current) unsubscribeVisitorLogsRef.current();
    };
  }, []);


  const handleLogout = async () => {
    // Manually trigger cleanup before signing out to be safe
    if (unsubscribeStudentsRef.current) { unsubscribeStudentsRef.current(); unsubscribeStudentsRef.current = null; }
    if (unsubscribeOutingLogsRef.current) { unsubscribeOutingLogsRef.current(); unsubscribeOutingLogsRef.current = null; }
    if (unsubscribeVisitorLogsRef.current) { unsubscribeVisitorLogsRef.current(); unsubscribeVisitorLogsRef.current = null; }
    
    setStudents([]);
    setOutingLogs([]);
    setVisitorLogs([]);

    try {
        await signOut(auth);
        setCurrentView('dashboard');
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
  
  const appContextValue = { students, outingLogs, visitorLogs, role: authState.role };

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
        <Header 
            currentView={currentView} 
            onViewChange={setCurrentView} 
            gate={authState.gate} 
            lastLogin={authState.lastLoginTime}
            onLogout={handleLogout} 
        />
        <main className="container mx-auto p-6 flex-grow">
          {renderView()}
        </main>
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;
