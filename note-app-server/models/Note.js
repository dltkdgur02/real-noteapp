const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  noteId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  createdAt: {
    type: String,
    required: true,
  },
  folderId: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model('Note', noteSchema);
