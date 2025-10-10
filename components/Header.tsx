
import React from 'react';
import { View } from '../types';

interface HeaderProps {
  currentView: View;
  onViewChange: (view: View) => void;
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

const Header: React.FC<HeaderProps> = ({ currentView, onViewChange }) => {
  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-lg sticky top-0 z-40">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">Student Outing Management - NIT Andhra Pradesh</h1>
        </div>
        <div className="hidden md:flex space-x-4 items-center">
            <NavButton label="Dashboard" view="dashboard" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Kiosk" view="kiosk" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Register Student" view="register" currentView={currentView} onViewChange={onViewChange} />
            <NavButton label="Logbook" view="logbook" currentView={currentView} onViewChange={onViewChange} />
        </div>
      </nav>
    </header>
  );
};

export default Header;