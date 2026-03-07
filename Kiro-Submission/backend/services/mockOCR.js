/**
 * Mock OCR Service
 * 
 * Simulates AWS Textract for extracting text from images and PDFs.
 * Returns hardcoded extracted text with a confidence score.
 * 
 * Validates: Requirements 5.1-5.5 (OCR Text Extraction)
 */

const SAMPLE_EXTRACTIONS = [
  {
    text: 'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data and use it to learn for themselves.',
    confidence: 0.98,
  },
  {
    text: 'Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy. During photosynthesis, plants capture light energy and use it to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds.',
    confidence: 0.96,
  },
  {
    text: 'The theory of relativity encompasses two interrelated physics theories by Albert Einstein: special relativity and general relativity. Special relativity applies to all physical phenomena in the absence of gravity. General relativity explains the law of gravitation and its relation to other forces of nature.',
    confidence: 0.94,
  },
  {
    text: 'Blockchain technology is a decentralized, distributed ledger that records transactions across many computers. This ensures that any involved record cannot be altered retroactively, without the alteration of all subsequent blocks.',
    confidence: 0.97,
  },
];

/**
 * Extract text from an image or PDF (mock)
 * @param {Buffer|string} content - The image/PDF content (ignored in mock)
 * @param {string} format - 'image' or 'pdf'
 * @returns {Promise<{text: string, confidence: number, warnings: string[]}>}
 */
async function extractText(content, format = 'image') {
  // Simulate OCR processing delay (500-1500ms)
  const delay = 500 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  // Pick a random sample extraction
  const sample = SAMPLE_EXTRACTIONS[Math.floor(Math.random() * SAMPLE_EXTRACTIONS.length)];

  const warnings = [];

  // Add warning if confidence is below 95% (Requirement 5.3)
  if (sample.confidence < 0.95) {
    warnings.push(
      `OCR confidence is ${(sample.confidence * 100).toFixed(1)}%, which is below the 95% threshold. The extracted text may contain inaccuracies.`
    );
  }

  return {
    text: sample.text,
    confidence: sample.confidence,
    warnings,
    format,
    processedAt: Date.now(),
  };
}

/**
 * Check if a content type is supported for OCR
 */
function isSupportedFormat(contentType) {
  return ['image', 'pdf'].includes(contentType);
}

module.exports = { extractText, isSupportedFormat };
