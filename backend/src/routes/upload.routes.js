const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getUploadUrl, getReadUrl, deleteBlob } = require('../config/azure');
const { protect, reporterOrAdmin } = require('../middleware/auth');

// @route   POST /api/upload/sas-token
// @desc    Get SAS token for direct upload to Azure Blob Storage
// @access  Private/Reporter
router.post('/sas-token', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Validate content type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm'
    ];

    if (contentType && !allowedTypes.includes(contentType)) {
      return res.status(400).json({ 
        error: 'Invalid file type',
        allowedTypes 
      });
    }

    // Generate unique filename
    const extension = filename.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${extension}`;
    const folder = contentType?.startsWith('video') ? 'videos' : 'images';
    const blobName = `${folder}/${uniqueFilename}`;

    const uploadData = getUploadUrl(blobName);

    res.json({
      uploadUrl: uploadData.fullUrl,
      blobUrl: uploadData.blobUrl,
      blobName,
      expiresAt: uploadData.expiresOn
    });
  } catch (error) {
    console.error('Generate SAS token error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// @route   POST /api/upload/sas-tokens
// @desc    Get multiple SAS tokens for batch upload
// @access  Private/Reporter
router.post('/sas-tokens', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    if (files.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 files per batch' });
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm'
    ];

    const uploadUrls = files.map((file, index) => {
      const { filename, contentType } = file;

      if (!filename) {
        throw new Error(`Filename is required for file at index ${index}`);
      }

      if (contentType && !allowedTypes.includes(contentType)) {
        throw new Error(`Invalid file type for ${filename}`);
      }

      const extension = filename.split('.').pop();
      const uniqueFilename = `${uuidv4()}.${extension}`;
      const folder = contentType?.startsWith('video') ? 'videos' : 'images';
      const blobName = `${folder}/${uniqueFilename}`;

      const uploadData = getUploadUrl(blobName);

      return {
        originalFilename: filename,
        uploadUrl: uploadData.fullUrl,
        blobUrl: uploadData.blobUrl,
        blobName,
        expiresAt: uploadData.expiresOn
      };
    });

    res.json({ uploadUrls });
  } catch (error) {
    console.error('Generate batch SAS tokens error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate upload URLs' });
  }
});

// @route   POST /api/upload/read-url
// @desc    Get read URL for a blob (for private/premium content)
// @access  Private
router.post('/read-url', protect, async (req, res) => {
  try {
    const { blobName, expiresInMinutes = 60 } = req.body;

    if (!blobName) {
      return res.status(400).json({ error: 'Blob name is required' });
    }

    const readData = getReadUrl(blobName, expiresInMinutes);

    res.json({
      readUrl: readData.fullUrl,
      expiresAt: readData.expiresOn
    });
  } catch (error) {
    console.error('Generate read URL error:', error);
    res.status(500).json({ error: 'Failed to generate read URL' });
  }
});

// @route   DELETE /api/upload/:blobName
// @desc    Delete a blob
// @access  Private/Reporter
router.delete('/:blobName(*)', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { blobName } = req.params;

    if (!blobName) {
      return res.status(400).json({ error: 'Blob name is required' });
    }

    const deleted = await deleteBlob(blobName);

    if (deleted) {
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found or could not be deleted' });
    }
  } catch (error) {
    console.error('Delete blob error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// @route   POST /api/upload/confirm
// @desc    Confirm upload completion (optional - for tracking)
// @access  Private/Reporter
router.post('/confirm', protect, reporterOrAdmin, async (req, res) => {
  try {
    const { blobUrl, blobName, type = 'image' } = req.body;

    // Here you could log the upload, track storage usage, etc.
    // For now, just acknowledge the confirmation

    res.json({
      message: 'Upload confirmed',
      url: blobUrl,
      type
    });
  } catch (error) {
    console.error('Confirm upload error:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

module.exports = router;
