const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // 🔥 추가된 부분
  color: { type: String, default: '#fff' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', folderSchema);
