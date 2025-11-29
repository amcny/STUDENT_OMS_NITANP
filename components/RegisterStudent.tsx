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

interface ImportStatus {
    message: string;
    type: 'success' | 'error' | 'info';
    progress?: number;
    total?: number;
    details?: {
        success: string[];
        skipped: string[];
        notFound: string[]; // repurposed for 'Invalid' in Excel
        analysisFailed: { file: string; reason: string }[];
    }
}

const RegisterStudent: React.FC = () => {
  const { students, role } = useContext(AppContext);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [rawFaceImage, setRawFaceImage] = useState<string | null>(null); // Store raw for features
  const [displayFaceImage, setDisplayFaceImage] = useState<string | null>(null); // Store compressed for display/upload
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const singleImageInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportStatus, setExcelImportStatus] = useState<ImportStatus | null>(null);
  const [skippedExcelRows, setSkippedExcelRows] = useState<any[]>([]); // Store full row data for overwrite
  
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);
  const [photoImportStatus, setPhotoImportStatus] = useState<ImportStatus | null>(null);
  const [skippedFiles, setSkippedFiles] = useState<File[]>([]); // To store skipped files for potential re-import

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
    // Keep raw for Analysis
    setRawFaceImage(imageBase64);
    // Compress for UI/Storage
    const compressed = await compressImage(imageBase64);
    setDisplayFaceImage(compressed);
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
          setRawFaceImage(rawBase64); // Keep raw for analysis
          const compressedBase64 = await compressImage(rawBase64);
          setDisplayFaceImage(compressedBase64); // Compress for display
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  
  const resetForm = () => {
      setFormData(INITIAL_FORM_DATA);
      setRawFaceImage(null);
      setDisplayFaceImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!rawFaceImage || !displayFaceImage) {
      setAlert({ message: 'A face image is required for registration.', type: 'error' }); return;
    }
    if (students.some(s => s.rollNumber === formData.rollNumber)) {
        setAlert({ message: 'A student with this Roll Number already exists.', type: 'error' }); return;
    }

    setIsSaving(true);
    setAlert({ message: 'Analyzing face (High Quality) and saving... Please wait.', type: 'info' });

    try {
      // SECURITY FIX: Extract features from the RAW image, not the compressed one.
      const features = await extractFaceFeatures(rawFaceImage);
      const studentData = {
        ...formData,
        faceFeatures: features,
      };
      // Save the compressed image to storage to save bandwidth
      await firebaseService.addStudent(studentData, displayFaceImage);
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
    setSkippedExcelRows([]);
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
        
        const details = {
            success: [] as string[],
            skipped: [] as string[],
            notFound: [] as string[], // Repurposed for invalid/missing data rows
            analysisFailed: [] as { file: string; reason: string }[]
        };

        const currentSkippedRows: any[] = [];

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const rowIdentifier = `Row ${i + 2} - ${row.rollNumber || 'No RollNo'}`;

            if (!row.name || !row.rollNumber) {
                details.notFound.push(`${rowIdentifier} (Missing name or roll number)`);
                continue;
            }
            
            const rollNum = String(row.rollNumber).toUpperCase();
            
            // Check for duplicates within the file itself
            if (duplicateRollNumbersInFile.has(rollNum)) {
                details.notFound.push(`${rollNum} (Duplicate in file)`);
                continue;
            }
            duplicateRollNumbersInFile.add(rollNum);

            // Check if student already exists in database
            if (existingRollNumbers.has(rollNum)) {
                details.skipped.push(rollNum);
                currentSkippedRows.push(row);
                continue;
            }
            
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
            details.success.push(rollNum);
        }
        
        if(newStudents.length > 0) {
            await firebaseService.addStudentsBatch(newStudents);
        }

        setSkippedExcelRows(currentSkippedRows);

        let summary = `Import complete. Added ${newStudents.length} new students.`;
        if (details.skipped.length > 0) {
            summary += ` ${details.skipped.length} skipped (already exist).`;
        }
        
        const hasErrors = details.notFound.length > 0;
        
        setExcelImportStatus({
            message: summary,
            type: hasErrors ? 'error' : 'success', // Show error color if there are missing/invalid rows, even if some succeeded
            total: json.length,
            details: details
        });

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

  const handleOverwriteExcelSkipped = async () => {
      if (skippedExcelRows.length === 0) return;

      setIsImportingExcel(true);
      setExcelImportStatus(prev => ({
          ...prev!,
          message: `Overwriting ${skippedExcelRows.length} students...`,
          type: 'info'
      }));

      try {
          // Map Roll Numbers to IDs
          const studentMap = new Map<string, string>(students.map(s => [s.rollNumber, s.id]));
          const updates: { id: string; data: Partial<Student> }[] = [];
          const successOverwrites: string[] = [];
          const failedOverwrites: string[] = [];

          skippedExcelRows.forEach(row => {
              const rollNum = String(row.rollNumber).toUpperCase();
              const studentId = studentMap.get(rollNum);
              
              if (studentId) {
                  updates.push({
                      id: studentId,
                      data: {
                        name: String(row.name).toUpperCase(),
                        contactNumber: String(row.contactNumber || ''),
                        branch: String(row.branch || ''),
                        year: String(row.year || ''),
                        gender: String(row.gender || ''),
                        studentType: String(row.studentType || ''),
                        hostel: String(row.hostel || ''),
                        roomNumber: String(row.roomNumber || '').toUpperCase(),
                      }
                  });
                  successOverwrites.push(rollNum);
              } else {
                  failedOverwrites.push(rollNum);
              }
          });

          if (updates.length > 0) {
              await firebaseService.updateStudentsBatch(updates);
          }
          
          setExcelImportStatus(prev => ({
            message: `Overwrite complete. Updated ${successOverwrites.length} students.`,
            type: 'success',
            details: {
                ...prev?.details!,
                skipped: [], // Clear skipped list as they are now processed
                success: [...(prev?.details?.success || []), ...successOverwrites], // Add to success for reporting
                notFound: [...(prev?.details?.notFound || []), ...failedOverwrites.map(r => `${r} (ID not found during overwrite)`)],
                analysisFailed: prev?.details?.analysisFailed || []
            }
          }));
          
          setSkippedExcelRows([]);

      } catch (error: any) {
          console.error("Error overwriting Excel data:", error);
          setExcelImportStatus(prev => ({
              ...prev!,
              message: `Overwrite failed: ${error.message}`,
              type: 'error'
          }));
      } finally {
          setIsImportingExcel(false);
      }
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
    setSkippedFiles([]); // Reset skipped files
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

  // Helper function to process a single photo file
  const processPhotoFile = async (
      file: File, 
      rollNumber: string, 
      updateStateCallback: (result: 'success' | 'analysisFailed', payload?: any) => void
  ) => {
      try {
          // SECURITY FIX: Extract features from RAW image
          const rawBase64Image = await readFileAsBase64(file);
          const features = await extractFaceFeatures(rawBase64Image); // Use High Quality

          // Compression for storage
          const compressedImage = await compressImage(rawBase64Image);
          
          await firebaseService.updateStudentPhotoByRollNo(rollNumber, compressedImage, features);
          updateStateCallback('success');
      } catch (error: any) {
          console.error(`Failed to process image for ${rollNumber}:`, error);
          updateStateCallback('analysisFailed', { 
              file: file.name, 
              reason: error.message || 'Face analysis failed' 
          });
      }
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length === 0) return;

      setIsImportingPhotos(true);
      setSkippedFiles([]);
      setPhotoImportStatus({
          message: `Starting photo import... Found ${files.length} files.`,
          type: 'info',
          progress: 0,
          total: files.length,
          details: { success: [], skipped: [], notFound: [], analysisFailed: [] }
      });

      // Explicitly type the Map to avoid 'unknown' type inference on values
      const studentMap = new Map<string, Student>(students.map(s => [s.rollNumber.toUpperCase(), s]));
      
      const details = {
          success: [] as string[],
          skipped: [] as string[],
          notFound: [] as string[],
          analysisFailed: [] as { file: string; reason: string }[]
      };

      const newSkippedFiles: File[] = [];

      // Process files in parallel batches to speed up
      const processBatch = async (batch: File[]) => {
          await Promise.all(batch.map(async (file, index) => {
              const rollNumber = file.name.split('.').slice(0, -1).join('.').toUpperCase();
              const student = studentMap.get(rollNumber);
              
              if (!student) {
                  details.notFound.push(`${rollNumber} (${file.name})`);
                  return;
              }

              // SKIP EXISTING: If student already has a photo, skip processing
              if (student.faceImage) {
                  details.skipped.push(rollNumber);
                  newSkippedFiles.push(file); // Store the file for re-import potential
                  return;
              }

              await processPhotoFile(file, rollNumber, (result, payload) => {
                  if (result === 'success') {
                      details.success.push(rollNumber);
                  } else {
                      details.analysisFailed.push(payload);
                  }
              });

          }));
          
          // Update progress UI after batch completes
          setPhotoImportStatus(prev => {
              if(!prev) return null;
              return {
                ...prev,
                message: `Processing...`,
                progress: Math.min((prev.progress || 0) + batch.length, files.length),
              }
          });
      };
      
      const batchSize = 5; 
      for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          await processBatch(batch);
      }
      
      setSkippedFiles(newSkippedFiles);

      let summary = `Import complete. Processed ${details.success.length} successfully.`;
      if (details.skipped.length > 0) {
          summary += ` ${details.skipped.length} skipped (already exist).`;
      }
      
      const hasErrors = details.notFound.length > 0 || details.analysisFailed.length > 0;

      setPhotoImportStatus({
          message: summary,
          type: hasErrors ? 'error' : 'success',
          progress: files.length,
          total: files.length,
          details: details
      });
      
      setIsImportingPhotos(false);
      if (e.target) e.target.value = '';
  };
  
  const handleOverwriteSkipped = async () => {
    if (skippedFiles.length === 0) return;

    setIsImportingPhotos(true);
    setPhotoImportStatus(prev => ({
        ...prev!,
        message: `Overwriting ${skippedFiles.length} photos...`,
        type: 'info',
        progress: 0,
        total: skippedFiles.length,
        // Reset details for this new run, keep notFound/analysisFailed from previous run if desired, or clear. 
        // Let's clear skipped list in details to show progress.
        details: {
            ...prev!.details!,
            skipped: [], // Clear skipped because we are processing them
            success: prev!.details!.success // Keep existing successes
        }
    }));

    const newDetails = {
        success: [] as string[],
        analysisFailed: [] as { file: string; reason: string }[]
    };

    const processBatch = async (batch: File[]) => {
        await Promise.all(batch.map(async (file) => {
            const rollNumber = file.name.split('.').slice(0, -1).join('.').toUpperCase();
            
            await processPhotoFile(file, rollNumber, (result, payload) => {
                if (result === 'success') {
                    newDetails.success.push(rollNumber);
                } else {
                    newDetails.analysisFailed.push(payload);
                }
            });
        }));
        
        setPhotoImportStatus(prev => {
            if(!prev) return null;
            return {
              ...prev,
              progress: Math.min((prev.progress || 0) + batch.length, skippedFiles.length),
            }
        });
    };

    const batchSize = 5; 
    for (let i = 0; i < skippedFiles.length; i += batchSize) {
        const batch = skippedFiles.slice(i, i + batchSize);
        await processBatch(batch);
    }
    
    // Merge new results with old results
    setPhotoImportStatus(prev => {
        const mergedSuccess = [...(prev?.details?.success || []), ...newDetails.success];
        const mergedFailures = [...(prev?.details?.analysisFailed || []), ...newDetails.analysisFailed];
        
        return {
            message: `Overwrite complete. Updated ${newDetails.success.length} photos.`,
            type: 'success',
            progress: skippedFiles.length,
            total: skippedFiles.length,
            details: {
                ...prev!.details!,
                success: mergedSuccess,
                analysisFailed: mergedFailures,
                skipped: [] // All processed
            }
        };
    });
    
    setSkippedFiles([]); // Clear queue
    setIsImportingPhotos(false);
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
                                <button type="button" onClick={() => setIsCameraOpen(true)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition w-48 flex items-center justify-center space-x-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span>{displayFaceImage ? 'Retake Photo' : 'Use Camera'}</span></button>
                                <button type="button" onClick={handleUploadClick} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 transition w-48 flex items-center justify-center space-x-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg><span>Upload Image</span></button>
                            </div>
                            <div className="w-24 h-24 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 overflow-hidden flex-shrink-0 flex items-center justify-center">{displayFaceImage ? <img src={displayFaceImage} alt="Captured face" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500 text-center p-2">Image Preview</span>}</div>
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
                    
                    {excelImportStatus && (
                        <div className="mt-4">
                            <Alert message={excelImportStatus.message} type={excelImportStatus.type} onClose={() => setExcelImportStatus(null)} />
                            
                            {excelImportStatus.details && (excelImportStatus.details.skipped.length > 0 || excelImportStatus.details.notFound.length > 0) && (
                                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-h-80 overflow-y-auto">
                                    <h5 className="font-bold text-gray-800 mb-2 border-b pb-1">Detailed Excel Report</h5>

                                    {excelImportStatus.details.skipped.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-600 mb-1">
                                                        Skipped ({excelImportStatus.details.skipped.length}):
                                                    </p>
                                                    <p className="text-xs text-gray-500 mb-1 italic">Student already exists in database.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleOverwriteExcelSkipped}
                                                    disabled={isImportingExcel}
                                                    className="bg-amber-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-amber-600 transition disabled:bg-gray-400"
                                                >
                                                    Overwrite & Update ({skippedExcelRows.length})
                                                </button>
                                            </div>
                                            <ul className="list-disc list-inside text-xs text-gray-700 bg-blue-50 p-2 rounded mt-1">
                                                {excelImportStatus.details.skipped.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {excelImportStatus.details.notFound.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-semibold text-red-600 mb-1">
                                                Invalid / Missing Data ({excelImportStatus.details.notFound.length}):
                                            </p>
                                            <p className="text-xs text-gray-500 mb-1 italic">Rows skipped due to missing required fields or duplicates in file.</p>
                                            <ul className="list-disc list-inside text-xs text-gray-700 bg-red-50 p-2 rounded">
                                                {excelImportStatus.details.notFound.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="my-6"><div className="border-t"></div></div>
                
                {/* Photo Import */}
                <div className="p-4 rounded-lg bg-slate-50 border space-y-3">
                    <h4 className="text-lg font-semibold text-gray-600">2. Import Student Photos</h4>
                    <p className="text-sm text-gray-600">Upload multiple photos at once. Name each photo file with the student's <strong className="text-gray-800">Roll Number</strong> (e.g., <code className="bg-gray-200 text-red-600 px-1 rounded">6222241.jpg</code>).</p>
                    <p className="text-xs text-red-500 font-bold">Note: Photos are now analyzed in high definition before compression. This ensures better accuracy but may take slightly longer.</p>
                    <button type="button" onClick={handlePhotoImportClick} disabled={isImportingExcel || isImportingPhotos} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-700 transition w-full flex items-center justify-center space-x-2 disabled:bg-gray-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>{isImportingPhotos ? 'Importing...' : 'Import Photos'}</span></button>
                    <input type="file" ref={photoInputRef} onChange={handlePhotoFilesSelected} className="hidden" multiple accept="image/png, image/jpeg, image/webp" />
                    
                    {isImportingPhotos && photoImportStatus?.total && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(photoImportStatus.progress! / photoImportStatus.total) * 100}%` }}></div>
                        </div>
                    )}
                    
                    {photoImportStatus && (
                        <div className="mt-4">
                            <Alert message={photoImportStatus.message} type={photoImportStatus.type} onClose={() => setPhotoImportStatus(null)} />
                            
                            {photoImportStatus.details && (photoImportStatus.details.notFound.length > 0 || photoImportStatus.details.analysisFailed.length > 0 || photoImportStatus.details.skipped.length > 0) && (
                                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-h-80 overflow-y-auto">
                                    <h5 className="font-bold text-gray-800 mb-2 border-b pb-1">Detailed Photo Report</h5>
                                    
                                    {photoImportStatus.details.skipped.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-600 mb-1">
                                                        Skipped ({photoImportStatus.details.skipped.length}):
                                                    </p>
                                                    <p className="text-xs text-gray-500 mb-1 italic">Student already has a photo.</p>
                                                </div>
                                                {/* Re-import Button */}
                                                <button
                                                    type="button"
                                                    onClick={handleOverwriteSkipped}
                                                    disabled={isImportingPhotos}
                                                    className="bg-amber-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-amber-600 transition disabled:bg-gray-400"
                                                >
                                                    Overwrite & Re-import ({skippedFiles.length})
                                                </button>
                                            </div>
                                            <ul className="list-disc list-inside text-xs text-gray-700 bg-blue-50 p-2 rounded mt-1">
                                                {photoImportStatus.details.skipped.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {photoImportStatus.details.notFound.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-semibold text-red-600 mb-1">
                                                Student Not Found ({photoImportStatus.details.notFound.length}):
                                            </p>
                                            <p className="text-xs text-gray-500 mb-1 italic">Filename did not match any registered Roll No.</p>
                                            <ul className="list-disc list-inside text-xs text-gray-700 bg-red-50 p-2 rounded">
                                                {photoImportStatus.details.notFound.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {photoImportStatus.details.analysisFailed.length > 0 && (
                                        <div>
                                            <p className="text-sm font-semibold text-amber-600 mb-1">
                                                Analysis Failed ({photoImportStatus.details.analysisFailed.length}):
                                            </p>
                                             <p className="text-xs text-gray-500 mb-1 italic">Could not detect a clear face.</p>
                                            <ul className="list-disc list-inside text-xs text-gray-700 bg-amber-50 p-2 rounded">
                                                {photoImportStatus.details.analysisFailed.map((item, idx) => (
                                                    <li key={idx}>
                                                        <strong>{item.file}</strong>: {item.reason}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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