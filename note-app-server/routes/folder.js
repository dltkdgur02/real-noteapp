const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');

router.get('/list', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'userId가 필요합니다.' });
  }

  try {
    const folders = await Folder.find({ userId });
    res.status(200).json({ folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '폴더 목록 불러오기 실패' });
  }
});

router.post('/create', async (req, res) => {
  const { name, userId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ message: 'name과 userId가 필요합니다.' });
  }

  try {
    const newFolder = new Folder({ name, userId });
    await newFolder.save();

    res.status(201).json({ message: '폴더 생성 완료!', folder: newFolder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '폴더 생성 실패' });
  }
});

module.exports = router;