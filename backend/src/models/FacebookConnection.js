const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  pageId: { type: String, required: true },
  pageName: { type: String, default: '' },
  pageAccessToken: { type: String, required: true },
  tasks: { type: [String], default: [] }
}, { _id: false });

const facebookConnectionSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  facebookUserAccessTokenLong: { type: String, default: '' },
  facebookUserTokenExpiresAt: { type: Date, default: null },
  facebookPageId: { type: String, default: '' },
  facebookPageAccessToken: { type: String, default: '' },
  facebookPageName: { type: String, default: '' },
  facebookConnectionStatus: {
    type: String,
    enum: ['connected', 'expired', 'disconnected'],
    default: 'disconnected'
  },
  facebookConnectedAt: { type: Date, default: null },
  facebookLastError: { type: String, default: '' },
  pages: { type: [pageSchema], default: [] },
  selectedPageId: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('FacebookConnection', facebookConnectionSchema);
