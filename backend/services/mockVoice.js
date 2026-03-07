/**
 * Mock Voice Synthesizer
 * 
 * Simulates AWS Polly for converting text explanations to speech.
 * Returns a minimal valid MP3 audio buffer for demo purposes.
 * 
 * Validates: Requirements 9.1-9.6 (Audio Explanation Synthesis)
 */

// Minimal valid MP3 frame (silence) — enough for browser to recognize as audio
// This is a tiny MPEG audio frame that produces ~0.1s of silence
const SILENT_MP3_FRAME = Buffer.from([
  0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x54, 0x41, 0x47, 0x00,
]);

const AVAILABLE_VOICES = [
  { id: 'Joanna', language: 'en-US', gender: 'Female' },
  { id: 'Matthew', language: 'en-US', gender: 'Male' },
  { id: 'Amy', language: 'en-GB', gender: 'Female' },
  { id: 'Brian', language: 'en-GB', gender: 'Male' },
];

/**
 * Convert text to speech (mock)
 * @param {string} text - The explanation text to convert
 * @param {string} voice - Voice name (default: 'Joanna')
 * @returns {Promise<{audio: Buffer, contentType: string, duration: number}>}
 */
async function synthesizeSpeech(text, voice = 'Joanna') {
  // Simulate Polly processing delay (200-600ms)
  const delay = 200 + Math.random() * 400;
  await new Promise(resolve => setTimeout(resolve, delay));

  // Estimate duration based on text length (~150 words per minute)
  const wordCount = text.split(/\s+/).length;
  const estimatedDurationSec = (wordCount / 150) * 60;

  // Create a buffer by repeating the silent frame to approximate duration
  const framesNeeded = Math.max(1, Math.ceil(estimatedDurationSec * 10));
  const audioBuffers = [];
  for (let i = 0; i < Math.min(framesNeeded, 50); i++) {
    audioBuffers.push(SILENT_MP3_FRAME);
  }

  const audio = Buffer.concat(audioBuffers);

  return {
    audio,
    contentType: 'audio/mpeg',
    duration: estimatedDurationSec,
    voice,
    wordCount,
  };
}

/**
 * Get available voices
 */
function getVoices() {
  return AVAILABLE_VOICES;
}

module.exports = { synthesizeSpeech, getVoices };
