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
import { auth } from './firebase'; // Use the centralized instances
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { onStudentsUpdate, onOutingLogsUpdate, onVisitorLogsUpdate } from './services/firebaseService';

type UserRole = 'admin' | 'security';

// The context now provides the data arrays and the user's role.
// Components will use the firebaseService to modify data.
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
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [outingLogs, setOutingLogs] = useState<OutingRecord[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorPassRecord[]>([]);
  const [authState, setAuthState] = useState<AuthState>({ gate: null, isLoading: true, role: null });
  const [isKioskOnlyMode, setIsKioskOnlyMode] = useState(false);

  useEffect(() => {
    // Check for Kiosk mode once on initial load.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'kiosk') {
      setIsKioskOnlyMode(true);
    }

    // Main effect to handle authentication state and subsequent data fetching.
    const unsubscribeAuth = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      let dataUnsubscribers: (() => void)[] = [];
      
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
        
        // Set auth state now that we have a user.
        setAuthState({ gate: gateName, isLoading: false, role });

        // **CRITICAL FIX**: Only set up data listeners AFTER authentication is confirmed.
        const unsubscribeStudents = onStudentsUpdate(setStudents);
        const unsubscribeOutingLogs = onOutingLogsUpdate(setOutingLogs);
        const unsubscribeVisitorLogs = onVisitorLogsUpdate(setVisitorLogs);
        
        dataUnsubscribers = [unsubscribeStudents, unsubscribeOutingLogs, unsubscribeVisitorLogs];

      } else {
        // --- USER IS LOGGED OUT ---
        setAuthState({ gate: null, isLoading: false, role: null });
        // Clear all data to prevent showing stale info on next login.
        setStudents([]);
        setOutingLogs([]);
        setVisitorLogs([]);
      }
      
      // The onAuthStateChanged listener can return a cleanup function.
      // This will be called when the auth state changes again (e.g., user logs out).
      return () => {
        dataUnsubscribers.forEach(unsub => unsub());
      };
    });

    // Cleanup function for when the App component unmounts.
    return () => {
      unsubscribeAuth();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount.


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