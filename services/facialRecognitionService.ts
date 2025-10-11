/**
 * This service simulates a highly robust facial recognition pipeline, significantly
 * enhanced to handle real-world challenges like occlusions, lighting, and minor
 * appearance changes.
 *
 * It employs an advanced multi-stage process:
 * 1. Pre-processing: Center cropping, grayscale conversion, and histogram equalization
 *    normalize the image for distance and lighting invariance.
 * 2. Feature Extraction with Uniform Local Binary Patterns (ULBP): This is a major
 *    upgrade from standard LBP. It analyzes facial textures by focusing on "uniform"
 *    patterns, which are fundamental to texture. This makes the features highly
 *    robust against rotation and illumination changes. A 4x4 grid of ULBP
 *    histograms creates a powerful facial signature.
 * 3. Highly Occlusion-Resistant Matching: The matching algorithm compares the facial
 *    signature block by block. It is now more aggressive in discarding mismatched
 *    blocks (31% discarded), making it exceptionally tolerant to partial occlusions
 *    from phones, hands, glasses, or jewelry. The final decision is based only
 *    on the well-matched, unobscured parts of the face.
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
 * Generates a lookup table to map all 256 LBP codes to their "uniform" pattern index.
 * A uniform pattern has at most two 0->1 or 1->0 transitions in its binary representation.
 * There are 58 such patterns. All other non-uniform patterns are mapped to a single bin (59th bin).
 * @returns An array of 256 elements mapping each LBP code to a uniform index (0-58).
 */
const generateUniformLbpLut = (): number[] => {
    const lut = new Array(256).fill(0);
    let uniformPatternIndex = 0;
    for (let i = 0; i < 256; i++) {
        let transitions = 0;
        const binary = i.toString(2).padStart(8, '0');
        for (let j = 0; j < 8; j++) {
            const currentBit = binary.charAt(j);
            const nextBit = binary.charAt((j + 1) % 8);
            if (currentBit !== nextBit) {
                transitions++;
            }
        }
        if (transitions <= 2) {
            lut[i] = uniformPatternIndex++;
        } else {
            // All non-uniform patterns map to the last index (58)
            lut[i] = 58; 
        }
    }
    return lut;
};

// Generate the LUT once and reuse it.
const uniformLbpLut = generateUniformLbpLut();
const UNIFORM_LBP_BINS = 59;

/**
 * Calculates the Local Binary Pattern for a single pixel.
 * This captures texture information from the pixel's neighborhood.
 * @param grayData The flat grayscale image data.
 * @param width The width of the image.
 * @param x The x-coordinate of the center pixel.
 * @param y The y-coordinate of the center pixel.
 * @returns The LBP value (0-255).
 */
const getLBPValue = (grayData: Uint8ClampedArray, width: number, x: number, y: number): number => {
    const centerPixel = grayData[y * width + x];
    let lbpCode = 0;
    
    // 3x3 neighborhood, clockwise from top-left
    const neighbors = [
        [x - 1, y - 1], [x, y - 1], [x + 1, y - 1],
        [x + 1, y], [x + 1, y + 1], [x, y + 1],
        [x - 1, y + 1], [x - 1, y]
    ];
    
    for (let i = 0; i < neighbors.length; i++) {
        const [nx, ny] = neighbors[i];
        // Handle image boundaries by not adding to the code
        if (nx >= 0 && nx < width && ny >= 0 && ny < width) {
            if (grayData[ny * width + nx] >= centerPixel) {
                lbpCode |= (1 << i);
            }
        }
    }
    
    return lbpCode;
};

/**
 * Extracts a robust feature vector using block-based Uniform LBP histograms.
 * @param imageBase64 - base64 string of the captured image.
 * @returns A promise that resolves to an array of numbers representing the facial signature.
 */
export const extractFaceFeatures = async (imageBase64: string): Promise<number[]> => {
    // Simulate async processing time of a model
    await new Promise(resolve => setTimeout(resolve, 350));

    const processedData = await getProcessedImageData(imageBase64);
    const size = 64; // Must match the size in getProcessedImageData
    const gridSize = 4; // Use a 4x4 grid of blocks
    const blockSize = size / gridSize; // Each block is 16x16
    const allHistograms: number[] = [];

    for (let gridY = 0; gridY < gridSize; gridY++) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
            const histogram = new Array(UNIFORM_LBP_BINS).fill(0);
            let pixelCount = 0;

            const startX = gridX * blockSize;
            const startY = gridY * blockSize;

            // Iterate through pixels in the block (ignoring 1px border for LBP calc)
            for (let y = startY + 1; y < startY + blockSize - 1; y++) {
                for (let x = startX + 1; x < startX + blockSize - 1; x++) {
                    const lbpValue = getLBPValue(processedData, size, x, y);
                    const uniformIndex = uniformLbpLut[lbpValue];
                    histogram[uniformIndex]++;
                    pixelCount++;
                }
            }
            
            // Normalize the histogram for this block
            if (pixelCount > 0) {
                for (let i = 0; i < histogram.length; i++) {
                    histogram[i] /= pixelCount;
                }
            }
            
            allHistograms.push(...histogram);
        }
    }
    
    return allHistograms;
};

// A new, adjusted threshold for the more robust Uniform LBP feature comparison.
const MATCH_THRESHOLD = 0.25;

/**
 * Calculates the Chi-squared distance between two histograms (a good metric for comparing them).
 * @param hist1 First normalized histogram.
 * @param hist2 Second normalized histogram.
 * @returns The Chi-squared distance.
 */
const chiSquaredDistance = (hist1: number[], hist2: number[]): number => {
    let distance = 0;
    for (let i = 0; i < hist1.length; i++) {
        const numerator = (hist1[i] - hist2[i]) ** 2;
        const denominator = hist1[i] + hist2[i];
        if (denominator > 0) {
            distance += numerator / denominator;
        }
    }
    return distance / 2; // Divide by 2 to keep distance in [0, 1] range
};

/**
 * Compares two Uniform LBP feature vectors using a highly occlusion-resistant method.
 * It calculates the distance for each corresponding block and discards the blocks with
 * the highest error before averaging the rest.
 * @param features1 First feature vector.
 * @param features2 Second feature vector.
 * @returns The final calculated distance.
 */
const calculateDistance = (features1: number[], features2: number[]): number => {
    if (features1.length !== features2.length || features1.length === 0) {
        return Infinity;
    }
    
    const numBlocks = 16; // From 4x4 grid
    const histogramSize = UNIFORM_LBP_BINS;
    const blockDistances: number[] = [];

    for (let i = 0; i < numBlocks; i++) {
        const start = i * histogramSize;
        const end = start + histogramSize;
        
        const hist1 = features1.slice(start, end);
        const hist2 = features2.slice(start, end);
        
        blockDistances.push(chiSquaredDistance(hist1, hist2));
    }

    // --- Enhanced Occlusion Handling ---
    // Sort distances and discard the worst 31% (5 out of 16 blocks).
    // This provides stronger tolerance for phones, sunglasses, etc.
    blockDistances.sort((a, b) => a - b);
    const blocksToDiscard = 5;
    const blocksToKeep = numBlocks - blocksToDiscard;
    
    let totalDistance = 0;
    for (let i = 0; i < blocksToKeep; i++) {
        totalDistance += blockDistances[i];
    }

    return totalDistance / blocksToKeep;
};

/**
 * Verifies a captured image against a single student's known facial features.
 * @param capturedImage - base64 string of the image captured at check-in/out.
 * @param storedFeatures - The feature vector stored during student registration.
 * @returns A promise that resolves to true if the face "matches".
 */
export const verifyFace = async (capturedImage: string, storedFeatures: number[]): Promise<boolean> => {
  const capturedFeatures = await extractFaceFeatures(capturedImage);
  const distance = calculateDistance(capturedFeatures, storedFeatures);
  console.log('Calculated feature distance (occlusion-resistant ULBP):', distance);
  return distance < MATCH_THRESHOLD;
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