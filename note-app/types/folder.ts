// types/folder.ts

export type Folder = {
  _id: string;
  name: string;
  userId: string;
  parentId: string | null;
  color?: string;
};
