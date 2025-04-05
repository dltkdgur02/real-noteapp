// hooks/useFolderManager.ts
import axios from 'axios';
import { useEffect, useState } from 'react';
import { getUserId } from '../utils/auth';
import { API_BASE } from '@/utils/api';

export function useFolderManager() {
  const [folders, setFolders] = useState<string[]>([]);
  const [folderName, setFolderName] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState<number | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserIdAndFolders = async () => {
      const id = await getUserId();
      setUserId(id);
  
      if (id) {
        try {
          const res = await axios.get('http://192.168.0.30:5001/api/folders/list', {
            params: { userId: id },
          });
  
          if (res.status === 200) {
            setFolders(res.data.folders.map((folder: any) => folder.name)); // name만 추출해서 상태에 저장
          }
        } catch (err: any) {
          console.error('폴더 불러오기 실패:', err.response?.data || err.message);
        }
      }
    };
  
    fetchUserIdAndFolders();
  }, []);
  
  

  const openCreateModal = () => {
    setEditMode(false);
    setFolderName('');
    setFolderModalVisible(true);
  };

  // hooks/useFolderManager.ts
  const createFolder = async () => {
    if (folderName.trim() === '') return;
  
    // ✅ 1. 폴더 생성 요청 전에 콘솔로 확인
    console.log('📦 createFolder() 호출됨');
    console.log('userId:', userId);
    console.log('folderName:', folderName);
  
    try {
      console.log('➡️ 폴더 생성 요청:', {
        userId,
        name: folderName,
      });
      const res = await axios.post('http://192.168.0.30:5001/api/folders/create', {
        userId,
        name: folderName,
      });
  
      if (res.status === 201) {
        setFolders(prev => [...prev, res.data.folder.name]); 
        setFolderName('');
        setFolderModalVisible(false);
      }
    } catch (error: any) {
      console.error('폴더 생성 실패:', error.response?.data || error.message);
    }
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