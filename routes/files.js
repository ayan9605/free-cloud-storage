const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const {
  uploadToTelegram,
  streamFileFromTelegram,
  deleteFromTelegram
} = require('../utils/telegram');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type validation
    cb(null, true);
  }
});

// Upload File
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const { originalname, mimetype, size, buffer } = req.file;

    console.log(`📤 Uploading: ${originalname} (${(size / 1024 / 1024).toFixed(2)} MB)`);

    const telegramData = await uploadToTelegram(buffer, originalname, mimetype);

    const fileDoc = new File({
      fileId,
      fileName: originalname,
      originalName: originalname,
      fileSize: size,
      mimeType: mimetype,
      telegramFileId: telegramData.fileId,
      telegramMessageId: telegramData.messageId,
      channelId: telegramData.channelId,
      shareLink: fileId,
      userId: req.body.userId || 'anonymous'
    });

    await fileDoc.save();

    console.log(`✅ File saved: ${fileId}`);

    res.json({
      success: true,
      file: {
        id: fileDoc.fileId,
        name: fileDoc.fileName,
        size: fileDoc.fileSize,
        type: fileDoc.mimeType,
        uploadDate: fileDoc.uploadDate,
        shareLink: fileDoc.shareLink
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

// List Files
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', userId = 'anonymous' } = req.query;
    
    const query = { userId };
    if (search) {
      query.$text = { $search: search };
    }

    const files = await File.find(query)
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-telegramFileId -telegramMessageId -channelId');

    const count = await File.countDocuments(query);

    res.json({
      success: true,
      files,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalFiles: count
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Download File
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const fileDoc = await File.findOne({ fileId });
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found' });
    }

    fileDoc.downloads += 1;
    await fileDoc.save();

    const fileStream = await streamFileFromTelegram(fileDoc.telegramFileId);

    res.setHeader('Content-Type', fileDoc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileDoc.fileName)}"`);
    res.setHeader('Content-Length', fileDoc.fileSize);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fileStream.data.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Stream File (for preview)
router.get('/stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const fileDoc = await File.findOne({ fileId });
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileStream = await streamFileFromTelegram(fileDoc.telegramFileId);

    res.setHeader('Content-Type', fileDoc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileDoc.fileName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    fileStream.data.pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// Delete File
router.delete('/delete/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId = 'anonymous' } = req.body;
    
    const fileDoc = await File.findOne({ fileId, userId });
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found or unauthorized' });
    }

    await deleteFromTelegram(fileDoc.channelId, fileDoc.telegramMessageId);
    await File.deleteOne({ fileId });

    console.log(`🗑️  File deleted: ${fileId}`);

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Get Statistics
router.get('/stats', async (req, res) => {
  try {
    const { userId = 'anonymous' } = req.query;
    
    const totalFiles = await File.countDocuments({ userId });
    const totalSize = await File.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } }
    ]);
    const totalDownloads = await File.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]);

    res.json({
      success: true,
      totalFiles,
      totalSize: totalSize[0]?.total || 0,
      totalDownloads: totalDownloads[0]?.total || 0
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get File Info
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const fileDoc = await File.findOne({ fileId })
      .select('-telegramFileId -telegramMessageId -channelId');
    
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true, file: fileDoc });
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to fetch file info' });
  }
});

module.exports = router;
