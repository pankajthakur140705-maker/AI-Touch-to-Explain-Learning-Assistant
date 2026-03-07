/**
 * DynamoDB Data Store
 * 
 * Real AWS DynamoDB implementation for persistent storage.
 * Falls back to in-memory store if DynamoDB is not configured.
 * 
 * Tables:
 *   - ai-learning-highlights: userId (PK) + createdAt (SK)
 *   - ai-learning-flashcards: userId (PK) + flashcardId (SK)
 *   - ai-learning-documents:  userId (PK) + documentId (SK)
 * 
 * Validates: Requirements 7, 8, 10, 13
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { config, getAWSConfig, isAWSMode } = require('../config');

// In-memory fallback
const inMemoryStore = require('./inMemoryStore');

let dynamoClient = null;
let docClient = null;

function getDocClient() {
  if (!docClient) {
    dynamoClient = new DynamoDBClient(getAWSConfig());
    docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

function useDynamo() {
  return isAWSMode() && config.dynamodb.enabled;
}

// ─────────────────────────────────────────────
// Highlight Operations
// ─────────────────────────────────────────────

async function storeHighlight(userId, highlightData) {
  if (!useDynamo()) return inMemoryStore.storeHighlight(userId, highlightData);

  const client = getDocClient();
  const now = Date.now();
  const record = {
    userId,
    createdAt: now,
    highlightId: uuidv4(),
    text: highlightData.text,
    explanation: highlightData.explanation,
    depth: highlightData.depth,
    topicCategory: inMemoryStore.detectTopicCategory(highlightData.text),
    conceptId: highlightData.conceptId,
    frequency: highlightData.frequency || 1,
    updatedAt: now,
  };

  await client.send(new PutCommand({
    TableName: config.dynamodb.tables.highlights,
    Item: record,
  }));

  return record;
}

async function getHighlights(userId, options = {}) {
  if (!useDynamo()) return inMemoryStore.getHighlights(userId, options);

  const client = getDocClient();

  const params = {
    TableName: config.dynamodb.tables.highlights,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false, // newest first
  };

  // Add date range filters
  if (options.startDate && options.endDate) {
    params.KeyConditionExpression += ' AND createdAt BETWEEN :start AND :end';
    params.ExpressionAttributeValues[':start'] = options.startDate;
    params.ExpressionAttributeValues[':end'] = options.endDate;
  } else if (options.startDate) {
    params.KeyConditionExpression += ' AND createdAt >= :start';
    params.ExpressionAttributeValues[':start'] = options.startDate;
  } else if (options.endDate) {
    params.KeyConditionExpression += ' AND createdAt <= :end';
    params.ExpressionAttributeValues[':end'] = options.endDate;
  }

  // Topic filter as post-query filter
  if (options.topic) {
    params.FilterExpression = 'topicCategory = :topic';
    params.ExpressionAttributeValues[':topic'] = options.topic;
  }

  const result = await client.send(new QueryCommand(params));
  return result.Items || [];
}

async function getHighlightCount(userId) {
  if (!useDynamo()) return inMemoryStore.getHighlightCount(userId);

  const highlights = await getHighlights(userId);
  return highlights.length;
}

// ─────────────────────────────────────────────
// Concept Frequency — stored as a counter item in highlights table
// Uses userId#FREQ as a special partition + conceptId as sort key
// ─────────────────────────────────────────────

async function incrementConceptFrequency(userId, conceptId) {
  if (!useDynamo()) return inMemoryStore.incrementConceptFrequency(userId, conceptId);

  const client = getDocClient();

  try {
    const result = await client.send(new UpdateCommand({
      TableName: config.dynamodb.tables.highlights,
      Key: {
        userId: `${userId}#FREQ`,
        createdAt: 0, // Use 0 as sort key for frequency records
      },
      UpdateExpression: 'SET #cid = if_not_exists(#cid, :zero) + :one',
      ExpressionAttributeNames: { '#cid': `freq_${conceptId}` },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
      ReturnValues: 'ALL_NEW',
    }));

    return result.Attributes?.[`freq_${conceptId}`] || 1;
  } catch (error) {
    console.error('[DynamoDB] Frequency increment error:', error.message);
    // Fall back to in-memory for this operation
    return inMemoryStore.incrementConceptFrequency(userId, conceptId);
  }
}

async function getConceptFrequency(userId, conceptId) {
  if (!useDynamo()) return inMemoryStore.getConceptFrequency(userId, conceptId);

  const client = getDocClient();

  try {
    const result = await client.send(new GetCommand({
      TableName: config.dynamodb.tables.highlights,
      Key: {
        userId: `${userId}#FREQ`,
        createdAt: 0,
      },
    }));

    return result.Item?.[`freq_${conceptId}`] || 0;
  } catch (error) {
    return inMemoryStore.getConceptFrequency(userId, conceptId);
  }
}

// ─────────────────────────────────────────────
// Flashcard Operations
// ─────────────────────────────────────────────

async function storeFlashcard(userId, flashcardData) {
  if (!useDynamo()) return inMemoryStore.storeFlashcard(userId, flashcardData);

  const client = getDocClient();
  const record = {
    userId,
    flashcardId: uuidv4(),
    conceptId: flashcardData.conceptId,
    front: flashcardData.front,
    back: flashcardData.back,
    createdAt: Date.now(),
    lastReviewed: null,
    reviewCount: 0,
    difficulty: 3,
  };

  await client.send(new PutCommand({
    TableName: config.dynamodb.tables.flashcards,
    Item: record,
  }));

  return record;
}

async function getFlashcards(userId) {
  if (!useDynamo()) return inMemoryStore.getFlashcards(userId);

  const client = getDocClient();

  const result = await client.send(new QueryCommand({
    TableName: config.dynamodb.tables.flashcards,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  return result.Items || [];
}

async function flashcardExistsForConcept(userId, conceptId) {
  if (!useDynamo()) return inMemoryStore.flashcardExistsForConcept(userId, conceptId);

  const client = getDocClient();

  const result = await client.send(new QueryCommand({
    TableName: config.dynamodb.tables.flashcards,
    KeyConditionExpression: 'userId = :uid',
    FilterExpression: 'conceptId = :cid',
    ExpressionAttributeValues: {
      ':uid': userId,
      ':cid': conceptId,
    },
    Limit: 1,
  }));

  return (result.Items || []).length > 0;
}

async function getFlashcardCount(userId) {
  if (!useDynamo()) return inMemoryStore.getFlashcardCount(userId);

  const flashcards = await getFlashcards(userId);
  return flashcards.length;
}

// ─────────────────────────────────────────────
// Document Operations
// ─────────────────────────────────────────────

async function storeDocument(userId, docData) {
  if (!useDynamo()) return inMemoryStore.storeDocument(userId, docData);

  const client = getDocClient();
  const record = {
    userId,
    documentId: uuidv4(),
    fileName: docData.fileName,
    fileSize: docData.fileSize,
    contentType: docData.contentType,
    s3Key: `${userId}/uploads/${uuidv4()}.${docData.extension || 'pdf'}`,
    uploadedAt: Date.now(),
    processedAt: null,
    status: 'uploaded',
  };

  await client.send(new PutCommand({
    TableName: config.dynamodb.tables.documents,
    Item: record,
  }));

  return record;
}

async function getDocuments(userId) {
  if (!useDynamo()) return inMemoryStore.getDocuments(userId);

  const client = getDocClient();

  const result = await client.send(new QueryCommand({
    TableName: config.dynamodb.tables.documents,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));

  return result.Items || [];
}

// ─────────────────────────────────────────────
// Learning Analytics
// ─────────────────────────────────────────────

async function getTopConcepts(userId, limit = 10) {
  if (!useDynamo()) return inMemoryStore.getTopConcepts(userId, limit);

  const highlights = await getHighlights(userId);

  const conceptMap = {};
  for (const h of highlights) {
    if (!conceptMap[h.conceptId]) {
      conceptMap[h.conceptId] = {
        conceptId: h.conceptId,
        name: (h.text || '').substring(0, 50),
        frequency: 0,
        category: h.topicCategory || 'general',
      };
    }
    conceptMap[h.conceptId].frequency++;
  }

  return Object.values(conceptMap)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}

async function getLearningAnalytics(userId, startDate, endDate) {
  if (!useDynamo()) return inMemoryStore.getLearningAnalytics(userId, startDate, endDate);

  const highlights = await getHighlights(userId, { startDate, endDate });
  const allHighlights = await getHighlights(userId);
  const flashcardCount = await getFlashcardCount(userId);

  const conceptMap = {};
  for (const h of highlights) {
    if (!conceptMap[h.conceptId]) {
      conceptMap[h.conceptId] = {
        conceptId: h.conceptId,
        name: (h.text || '').substring(0, 50),
        frequency: 0,
        category: h.topicCategory || 'general',
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
    flashcardCount,
    dateRange: { start: startDate || null, end: endDate || null },
  };
}

// ─────────────────────────────────────────────
// Monitoring / Helpers (always in-memory)
// ─────────────────────────────────────────────

const { logRequest, getRequestLogs, detectTopicCategory, generateConceptId, resetAll } = inMemoryStore;

module.exports = {
  storeHighlight,
  getHighlights,
  getHighlightCount,
  incrementConceptFrequency,
  getConceptFrequency,
  storeFlashcard,
  getFlashcards,
  flashcardExistsForConcept,
  getFlashcardCount,
  storeDocument,
  getDocuments,
  getTopConcepts,
  getLearningAnalytics,
  logRequest,
  getRequestLogs,
  detectTopicCategory,
  generateConceptId,
  resetAll,
};
