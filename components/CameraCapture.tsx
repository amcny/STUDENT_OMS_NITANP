import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(1);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      setIsFlashing(true);
      setTimeout(() => {
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          onCapture(dataUrl);
          stopCamera();
          onClose();
        }
      }, 100);
    }
  }, [onCapture, onClose, stopCamera]);


  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Only set ready when data is loaded to avoid black screen countdown
          videoRef.current.onloadeddata = () => {
             setIsCameraReady(true);
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access the camera. Please ensure permissions are granted.");
      }
    };

    startCamera();
    
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (error) return;

    // Wait until camera is actually ready before starting countdown
    if (!isCameraReady) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleCapture();
    }
  }, [countdown, handleCapture, error, isCameraReady]);

  return (
    <div className="flex flex-col items-center">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" style={{ transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} className="hidden" />
        
        {isFlashing && <div className="absolute inset-0 bg-white opacity-75"></div>}
        
        <div className="absolute inset-0 flex justify-center items-center">
          <div 
            className="w-64 h-80 border-4 border-white border-dashed rounded-lg opacity-50" 
            style={{boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'}}
          ></div>
        </div>

        {/* Only show countdown if camera is ready */}
        {isCameraReady && countdown > 0 && !error && (
          <div className="absolute inset-0 flex justify-center items-center">
            <span className="text-white text-9xl font-bold" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>{countdown}</span>
          </div>
        )}
        
        {/* Loading state if camera isn't ready yet */}
        {!isCameraReady && !error && (
           <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50">
             <div className="border-4 border-gray-200 border-t-white rounded-full w-12 h-12 animate-spin"></div>
           </div>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;