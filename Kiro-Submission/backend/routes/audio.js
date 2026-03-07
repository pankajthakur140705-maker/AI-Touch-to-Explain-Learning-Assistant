/**
 * Audio Route — POST /api/v1/audio
 * 
 * Converts explanation text to speech (mock AWS Polly).
 * Returns MP3 audio stream.
 * 
 * Validates: Requirements 9.1-9.6 (Audio Explanation Synthesis)
 */

const express = require('express');
const router = express.Router();
const { synthesizeSpeech, getVoices } = require('../services/voiceService');
const { circuitBreakers } = require('../middleware/circuitBreaker');
const store = require('../store/dynamoStore');

// POST /api/v1/audio — Convert text to speech
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user.userId;

  try {
    const { text, voice } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The "text" field is required for audio synthesis.',
      });
    }

    // Generate audio via Voice Synthesizer with circuit breaker
    let result;
    try {
      result = await circuitBreakers.voice.execute(async () => {
        return await synthesizeSpeech(text, voice || 'Joanna');
      });
    } catch (error) {
      return res.status(502).json({
        error: 'Audio generation failed',
        message: 'Unable to generate audio at this time. The text explanation is still available.',
      });
    }

    // Log request
    store.logRequest({
      type: 'AUDIO',
      userId,
      voice: result.voice,
      wordCount: result.wordCount,
      duration: result.duration,
      latency: Date.now() - startTime,
      success: true,
    });

    // Stream audio response
    res.set({
      'Content-Type': result.contentType,
      'Content-Length': result.audio.length,
      'X-Audio-Duration': result.duration.toFixed(1),
      'X-Audio-Voice': result.voice,
    });

    return res.send(result.audio);

  } catch (error) {
    console.error('[Audio] Unexpected error:', error);
    return res.status(500).json({
      error: 'Audio processing failed',
      message: 'An unexpected error occurred during audio generation. Please try again.',
    });
  }
});

// GET /api/v1/audio/voices — List available voices
router.get('/voices', (req, res) => {
  res.json({ voices: getVoices() });
});

module.exports = router;
