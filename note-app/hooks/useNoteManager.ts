// hooks/useNoteManager.ts
import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { API_BASE } from '@/utils/api';
import { getUserId } from '@/utils/auth';
import { Note } from '@/types/note';
// hooks/useNoteManager.ts 안에 추가

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

export const fetchNotesFromServer = async (
  userId: string,
  folderId: string | null
): Promise<Note[]> => {
  try {
    const res = await axios.get(`${API_BASE}/api/notes`, {
      params: {
        userId,
        folderId,
      },
    });
    return res.data.notes;
  } catch (err: any) {
    console.error('🚨 서버에서 노트 목록 불러오기 실패:', err.response?.data || err.message);
    return [];
  }
};




export const uploadNoteToServer = async (note: Note) => {
  console.log('📡 uploadNoteToServer 시작');
  try {
    const res = await axios.post(`${API_BASE}/api/notes/upload`, {
      userId: note.userId,
      noteId: note.id,
      name: note.name,
      createdAt: note.createdAt,
      folderId: note.folderId ?? null,
    });

    console.log('✅ 노트 서버 업로드 성공:', res.data);
  } catch (err: any) {
    console.error('🚨 노트 업로드 실패:', err.response?.data || err.message);
  }
};

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
    uploadNoteToServer,
  };
};

