/**
 * Popup Script — AI Touch-to-Explain Learning Assistant
 * 
 * Dashboard showing learning summary, flashcard review, and help.
 * Communicates with the backend via the background service worker.
 * 
 * Validates: Requirements 8, 13 (Analytics & Flashcards)
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  checkServerStatus();
  loadDashboard();
  loadFlashcards();
});

// ─────────────────────────────────────────────
// Tab Navigation
// ─────────────────────────────────────────────

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`tab-${targetTab}`)?.classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────
// Server Status Check
// ─────────────────────────────────────────────

async function checkServerStatus() {
  const statusEl = document.getElementById('serverStatus');
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');

  try {
    const response = await fetch('http://localhost:3001/api/v1/health', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      dot.classList.add('online');
      text.textContent = 'Online';
    } else {
      dot.classList.add('offline');
      text.textContent = 'Error';
    }
  } catch {
    dot.classList.add('offline');
    text.textContent = 'Offline';
  }
}

// ─────────────────────────────────────────────
// Dashboard — Learning Summary (Req 13)
// ─────────────────────────────────────────────

async function loadDashboard() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'learning-summary',
      data: {},
    });

    if (response.error) {
      console.warn('Failed to load dashboard:', response.message);
      return;
    }

    // Update stats
    document.getElementById('totalHighlights').textContent = response.totalHighlights || 0;
    document.getElementById('totalFlashcards').textContent = response.flashcardCount || 0;

    // Top category
    if (response.topConcepts && response.topConcepts.length > 0) {
      const topCategory = response.topConcepts[0].category || 'general';
      document.getElementById('topCategory').textContent = capitalize(topCategory);

      // Display top concepts (Req 13.2, 13.3)
      renderTopConcepts(response.topConcepts);
    }
  } catch (error) {
    console.warn('Dashboard load error:', error);
  }
}

function renderTopConcepts(concepts) {
  const container = document.getElementById('topConcepts');

  if (!concepts || concepts.length === 0) {
    container.innerHTML = '<p class="empty-state">No concepts yet. Highlight text on any page to get started!</p>';
    return;
  }

  const maxFreq = concepts[0].frequency || 1;

  container.innerHTML = concepts.map((concept, index) => `
    <div class="concept-item">
      <div class="concept-rank">${index + 1}</div>
      <div class="concept-info">
        <div class="concept-name">${escapeHtml(concept.name)}</div>
        <div class="concept-meta">
          <span class="concept-category">${capitalize(concept.category)}</span>
          <span class="concept-freq">${concept.frequency}x</span>
        </div>
      </div>
      <div class="concept-bar-wrapper">
        <div class="concept-bar" style="width: ${(concept.frequency / maxFreq) * 100}%"></div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// Flashcards (Req 8)
// ─────────────────────────────────────────────

let flashcards = [];
let currentFlashcardIndex = 0;
let isFlipped = false;

async function loadFlashcards() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'flashcards',
    });

    if (response.error) {
      console.warn('Failed to load flashcards:', response.message);
      return;
    }

    flashcards = response.flashcards || [];

    if (flashcards.length === 0) {
      document.getElementById('flashcardEmpty').style.display = 'block';
      document.getElementById('flashcardViewer').style.display = 'none';
    } else {
      document.getElementById('flashcardEmpty').style.display = 'none';
      document.getElementById('flashcardViewer').style.display = 'block';
      document.getElementById('flashcardTotal').textContent = flashcards.length;
      renderFlashcard(0);
      initFlashcardControls();
    }

    // Update dashboard count
    document.getElementById('totalFlashcards').textContent = flashcards.length;
  } catch (error) {
    console.warn('Flashcards load error:', error);
  }
}

function renderFlashcard(index) {
  if (index < 0 || index >= flashcards.length) return;

  currentFlashcardIndex = index;
  isFlipped = false;

  const card = flashcards[index];
  document.getElementById('flashcardFront').textContent = card.front || '—';
  document.getElementById('flashcardBack').textContent = truncate(card.back || '—', 300);
  document.getElementById('flashcardIndex').textContent = index + 1;

  // Reset flip state
  document.getElementById('flashcardInner').classList.remove('flipped');
}

function initFlashcardControls() {
  const flipBtn = document.getElementById('fcFlip');
  const prevBtn = document.getElementById('fcPrev');
  const nextBtn = document.getElementById('fcNext');
  const card = document.getElementById('flashcard');

  flipBtn?.addEventListener('click', toggleFlip);
  card?.addEventListener('click', toggleFlip);

  prevBtn?.addEventListener('click', () => {
    if (currentFlashcardIndex > 0) {
      renderFlashcard(currentFlashcardIndex - 1);
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (currentFlashcardIndex < flashcards.length - 1) {
      renderFlashcard(currentFlashcardIndex + 1);
    }
  });

  // Keyboard navigation
  card?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFlip();
    }
  });
}

function toggleFlip() {
  isFlipped = !isFlipped;
  const inner = document.getElementById('flashcardInner');
  if (isFlipped) {
    inner.classList.add('flipped');
  } else {
    inner.classList.remove('flipped');
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
