const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  pageId: { type: String, required: true },
  pageName: { type: String, default: '' },
  pageAccessToken: { type: String, required: true },
  tasks: { type: [String], default: [] }
}, { _id: false });

const facebookConnectionSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  facebookUserTokenLong: { type: String, default: '' },
  facebookUserTokenExpiresAt: { type: Date, default: null },
  pages: { type: [pageSchema], default: [] },
  selectedPageId: { type: String, default: '' },
  stale: { type: Boolean, default: false },
  staleReason: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('FacebookConnection', facebookConnectionSchema);
