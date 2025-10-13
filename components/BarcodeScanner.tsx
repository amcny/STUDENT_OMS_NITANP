import React, { useRef, useEffect, useState, useCallback } from 'react';

// Inform TypeScript about the global ZXing object from the script tag
declare var ZXing: any;

interface BarcodeScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const codeReaderRef = useRef<any>(null);

  const stopScanner = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      // Also stop the video stream manually to be certain
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      codeReaderRef.current = null;
    }
  }, []);

  useEffect(() => {
    // A small delay to ensure the DOM is ready and modal animation is complete
    const timer = setTimeout(() => {
      if (typeof ZXing === 'undefined') {
        setError("Barcode scanning library failed to load. Please check your internet connection and refresh.");
        return;
      }

      if (!videoRef.current) {
        return;
      }

      const codeReader = new ZXing.BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const startScanner = async () => {
        try {
          // Request camera access. The decodeFromVideoDevice will also do this, but doing it
          // separately allows for better error handling.
          await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

          // Start decoding from the video device.
          // 'undefined' for the device ID lets the library pick the default camera.
          codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
            if (result) {
              // A barcode was successfully found
              stopScanner();
              onScan(result.getText());
            }
            if (err) {
                // Ignore NotFoundException as it's expected until a barcode is found
                if (!(err instanceof ZXing.NotFoundException)) {
                    console.error("Barcode decoding error:", err);
                    setError("An error occurred during scanning.");
                    stopScanner();
                }
            }
          });
        } catch (err: any) {
          console.error("Camera access error:", err);
           if (err.name === 'NotAllowedError') {
              setError("Camera access was denied. Please grant permission in your browser settings.");
          } else {
              setError("Could not access the camera. Please ensure it's not in use by another application.");
          }
        }
      };

      startScanner();
    }, 100);


    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [onScan, stopScanner]);

  return (
    <div className="flex flex-col items-center">
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
      <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden shadow-lg">
        {/* The ZXing library will automatically attach the video stream here */}
        <video ref={videoRef} className="w-full h-auto" />
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <div 
            className="w-[80%] h-32 border-4 border-red-500 border-dashed rounded-lg opacity-75" 
            style={{boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'}}
          ></div>
        </div>
        {!error && (
            <p className="absolute bottom-4 left-0 right-0 text-white text-center text-lg font-semibold bg-black bg-opacity-50 p-2">
                Align barcode within the rectangle
            </p>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
