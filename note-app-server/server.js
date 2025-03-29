const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ 먼저 미들웨어부터 적용!
app.use(cors());
app.use(express.json());

// ✅ 그 다음에 라우터 연결
const userRouter = require('./routes/user');
app.use('/api/user', userRouter);

// ✅ 로깅 (선택 사항)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// 기본 라우트
app.get('/', (req, res) => {
  res.send('서버 연결 성공!');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
