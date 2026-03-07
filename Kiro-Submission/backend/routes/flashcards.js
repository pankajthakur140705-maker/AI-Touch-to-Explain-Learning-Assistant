/**
 * Flashcards Route — GET /api/v1/flashcards
 * 
 * Returns all flashcards for the authenticated user.
 * 
 * Validates: Requirements 8.1-8.5 (Automatic Flashcard Generation)
 */

const express = require('express');
const router = express.Router();
const store = require('../store/dynamoStore');

// GET /api/v1/flashcards — Get all flashcards for the user
router.get('/', async (req, res) => {
  const userId = req.user.userId;

  try {
    const flashcards = await store.getFlashcards(userId);

    return res.json({
      flashcards,
      total: flashcards.length,
      userId,
    });
  } catch (error) {
    console.error('[Flashcards] Error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve flashcards',
      message: 'Unable to load your flashcards at this time. Please try again.',
    });
  }
});

module.exports = router;
