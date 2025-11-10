import React, { useState, useContext, useEffect, useRef } from 'react';
import { Student } from '../types';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import Alert from './Alert';
import { AppContext } from '../App';
import { extractFaceFeatures } from '../services/facialRecognitionService';
import CustomSelect from './CustomSelect';
import { 
    BRANCH_OPTIONS, YEAR_OPTIONS, GENDER_OPTIONS, 
    STUDENT_TYPE_OPTIONS, BOYS_HOSTELS, GIRLS_HOSTELS 
} from '../constants';

// Allow XLSX global
declare var XLSX: any;

const EXPECTED_HEADERS = [
    'name', 'rollNumber', 'registrationNumber', 'contactNumber',
    'branch', 'year', 'gender', 'studentType', 'hostel', 'roomNumber'
];

const RegisterStudent: React.FC = () => {
  const { students, setStudents } = useContext(AppContext);
  const [formData, setFormData] = useState({
    name: '', rollNumber: '', registrationNumber: '', contactNumber: '',
    branch: '', year: '', gender: '', studentType: '', hostel: '', roomNumber: '',
  });
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isHostelDropdownOpen, setIsHostelDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formData.studentType === 'Day-Scholar' && (formData.hostel !== '' || formData.roomNumber !== '')) {
        setFormData(prev => ({ ...prev, hostel: '', roomNumber: '' }));
    }
  }, [formData.studentType, formData.hostel, formData.roomNumber]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    const uppercaseFields = ['name', 'rollNumber', 'registrationNumber', 'roomNumber'];
    const processedValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newState = { ...prev, [name]: value };
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setAlert({ message: 'Please select a valid image file.', type: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
             setAlert({ message: 'File is too large. Please select an image under 5MB.', type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setFaceImage(reader.result as string);
        };
        reader.onerror = () => {
            setAlert({ message: 'Failed to read the image file.', type: 'error' });
        };
        reader.readAsDataURL(file);
    }
    // Reset file input to allow selecting the same file again
    e.target.value = '';
  };
  
  const handleImportClick = () => {
    importFileRef.current?.click();
  };
  
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAlert({ message: 'Reading and processing Excel file...', type: 'info' });
    setIsRegistering(true);

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
            throw new Error("The Excel sheet is empty or contains only a header.");
        }

        const headers = jsonData[0].map(h => String(h).trim());
        const headerMatch = JSON.stringify(headers) === JSON.stringify(EXPECTED_HEADERS);
        if (!headerMatch) {
            throw new Error(`Invalid headers. Expected: ${EXPECTED_HEADERS.join(', ')}`);
        }
        
        const rows = jsonData.slice(1);
        const newStudents: Student[] = [];
        const existingRegistrationNumbers = new Set(students.map(s => s.registrationNumber));
        const importedRegistrationNumbers = new Set<string>();

        for (const row of rows) {
            if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
                continue; // Skip empty rows
            }

            const registrationNumber = String(row[2] || '').trim().toUpperCase();
            if (!registrationNumber) {
                console.warn(`Skipping a row with a missing Registration Number.`);
                continue; // Skip rows without a registration number
            }
            if (existingRegistrationNumbers.has(registrationNumber) || importedRegistrationNumbers.has(registrationNumber)) {
                console.warn(`Skipping duplicate registration number: ${registrationNumber}`);
                continue;
            }

            const studentData: Omit<Student, 'id' | 'faceImage' | 'faceFeatures'> = {
                name: String(row[0] || '').toUpperCase(),
                rollNumber: String(row[1] || '').trim().toUpperCase(),
                registrationNumber: registrationNumber,
                contactNumber: String(row[3] || ''),
                branch: String(row[4] || ''),
                year: String(row[5] || ''),
                gender: String(row[6] || ''),
                studentType: String(row[7] || ''),
                hostel: String(row[8] || ''),
                roomNumber: String(row[9] || '').toUpperCase(),
            };

            newStudents.push({
                ...studentData,
                id: crypto.randomUUID(),
                faceImage: null,
                faceFeatures: null,
            });
            importedRegistrationNumbers.add(registrationNumber);
        }

        if (newStudents.length > 0) {
            setStudents(prev => [...prev, ...newStudents]);
            setAlert({ message: `Successfully imported ${newStudents.length} new students. Please add their photos from the 'All Students' page.`, type: 'success' });
        } else {
            setAlert({ message: 'No new students were imported. They may already exist in the database.', type: 'info' });
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to import students:", error);
        setAlert({ message: `Import failed: ${errorMessage}`, type: 'error' });
    } finally {
        setIsRegistering(false);
        // Reset file input to allow re-selection of the same file
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!faceImage) {
      setAlert({ message: 'Please capture or upload a face image.', type: 'error' });
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
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        setFormData({
            name: '', rollNumber: '', registrationNumber: '', contactNumber: '',
            branch: '', year: '', gender: '', studentType: '', hostel: '', roomNumber: '',
        });
        setFaceImage(null);

    } catch (error) {
        console.error("Failed to extract features:", error);
        setAlert({ message: 'Could not process face image. Please try again.', type: 'error' });
    } finally {
        setIsRegistering(false);
    }
  };

  const isHosteller = formData.studentType === 'Hosteller';
  const isGenderSelected = !!formData.gender;
  const currentHostelOptions = formData.gender === 'Male' ? BOYS_HOSTELS : GIRLS_HOSTELS;

  const baseFieldClasses = "w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

  const renderInput = (name: keyof typeof formData, label: string, type: string = 'text', required: boolean = true) => {
    const isUppercase = ['name', 'rollNumber', 'registrationNumber', 'roomNumber'].includes(name as string);
    const inputClasses = `${baseFieldClasses} ${isUppercase ? 'uppercase' : ''}`;
    return (
        <div>
            <label htmlFor={name} className="block text-gray-700 font-medium mb-1">{label}</label>
            <input 
                type={type} 
                id={name} 
                name={name} 
                value={formData[name]} 
                onChange={handleInputChange} 
                required={required} 
                className={inputClasses}
            />
        </div>
    );
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Register New Student</h2>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isRegistering}
            className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg disabled:bg-gray-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            <span>Import from Excel</span>
          </button>
          <input 
            type="file"
            ref={importFileRef}
            onChange={handleFileImport}
            className="hidden"
            accept=".xlsx, .xls, .csv"
          />
        </div>
      </div>
      {alert && <div className="mb-6"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Student Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-slate-50 rounded-lg border">
                {renderInput('name', 'Full Name')}
                {renderInput('rollNumber', 'Roll Number')}
                {renderInput('registrationNumber', 'Registration Number')}
                {renderInput('contactNumber', 'Contact Number')}
            </div>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Academic & Residential Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-slate-50 rounded-lg border">
                <CustomSelect name="branch" label="Branch" options={BRANCH_OPTIONS} value={formData.branch} onChange={handleSelectChange} required />
                <CustomSelect name="year" label="Year" options={YEAR_OPTIONS} value={formData.year} onChange={handleSelectChange} required />
                <CustomSelect name="gender" label="Gender" options={GENDER_OPTIONS} value={formData.gender} onChange={handleSelectChange} required />
                <CustomSelect name="studentType" label="Student Type" options={STUDENT_TYPE_OPTIONS} value={formData.studentType} onChange={handleSelectChange} required />
                
                <div className={`
                    lg:col-span-2 
                    grid 
                    transition-[grid-template-rows] duration-500 ease-in-out
                    ${isHosteller ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
                `}>
                    <div className={`min-h-0 ${isHosteller ? '' : 'overflow-hidden'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 md:mt-0">
                            <CustomSelect 
                                name="hostel" 
                                label="Hostel" 
                                options={isGenderSelected ? currentHostelOptions : []} 
                                value={formData.hostel} 
                                onChange={handleSelectChange} 
                                required={isHosteller} 
                                disabled={!isGenderSelected} 
                                onToggle={setIsHostelDropdownOpen}
                            />
                            {renderInput('roomNumber', 'Room Number', 'text', isHosteller)}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4 border-l-4 border-blue-500 pl-3">Biometric Registration</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start space-y-4 sm:space-y-0 sm:space-x-6 bg-slate-50 p-6 rounded-lg border">
                <div className="flex flex-col space-y-3">
                    <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="bg-indigo-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-indigo-700 transition duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg w-60"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span>{faceImage ? 'Retake with Camera' : 'Capture with Camera'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleUploadClick}
                        className="bg-slate-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-slate-700 transition duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg w-60"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span>Upload an Image</span>
                    </button>
                </div>
                <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 overflow-hidden">
                    {faceImage ? (
                        <img src={faceImage} alt="Captured face" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-gray-500 text-center">Image Preview</span>
                    )}
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelect}
                />
            </div>
        </section>

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