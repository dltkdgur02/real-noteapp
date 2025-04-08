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
  const { name, userId, parentId, color } = req.body; // ✅ color 추가!

  if (!name || !userId) {
    return res.status(400).json({ message: 'name과 userId는 필수입니다.' });
  }

  try {
    const folderData = {
      name,
      userId,
      color: color || '#fff', // ✅ 기본 색상 처리
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

router.patch('/rename', async (req, res) => {
  const { folderId, newName } = req.body;
  try {
    await Folder.findByIdAndUpdate(folderId, { name: newName });
    res.status(200).json({ message: '이름 변경 성공' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '이름 변경 실패' });
  }
});

const deleteFolderAndChildren = async (folderId) => {
  // 1. 하위 폴더들 가져오기
  const children = await Folder.find({ parentId: folderId });

  // 2. 각각 하위 폴더에 대해 재귀 삭제
  for (const child of children) {
    await deleteFolderAndChildren(child._id);
  }

  // 3. 본인 삭제
  await Folder.findByIdAndDelete(folderId);
};

router.post('/delete', async (req, res) => {
  const { folderId } = req.body;

  if (!folderId) return res.status(400).json({ message: 'folderId가 필요합니다.' });

  try {
    await deleteFolderAndChildren(folderId);
    res.status(200).json({ message: '상위 및 하위 폴더 삭제 완료' });
  } catch (err) {
    console.error('폴더 삭제 실패:', err);
    res.status(500).json({ message: '폴더 삭제 실패' });
  }
});

router.patch('/color', async (req, res) => {
  const { folderId, newColor } = req.body;

  if (!folderId || !newColor) {
    return res.status(400).json({ message: 'folderId와 newColor가 필요합니다.' });
  }

  try {
    await Folder.findByIdAndUpdate(folderId, { color: newColor });
    res.status(200).json({ message: '색상 변경 완료' });
  } catch (err) {
    console.error('색상 변경 실패:', err);
    res.status(500).json({ message: '색상 변경 실패' });
  }
});







module.exports = router;