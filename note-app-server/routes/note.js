const express = require('express');
const router = express.Router();
const Note = require('../models/Note'); // ✅ 이름 통일

console.log('✅ note.js 라우터 로드됨');

router.get('/', async (req, res) => {
  try {
    const { userId, folderId } = req.query;
    console.log('📥 GET /api/notes 쿼리:', { userId, folderId });

    const filter = { userId };

    if (folderId === 'null' || folderId === null || folderId === undefined || folderId === '') {
      filter.folderId = null;
    } else {
      filter.folderId = folderId;
    }

    const notes = await Note.find(filter).sort({ createdAt: -1 }); // ✅ 수정
    res.json({ notes });
  } catch (err) {
    console.error('❌ 노트 불러오기 오류:', err);
    res.status(500).json({ error: '노트 불러오기 실패' });
  }
});

router.post('/upload', async (req, res) => {
  console.log('📨 [서버] 업로드 요청 수신:', req.body);

  try {
    const { userId, noteId, name, createdAt, folderId } = req.body;

    if (!userId || !noteId || !name || !createdAt) {
      return res.status(400).json({ error: '필수 항목 누락됨' });
    }

    const newNote = new Note({
      userId,
      noteId,
      name,
      createdAt,
      folderId: folderId ?? null,
    });

    await newNote.save();

    console.log('✅ [서버] 노트 저장 성공:', newNote);
    return res.status(201).json({ message: '노트 업로드 성공', note: newNote });
  } catch (err) {
    console.error('❌ [서버] 노트 업로드 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
