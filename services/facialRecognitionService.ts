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
const SIMILARITY_THRESHOLD = 0.5; // Using Euclidean distance. Lower is a better match. A threshold of 0.5 is reasonably strict.

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
                const detection = await faceapi
                    .detectSingleFace(image)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    reject(new Error("No face detected in the image. Please ensure your face is clearly visible."));
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
    return distance < SIMILARITY_THRESHOLD;
  } catch (error) {
    console.error("Face verification failed:", error);
    // Return false if any error occurs (e.g., no face detected).
    return false;
  }
};


/**
 * Scans a captured image and compares it against a list of all students to find the best match.
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
        let minDistance = Infinity;

        for (const student of students) {
            if (student.faceFeatures && student.faceFeatures.length > 0) {
                const distance = calculateEuclideanDistance(capturedFeatures, student.faceFeatures);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = student;
                }
            }
        }

        console.log(`Best match candidate: ${bestMatch?.name} with distance: ${minDistance}`);

        if (bestMatch && minDistance < SIMILARITY_THRESHOLD) {
            return bestMatch;
        }

        return null; // No match found that meets the threshold
    } catch (error) {
        // Log the error but return null to indicate failure, which is expected by the calling components.
        console.error("An error occurred while finding the best match:", error);
        return null;
    }
};
