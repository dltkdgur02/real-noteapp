// models/Note.js
const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema(
    {
        userId:    { type: String, required: true, index: true },
        noteId:    { type: String, required: true, unique: true, index: true },
        name:      { type: String, required: true },
        createdAt: { type: Date,   required: true },
        folderId:  { type: String, default: null },

        // GridFS 메타
        fileId:    { type: mongoose.Schema.Types.ObjectId, default: null },
        fileName:  { type: String, default: null },
        mimeType:  { type: String, default: 'application/pdf' },
    },
    {
        timestamps: true,
        strict: true,
    }
);

module.exports = mongoose.model('Note', NoteSchema);
