// routes/note.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket, ObjectId } = require('mongodb');
const { once } = require('events');
const Note = require('../models/Note');

const router = express.Router();

// 메모리 업로드(파일을 바로 GridFS로 흘린다)
const upload = multer({
    // 필요 시 용량 제한(예: 50MB)
    // limits: { fileSize: 50 * 1024 * 1024 },
});

// 유틸: folderId 정규화
function normalizeFolderId(v) {
    return (v === undefined || v === null || v === '' || v === 'null' || v === 'undefined') ? null : v;
}

// 유틸: createdAt 파싱 (유효하지 않으면 현재시각)
function parseCreatedAt(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * 1) 노트 목록 조회
 *    GET /api/notes?userId=...&folderId=...
 *    - folderId 없거나 'null'/'undefined' 이면 root(null)로 간주
 */
router.get('/', async (req, res) => {
    try {
        const { userId, folderId } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId 필요' });

        const filter = {
            userId,
            folderId: normalizeFolderId(folderId),
        };

        const notes = await Note.find(filter).sort({ createdAt: -1 });
        return res.json({ notes });
    } catch (err) {
        console.error('❌ 노트 목록 조회 오류:', err);
        return res.status(500).json({ error: '서버 오류' });
    }
});

/**
 * 2) 노트 + PDF 업로드 (메타데이터 + 파일을 GridFS에 저장)
 *    POST /api/notes/upload (multipart/form-data)
 *    fields: file, userId, noteId, name, createdAt, folderId
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { userId, noteId, name, createdAt, folderId } = req.body;
        if (!userId || !noteId || !name || !createdAt) {
            return res.status(400).json({ error: '필수 항목 누락(userId, noteId, name, createdAt)' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'PDF 파일 누락(file)' });
        }

        const db = mongoose.connection.db;
        if (!db) return res.status(500).json({ error: 'DB 연결 미확립' });

        const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });
        const originalName = req.file.originalname || `${noteId}.pdf`;
        const mime = req.file.mimetype || 'application/pdf';

        // GridFS 업로드
        const uploadStream = bucket.openUploadStream(originalName, { contentType: mime });
        uploadStream.end(req.file.buffer);

        try {
            await once(uploadStream, 'finish'); // 업로드 완료 대기
        } catch (e) {
            console.error('❌ GridFS 업로드 오류:', e);
            return res.status(500).json({ error: '업로드 실패' });
        }

        const file = uploadStream.id ? { _id: uploadStream.id } : null;
        if (!file?._id) {
            console.error('❌ 업로드 ID를 확인하지 못함');
            return res.status(500).json({ error: '업로드 식별자 없음' });
        }

        // 메타데이터 저장
        try {
            const doc = new Note({
                userId,
                noteId,
                name,
                createdAt: parseCreatedAt(createdAt),
                folderId: normalizeFolderId(folderId),
                fileId: file._id,
                fileName: originalName,
                mimeType: mime,
            });

            await doc.save();
            return res.status(201).json({ message: '업로드 성공', note: doc });
        } catch (e) {
            if (e?.code === 11000) {
                // noteId unique 충돌
                console.warn('⚠️ 중복 noteId 업로드 시도:', e?.keyValue);
                return res.status(409).json({ error: '중복된 noteId', key: e?.keyValue });
            }
            if (e?.name === 'StrictModeError') {
                console.error('❌ 스키마 불일치(StrictModeError):', e?.message);
                return res.status(400).json({ error: '스키마 불일치', detail: e?.message });
            }
            console.error('❌ Note 저장 실패(세부):', e);
            return res.status(500).json({ error: '메타데이터 저장 실패' });
        }
    } catch (err) {
        console.error('❌ 업로드 처리 오류:', err);
        return res.status(500).json({ error: '서버 오류' });
    }
});

/**
 * 3) PDF 스트리밍 (GridFS)
 *    GET /api/notes/:noteId/file
 *    - 기본 inline 렌더
 *    - Range 요청(부분 다운로드) 지원
 */
router.get('/:noteId/file', async (req, res) => {
    try {
        const { noteId } = req.params;
        const db = mongoose.connection.db;
        if (!db) return res.status(500).json({ error: 'DB 연결 미확립' });

        const note = await Note.findOne({ noteId });
        if (!note || !note.fileId) {
            return res.status(404).json({ error: '파일 없음' });
        }

        const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });

        // 파일 메타 조회
        const filesCol = db.collection('pdfs.files');
        const _id = typeof note.fileId === 'string' ? new ObjectId(note.fileId) : note.fileId;
        const fileDoc = await filesCol.findOne({ _id });
        if (!fileDoc) return res.status(404).json({ error: 'GridFS 파일 없음' });

        const fileSize = fileDoc.length;
        const filename = note.fileName || `${noteId}.pdf`;
        const mime = note.mimeType || 'application/pdf';

        const range = req.headers.range;

        if (range) {
            // bytes=start-end
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
                return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
            }

            res.status(206);
            res.set({
                'Content-Type': mime,
                'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
                'Accept-Ranges': 'bytes',
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Content-Length': end - start + 1,
                'Cache-Control': 'no-store',
            });

            bucket.openDownloadStream(_id, { start, end: end + 1 })
                .on('error', (e) => {
                    console.error('❌ Range 스트리밍 오류:', e);
                    res.status(500).end();
                })
                .pipe(res);

            return;
        }

        // 전체 스트리밍
        res.set({
            'Content-Type': mime,
            'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
            'Accept-Ranges': 'bytes',
            'Content-Length': fileSize,
            'Cache-Control': 'no-store',
        });

        bucket.openDownloadStream(_id)
            .on('error', (e) => {
                console.error('❌ PDF 스트리밍 오류:', e);
                res.status(500).end();
            })
            .pipe(res);
    } catch (err) {
        console.error('❌ PDF 다운로드 오류:', err);
        return res.status(500).json({ error: '서버 오류' });
    }
});

module.exports = router;
