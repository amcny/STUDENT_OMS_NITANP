import React, { useState, useContext, useEffect } from 'react';
import { Student } from '../types';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import Alert from './Alert';
import { AppContext } from '../App';
import { extractFaceFeatures } from '../services/facialRecognitionService';

const BRANCH_OPTIONS = [
    'Biotechnology', 'Chemical Engineering', 'Civil Engineering', 
    'Computer Science & Engg.', 'Electrical Engineering', 'Electronics & Communication Engineering', 
    'Mechanical Engineering', 'Metallurgical & Materials Engineering', 'School of Sciences', 
    'School of Humanities and Management'
];
const YEAR_OPTIONS = ['I', 'II', 'III', 'IV'];
const GENDER_OPTIONS = ['Male', 'Female'];
const STUDENT_TYPE_OPTIONS = ['Hosteller', 'Day-Scholar'];
const BOYS_HOSTELS = [
    'Godavari', 'Vamsadhara', 'Pranahita', 'Sabari', 'Indravathi', 
    'Nagavali', 'Purna', 'Manjeera', 'Banganga', 'Swarnamukhi'
];
const GIRLS_HOSTELS = [
    'Krishnaveni', 'Bhima', 'Thungabhadra', 'Ghataprabha', 'Munneru'
];

const RegisterStudent: React.FC = () => {
  const { students, setStudents } = useContext(AppContext);
  const [formData, setFormData] = useState({
    name: '', rollNumber: '', registrationNumber: '', contactNumber: '',
    branch: '', year: '', gender: '', studentType: '', hostel: '',
  });
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    // Reset hostel if student type is Day-Scholar or if gender changes
    if (formData.studentType === 'Day-Scholar') {
      if (formData.hostel !== '') {
        setFormData(prev => ({ ...prev, hostel: '' }));
      }
    }
  }, [formData.studentType, formData.gender, formData.hostel]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Convert to uppercase for specific text fields
    const uppercaseFields = ['name', 'rollNumber', 'registrationNumber'];
    const processedValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;

    setFormData(prev => {
      const newState = { ...prev, [name]: processedValue };
      // If gender is changed, reset hostel as the list is now invalid
      if (name === 'gender' || name === 'studentType') {
        newState.hostel = '';
      }
      return newState;
    });
  };

  const handleCapture = (imageBase64: string) => {
    setFaceImage(imageBase64);
    setIsCameraOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!faceImage) {
      setAlert({ message: 'Please capture a face image.', type: 'error' });
      return;
    }
    
    if (students.some(s => s.rollNumber.toLowerCase() === formData.rollNumber.trim().toLowerCase())) {
        setAlert({ message: 'A student with this Roll Number already exists.', type: 'error' });
        return;
    }

    setIsRegistering(true);
    setAlert({ message: 'Analyzing face and extracting features... Please wait.', type: 'info' });

    try {
        const features = await extractFaceFeatures(faceImage);
        
        const newStudent: Student = {
          id: crypto.randomUUID(),
          ...formData,
          faceImage,
          faceFeatures: features,
        };

        setStudents(prevStudents => [...prevStudents, newStudent]);
        setAlert({ message: 'Student registered successfully!', type: 'success' });
        
        // Scroll to top to show the success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Reset form
        setFormData({
            name: '', rollNumber: '', registrationNumber: '', contactNumber: '',
            branch: '', year: '', gender: '', studentType: '', hostel: '',
        });
        setFaceImage(null);

    } catch (error) {
        console.error("Failed to extract features:", error);
        setAlert({ message: 'Could not process face image. Please try again.', type: 'error' });
    } finally {
        setIsRegistering(false);
    }
  };

  const currentHostelOptions = formData.gender === 'Male' ? BOYS_HOSTELS : GIRLS_HOSTELS;

  const baseFieldClasses = "w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

  const renderSelect = (name: keyof typeof formData, label: string, options: string[]) => (
    <div>
        <label htmlFor={name} className="block text-gray-700 font-medium mb-1">{label}</label>
        <div className="relative">
            <select
                id={name}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                required
                className={`${baseFieldClasses} appearance-none pr-10`}
            >
                <option value="" disabled>Select {label}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    </div>
  );

  const renderInput = (name: keyof typeof formData, label: string, type: string = 'text') => {
    // FIX: Cast `name` to string to satisfy Array.prototype.includes() type requirement.
    const isUppercase = ['name', 'rollNumber', 'registrationNumber'].includes(name as string);
    const inputClasses = `${baseFieldClasses} ${isUppercase ? 'uppercase' : ''}`;
    return (
        <div>
            <label htmlFor={name} className="block text-gray-700 font-medium mb-1">{label}</label>
            <input 
                type={type} 
                id={name} 
                name={name} 
                value={formData[name]} 
                onChange={handleChange} 
                required 
                className={inputClasses}
            />
        </div>
    );
  };


  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Register New Student</h2>
      {alert && <div className="mb-6"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Student Details */}
        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Student Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border">
                {renderInput('name', 'Full Name')}
                {renderInput('rollNumber', 'Roll Number')}
                {renderInput('registrationNumber', 'Registration Number')}
                {renderInput('contactNumber', 'Contact Number')}
            </div>
        </section>

        {/* Section 2: Academic & Residential Info */}
        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Academic & Residential Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border">
                {renderSelect('branch', 'Branch', BRANCH_OPTIONS)}
                {renderSelect('year', 'Year', YEAR_OPTIONS)}
                {renderSelect('gender', 'Gender', GENDER_OPTIONS)}
                {renderSelect('studentType', 'Student Type', STUDENT_TYPE_OPTIONS)}
                
                {formData.studentType === 'Hosteller' && formData.gender && (
                    <div className="md:col-span-2">
                        {renderSelect('hostel', 'Hostel', currentHostelOptions)}
                    </div>
                )}
            </div>
        </section>

        {/* Section 3: Biometric Registration */}
        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Biometric Registration</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start space-y-4 sm:space-y-0 sm:space-x-6 bg-slate-50 p-6 rounded-lg border">
                <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="bg-indigo-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-indigo-700 transition duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{faceImage ? 'Retake Face Image' : 'Capture Face Image'}</span>
                </button>
                <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 overflow-hidden">
                    {faceImage ? (
                        <img src={faceImage} alt="Captured face" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-gray-500 text-center">Image Preview</span>
                    )}
                </div>
            </div>
        </section>

        {/* Submit Button */}
        <div className="mt-8 border-t pt-6">
          <button
            type="submit"
            disabled={isRegistering}
            className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 text-lg flex justify-center items-center disabled:bg-blue-400 disabled:cursor-wait shadow-md hover:shadow-lg"
          >
            {isRegistering ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                </>
            ) : (
                'Register Student'
            )}
          </button>
        </div>
      </form>
      
      <Modal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} title="Capture Student's Face">
        <CameraCapture onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
      </Modal>
    </div>
  );
};

export default RegisterStudent;