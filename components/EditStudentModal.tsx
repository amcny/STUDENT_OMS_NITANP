
import React, { useState, useEffect, useRef } from 'react';
import { Student } from '../types';
import Modal from './Modal';
import CameraCapture from './CameraCapture';
import Alert from './Alert';
import { extractFaceFeatures } from '../services/facialRecognitionService';
import CustomSelect from './CustomSelect';
import { 
    BRANCH_OPTIONS, YEAR_OPTIONS, GENDER_OPTIONS, 
    STUDENT_TYPE_OPTIONS, BOYS_HOSTELS, GIRLS_HOSTELS 
} from '../constants';

interface EditStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    onSave: (updatedStudent: Student, newPhotoBase64?: string | null) => void;
    allStudents: Student[];
}

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

const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, onClose, student, onSave, allStudents }) => {
    const [formData, setFormData] = useState<Student | null>(student);
    const [faceImage, setFaceImage] = useState<string | null>(student?.faceImage || null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalTopRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        setFormData(student);
        setFaceImage(student?.faceImage || null);
        setAlert(null);
    }, [student]);

    useEffect(() => {
        if (alert && modalTopRef.current) {
            modalTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [alert]);


    if (!isOpen || !formData || !student) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const uppercaseFields = ['name', 'rollNumber', 'registrationNumber', 'roomNumber'];
        const processedValue = uppercaseFields.includes(name) ? value.toUpperCase() : value;
        
        setFormData(prev => prev ? { ...prev, [name]: processedValue } : null);
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => {
            if (!prev) return null;
            const newState = { ...prev, [name]: value };
            if (name === 'gender' || name === 'studentType') {
                newState.hostel = '';
            }
             if (name === 'studentType' && value === 'Day-Scholar') {
                newState.roomNumber = '';
            }
            return newState;
        });
    };

    const handleCapture = async (imageBase64: string) => {
        const compressed = await compressImage(imageBase64);
        setFaceImage(compressed);
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
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                 setAlert({ message: 'File is too large. Please select an image under 10MB.', type: 'error' });
                return;
            }
    
            const reader = new FileReader();
            reader.onload = async () => {
                const rawBase64 = reader.result as string;
                const compressed = await compressImage(rawBase64);
                setFaceImage(compressed);
            };
            reader.onerror = () => {
                setAlert({ message: 'Failed to read the image file.', type: 'error' });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAlert(null);
        
        const otherStudents = allStudents.filter(s => s.id !== student.id);
        if (otherStudents.some(s => s.rollNumber === formData.rollNumber)) {
            setAlert({ message: 'Another student with this Roll Number already exists.', type: 'error' });
            return;
        }
        if (otherStudents.some(s => s.registrationNumber === formData.registrationNumber)) {
            setAlert({ message: 'Another student with this Registration Number already exists.', type: 'error' });
            return;
        }

        setIsSaving(true);
        
        try {
            let features = formData.faceFeatures;
            let newPhotoBase64: string | null = null;
            
            // A new base64 string indicates a new image was captured/uploaded
            if (faceImage && faceImage.startsWith('data:image')) {
                setAlert({ message: 'New image detected. Re-analyzing face...', type: 'info' });
                features = await extractFaceFeatures(faceImage);
                newPhotoBase64 = faceImage;
            }
            
            const updatedStudent: Student = {
                ...formData,
                faceImage: faceImage, // This will be the old URL or the new base64
                faceFeatures: features,
            };

            onSave(updatedStudent, newPhotoBase64);
            setAlert({ message: 'Student details saved successfully!', type: 'success' });
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (error: any) {
            console.error("Failed to process update:", error);
            setAlert({ message: error.message || 'Could not process the request. Please try again.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const currentHostelOptions = formData.gender === 'Male' ? BOYS_HOSTELS : GIRLS_HOSTELS;
    const baseFieldClasses = "w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Profile: ${student?.name}`}>
            <div className="max-h-[80vh] overflow-y-auto pr-4 -mr-4 pl-1">
                <div ref={modalTopRef} className="w-full h-0" />
                {alert && <div className="mb-4"><Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} /></div>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className="block text-gray-700 font-medium mb-1">Full Name</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} />
                        </div>
                        <div>
                            <label htmlFor="rollNumber" className="block text-gray-700 font-medium mb-1">Roll Number</label>
                            <input type="text" id="rollNumber" name="rollNumber" value={formData.rollNumber} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} />
                        </div>
                        <div>
                            <label htmlFor="registrationNumber" className="block text-gray-700 font-medium mb-1">Registration Number</label>
                            <input type="text" id="registrationNumber" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} />
                        </div>
                        <div>
                            <label htmlFor="contactNumber" className="block text-gray-700 font-medium mb-1">Contact Number</label>
                            <input type="text" id="contactNumber" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required className={baseFieldClasses} />
                        </div>
                        <CustomSelect name="branch" label="Branch" options={BRANCH_OPTIONS} value={formData.branch} onChange={handleSelectChange} required />
                        <CustomSelect name="year" label="Year" options={YEAR_OPTIONS} value={formData.year} onChange={handleSelectChange} required />
                        <CustomSelect name="gender" label="Gender" options={GENDER_OPTIONS} value={formData.gender} onChange={handleSelectChange} required />
                        <CustomSelect name="studentType" label="Student Type" options={STUDENT_TYPE_OPTIONS} value={formData.studentType} onChange={handleSelectChange} required />
                        {formData.studentType === 'Hosteller' && (
                           <>
                             <CustomSelect name="hostel" label="Hostel" options={currentHostelOptions} value={formData.hostel} onChange={handleSelectChange} required />
                             <div>
                                <label htmlFor="roomNumber" className="block text-gray-700 font-medium mb-1">Room Number</label>
                                <input type="text" id="roomNumber" name="roomNumber" value={formData.roomNumber} onChange={handleInputChange} required className={`${baseFieldClasses} uppercase`} />
                            </div>
                           </>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Biometric Data</h3>
                        <div className="flex items-center space-x-6 bg-slate-50 p-4 rounded-md">
                            <div className="flex flex-col space-y-2">
                                <button type="button" onClick={() => setIsCameraOpen(true)} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition duration-300 w-48 flex items-center justify-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span>{faceImage ? 'Retake with Camera' : 'Capture with Camera'}</span>
                                </button>
                                <button type="button" onClick={handleUploadClick} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-700 transition duration-300 w-48 flex items-center justify-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    <span>Upload an Image</span>
                                </button>
                            </div>
                            <div className="w-24 h-24 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {faceImage ? <img src={faceImage} alt="Captured face" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-500 text-center p-2">Image Preview</span>}
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleFileSelect}
                        />
                    </div>

                    <div className="flex justify-end space-x-4 border-t pt-4 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                <Modal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} title="Capture New Face Image">
                    <CameraCapture onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
                </Modal>
            </div>
        </Modal>
    );
};
export default EditStudentModal;
