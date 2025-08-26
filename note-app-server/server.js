// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();

// 1) 미들웨어
app.use(cors());
app.use(express.json());

// 2) 라우터 import
const notesRoutes  = require('./routes/note');    // ✅ GET /api/notes 포함된 파일
const folderRoutes = require('./routes/folder');
const userRouter   = require('./routes/user');

// 3) 라우터 장착 (한 번만!)
app.use('/api/notes', notesRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/user', userRouter);

// 4) 헬스체크
app.get('/', (_req, res) => res.send('서버 연결 성공!'));

// 5) (선택) 정적 파일 — API와 충돌 없도록 마지막에 배치
app.use(express.static(path.join(__dirname, 'public')));

// 6) 요청 로깅 (선택)
app.use((req, _res, next) => {
    console.log(`[${req.method}] ${req.originalUrl}`);
    next();
});

// 7) 라우트 목록 로깅(디버깅용)
function logRoutes() {
    const lines = [];
    app._router.stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            lines.push(`${methods.padEnd(6)} ${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle?.stack) {
            layer.handle.stack.forEach((r) => {
                if (r.route) {
                    const methods = Object.keys(r.route.methods).join(',').toUpperCase();
                    // layer.regexp는 mount path를 나타냄
                    lines.push(`${methods.padEnd(6)} ${layer.regexp} ${r.route.path}`);
                }
            });
        }
    });
    console.log('🧭 Mounted routes:\n' + lines.map(s => '  - ' + s).join('\n'));
}

// 8) DB 연결 후에만 listen
const PORT = process.env.PORT || 5001;

(async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error('❌ MONGO_URI 미설정');
            process.exit(1);
        }

        console.log('🗄️  MongoDB 연결 시도…');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB 연결 성공');

        logRoutes(); // ✅ 라우트 실제 장착 확인

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
        });

        mongoose.connection.on('error', (err) => console.error('❌ Mongoose 에러:', err));
        mongoose.connection.on('disconnected', () => console.warn('⚠️  Mongoose 연결 끊김'));
    } catch (err) {
        console.error('❌ MongoDB 연결 실패:', err);
        process.exit(1);
    }
})();
