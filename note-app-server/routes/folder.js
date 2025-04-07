const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const mongoose = require('mongoose');


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
  const { name, userId, parentId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ message: 'name과 userId는 필수입니다.' });
  }

  try {
    const folderData = {
      name,
      userId,
      parentId: parentId && mongoose.Types.ObjectId.isValid(parentId)
        ? new mongoose.Types.ObjectId(parentId)
        : null,
    };

    const newFolder = new Folder(folderData);
    await newFolder.save();

    res.status(201).json({ message: '폴더 생성 완료!', folder: newFolder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '폴더 생성 실패' });
  }
});


// GET /folders/children?userId=xxx&parentId=yyy
router.get('/children', async (req, res) => {
  const { userId, parentId } = req.query;

  if (!userId) return res.status(400).json({ message: 'userId가 필요합니다.' });

  try {
    const folders = await Folder.find({ userId, parentId: parentId || null });
    res.status(200).json({ folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '하위 폴더 조회 실패' });
  }
});



module.exports = router;