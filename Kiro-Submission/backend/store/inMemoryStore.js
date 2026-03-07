/**
 * In-Memory Data Store
 * 
 * Simulates DynamoDB (Knowledge Store) for demo purposes.
 * Data persists only while the server is running.
 * 
 * Validates: Requirements 7.1-7.6 (Knowledge Graph Storage)
 *            Requirements 8.1-8.4 (Flashcard Storage)
 *            Requirements 13.1-13.4 (Learning Analytics)
 */

const { v4: uuidv4 } = require('uuid');

// ── Highlights Store ──
// Map<userId, Highlight[]>
const highlights = new Map();

// ── Flashcards Store ──
// Map<userId, Flashcard[]>
const flashcards = new Map();

// ── Concept Frequency Store ──
// Map<"userId:conceptId", number>
const conceptFrequency = new Map();

// ── Documents Store ──
// Map<userId, Document[]>
const documents = new Map();

// ── Monitoring / Logs ──
const requestLogs = [];

// ─────────────────────────────────────────────
// Highlight Operations
// ─────────────────────────────────────────────

function storeHighlight(userId, highlightData) {
  const record = {
    highlightId: uuidv4(),
    userId,
    text: highlightData.text,
    explanation: highlightData.explanation,
    depth: highlightData.depth,
    topicCategory: detectTopicCategory(highlightData.text),
    conceptId: highlightData.conceptId,
    frequency: getConceptFrequency(userId, highlightData.conceptId),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (!highlights.has(userId)) {
    highlights.set(userId, []);
  }
  highlights.get(userId).push(record);

  return record;
}

function getHighlights(userId, options = {}) {
  const userHighlights = highlights.get(userId) || [];

  let filtered = [...userHighlights];

  // Filter by date range
  if (options.startDate) {
    filtered = filtered.filter(h => h.createdAt >= options.startDate);
  }
  if (options.endDate) {
    filtered = filtered.filter(h => h.createdAt <= options.endDate);
  }

  // Filter by topic
  if (options.topic) {
    filtered = filtered.filter(h => h.topicCategory === options.topic);
  }

  return filtered;
}

function getHighlightCount(userId) {
  return (highlights.get(userId) || []).length;
}

// ─────────────────────────────────────────────
// Concept Frequency Operations
// ─────────────────────────────────────────────

function incrementConceptFrequency(userId, conceptId) {
  const key = `${userId}:${conceptId}`;
  const current = conceptFrequency.get(key) || 0;
  conceptFrequency.set(key, current + 1);
  return current + 1;
}

function getConceptFrequency(userId, conceptId) {
  return conceptFrequency.get(`${userId}:${conceptId}`) || 0;
}

// ─────────────────────────────────────────────
// Flashcard Operations
// ─────────────────────────────────────────────

function storeFlashcard(userId, flashcardData) {
  const record = {
    flashcardId: uuidv4(),
    userId,
    conceptId: flashcardData.conceptId,
    front: flashcardData.front,
    back: flashcardData.back,
    createdAt: Date.now(),
    lastReviewed: null,
    reviewCount: 0,
    difficulty: 3, // Medium default
  };

  if (!flashcards.has(userId)) {
    flashcards.set(userId, []);
  }
  flashcards.get(userId).push(record);

  return record;
}

function getFlashcards(userId) {
  return flashcards.get(userId) || [];
}

function flashcardExistsForConcept(userId, conceptId) {
  const userFlashcards = flashcards.get(userId) || [];
  return userFlashcards.some(f => f.conceptId === conceptId);
}

function getFlashcardCount(userId) {
  return (flashcards.get(userId) || []).length;
}

// ─────────────────────────────────────────────
// Document Operations
// ─────────────────────────────────────────────

function storeDocument(userId, docData) {
  const record = {
    documentId: uuidv4(),
    userId,
    fileName: docData.fileName,
    fileSize: docData.fileSize,
    contentType: docData.contentType,
    s3Key: `${userId}/uploads/${uuidv4()}.${docData.extension || 'pdf'}`,
    uploadedAt: Date.now(),
    processedAt: null,
    status: 'uploaded',
  };

  if (!documents.has(userId)) {
    documents.set(userId, []);
  }
  documents.get(userId).push(record);

  return record;
}

function getDocuments(userId) {
  return documents.get(userId) || [];
}

// ─────────────────────────────────────────────
// Learning Analytics
// ─────────────────────────────────────────────

function getTopConcepts(userId, limit = 10) {
  const userHighlights = highlights.get(userId) || [];

  // Aggregate by conceptId
  const conceptMap = {};
  for (const h of userHighlights) {
    if (!conceptMap[h.conceptId]) {
      conceptMap[h.conceptId] = {
        conceptId: h.conceptId,
        name: h.text.substring(0, 50),
        frequency: 0,
        category: h.topicCategory,
      };
    }
    conceptMap[h.conceptId].frequency++;
  }

  // Sort by frequency descending, take top N
  return Object.values(conceptMap)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}

function getLearningAnalytics(userId, startDate, endDate) {
  const dateFilteredHighlights = getHighlights(userId, { startDate, endDate });
  const allHighlights = highlights.get(userId) || [];

  // Get top concepts from filtered highlights
  const conceptMap = {};
  for (const h of dateFilteredHighlights) {
    if (!conceptMap[h.conceptId]) {
      conceptMap[h.conceptId] = {
        conceptId: h.conceptId,
        name: h.text.substring(0, 50),
        frequency: 0,
        category: h.topicCategory,
      };
    }
    conceptMap[h.conceptId].frequency++;
  }

  const topConcepts = Object.values(conceptMap)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  return {
    userId,
    topConcepts,
    totalHighlights: allHighlights.length,
    flashcardCount: getFlashcardCount(userId),
    dateRange: {
      start: startDate || null,
      end: endDate || null,
    },
  };
}

// ─────────────────────────────────────────────
// Monitoring / Logging
// ─────────────────────────────────────────────

function logRequest(logEntry) {
  requestLogs.push({
    ...logEntry,
    timestamp: Date.now(),
  });

  // Keep only last 1000 logs in memory
  if (requestLogs.length > 1000) {
    requestLogs.shift();
  }
}

function getRequestLogs() {
  return [...requestLogs];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function detectTopicCategory(text) {
  const lowerText = text.toLowerCase();

  const categories = {
    programming: ['function', 'variable', 'code', 'algorithm', 'api', 'class', 'object', 'array', 'loop', 'javascript', 'python', 'react', 'node', 'database', 'html', 'css', 'typescript', 'programming', 'software', 'debug', 'compile'],
    mathematics: ['equation', 'theorem', 'calculus', 'algebra', 'geometry', 'integral', 'derivative', 'matrix', 'vector', 'probability', 'statistics', 'math', 'number', 'formula'],
    science: ['atom', 'molecule', 'cell', 'energy', 'force', 'gravity', 'evolution', 'dna', 'chemical', 'physics', 'biology', 'chemistry', 'quantum', 'electron', 'nucleus', 'photon'],
    history: ['war', 'empire', 'revolution', 'dynasty', 'civilization', 'ancient', 'medieval', 'century', 'colony', 'president', 'king', 'queen', 'historical'],
    language: ['grammar', 'syntax', 'verb', 'noun', 'adjective', 'sentence', 'paragraph', 'essay', 'literary', 'metaphor', 'simile', 'rhetoric'],
    business: ['market', 'economy', 'investment', 'revenue', 'profit', 'strategy', 'management', 'finance', 'startup', 'entrepreneur', 'stock', 'trade'],
    health: ['disease', 'symptom', 'treatment', 'medicine', 'health', 'nutrition', 'exercise', 'mental', 'therapy', 'diagnosis', 'organ', 'immune'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

function generateConceptId(text) {
  // Normalize: lowercase, trim, remove extra spaces, take first 5 meaningful words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2) // skip tiny words
    .slice(0, 5);

  return words.join('-') || 'unknown-concept';
}

// ─────────────────────────────────────────────
// Reset (for testing)
// ─────────────────────────────────────────────

function resetAll() {
  highlights.clear();
  flashcards.clear();
  conceptFrequency.clear();
  documents.clear();
  requestLogs.length = 0;
}

module.exports = {
  // Highlights
  storeHighlight,
  getHighlights,
  getHighlightCount,
  // Concept Frequency
  incrementConceptFrequency,
  getConceptFrequency,
  // Flashcards
  storeFlashcard,
  getFlashcards,
  flashcardExistsForConcept,
  getFlashcardCount,
  // Documents
  storeDocument,
  getDocuments,
  // Analytics
  getTopConcepts,
  getLearningAnalytics,
  // Monitoring
  logRequest,
  getRequestLogs,
  // Helpers
  detectTopicCategory,
  generateConceptId,
  // Testing
  resetAll,
};
