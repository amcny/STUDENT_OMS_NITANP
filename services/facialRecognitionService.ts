/**
 * --- Face-API.js (TensorFlow.js) Integration ---
 *
 * This service leverages the face-api.js library to provide real, browser-based
 * facial recognition capabilities. It replaces the previous simulation with a
 * production-grade AI model pipeline.
 *
 * The process involves:
 * 1.  **Asynchronous Model Loading:** On initialization, the service loads the
 *     necessary pre-trained models (SSD Mobilenet v1 for face detection,
 *     face landmark detection, and a deep learning model for face recognition)
 *     from a CDN. All subsequent operations await the completion of this loading.
 *
 * 2.  **Face Detection:** When an image is provided, the service first uses a
 *     Single Shot Detector (SSD) based on MobileNetV1 to locate a face within the
 *     image. It's configured to find only a single, primary face, which is
 *     ideal for registration and verification tasks.
 *
 * 3.  **Feature Extraction (Embedding):** Once a face is detected and its landmarks
 *     (eyes, nose, mouth) are identified, a deep residual neural network (ResNet)
 *     processes the aligned face to compute a 128-dimensional feature vector,
 *     also known as a "face descriptor" or "embedding." This vector represents
 *     the unique characteristics of the face in a numerical format.
 *
 * 4.  **Comparison (Distance Metric):** To compare two faces, the service calculates
 *     the Euclidean distance between their 128-D embeddings. A smaller distance
 *     signifies a higher likelihood that the two faces belong to the same person.
 *     A predefined threshold is used to make the final match/no-match decision.
 */

// --- Type Declaration for face-api.js ---
// This informs TypeScript that a global 'faceapi' variable exists,
// which is loaded via the script tag in index.html.
declare var faceapi: any;

// --- Constants ---
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// CRITICAL SECURITY SETTINGS
// Euclidean distance: LOWER is a better match.
// 0.6 is typical default. 0.4 is strict. 
const STRICT_THRESHOLD = 0.45; 

// If the difference between the Best Match and 2nd Best Match is smaller than this,
// we reject the result to prevent "confusing" lookalikes.
const CONFIDENCE_GAP_THRESHOLD = 0.05; 

// --- Model Loading ---
let modelsLoadedPromise: Promise<boolean> | null = null;

const loadModels = async (): Promise<boolean> => {
    // Ensure models are loaded only once
    if (!modelsLoadedPromise) {
        modelsLoadedPromise = (async () => {
            try {
                console.log("Loading facial recognition models...");
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);

                // --- WARM UP STEP ---
                // We run a dummy detection on a small blank canvas. 
                // This forces TensorFlow.js to compile the WebGL shaders and allocate GPU memory.
                // Without this, the UI would freeze for 1-2 seconds on the very first user scan.
                console.log("Warming up facial recognition models...");
                try {
                    const dummyCanvas = document.createElement('canvas');
                    dummyCanvas.width = 50;
                    dummyCanvas.height = 50;
                    // We expect this to return undefined (no face), but the internal engine will spin up.
                    await faceapi
                        .detectSingleFace(dummyCanvas)
                        .withFaceLandmarks()
                        .withFaceDescriptor();
                    console.log("Model warm-up complete.");
                } catch (warmupError) {
                    // It's okay if this fails (e.g. strict mode), main functionality might still work.
                    console.warn("Model warm-up warning (non-fatal):", warmupError);
                }
                // --------------------

                console.log("Facial recognition models loaded successfully.");
                return true;
            } catch (error) {
                console.error("Error loading facial recognition models:", error);
                // Reset promise on failure to allow retry
                modelsLoadedPromise = null;
                return false;
            }
        })();
    }
    return modelsLoadedPromise;
};

// Immediately start loading models when the service is imported.
loadModels();


/**
 * Extracts a 128-D face feature vector (embedding) from a single face in an image.
 * @param imageBase64 - base64 string of the captured image.
 * @returns A promise that resolves to a 128-element array representing the facial embedding.
 * @throws An error if models fail to load, no face is detected, or the image cannot be processed.
 */
export const extractFaceFeatures = async (imageBase64: string): Promise<number[]> => {
    await loadModels();

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => {
            try {
                // Use detectSingleFace for registration/verification to ensure only one person is processed.
                // We use SsdMobilenetv1Options with a minimum confidence to ensure we don't register blurry/bad faces.
                const detection = await faceapi
                    .detectSingleFace(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    reject(new Error("No face detected, or face is too blurry. Please ensure good lighting."));
                    return;
                }
                
                // The descriptor is a Float32Array, so we convert it to a standard number array.
                resolve(Array.from(detection.descriptor));
            } catch (error) {
                console.error("Error during face feature extraction:", error);
                reject(new Error("Could not process the face image due to a technical issue."));
            }
        };
        image.onerror = () => {
            reject(new Error("Failed to load image for processing."));
        };
        image.src = imageBase64;
    });
};

/**
 * Calculates the Euclidean distance between two vectors.
 */
const calculateEuclideanDistance = (vecA: number[], vecB: number[]): number => {
    if (vecA.length !== vecB.length || vecA.length === 0) return Infinity;
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        sum += Math.pow(vecA[i] - vecB[i], 2);
    }
    return Math.sqrt(sum);
};


/**
 * Verifies a captured image against a single student's known facial embedding.
 */
export const verifyFace = async (capturedImage: string, storedFeatures: number[]): Promise<boolean> => {
  try {
    const capturedFeatures = await extractFaceFeatures(capturedImage);
    if (capturedFeatures.length === 0 || storedFeatures.length === 0) {
      return false;
    }
    const distance = calculateEuclideanDistance(capturedFeatures, storedFeatures);
    console.log('Calculated Euclidean distance for verification:', distance);
    return distance < STRICT_THRESHOLD;
  } catch (error) {
    console.error("Face verification failed:", error);
    // Return false if any error occurs (e.g., no face detected).
    return false;
  }
};


/**
 * Scans a captured image and compares it against a list of all students to find the best match.
 * IMPLEMENTS "CONFIDENCE GAP" LOGIC:
 * If the best match and second best match are too close, we reject both to prevent false positives.
 */
export const findBestMatch = async (capturedImage: string, students: import('../types').Student[]): Promise<import('../types').Student | null> => {
    console.log('Searching for the best match using face-api.js...');
    try {
        const capturedFeatures = await extractFaceFeatures(capturedImage);

        if (capturedFeatures.length === 0) {
            console.warn("Could not find a face in the captured image for matching.");
            return null;
        }

        let bestMatch: import('../types').Student | null = null;
        let bestDistance = Infinity;
        let secondBestDistance = Infinity;

        for (const student of students) {
            if (student.faceFeatures && student.faceFeatures.length > 0) {
                const distance = calculateEuclideanDistance(capturedFeatures, student.faceFeatures);
                
                if (distance < bestDistance) {
                    // Demote current best to second best
                    secondBestDistance = bestDistance;
                    bestDistance = distance;
                    bestMatch = student;
                } else if (distance < secondBestDistance) {
                    secondBestDistance = distance;
                }
            }
        }

        console.log(`Best match: ${bestMatch?.name} (Dist: ${bestDistance.toFixed(4)})`);
        console.log(`2nd Best: (Dist: ${secondBestDistance.toFixed(4)})`);

        // 1. Hard Threshold Check
        if (bestDistance > STRICT_THRESHOLD) {
            console.warn("Match rejected: Distance too high (Low Confidence).");
            return null;
        }

        // 2. Confidence Gap Check (Anti-Spoof/Lookalike)
        // If the best match is 0.40 and second best is 0.42, that's too close. We can't be sure.
        const gap = secondBestDistance - bestDistance;
        if (gap < CONFIDENCE_GAP_THRESHOLD) {
             console.warn(`Match rejected: Ambiguous result. Gap (${gap.toFixed(4)}) is too small.`);
             return null;
        }

        return bestMatch; 
    } catch (error) {
        console.error("An error occurred while finding the best match:", error);
        return null;
    }
};