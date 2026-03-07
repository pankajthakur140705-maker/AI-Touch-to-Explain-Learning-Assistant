/**
 * Explain Route — POST /api/v1/explain
 * 
 * Core endpoint: receives highlighted text + depth preference,
 * generates AI explanation, stores highlight, checks flashcard threshold.
 * 
 * Validates: Requirements 1, 2, 4, 5, 6, 7, 8
 */

const express = require('express');
const router = express.Router();
const { generateExplanation, isValidDepth } = require('../services/llmEngine');
const { extractText, isSupportedFormat } = require('../services/ocrService');
const store = require('../store/dynamoStore');
const { circuitBreakers } = require('../middleware/circuitBreaker');

// Supported content types
const SUPPORTED_CONTENT_TYPES = ['text', 'image', 'pdf'];

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.userId;

  try {
    // ── 1. Validate request body (Req 2.1, 2.2) ──
    const { text, depth, contentType } = req.body;

    if (!text && contentType === 'text') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The "text" field is required when content type is "text".',
      });
    }

    if (!depth || !isValidDepth(depth)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The "depth" field must be one of: very-short, normal, detailed.',
      });
    }

    // ── 2. Content type detection (Req 4.1, 4.4) ──
    const resolvedContentType = contentType || 'text';

    if (!SUPPORTED_CONTENT_TYPES.includes(resolvedContentType)) {
      return res.status(415).json({
        error: 'Unsupported media type',
        message: `Content type "${resolvedContentType}" is not supported. Supported formats: ${SUPPORTED_CONTENT_TYPES.join(', ')}.`,
      });
    }

    // ── 3. OCR processing for images/PDFs (Req 5.1-5.5) ──
    let extractedText = text;
    let ocrResult = null;

    if (resolvedContentType === 'image' || resolvedContentType === 'pdf') {
      try {
        ocrResult = await circuitBreakers.ocr.execute(async () => {
          return await extractText(text, resolvedContentType);
        });
        extractedText = ocrResult.text;
      } catch (error) {
        return res.status(502).json({
          error: 'OCR processing failed',
          message: 'Unable to extract text from the provided content. Please try again or provide text directly.',
        });
      }
    }

    if (!extractedText || extractedText.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'No text could be extracted from the provided content.',
      });
    }

    // ── 4. Generate explanation via LLM (Req 6.1-6.7) ──
    let explanation;
    try {
      explanation = await circuitBreakers.llm.execute(async () => {
        return await generateExplanation(extractedText, depth);
      });
    } catch (error) {
      // Retry once (Req 6.7)
      try {
        explanation = await generateExplanation(extractedText, depth);
        circuitBreakers.llm.onSuccess();
      } catch (retryError) {
        return res.status(502).json({
          error: 'Explanation generation failed',
          message: 'Unable to generate an explanation at this time. Please try again.',
        });
      }
    }

    // ── 5. Generate concept ID ──
    const conceptId = store.generateConceptId(extractedText);

    // ── 6. Store highlight in Knowledge Store (Req 7.1-7.4) ──
    let highlightRecord = null;
    try {
      // Increment concept frequency (Req 7.3)
      const frequency = await store.incrementConceptFrequency(userId, conceptId);

      highlightRecord = await store.storeHighlight(userId, {
        text: extractedText,
        explanation,
        depth,
        conceptId,
      });

      // Update frequency in record
      highlightRecord.frequency = frequency;
    } catch (storeError) {
      // Req 14.3: If Knowledge Store fails, still return explanation
      console.error('[Explain] Knowledge Store error (continuing):', storeError.message);
      store.logRequest({
        type: 'STORE_ERROR',
        userId,
        error: storeError.message,
        conceptId,
      });
    }

    // ── 7. Check flashcard threshold (Req 8.1-8.5) ──
    let flashcardCreated = false;
    try {
      const frequency = await store.getConceptFrequency(userId, conceptId);

      if (frequency >= 3) {
        // Check for duplicate (Req 8.4)
        if (!(await store.flashcardExistsForConcept(userId, conceptId))) {
          await store.storeFlashcard(userId, {
            conceptId,
            front: extractedText.substring(0, 100),
            back: explanation,
          });
          flashcardCreated = true;
        }
      }
    } catch (flashcardError) {
      // Req 8.5: Log error, don't block response
      console.error('[Explain] Flashcard generation error (continuing):', flashcardError.message);
    }

    // ── 8. Log request (Req 12) ──
    const latency = Date.now() - startTime;
    store.logRequest({
      type: 'EXPLAIN',
      userId,
      conceptId,
      depth,
      contentType: resolvedContentType,
      latency,
      success: true,
    });

    // ── 9. Return response (Req 11.3) ──
    const response = {
      explanation,
      conceptId,
      depth,
      flashcardCreated,
      frequency: await store.getConceptFrequency(userId, conceptId),
      latency: `${latency}ms`,
    };

    if (ocrResult) {
      response.ocrConfidence = ocrResult.confidence;
      response.ocrWarnings = ocrResult.warnings;
    }

    return res.json(response);

  } catch (error) {
    // Req 14.1: User-friendly error, no internal details
    console.error('[Explain] Unexpected error:', error);
    store.logRequest({
      type: 'EXPLAIN_ERROR',
      userId,
      error: error.message,
      latency: Date.now() - startTime,
    });

    return res.status(500).json({
      error: 'Processing failed',
      message: 'An unexpected error occurred while processing your request. Please try again.',
    });
  }
});

module.exports = router;
