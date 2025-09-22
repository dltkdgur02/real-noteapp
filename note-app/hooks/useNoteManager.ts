// hooks/useNoteManager.ts
import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { API_BASE } from '@/utils/api';
import { getUserId } from '@/utils/auth';
import { Note } from '@/types/note';

// 🗑️ 로컬 노트 폴더 삭제
export const deleteNote = async (noteId: string) => {
    try {
        const noteFolderPath = `${FileSystem.documentDirectory}notes/${noteId}.note/`;
        const info = await FileSystem.getInfoAsync(noteFolderPath);
        if (info.exists) {
            await FileSystem.deleteAsync(noteFolderPath, { idempotent: true });
            console.log(`🗑️ 노트 삭제 완료: ${noteId}`);
        } else {
            console.warn('⚠️ 삭제하려는 노트 폴더가 존재하지 않음');
        }
    } catch (err) {
        console.error('🚨 노트 삭제 오류:', err);
    }
};

// 📥 서버에서 노트 목록 조회
export const fetchNotesFromServer = async (
    userId: string,
    folderId: string | null
): Promise<Note[]> => {
    try {
        const res = await axios.get(`${API_BASE}/api/notes`, {
            params: { userId, folderId },
        });
        return res.data.notes;
    } catch (err: any) {
        console.error('🚨 서버에서 노트 목록 불러오기 실패:', err.response?.data || err.message);
        return [];
    }
};

// ⬆️ PDF(파일) + 메타데이터 업로드 (A안)
export const uploadNoteToServer = async (note: Note) => {
    console.log('📡 uploadNoteToServer 시작');

    try {
        if (!note.pdfPath) {
            throw new Error('pdfPath가 비어 있음 (file:// 경로 필요)');
        }

        // 업로드 대상 파일 존재 여부 확인
        const info = await FileSystem.getInfoAsync(note.pdfPath);
        if (!info.exists) {
            throw new Error(`업로드 대상 파일이 존재하지 않음: ${note.pdfPath}`);
        }

        // 파일명 생성 (원본 이름 유지, 없으면 note.id.pdf)
        const fallbackName = `${note.id}.pdf`;
        const filename = decodeURIComponent(note.pdfPath.split('/').pop() || fallbackName);

        // Expo 멀티파트 업로드
        const uploadUrl = `${API_BASE}/api/notes/upload`;
        const result = await FileSystem.uploadAsync(uploadUrl, note.pdfPath, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file', // ✅ 서버 multer.single('file') 와 일치해야 함
            mimeType: 'application/pdf',
            parameters: {
                userId: note.userId,
                noteId: note.id,                // 서버는 noteId 로 식별
                name: note.name,
                createdAt: note.createdAt,
                folderId: note.folderId ?? 'null', // 서버에서 'null' → null 처리
                // 필요 시 추가 메타데이터를 여기에 더 실을 수 있다.
            },
            headers: {
                Accept: 'application/json', // Content-Type은 SDK가 boundary와 함께 자동 설정
                // iOS 시뮬레이터 기준으로 추가 헤더는 필요 없음
            },
        });

        console.log('✅ 업로드 응답 status:', result.status);
        console.log('✅ 업로드 응답 body:', result.body);

        if (result.status < 200 || result.status >= 300) {
            throw new Error(`업로드 실패: HTTP ${result.status} ${result.body}`);
        }
    } catch (err: any) {
        console.error('🚨 노트 업로드 실패:', err.message || err);
        throw err;
    }
};

// 📊 훅: 현재 폴더 기준으로 서버 노트 로드
export const useNoteManager = (currentFolderId: string | null) => {
    const [notes, setNotes] = useState<Note[]>([]);

    const loadNotes = async () => {
        console.log('📡 서버에서 노트 불러오는 중...');
        try {
            const userId = await getUserId();
            if (!userId) {
                console.warn('❌ 사용자 ID 없음. 노트 불러오기 중단');
                return;
            }
            const serverNotes = await fetchNotesFromServer(userId, currentFolderId ?? null);
            setNotes(serverNotes);
        } catch (err) {
            console.error('노트 로딩 오류:', err);
        }
    };

    useEffect(() => {
        loadNotes();
    }, [currentFolderId]);

    return {
        notes,
        reloadNotes: loadNotes,
        uploadNoteToServer, // 업로드 후 reloadNotes() 호출 권장
    };
};
