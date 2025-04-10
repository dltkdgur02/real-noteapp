import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFolderManager } from '@/hooks/useFolderManager';
import PlusIcon from '../../assets/images/square-plus-button-icon.svg';
import FolderIcon from '../../assets/images/folder.svg';

export default function FolderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const currentFolderId = typeof id === 'string' ? id : null;

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const {
    folders,
    createFolder,
    folderModalVisible,
    setFolderModalVisible,
    folderName,
    setFolderName,
    editMode,
    setEditMode,
    selectedIndex,
    setSelectedIndex,
    optionsVisible,
    setOptionsVisible,
    renameFolder,
    deleteFolder,
    selectedFolderId,
    setSelectedFolderId,
    folderColor,
    setFolderColor,
    updateFolderColor,
    moveFolder,
  } = useFolderManager();

  useEffect(() => {
    if (currentFolderId) {
      setSelectedFolderId(currentFolderId);
    }
  }, [currentFolderId]);

  const buildBreadcrumbString = (folderId: string | null): string => {
    const names: string[] = [];
    let currentId = folderId;
    while (currentId) {
      const folder = folders.find(f => f._id === currentId);
      if (!folder) break;
      names.unshift(folder.name);
      currentId = folder.parentId;
    }
    return names.join(' → ');
  };

  const handleAction = (action: string) => {
    if (action === '폴더 생성') {
      setSelectedFolderId(currentFolderId);
      setFolderModalVisible(true);
    }
    setActionModalVisible(false);
  };

  const handleMoveFolder = (targetId: string) => {
    if (movingFolderId && movingFolderId !== targetId) {
      moveFolder(movingFolderId, targetId);
    }
    setMoveModalVisible(false);
    setMovingFolderId(null);
  };

  const renderFolderTree = (parentId: string | null = null, depth = 0) => {
    return folders
      .filter(f => f.parentId === parentId)
      .map(folder => (
        <TouchableOpacity
          key={folder._id}
          onPress={() => handleMoveFolder(folder._id)}
          style={{ paddingVertical: 8, paddingLeft: depth * 16 }}
        >
          <Text>📁 {folder.name}</Text>
          {renderFolderTree(folder._id, depth + 1)}
        </TouchableOpacity>
      ));
  };

  const renderChildFolders = () => {
    return folders
      .filter(folder => folder.parentId === currentFolderId)
      .map((folder, index) => (
        <View key={folder._id} style={styles.folderContainer}>
          <TouchableOpacity
            style={styles.folderItem}
            onPress={() => router.push(`/folder/${folder._id}`)}
          >
            <FolderIcon width={150} height={150} color={folder.color || '#999'} />
          </TouchableOpacity>
          <View style={styles.folderLabelRow}>
            <Text style={styles.folderText}>{folder.name}</Text>
            <TouchableOpacity onPress={() => setOptionsVisible(optionsVisible === index ? null : index)}>
              <Text style={styles.dropdown}>▼</Text>
            </TouchableOpacity>
          </View>
          {optionsVisible === index && (
            <View style={styles.dropdownBox}>
              <Pressable onPress={() => {
                setSelectedIndex(index);
                setEditMode(true);
                setFolderName(folder.name);
                setFolderModalVisible(true);
                setOptionsVisible(null);
              }}>
                <Text style={styles.dropdownOption}>이름 변경</Text>
              </Pressable>
              <Pressable onPress={() => deleteFolder(folder._id)}>
                <Text style={styles.dropdownOption}>폴더 삭제</Text>
              </Pressable>
              <Pressable onPress={() => {
                setSelectedIndex(index);
                setEditMode(false);
                setFolderColor(folder.color || '#FFD700');
                setFolderModalVisible(true);
                setOptionsVisible(null);
              }}>
                <Text style={styles.dropdownOption}>색상 변경</Text>
              </Pressable>
              <Pressable onPress={() => {
                setMovingFolderId(folder._id);
                setMoveModalVisible(true);
                setOptionsVisible(null);
              }}>
                <Text style={styles.dropdownOption}>폴더 이동</Text>
              </Pressable>
            </View>
          )}
        </View>
      ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <Text style={styles.sidebarTitle}>📝 Note-App</Text>
        {['문서', '즐겨찾기', '검색', 'Ai 기능'].map(tab => (
          <TouchableOpacity key={tab} onPress={() => router.push(`/main?tab=${tab}`)} style={styles.tabButton}>
            <Text style={styles.tabText}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/main?tab=document')}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <Text style={styles.headerText}>📁 {buildBreadcrumbString(currentFolderId)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.folderRow}>
            <TouchableOpacity style={styles.folderContainer} onPress={() => setActionModalVisible(true)}>
              <View style={styles.folderItem}>
                <PlusIcon width={150} height={150} />
              </View>
            </TouchableOpacity>
            {renderChildFolders()}
          </View>
        </ScrollView>
      </View>

      {/* 폴더 추가 모달 */}
      <Modal transparent visible={actionModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>무엇을 추가할까요?</Text>
            <Pressable style={styles.option} onPress={() => handleAction('폴더 생성')}>
              <Text style={styles.optionText}>📁 폴더 생성</Text>
            </Pressable>
            <Pressable style={styles.option}>
              <Text style={styles.optionText}>📄 PDF 업로드</Text>
            </Pressable>
            <Pressable style={styles.option}>
              <Text style={styles.optionText}>🖼️ 이미지 업로드</Text>
            </Pressable>
            <Pressable onPress={() => setActionModalVisible(false)}>
              <Text style={styles.cancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 폴더 이동 모달 */}
      <Modal transparent visible={moveModalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>폴더를 어디로 이동할까요?</Text>
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {renderFolderTree()}
            </ScrollView>
            <Pressable onPress={() => setMoveModalVisible(false)}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 폴더 생성/수정/색상 모달 */}
      <Modal transparent visible={folderModalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editMode ? '이름 변경' : '폴더 이름을 입력하세요'}</Text>
            {!editMode && (
              <TextInput
                placeholder="예: 수학노트"
                style={styles.input}
                value={folderName}
                onChangeText={setFolderName}
              />
            )}
            <Text style={{ fontWeight: 'bold', marginTop: 8 }}>폴더 색상 선택</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {['#999', '#FFD700', '#FF7F50', '#87CEFA', '#90EE90', '#DDA0DD', '#FF69B4', '#FFA500', '#6A5ACD', '#20B2AA', '#A0522D', '#FF6347', '#00CED1', '#BDB76B', '#DC143C']
                .map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setFolderColor(color)}
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: color,
                      borderWidth: folderColor === color ? 2 : 0,
                      borderColor: '#000', margin: 4
                    }}
                  />
                ))}
            </View>
            <TouchableOpacity style={styles.createButton} onPress={editMode ? renameFolder : createFolder}>
              <Text style={styles.createButtonText}>{editMode ? '변경' : '생성'}</Text>
            </TouchableOpacity>
            <Pressable onPress={() => {
              setFolderModalVisible(false);
              setEditMode(false);
              setFolderName('');
              setFolderColor('#FFD700');
            }}>
              <Text style={styles.cancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 250,
    backgroundColor: '#f0f0f0',
    paddingTop: 40,
    paddingHorizontal: 8,
  },
  sidebarTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 32, textAlign: 'center', color: '#000' },
  tabButton: {
    paddingVertical: 16, paddingHorizontal: 12, marginBottom: 12,
    borderRadius: 6, backgroundColor: '#ddd',
  },
  tabText: { color: '#000', fontWeight: '600', textAlign: 'center' },
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    alignItems: 'center', flexDirection: 'row', height: 60,
    backgroundColor: '#f0f0f0', justifyContent: 'center',
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#ccc',
  },
  backText: { fontSize: 22, fontWeight: 'bold', marginRight: 12 },
  titleWrapper: { flex: 1, alignItems: 'center' },
  headerText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  scrollContent: { padding: 16 },
  folderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 33 },
  folderContainer: { width: 150, alignItems: 'center', marginBottom: 24 },
  folderItem: {
    width: 150, height: 150, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  folderLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  folderText: { fontSize: 14, fontWeight: '500' },
  dropdown: { fontSize: 16 },
  dropdownBox: { marginTop: 4, padding: 8, backgroundColor: '#eee', borderRadius: 8 },
  dropdownOption: { paddingVertical: 4, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24,
    width: '80%', alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  option: {
    paddingVertical: 12, width: '100%', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  optionText: { fontSize: 16 },
  input: {
    width: '100%', height: 44,
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 12, marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#000', paddingVertical: 10,
    paddingHorizontal: 24, borderRadius: 8,
  },
  createButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelText: { marginTop: 16, color: '#999' },
});
