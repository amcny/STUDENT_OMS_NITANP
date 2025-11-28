

import React, { useState, useContext, useEffect, useRef } from 'react';
import { Student } from '../types';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import Alert from './Alert';
import { AppContext } from '../App';
import { extractFaceFeatures } from '../services/facialRecognitionService';
import * as firebaseService from '../services/firebaseService';
import CustomSelect from './CustomSelect';
import { 
    BRANCH_OPTIONS, YEAR_OPTIONS, GENDER_OPTIONS, 
    STUDENT_TYPE_OPTIONS, BOYS_HOSTELS, GIRLS_HOSTELS 
} from '../constants';

// Allow XLSX global
declare var XLSX: any;

const MANDATORY_HEADERS = ['name', 'rollNumber'];

const INITIAL_FORM_DATA = {
    name: '', rollNumber: '', contactNumber: '',
    branch: '', year: '', gender: '', studentType: '', hostel: '', roomNumber: '',
};

// --- Image Compression Utility ---
const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG at 0.8 quality
          resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
          resolve(base64Str); // Fallback to original if context fails
      }
    };
    img.onerror = () => resolve(base64Str); // Fallback to original on error
  });
};


const RegisterStudent: React.FC = () => {
  const { students, role } = useContext(AppContext);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const singleImageInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportStatus, setExcelImportStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [photoImportStatus, setPhotoImportStatus] = useState<{ message: string; type: 'success' | 'error' | 'info'; progress?: number; total?: number } | null>(null);

  useEffect(() => {
    if (formData.gender || formData.studentType) {
        setFormData(prev => ({ ...prev, hostel: '' }));
    }
    if (formData.studentType === 'Day-Scholar') {
      setFormData(prev => ({ ...prev, hostel: '', roomNumber: '' }));
    }
  }, [formData.gender, formData.studentType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const uppercaseFields = ['name', 'rollNumber', 'roomNumber'];
    const processedValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCapture = async (imageBase64: string) => {
    const compressed = await compressImage(imageBase64);
    setFaceImage(compressed);
    setIsCameraOpen(false);
  };

  const handleUploadClick = () => {
    singleImageInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setAlert({ message: 'Please select a valid image file.', type: 'error' }); return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit (we compress it anyway)
        setAlert({ message: 'File is too large. Please select an image under 10MB.', type: 'error' }); return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
          const rawBase64 = reader.result as string;
          const compressedBase64 = await compressImage(rawBase64);
          setFaceImage(compressedBase64);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  
  const resetForm = () => {
      setFormData(INITIAL_FORM_DATA);
      setFaceImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!faceImage) {
      setAlert({ message: 'A face image is required for registration.', type: 'error' }); return;
    }
    if (students.some(s => s.rollNumber === formData.rollNumber)) {
        setAlert({ message: 'A student with this Roll Number already exists.', type: 'error' }); return;
    }

    setIsSaving(true);
    setAlert({ message: 'Analyzing face and saving to database... Please wait.', type: 'info' });

    try {
      const features = await extractFaceFeatures(faceImage);
      const studentData = {
        ...formData,
        faceFeatures: features,
      };
      await firebaseService.addStudent(studentData, faceImage);
      setAlert({ message: `${formData.name} has been registered successfully!`, type: 'success' });
      resetForm();
    } catch (error: any) {
      console.error("Registration failed:", error);
      setAlert({ message: error.message || "Could not process the request.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDownloadTemplate = () => {
    if (typeof XLSX === 'undefined') {
        setExcelImportStatus({ message: 'Excel library not loaded. Please refresh.', type: 'error' });
        return;
    }
    
    // Sample row to guide the user
    const sampleData = [
        {
            name: "STUDENT NAME",
            rollNumber: "6xxxxx",
            contactNumber: "9876543210",
            branch: "Computer Science & Engg.",
            year: "IV",
            gender: "Male",
            studentType: "Hosteller",
            hostel: "Godavari",
            roomNumber: "F-31"
        }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    
    // Add column widths for better readability
    const wscols = [
        {wch: 20}, // name
        {wch: 15}, // rollNumber
        {wch: 15}, // contactNumber
        {wch: 30}, // branch
        {wch: 10}, // year
        {wch: 10}, // gender
        {wch: 15}, // studentType
        {wch: 15}, // hostel
        {wch: 10}  // roomNumber
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Template");
    XLSX.writeFile(wb, "Student_Registration_Template.xlsx");
  };

  const handleExcelImportClick = () => {
    setExcelImportStatus(null);
    excelInputRef.current?.click();
  };
  
  const handleExcelFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingExcel(true);
    setExcelImportStatus({ message: 'Reading and processing Excel file...', type: 'info' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            setExcelImportStatus({ message: 'The Excel file is empty or in an invalid format.', type: 'error' });
            return;
        }

        const headers = Object.keys(json[0]);
        const missingHeaders = MANDATORY_HEADERS.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            setExcelImportStatus({ message: `Missing required columns in Excel file: ${missingHeaders.join(', ')}`, type: 'error' });
            return;
        }

        const newStudents: Omit<Student, 'id'>[] = [];
        const existingRollNumbers = new Set(students.map(s => s.rollNumber));
        const duplicateRollNumbersInFile = new Set<string>();
        let addedCount = 0;
        let skippedCount = 0;

        for (const row of json) {
            if (!row.name || !row.rollNumber) {
                skippedCount++;
                continue;
            }
            
            const rollNum = String(row.rollNumber).toUpperCase();
            if (existingRollNumbers.has(rollNum) || duplicateRollNumbersInFile.has(rollNum)) {
                skippedCount++;
                continue;
            }
            duplicateRollNumbersInFile.add(rollNum);
            
            newStudents.push({
                name: String(row.name).toUpperCase(),
                rollNumber: rollNum,
                contactNumber: String(row.contactNumber || ''),
                branch: String(row.branch || ''),
                year: String(row.year || ''),
                gender: String(row.gender || ''),
                studentType: String(row.studentType || ''),
                hostel: String(row.hostel || ''),
                roomNumber: String(row.roomNumber || '').toUpperCase(),
                faceImage: null,
                faceFeatures: null,
            });
            addedCount++;
        }
        
        if(addedCount > 0) {
            await firebaseService.addStudentsBatch(newStudents);
        }
        setExcelImportStatus({ message: `Successfully imported ${addedCount} new students. ${skippedCount} rows were skipped due to missing data or duplicates.`, type: 'success' });

      } catch (error) {
        console.error("Error processing Excel file:", error);
        setExcelImportStatus({ message: 'Failed to process the Excel file. Please ensure it is a valid .xlsx file.', type: 'error' });
      } finally {
        setIsImportingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };
  
  const handlePhotoImportClick = () => {
    if (students.length === 0) {
        setPhotoImportStatus({
            message: 'Please register or import student data via Excel first.',
            type: 'error',
        });
        return;
    }
    setPhotoImportStatus(null);
    photoInputRef.current?.click();
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
      });
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length === 0) return;

      setIsImportingPhotos(true);
      setPhotoImportStatus({
          message: `Starting photo import... Found ${files.length} files.`,
          type: 'info',
          progress: 0,
          total: files.length,
      });

      const studentMap = new Map(students.map(s => [s.rollNumber.toUpperCase(), s.id]));
      let successCount = 0;
      const notFoundFiles: string[] = [];
      const errorFiles: string[] = [];

      // Process files in parallel batches to speed up
      const processBatch = async (batch: File[]) => {
          await Promise.all(batch.map(async (file, index) => {
              const rollNumber = file.name.split('.').slice(0, -1).join('.').toUpperCase();
              
              if (!studentMap.has(rollNumber)) {
                  notFoundFiles.push(file.name);
                  return;
              }

              try {
                  const base64Image = await readFileAsBase64(file);
                  // COMPRESSION STEP
                  const compressedImage = await compressImage(base64Image);
                  
                  const features = await extractFaceFeatures(compressedImage);
                  await firebaseService.updateStudentPhotoByRollNo(rollNumber, compressedImage, features);
                  successCount++;
              } catch (error) {
                  console.error(`Failed to process image for ${rollNumber}:`, error);
                  errorFiles.push(file.name);
              } finally {
                  setPhotoImportStatus(prev => ({
                      ...prev!,
                      message: `Processing...`,
                      progress: (prev?.progress || 0) + 1,
                  }));
              }
          }));
      };
      
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          await processBatch(batch);
      }
      
      let summary = `Import complete. Successfully processed ${successCount} photos.`;
      if (notFoundFiles.length > 0) {
          summary += ` ${notFoundFiles.length} photos did not match any student.`;
      }
      if (errorFiles.length > 0) {
          summary += ` ${errorFiles.length} photos failed during face analysis.`;
      }

      setPhotoImportStatus({
          message: summary,
          type: (notFoundFiles.length > 0 || errorFiles.length > 0) ? 'error' : 'success',
      });
      
      setIsImportingPhotos(false);
      if (e.target) e.target.value = '';
  };
  
  if (role !== 'admin') {
    return (
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 text-lg">You do not have permission to register students. Please contact an administrator.</p>
        </div>
    );
  }
  
  const currentHostelOptions = formData.gender === 'Male' ? BOYS_HOSTELS : (formData.gender === 'Female' ? GIRLS_HOSTELS : []);
  const baseFieldClasses = "w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-gray-800 shadow-sm";

  return (
    <>
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Register Student</h2>
        
        <div className="flex flex-col lg:flex-row gap-12">
            {/* Left side: Single registration form */}
            <div className="lg:w-1/2">
                <h3 className="text-xl font-bold text-gray-700 mb-4">Register a New Student</h3>
                {alert && <div className="mb-4"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2"><label className="block text-gray-700 font-medium mb-1">Full Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                        <div><label className="block text-gray-700 font-medium mb-1">Roll Number</label><input type="text" name="rollNumber" value={formData.rollNumber} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                        <div><label className="block text-gray-700 font-medium mb-1">Contact Number</label><input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required className={baseFieldClasses} /></div>
                        <div className="md:col-span-2"><CustomSelect name="branch" label="Branch" options={BRANCH_OPTIONS} value={formData.branch} onChange={handleSelectChange} required /></div>
                        <CustomSelect name="year" label="Year" options={YEAR_OPTIONS} value={formData.year} onChange={handleSelectChange} required />
                        <CustomSelect name="gender" label="Gender" options={GENDER_OPTIONS} value={formData.gender} onChange={handleSelectChange} required />
                        <div className="md:col-span-2"><CustomSelect name="studentType" label="Student Type" options={STUDENT_TYPE_OPTIONS} value={formData.studentType} onChange={handleSelectChange} required /></div>
                        {formData.studentType === 'Hosteller' && (
                           <>
                             <CustomSelect name="hostel" label="Hostel" options={currentHostelOptions} value={formData.hostel} onChange={handleSelectChange} required disabled={!formData.gender} />
                             <div><label className="block text-gray-700 font-medium mb-1">Room Number</label><input type="text" name="roomNumber" value={formData.roomNumber} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} /></div>
                           </>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Biometric Data (Required)</h3>
                        <div className="flex items-center space-x-6 bg-slate-50 p-4 rounded-md">
                            <div className="flex flex-col space-y-2">
                                <button type="button" onClick={() => setIsCameraOpen(true)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition w-48 flex items-center justify-center space-x-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span>{faceImage ? 'Retake Photo' : 'Use Camera'}</span></button>
                                <button type="button" onClick={handleUploadClick} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 transition w-48 flex items-center justify-center space-x-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg><span>Upload Image</span></button>
                            </div>
                            <div className="w-24 h-24 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 overflow-hidden flex-shrink-0 flex items-center justify-center">{faceImage ? <img src={faceImage} alt="Captured face" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500 text-center p-2">Image Preview</span>}</div>
                        </div>
                        <input type="file" ref={singleImageInputRef} className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileSelect}/>
                    </div>

                    <div className="flex justify-end space-x-4 border-t pt-4 mt-6">
                        <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Clear Form</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold min-w-[120px]">{isSaving ? 'Saving...' : 'Register'}</button>
                    </div>
                </form>
            </div>
            
            {/* Right side: Bulk registration */}
            <div className="lg:w-1/2 lg:border-l lg:pl-12">
                <h3 className="text-xl font-bold text-gray-700 mb-4">Bulk Registration</h3>
                
                {/* Excel Import */}
                <div className="p-4 rounded-lg bg-slate-50 border space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold text-gray-600">1. Import from Excel</h4>
                         <button 
                            type="button"
                            onClick={handleDownloadTemplate} 
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Download Template</span>
                        </button>
                    </div>
                    <p className="text-sm text-gray-600">Upload an .xlsx file with student data. Required columns: <strong className="text-gray-800">name, rollNumber</strong>. Other columns are optional.</p>
                    <button type="button" onClick={handleExcelImportClick} disabled={isImportingExcel || isImportingPhotos} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition w-full flex items-center justify-center space-x-2 disabled:bg-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>{isImportingExcel ? 'Importing...' : 'Import from Excel'}</span></button>
                    <input type="file" ref={excelInputRef} onChange={handleExcelFileSelected} className="hidden" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                    {excelImportStatus && <div className="mt-2"><Alert message={excelImportStatus.message} type={excelImportStatus.type} onClose={() => setExcelImportStatus(null)} /></div>}
                </div>
                
                <div className="my-6"><div className="border-t"></div></div>
                
                {/* Photo Import */}
                <div className="p-4 rounded-lg bg-slate-50 border space-y-3">
                    <h4 className="text-lg font-semibold text-gray-600">2. Import Student Photos</h4>
                    <p className="text-sm text-gray-600">Upload multiple photos at once. Name each photo file with the student's <strong className="text-gray-800">Roll Number</strong> (e.g., <code className="bg-gray-200 text-red-600 px-1 rounded">6222241.jpg</code>).</p>
                    <button type="button" onClick={handlePhotoImportClick} disabled={isImportingExcel || isImportingPhotos} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 transition w-full flex items-center justify-center space-x-2 disabled:bg-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>{isImportingPhotos ? 'Importing...' : 'Import Photos'}</span></button>
                    <input type="file" ref={photoInputRef} onChange={handlePhotoFilesSelected} className="hidden" multiple accept="image/png, image/jpeg, image/webp" />
                    {isImportingPhotos && photoImportStatus?.total && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(photoImportStatus.progress! / photoImportStatus.total) * 100}%` }}></div>
                        </div>
                    )}
                    {photoImportStatus && <div className="mt-2"><Alert message={photoImportStatus.message} type={photoImportStatus.type} onClose={() => setPhotoImportStatus(null)} /></div>}
                </div>
            </div>
        </div>
      </div>
      
      <Modal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} title="Capture Face Image">
          <CameraCapture onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
      </Modal>
    </>
  );
};

export default RegisterStudent;