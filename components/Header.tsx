import React from 'react';
import { View } from '../types';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
  gate: string;
  onLogout: () => void;
}

const NavButton: React.FC<{
  label: string;
  view: View;
  currentView: View;
  onViewChange: (view: View) => void;
}> = ({ label, view, currentView, onViewChange }) => {
  const isActive = currentView === view;
  const baseClasses = 'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200';
  const activeClasses = 'bg-blue-500 text-white shadow-md';
  const inactiveClasses = 'text-gray-300 hover:bg-slate-700 hover:text-white';
  return (
    <button
      onClick={() => onViewChange(view)}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      {label}
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ currentView, onViewChange, gate, onLogout }) => {
  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-lg sticky top-0 z-40">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">Student Outing Management</h1>
        </div>
        <div className="hidden md:flex flex-grow justify-center space-x-4">
            <NavButton label="Dashboard" view="dashboard" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Kiosk" view="kiosk" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Register Student" view="register" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Logbook" view="logbook" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Visitor Pass" view="visitorPass" currentView={currentView} onViewChange={onViewChange} />
        </div>
        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300 hidden sm:block">
                Logged in: <span className="font-semibold text-white">{gate}</span>
            </span>
            <button 
                onClick={onLogout} 
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-red-500 text-white hover:bg-red-600 shadow"
            >
                Logout
            </button>
        </div>
      </nav>
    </header>
  );
};

export default Header;