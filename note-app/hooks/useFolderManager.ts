// hooks/useFolderManager.ts
import { useState } from 'react';

export function useFolderManager() {
  const [folders, setFolders] = useState<string[]>([]);
  const [folderName, setFolderName] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState<number | null>(null);

  const openCreateModal = () => {
    setEditMode(false);
    setFolderName('');
    setFolderModalVisible(true);
  };

  const createFolder = () => {
    if (folderName.trim() === '') return;
    setFolders(prev => [...prev, folderName]);
    setFolderName('');
    setFolderModalVisible(false);
  };

  const deleteFolder = (index: number) => {
    const updated = [...folders];
    updated.splice(index, 1);
    setFolders(updated);
    setOptionsVisible(null);
  };

  const renameFolder = () => {
    if (folderName.trim() === '' || selectedIndex === null) return;
    const updated = [...folders];
    updated[selectedIndex] = folderName;
    setFolders(updated);
    setFolderName('');
    setSelectedIndex(null);
    setEditMode(false);
    setFolderModalVisible(false);
  };

  return {
    folders,
    folderName,
    setFolderName,
    folderModalVisible,
    setFolderModalVisible,
    optionsVisible,
    setOptionsVisible,
    selectedIndex,
    setSelectedIndex,
    editMode,
    setEditMode,
    openCreateModal,
    createFolder,
    deleteFolder,
    renameFolder,
  };
}
