/**
 * Background Service Worker — AI Touch-to-Explain Learning Assistant
 * 
 * Handles communication between content script and backend API.
 * Includes hardcoded demo auth token for authentication.
 * 
 * Validates: Requirements 1.3, 1.4, 9.2
 */

const API_BASE = 'http://localhost:3001/api/v1';
const AUTH_TOKEN = 'demo-user-token';

// ── Message Handler ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        error: true,
        message: error.message || 'An unexpected error occurred.',
      });
    });

  // Return true to indicate we'll respond asynchronously
  return true;
});

async function handleMessage(message) {
  switch (message.action) {
    case 'explain':
      return handleExplain(message.data);

    case 'audio':
      return handleAudio(message.data);

    case 'flashcards':
      return handleGetFlashcards();

    case 'learning-summary':
      return handleGetLearningSummary(message.data);

    default:
      return { error: true, message: `Unknown action: ${message.action}` };
  }
}

// ── Explain Request (Req 1.3, 1.4) ──
async function handleExplain(data) {
  try {
    const response = await fetch(`${API_BASE}/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        text: data.text,
        depth: data.depth,
        contentType: data.contentType || 'text',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: true,
        message: errorData.message || `Server returned ${response.status}`,
        status: response.status,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      error: true,
      message: 'Failed to connect to the server. Make sure the backend is running on localhost:3001.',
    };
  }
}

// ── Audio Request (Req 9.2) ──
async function handleAudio(data) {
  try {
    const response = await fetch(`${API_BASE}/audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        text: data.text,
        voice: data.voice || 'Joanna',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: true,
        message: errorData.message || 'Audio generation failed',
      };
    }

    // Return success — actual audio playback uses Web Speech API in content script
    return { success: true };
  } catch (error) {
    return {
      error: true,
      message: 'Failed to connect to audio service.',
    };
  }
}

// ── Get Flashcards ──
async function handleGetFlashcards() {
  try {
    const response = await fetch(`${API_BASE}/flashcards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    });

    if (!response.ok) {
      return { error: true, message: 'Failed to load flashcards' };
    }

    return await response.json();
  } catch (error) {
    return {
      error: true,
      message: 'Failed to connect to the server.',
    };
  }
}

// ── Get Learning Summary ──
async function handleGetLearningSummary(data = {}) {
  try {
    const params = new URLSearchParams();
    if (data?.startDate) params.set('startDate', data.startDate);
    if (data?.endDate) params.set('endDate', data.endDate);

    const url = `${API_BASE}/learning-summary${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    });

    if (!response.ok) {
      return { error: true, message: 'Failed to load learning summary' };
    }

    return await response.json();
  } catch (error) {
    return {
      error: true,
      message: 'Failed to connect to the server.',
    };
  }
}
