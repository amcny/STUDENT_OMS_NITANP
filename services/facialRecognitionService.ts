/**
 * This service simulates a robust facial recognition pipeline.
 *
 * It enhances reliability through a multi-stage process:
 * 1. Center Cropping: Focuses on the central part of the image, making the system
 *    more tolerant to the student's distance from the camera.
 * 2. Grayscale Conversion: Simplifies the image to intensity values.
 * 3. Histogram Equalization: A powerful technique to normalize lighting and contrast,
 *    making the system work reliably in both dark and bright conditions.
 * 4. Feature Extraction & Normalization: A downsampled brightness map is created and then
 *    normalized with Z-score to produce a stable facial signature that represents
 *    the underlying pattern of the face, not just superficial appearance.
 */

/**
 * Applies Histogram Equalization to a grayscale image data array.
 * This enhances contrast in images, especially in poor lighting.
 * @param grayscaleData A flat array of grayscale pixel values (0-255).
 * @param width The width of the image.
 * @param height The height of the image.
 * @returns A new Uint8ClampedArray with the equalized grayscale data.
 */
const applyHistogramEqualization = (grayscaleData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
    const pixelCount = width * height;
    const histogram = new Array(256).fill(0);
    
    // 1. Calculate histogram
    for (let i = 0; i < grayscaleData.length; i++) {
        histogram[grayscaleData[i]]++;
    }

    // 2. Calculate cumulative distribution function (CDF)
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Find first non-zero CDF value for scaling
    let cdfMin = 0;
    for(let i=0; i < 256; i++) {
      if(cdf[i] > 0) {
        cdfMin = cdf[i];
        break;
      }
    }

    // 3. Create a lookup table (LUT) to map old pixel values to new ones
    const lut = new Array(256).fill(0);
    const scaleFactor = 255 / (pixelCount - cdfMin);
    for (let i = 0; i < 256; i++) {
        lut[i] = Math.round((cdf[i] - cdfMin) * scaleFactor);
    }

    // 4. Apply the LUT to create the new image data
    const equalizedData = new Uint8ClampedArray(grayscaleData.length);
    for (let i = 0; i < grayscaleData.length; i++) {
        equalizedData[i] = lut[grayscaleData[i]];
    }

    return equalizedData;
};

/**
 * Processes a base64 image through a pipeline: center-cropping, grayscale conversion,
 * and histogram equalization.
 * @param imageBase64 The base64 string of the image.
 * @returns A promise that resolves to a flat, processed Uint8ClampedArray of grayscale values.
 */
const getProcessedImageData = (imageBase64: string): Promise<Uint8ClampedArray> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const size = 64; // Standard size for processing
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            return reject(new Error('Could not create canvas context.'));
        }

        const image = new Image();
        image.onload = () => {
            // --- Center Cropping for Distance Invariance ---
            const sourceSize = Math.min(image.width, image.height);
            const sourceX = (image.width - sourceSize) / 2;
            const sourceY = (image.height - sourceSize) / 2;
            ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;
            const grayscaleData = new Uint8ClampedArray(size * size);

            // --- Grayscale Conversion ---
            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                grayscaleData[j] = 0.299 * r + 0.587 * g + 0.114 * b;
            }

            // --- Histogram Equalization for Lighting Invariance ---
            const equalizedData = applyHistogramEqualization(grayscaleData, size, size);

            resolve(equalizedData);
        };
        image.onerror = () => {
            reject(new Error('Failed to load image for processing.'));
        };
        image.src = imageBase64;
    });
};


/**
 * Extracts a robust feature vector from a facial image using a multi-stage pipeline.
 * The pipeline makes this process highly resilient to changes in distance and lighting.
 * @param imageBase64 - base64 string of the captured image.
 * @returns A promise that resolves to a normalized array of numbers representing the facial signature.
 */
export const extractFaceFeatures = async (imageBase64: string): Promise<number[]> => {
  // Simulate async processing time of a model
  await new Promise(resolve => setTimeout(resolve, 250));

  // The preprocessing step handles cropping, grayscale, and equalization
  const processedData = await getProcessedImageData(imageBase64);
  const size = 64; // Must match the size in getProcessedImageData

  // --- Step 1: Create a low-resolution map from the pre-processed data ---
  const features: number[] = [];
  const downsampledSize = 8;
  const cellSize = size / downsampledSize;

  for (let gridY = 0; gridY < downsampledSize; gridY++) {
    for (let gridX = 0; gridX < downsampledSize; gridX++) {
      let totalBrightness = 0;
      let pixelCount = 0;

      const startX = gridX * cellSize;
      const startY = gridY * cellSize;
      for (let y = startY; y < startY + cellSize; y++) {
        for (let x = startX; x < startX + cellSize; x++) {
          const i = y * size + x;
          totalBrightness += processedData[i];
          pixelCount++;
        }
      }
      const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 0;
      features.push(avgBrightness / 255.0); // Normalize to [0, 1] range
    }
  }

  // --- Step 2: Normalize the feature vector (Z-Score) ---
  // This final step ensures we are matching the *pattern* of features, not absolute values.
  const sum = features.reduce((acc, val) => acc + val, 0);
  const mean = sum / features.length;

  const variance = features.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / features.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 1e-6) {
    return Array(features.length).fill(0);
  }
  
  const normalizedFeatures = features.map(val => (val - mean) / stdDev);
  
  return normalizedFeatures;
};

// With a more robust pipeline, we can be stricter with our matching threshold.
const MATCH_THRESHOLD = 0.35;

/**
 * Calculates the Mean Squared Error (MSE) between two feature vectors.
 * A lower value indicates a closer match.
 * @param features1 First feature vector.
 * @param features2 Second feature vector.
 * @returns The calculated MSE, or Infinity if vectors are mismatched.
 */
const calculateDistance = (features1: number[], features2: number[]): number => {
    if (features1.length !== features2.length || features1.length === 0) {
        return Infinity;
    }
    let distance = 0;
    for (let i = 0; i < features1.length; i++) {
        distance += Math.pow(features1[i] - features2[i], 2);
    }
    return distance / features1.length;
};


/**
 * Verifies a captured image against a single student's known facial features.
 * @param capturedImage - base64 string of the image captured at check-in/out.
 * @param storedFeatures - The normalized feature vector stored during student registration.
 * @returns A promise that resolves to true if the face "matches".
 */
export const verifyFace = async (capturedImage: string, storedFeatures: number[]): Promise<boolean> => {
  const capturedFeatures = await extractFaceFeatures(capturedImage);
  const mse = calculateDistance(capturedFeatures, storedFeatures);
  console.log('Calculated feature distance (MSE on normalized vectors):', mse);
  return mse < MATCH_THRESHOLD;
};


/**
 * Scans a captured image and compares it against a list of all students to find the best match.
 * @param capturedImage - The base64 string of the newly captured face.
 * @param students - An array of all registered students with their stored facial features.
 * @returns A promise that resolves to the matched Student object, or null if no confident match is found.
 */
export const findBestMatch = async (capturedImage: string, students: import('../types').Student[]): Promise<import('../types').Student | null> => {
    console.log('Searching for the best match among all students...');
    const capturedFeatures = await extractFaceFeatures(capturedImage);

    let bestMatch: import('../types').Student | null = null;
    let minDistance = Infinity;

    for (const student of students) {
        if (student.faceFeatures && student.faceFeatures.length > 0) {
            const distance = calculateDistance(capturedFeatures, student.faceFeatures);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = student;
            }
        }
    }

    console.log(`Best match found: ${bestMatch?.name} with distance: ${minDistance}`);

    if (bestMatch && minDistance < MATCH_THRESHOLD) {
        return bestMatch;
    }

    return null;
};
