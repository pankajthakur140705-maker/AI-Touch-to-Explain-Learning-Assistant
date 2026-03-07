/**
 * Real Voice Synthesizer — AWS Polly
 * 
 * Converts text to natural-sounding speech using AWS Polly.
 * Falls back to mock if Polly is not configured.
 * 
 * Validates: Requirements 9.1-9.6 (Audio Explanation Synthesis)
 */

const { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } = require('@aws-sdk/client-polly');
const { config, getAWSConfig, isAWSMode } = require('../config');

let pollyClient = null;

function getPollyClient() {
  if (!pollyClient) {
    pollyClient = new PollyClient(getAWSConfig());
  }
  return pollyClient;
}

/**
 * Convert text to speech
 * @param {string} text - The explanation text to convert
 * @param {string} voice - Voice ID (default from config)
 * @returns {Promise<{audio: Buffer, contentType: string, duration: number}>}
 */
async function synthesizeSpeech(text, voice) {
  if (!isAWSMode() || !config.polly.enabled) {
    // Fall back to mock
    const mockVoice = require('./mockVoice');
    return await mockVoice.synthesizeSpeech(text, voice);
  }

  try {
    const client = getPollyClient();
    const voiceId = voice || config.polly.voiceId;

    // Truncate text if too long for Polly (max 3000 characters)
    const truncatedText = text.length > 3000 ? text.substring(0, 2997) + '...' : text;

    const command = new SynthesizeSpeechCommand({
      Text: truncatedText,
      OutputFormat: 'mp3',
      VoiceId: voiceId,
      Engine: 'neural', // Use neural voice for better quality
      TextType: 'text',
    });

    const response = await client.send(command);

    // Convert audio stream to buffer
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Estimate duration
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    return {
      audio: audioBuffer,
      contentType: response.ContentType || 'audio/mpeg',
      duration: estimatedDuration,
      voice: voiceId,
      wordCount,
      requestCharacters: truncatedText.length,
    };
  } catch (error) {
    console.error('[Polly] Error:', error.message);

    // If engine is not supported, try standard engine
    if (error.name === 'InvalidParameterValueException' || error.message?.includes('neural')) {
      try {
        const client = getPollyClient();
        const command = new SynthesizeSpeechCommand({
          Text: text.length > 3000 ? text.substring(0, 2997) + '...' : text,
          OutputFormat: 'mp3',
          VoiceId: voice || config.polly.voiceId,
          Engine: 'standard',
          TextType: 'text',
        });

        const response = await client.send(command);
        const chunks = [];
        for await (const chunk of response.AudioStream) {
          chunks.push(chunk);
        }

        return {
          audio: Buffer.concat(chunks),
          contentType: response.ContentType || 'audio/mpeg',
          duration: (text.split(/\s+/).length / 150) * 60,
          voice: voice || config.polly.voiceId,
          wordCount: text.split(/\s+/).length,
          engine: 'standard',
        };
      } catch (fallbackError) {
        console.error('[Polly] Standard engine also failed:', fallbackError.message);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Get available voices from Polly
 */
async function getVoices() {
  if (!isAWSMode() || !config.polly.enabled) {
    const mockVoice = require('./mockVoice');
    return mockVoice.getVoices();
  }

  try {
    const client = getPollyClient();
    const command = new DescribeVoicesCommand({
      LanguageCode: 'en-US',
    });

    const response = await client.send(command);

    return (response.Voices || []).map((v) => ({
      id: v.Id,
      language: v.LanguageCode,
      gender: v.Gender,
      name: v.Name,
      engine: v.SupportedEngines,
    }));
  } catch (error) {
    console.error('[Polly] Error listing voices:', error.message);
    // Return defaults
    return [
      { id: 'Joanna', language: 'en-US', gender: 'Female' },
      { id: 'Matthew', language: 'en-US', gender: 'Male' },
    ];
  }
}

module.exports = { synthesizeSpeech, getVoices };
