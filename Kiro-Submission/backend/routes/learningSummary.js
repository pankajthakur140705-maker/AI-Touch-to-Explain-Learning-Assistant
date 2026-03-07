/**
 * Learning Summary Route — GET /api/v1/learning-summary
 * 
 * Returns top concepts, highlight counts, and flashcard stats.
 * 
 * Validates: Requirements 13.1-13.4 (Learning Analytics and Progress Tracking)
 */

const express = require('express');
const router = express.Router();
const store = require('../store/dynamoStore');

// GET /api/v1/learning-summary — Get learning analytics
router.get('/', async (req, res) => {
  const userId = req.user.userId;

  try {
    const { startDate, endDate } = req.query;

    const analytics = await store.getLearningAnalytics(
      userId,
      startDate ? parseInt(startDate) : undefined,
      endDate ? parseInt(endDate) : undefined
    );

    return res.json(analytics);
  } catch (error) {
    console.error('[LearningSummary] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate summary',
      message: 'Unable to load your learning summary at this time. Please try again.',
    });
  }
});

module.exports = router;
