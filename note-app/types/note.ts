// types/note.ts
export type Note = {
  id: string;
  noteId?: string; // ✅ 이렇게 옵셔널(?)로 바꿈
  name: string;
  createdAt: string;
  pdfPath: string;
  folderId?: string | null;
  userId: string;
};
