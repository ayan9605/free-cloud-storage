const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  telegramFileId: {
    type: String,
    required: true,
    index: true
  },
  telegramMessageId: {
    type: Number,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  userId: {
    type: String,
    default: 'anonymous',
    index: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  shareLink: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

fileSchema.index({ fileName: 'text', originalName: 'text' });
fileSchema.index({ uploadDate: -1 });
fileSchema.index({ userId: 1, uploadDate: -1 });

module.exports = mongoose.model('File', fileSchema);
