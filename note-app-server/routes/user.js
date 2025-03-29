const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const VerificationToken = require('../models/VerificationToken');
const sendEmail = require('../utils/sendEmail');

router.post('/send-verification', async (req, res) => {
  const { email } = req.body;

  try {
    // 랜덤 토큰 생성
    const token = crypto.randomBytes(32).toString('hex');

    // 기존 인증 요청 삭제 (중복 방지)
    await VerificationToken.deleteMany({ email });

    // 새 인증 토큰 저장
    await VerificationToken.create({ email, token });

    // 인증 링크 생성
    const link = `http://localhost:5001/api/user/verify-email?token=${token}`;

    // 이메일 전송
    await sendEmail(
      email,
      '📧 Note App 이메일 인증',
      `<h2>이메일 인증</h2>
        <p>아래 버튼을 눌러 이메일 인증을 완료해주세요.</p>
        <a href="${link}">👉 이메일 인증하기</a>`
    );

    res.status(200).json({ message: '인증 이메일이 전송되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '이메일 전송 중 오류 발생' });
  }
});

// 회원가입
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: '이미 가입된 이메일입니다.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashed });
    await newUser.save();

    res.status(201).json({ message: '회원가입 성공!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: '가입된 이메일이 없습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '비밀번호가 틀렸습니다.' });
    }

    res.status(200).json({ message: '로그인 성공', user: { email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
