// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // ⬅️ .env 읽기

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// 예시 라우트
app.get('/', (req, res) => {
  res.send('서버 연결 성공!');
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
