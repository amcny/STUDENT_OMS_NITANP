import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CustomSelectProps {
  name: string;
  label: string;
  options: string[];
  value: string;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
  required?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ name, label, options, value, onChange, disabled = false, required = false, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onToggle?.(isOpen);
  }, [isOpen, onToggle]);

  const handleSelect = (optionValue: string) => {
    onChange(name, optionValue);
    setIsOpen(false);
  };

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  return (
    <div>
        <label id={`${name}-label`} className="block text-gray-700 font-medium mb-1">{label}</label>
        <div className="relative" ref={selectRef}>
            {/* This hidden input handles native form validation for the 'required' attribute */}
            {required && <input type="text" value={value} required className="opacity-0 absolute w-0 h-0 p-0 border-0" tabIndex={-1} onChange={()=>{}}/>}

            <button
                type="button"
                aria-haspopup="listbox"
                aria-labelledby={`${name}-label`}
                aria-expanded={isOpen}
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-2 text-left bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition duration-150 ease-in-out flex justify-between items-center ${disabled ? 'bg-gray-200 cursor-not-allowed text-gray-500' : 'text-gray-800 focus:bg-white'}`}
            >
                <span className={value ? 'text-gray-800' : 'text-gray-500'}>
                    {value || (disabled ? 'Select Gender First' : `Select ${label}`)}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            <div
                className={`absolute z-30 w-full mt-1 bg-white rounded-md shadow-lg transition-all duration-200 ease-out transform ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                style={{ transformOrigin: 'top' }}
            >
                <ul
                    tabIndex={-1}
                    role="listbox"
                    aria-labelledby={`${name}-label`}
                    className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                >
                    {options.map(option => (
                        <li
                            key={option}
                            role="option"
                            aria-selected={value === option}
                            onClick={() => handleSelect(option)}
                            className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-100 ${value === option ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-900'}`}
                        >
                            <span className="block truncate">{option}</span>
                            {value === option ? (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </div>
  );
};

export default CustomSelect;