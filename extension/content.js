/**
 * Content Script — AI Touch-to-Explain Learning Assistant
 * 
 * Injected into every webpage. Detects text highlighting, shows a floating
 * action button, lets user pick explanation depth, displays explanation
 * overlay, and supports audio playback.
 * 
 * Validates: Requirements 1, 9, 11, 14.4, 17
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__aiTouchToExplainLoaded) return;
  window.__aiTouchToExplainLoaded = true;

  // ── State ──
  let currentPopup = null;
  let currentFloatingBtn = null;
  let currentDepthPicker = null;
  let audioElement = null;
  let selectedText = '';

  // ── Constants ──
  const MIN_SELECTION_LENGTH = 3;
  const DEPTHS = [
    { id: 'very-short', label: '⚡ Quick', desc: '50-100 words' },
    { id: 'normal', label: '📖 Normal', desc: '100-200 words' },
    { id: 'detailed', label: '🔬 Detailed', desc: '200-400 words' },
  ];

  // ─────────────────────────────────────────────
  // Text Selection Detection (Req 1.1)
  // ─────────────────────────────────────────────

  document.addEventListener('mouseup', (e) => {
    // Don't trigger on our own UI elements
    if (e.target.closest('.tte-container')) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length >= MIN_SELECTION_LENGTH) {
        selectedText = text;
        showFloatingButton(e.clientX, e.clientY);
      } else {
        removeFloatingButton();
      }
    }, 10);
  });

  // Close popup when clicking outside (Req 11.4)
  document.addEventListener('mousedown', (e) => {
    if (currentPopup && !e.target.closest('.tte-container')) {
      closeAllUI();
    }
  });

  // Keyboard navigation (Req 17.1) — Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllUI();
    }
  });

  // ─────────────────────────────────────────────
  // Floating Action Button (Req 1.2)
  // ─────────────────────────────────────────────

  function showFloatingButton(x, y) {
    removeFloatingButton();
    removeDepthPicker();

    const btn = document.createElement('div');
    btn.className = 'tte-container tte-floating-btn';
    btn.innerHTML = `
      <button class="tte-btn-primary" title="Explain this text" tabindex="0">
        <span class="tte-btn-icon">💡</span>
        <span class="tte-btn-text">Explain</span>
      </button>
    `;

    // Position near selection
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    btn.style.position = 'absolute';
    btn.style.left = `${x + scrollX + 10}px`;
    btn.style.top = `${y + scrollY - 40}px`;
    btn.style.zIndex = '2147483647';

    btn.querySelector('.tte-btn-primary').addEventListener('click', (e) => {
      e.stopPropagation();
      showDepthPicker(x, y);
    });

    document.body.appendChild(btn);
    currentFloatingBtn = btn;
  }

  function removeFloatingButton() {
    if (currentFloatingBtn) {
      currentFloatingBtn.remove();
      currentFloatingBtn = null;
    }
  }

  // ─────────────────────────────────────────────
  // Depth Picker (Req 1.2)
  // ─────────────────────────────────────────────

  function showDepthPicker(x, y) {
    removeFloatingButton();
    removeDepthPicker();

    const picker = document.createElement('div');
    picker.className = 'tte-container tte-depth-picker';
    picker.innerHTML = `
      <div class="tte-depth-header">Choose explanation depth:</div>
      <div class="tte-depth-options">
        ${DEPTHS.map((d, i) => `
          <button class="tte-depth-option" data-depth="${d.id}" tabindex="${i + 1}">
            <span class="tte-depth-label">${d.label}</span>
            <span class="tte-depth-desc">${d.desc}</span>
          </button>
        `).join('')}
      </div>
    `;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    picker.style.position = 'absolute';
    picker.style.left = `${x + scrollX + 10}px`;
    picker.style.top = `${y + scrollY - 40}px`;
    picker.style.zIndex = '2147483647';

    // Handle depth selection (Req 1.3)
    picker.querySelectorAll('.tte-depth-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const depth = btn.dataset.depth;
        removeDepthPicker();
        requestExplanation(selectedText, depth, x, y);
      });
    });

    document.body.appendChild(picker);
    currentDepthPicker = picker;

    // Focus first option for keyboard navigation
    picker.querySelector('.tte-depth-option')?.focus();
  }

  function removeDepthPicker() {
    if (currentDepthPicker) {
      currentDepthPicker.remove();
      currentDepthPicker = null;
    }
  }

  // ─────────────────────────────────────────────
  // Explanation Request & Display
  // ─────────────────────────────────────────────

  async function requestExplanation(text, depth, x, y) {
    // Show loading overlay
    showOverlay(x, y, {
      loading: true,
      text: text,
      depth: depth,
    });

    try {
      // Send message to background script (Req 1.3, 1.4)
      const response = await sendMessage({
        action: 'explain',
        data: { text, depth, contentType: 'text' },
      });

      if (response.error) {
        showOverlay(x, y, {
          error: true,
          message: response.message || 'Failed to generate explanation.',
          text,
          depth,
        });
        return;
      }

      // Display explanation (Req 11.1, 11.2, 11.3)
      showOverlay(x, y, {
        explanation: response.explanation,
        conceptId: response.conceptId,
        depth: response.depth,
        frequency: response.frequency,
        flashcardCreated: response.flashcardCreated,
        text,
      });
    } catch (error) {
      // Network timeout → show retry (Req 14.4)
      showOverlay(x, y, {
        error: true,
        message: 'Request timed out. Please check your connection.',
        retry: true,
        text,
        depth,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Overlay Popup (Req 11.1-11.5)
  // ─────────────────────────────────────────────

  function showOverlay(x, y, data) {
    closeOverlay();

    const overlay = document.createElement('div');
    overlay.className = 'tte-container tte-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'AI Explanation');
    overlay.tabIndex = -1;

    let content = '';

    if (data.loading) {
      content = `
        <div class="tte-overlay-header">
          <span class="tte-overlay-title">🔍 Generating explanation...</span>
          <button class="tte-close-btn" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="tte-overlay-body">
          <div class="tte-loading">
            <div class="tte-spinner"></div>
            <p>Analyzing "<em>${escapeHtml(truncate(data.text, 60))}</em>"</p>
            <p class="tte-loading-depth">Depth: ${data.depth}</p>
          </div>
        </div>
      `;
    } else if (data.error) {
      content = `
        <div class="tte-overlay-header tte-error-header">
          <span class="tte-overlay-title">⚠️ Error</span>
          <button class="tte-close-btn" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="tte-overlay-body">
          <p class="tte-error-message">${escapeHtml(data.message)}</p>
          ${data.retry ? `<button class="tte-retry-btn" tabindex="0">🔄 Retry</button>` : ''}
        </div>
      `;
    } else {
      const depthLabel = DEPTHS.find(d => d.id === data.depth)?.label || data.depth;
      content = `
        <div class="tte-overlay-header">
          <span class="tte-overlay-title">💡 Explanation <span class="tte-depth-badge">${depthLabel}</span></span>
          <button class="tte-close-btn" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="tte-overlay-body">
          <div class="tte-highlighted-text">
            <strong>Selected:</strong> "${escapeHtml(truncate(data.text, 80))}"
          </div>
          <div class="tte-explanation">${formatExplanation(data.explanation)}</div>
          ${data.flashcardCreated ? '<div class="tte-flashcard-notice">📝 Flashcard auto-created for this concept!</div>' : ''}
          ${data.frequency ? `<div class="tte-frequency">Highlighted ${data.frequency} time${data.frequency > 1 ? 's' : ''}</div>` : ''}
        </div>
        <div class="tte-overlay-footer">
          <button class="tte-listen-btn" tabindex="0" title="Listen to explanation">
            🔊 Listen
          </button>
          <span class="tte-concept-id" title="Concept ID">#${escapeHtml(data.conceptId || '')}</span>
        </div>
      `;
    }

    overlay.innerHTML = content;

    // Position overlay — keep within viewport
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '2147483647';

    document.body.appendChild(overlay);

    // Adjust position to stay within viewport
    const rect = overlay.getBoundingClientRect();
    let left = x + scrollX + 15;
    let top = y + scrollY + 15;

    if (left + rect.width > window.innerWidth + scrollX - 20) {
      left = x + scrollX - rect.width - 15;
    }
    if (top + rect.height > window.innerHeight + scrollY - 20) {
      top = y + scrollY - rect.height - 15;
    }
    if (left < scrollX + 10) left = scrollX + 10;
    if (top < scrollY + 10) top = scrollY + 10;

    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;

    currentPopup = overlay;

    // ── Event listeners ──

    // Close button
    overlay.querySelector('.tte-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOverlay();
    });

    // Retry button (Req 14.4)
    overlay.querySelector('.tte-retry-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      requestExplanation(data.text, data.depth, x, y);
    });

    // Listen button (Req 9.1, 9.2)
    overlay.querySelector('.tte-listen-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAudioRequest(data.explanation, overlay);
    });

    // Focus the overlay for keyboard navigation
    overlay.focus();

    // Keyboard: Escape to close, Tab to navigate
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    });
  }

  function closeOverlay() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    stopAudio();
  }

  function closeAllUI() {
    removeFloatingButton();
    removeDepthPicker();
    closeOverlay();
  }

  // ─────────────────────────────────────────────
  // Audio Playback (Req 9.1-9.6, 17.2)
  // ─────────────────────────────────────────────

  async function handleAudioRequest(text, overlay) {
    const listenBtn = overlay.querySelector('.tte-listen-btn');
    if (!listenBtn) return;

    // Show loading state
    listenBtn.innerHTML = '⏳ Loading...';
    listenBtn.disabled = true;

    try {
      const response = await sendMessage({
        action: 'audio',
        data: { text },
      });

      if (response.error) {
        // Req 9.5: Show error but keep text explanation visible
        listenBtn.innerHTML = '❌ Audio failed';
        setTimeout(() => {
          listenBtn.innerHTML = '🔊 Listen';
          listenBtn.disabled = false;
        }, 2000);
        return;
      }

      // Create audio controls (Req 17.2: play, pause, stop)
      listenBtn.outerHTML = `
        <div class="tte-audio-controls">
          <button class="tte-audio-btn tte-audio-play" title="Play" tabindex="0">▶️ Play</button>
          <button class="tte-audio-btn tte-audio-pause" title="Pause" tabindex="0" disabled>⏸️ Pause</button>
          <button class="tte-audio-btn tte-audio-stop" title="Stop" tabindex="0">⏹️ Stop</button>
        </div>
      `;

      // Use Web Speech API for actual audio since mock MP3 is silent
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;

        const playBtn = overlay.querySelector('.tte-audio-play');
        const pauseBtn = overlay.querySelector('.tte-audio-pause');
        const stopBtn = overlay.querySelector('.tte-audio-stop');

        playBtn?.addEventListener('click', () => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          } else {
            window.speechSynthesis.speak(utterance);
          }
          playBtn.disabled = true;
          pauseBtn.disabled = false;
        });

        pauseBtn?.addEventListener('click', () => {
          window.speechSynthesis.pause();
          playBtn.disabled = false;
          pauseBtn.disabled = true;
        });

        stopBtn?.addEventListener('click', () => {
          window.speechSynthesis.cancel();
          playBtn.disabled = false;
          pauseBtn.disabled = true;
        });

        utterance.onend = () => {
          playBtn.disabled = false;
          pauseBtn.disabled = true;
        };

        // Auto-play
        window.speechSynthesis.speak(utterance);
        playBtn.disabled = true;
        pauseBtn.disabled = false;
      }

    } catch (error) {
      listenBtn.innerHTML = '❌ Audio failed';
      listenBtn.disabled = false;
    }
  }

  function stopAudio() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }
  }

  // ─────────────────────────────────────────────
  // Communication with Background Script
  // ─────────────────────────────────────────────

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 10000); // 10 second timeout (Req 15.1)

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  function formatExplanation(text) {
    if (!text) return '';
    // Convert markdown-like formatting to HTML
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^# (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h4>$1</h4>')
      .replace(/^\d+\.\s/gm, (match) => `<br>${match}`)
      .replace(/^- (.*?)$/gm, '<li>$1</li>');
  }

})();
