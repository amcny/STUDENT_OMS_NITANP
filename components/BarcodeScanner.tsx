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
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      codeReaderRef.current = null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof ZXing === 'undefined') {
        setError("Barcode scanning library failed to load. Please check your internet connection and refresh.");
        return;
      }

      if (!videoRef.current) {
        return;
      }

      // Add hints for faster processing. This tells the library to prioritize these formats.
      const hints = new Map();
      const formats = [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.QR_CODE];
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
      const codeReader = new ZXing.BrowserMultiFormatReader(hints);
      codeReaderRef.current = codeReader;

      const startScanner = async () => {
        try {
          // Explicitly request the rear camera
          await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

          codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
            if (result) {
              // Haptic feedback for a better user experience on mobile
              navigator.vibrate?.(100);
              // Let the parent component handle the state change.
              // This will unmount the component, and the cleanup effect will stop the scanner.
              onScan(result.getText());
            }
            if (err) {
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
        <video 
            ref={videoRef} 
            className="w-full h-auto" 
            style={{ filter: 'contrast(1.3) brightness(1.1)' }} // Enhance video feed for better scanning
            playsInline
        />
        <div className="scanner-overlay absolute inset-0 flex justify-center items-center pointer-events-none">
            <div className="scanner-box relative w-[80%] h-[40%]">
                <div className="corner top-left"></div>
                <div className="corner top-right"></div>
                <div className="corner bottom-left"></div>
                <div className="corner bottom-right"></div>
                <div className="scanner-laser"></div>
            </div>
        </div>
        {!error && (
            <p className="absolute bottom-4 left-0 right-0 text-white text-center text-lg font-semibold bg-black bg-opacity-50 p-2">
                Align barcode within the frame
            </p>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
