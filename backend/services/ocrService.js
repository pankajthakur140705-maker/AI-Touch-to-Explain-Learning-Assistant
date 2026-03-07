/**
 * Real OCR Service — AWS Textract
 * 
 * Extracts text from images and PDFs using AWS Textract.
 * Falls back to mock if Textract is not configured.
 * 
 * Validates: Requirements 5.1-5.5 (OCR Text Extraction)
 */

const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { config, getAWSConfig, isAWSMode } = require('../config');

let textractClient = null;

function getTextractClient() {
  if (!textractClient) {
    textractClient = new TextractClient(getAWSConfig());
  }
  return textractClient;
}

/**
 * Extract text from an image or PDF
 * @param {Buffer|string} content - Image/PDF bytes or base64 string
 * @param {string} format - 'image' or 'pdf'
 * @returns {Promise<{text: string, confidence: number, warnings: string[]}>}
 */
async function extractText(content, format = 'image') {
  if (!isAWSMode() || !config.textract.enabled) {
    // Fall back to mock
    const mockOCR = require('./mockOCR');
    return await mockOCR.extractText(content, format);
  }

  try {
    const client = getTextractClient();

    // Convert content to bytes if it's base64
    let documentBytes;
    if (Buffer.isBuffer(content)) {
      documentBytes = content;
    } else if (typeof content === 'string') {
      // Assume base64
      documentBytes = Buffer.from(content, 'base64');
    } else {
      throw new Error('Content must be a Buffer or base64 string');
    }

    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: documentBytes,
      },
    });

    const response = await client.send(command);

    // Extract text from LINE blocks
    const lines = [];
    let totalConfidence = 0;
    let blockCount = 0;

    for (const block of response.Blocks || []) {
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text);
        totalConfidence += block.Confidence || 0;
        blockCount++;
      }
    }

    const extractedText = lines.join('\n');
    const avgConfidence = blockCount > 0 ? totalConfidence / blockCount : 0;
    const confidence = avgConfidence / 100; // Convert to 0-1 scale

    const warnings = [];
    if (confidence < 0.95) {
      warnings.push(
        `OCR confidence is ${(confidence * 100).toFixed(1)}%, which is below the 95% threshold. The extracted text may contain inaccuracies.`
      );
    }

    if (lines.length === 0) {
      warnings.push('No text could be detected in the document.');
    }

    return {
      text: extractedText,
      confidence,
      warnings,
      format,
      blocksDetected: blockCount,
      processedAt: Date.now(),
    };
  } catch (error) {
    console.error('[Textract] Error:', error.message);
    
    // If Textract fails, fall back to mock for demo resilience
    if (config.mode === 'aws') {
      throw error; // In AWS mode, propagate the error
    }
    
    const mockOCR = require('./mockOCR');
    return await mockOCR.extractText(content, format);
  }
}

/**
 * Check if a content type is supported for OCR
 */
function isSupportedFormat(contentType) {
  return ['image', 'pdf'].includes(contentType);
}

module.exports = { extractText, isSupportedFormat };
