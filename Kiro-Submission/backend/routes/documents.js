/**
 * Documents Route — POST /api/v1/documents
 * 
 * Handles document uploads (PDF, images) with size validation.
 * Stores metadata in memory; simulates S3 storage.
 * 
 * Validates: Requirements 10.1-10.6 (Document Upload and Storage)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const store = require('../store/dynamoStore');

// Configure multer for file uploads
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Requirement 10.1)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/v1/documents — Upload a document
router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      // Multer error — file too large (Requirement 10.2)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          message: `The uploaded file exceeds the maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
        });
      }

      return res.status(400).json({
        error: 'Upload failed',
        message: err.message || 'Unable to process the uploaded file.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please select a file to upload.',
      });
    }

    const userId = req.user.userId;

    try {
      // Store document metadata (Req 10.3, 10.4)
      const extension = req.file.originalname.split('.').pop() || 'pdf';
      const doc = await store.storeDocument(userId, {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        contentType: req.file.mimetype,
        extension,
      });

      // Log upload
      store.logRequest({
        type: 'DOCUMENT_UPLOAD',
        userId,
        documentId: doc.documentId,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
      });

      return res.status(201).json({
        documentId: doc.documentId,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        status: doc.status,
        message: 'Document uploaded successfully. (Simulated S3 storage with AES-256 encryption)',
      });
    } catch (error) {
      console.error('[Documents] Upload error:', error);
      return res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred while storing your document. Please try again.',
      });
    }
  });
});

// GET /api/v1/documents — List user's documents
router.get('/', async (req, res) => {
  const userId = req.user.userId;

  try {
    const documents = await store.getDocuments(userId);
    return res.json({
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('[Documents] List error:', error);
    return res.status(500).json({
      error: 'Failed to list documents',
      message: 'Unable to retrieve your documents at this time.',
    });
  }
});

module.exports = router;
