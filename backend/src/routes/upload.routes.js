const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const { getUploadUrl, getReadUrl, deleteBlob, containerClient } = require('../config/azure');
const { protect, reporterOrAdmin } = require('../middleware/auth');

const MAX_FEATURED_IMAGE_WIDTH = 1600;
const WEBP_QUALITY = 85;

// Configure multer for memory storage (50MB for e-paper PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

const getUploadFolder = (mimetype) => {
  if (mimetype.startsWith('video')) return 'videos';
  if (mimetype === 'application/pdf') return 'epapers';
  return 'images';
};

const parseCrop = (cropValue) => {
  if (!cropValue) return null;

  let crop;
  try {
    crop = JSON.parse(cropValue);
  } catch {
    const error = new Error('Invalid crop data');
    error.statusCode = 400;
    throw error;
  }

  const values = ['x', 'y', 'width', 'height'].map((key) => Number(crop[key]));
  const [x, y, width, height] = values;
  const isValid = values.every(Number.isFinite)
    && x >= 0
    && y >= 0
    && width > 0
    && height > 0
    && x + width <= 100.01
    && y + height <= 100.01;

  if (!isValid) {
    const error = new Error('Crop must contain valid percentage coordinates');
    error.statusCode = 400;
    throw error;
  }

  return { x, y, width, height };
};

const cropAndConvertToWebp = async (file, crop) => {
  if (!file.mimetype.startsWith('image/')) {
    const error = new Error('Crop is only supported for images');
    error.statusCode = 400;
    throw error;
  }

  // Normalize EXIF orientation first so the backend dimensions match the image
  // orientation shown by modern browsers in the crop dialog.
  const orientedBuffer = await sharp(file.buffer).rotate().toBuffer();
  const metadata = await sharp(orientedBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    const error = new Error('Unable to determine image dimensions');
    error.statusCode = 400;
    throw error;
  }

  const left = Math.max(0, Math.floor((crop.x / 100) * metadata.width));
  const top = Math.max(0, Math.floor((crop.y / 100) * metadata.height));
  const width = Math.min(
    metadata.width - left,
    Math.max(1, Math.round((crop.width / 100) * metadata.width))
  );
  const height = Math.min(
    metadata.height - top,
    Math.max(1, Math.round((crop.height / 100) * metadata.height))
  );

  return sharp(orientedBuffer)
    .extract({ left, top, width, height })
    .resize({ width: MAX_FEATURED_IMAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
};

// @route   POST /api/upload/file
// @desc    Upload file through backend (bypasses CORS)
// @access  Private/Reporter
router.post('/file', protect, reporterOrAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;
    const crop = parseCrop(req.body.crop);
    const outputBuffer = crop ? await cropAndConvertToWebp(file, crop) : file.buffer;
    const outputContentType = crop ? 'image/webp' : file.mimetype;
    const extension = crop ? 'webp' : file.originalname.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${extension}`;
    const folder = getUploadFolder(outputContentType);
    const blobName = `${Date.now()}-${folder}/${uniqueFilename}`;

    // Upload to Azure
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(outputBuffer, {
      blobHTTPHeaders: { blobContentType: outputContentType }
    });

    const blobUrl = `${process.env.AZURE_STORAGE_URL}/${process.env.AZURE_STORAGE_CONTAINER}/${blobName}`;

    res.json({
      blobUrl,
      blobName,
      originalName: file.originalname,
      size: outputBuffer.length,
      contentType: outputContentType
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to upload file' });
  }
});

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
      'video/webm',
      'application/pdf'
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
    const folder = contentType?.startsWith('video')
      ? 'videos'
      : contentType === 'application/pdf'
        ? 'epapers'
        : 'images';
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
      'video/webm',
      'application/pdf'
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
      const folder = contentType?.startsWith('video')
      ? 'videos'
      : contentType === 'application/pdf'
        ? 'epapers'
        : 'images';
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
