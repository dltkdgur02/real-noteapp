import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import PlusIcon from '../assets/images/square-plus-button-icon.svg';
import FolderIcon from '../assets/images/folder.svg';
import { useRouter } from 'expo-router';
import { useFolderManager } from '../hooks/useFolderManager';

// 분리한 모달 컴포넌트 import
import AddOptionsModal from '@/components/Modals/AddOptionsModal'
import FolderFormModal from '@/components/Modals/FolderFormModal';
import FolderMoveModal from '@/components/Modals/FolderMoveModal';

export default function DocumentTab() {
  const router = useRouter();
  const {
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
    folderColor,
    setFolderColor,
    updateFolderColor,
    moveFolder,
  } = useFolderManager();

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [colorEditMode, setColorEditMode] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const handleMove = (targetId: string) => {
    if (movingFolderId && targetId !== movingFolderId) {
      moveFolder(movingFolderId, targetId);
    }
    setMoveModalVisible(false);
    setMovingFolderId(null);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerText}>문서</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.folderRow}>
          <TouchableOpacity style={styles.folderContainer} onPress={() => setActionModalVisible(true)}>
            <View style={styles.folderItem}>
              <PlusIcon width={150} height={150} />
            </View>
          </TouchableOpacity>

          {folders.filter(f => f.parentId === null).map((folder, index) => (
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
                  <TouchableOpacity onPress={() => {
                    setSelectedIndex(index);
                    setEditMode(true);
                    setFolderName(folder.name);
                    setFolderColor(folder.color || '#FFD700');
                    setFolderModalVisible(true);
                    setOptionsVisible(null);
                  }}>
                    <Text style={styles.dropdownOption}>이름 변경</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteFolder(folder._id)}>
                    <Text style={styles.dropdownOption}>폴더 삭제</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setSelectedIndex(index);
                    setColorEditMode(true);
                    setFolderModalVisible(true);
                    setFolderColor(folder.color || '#FFD700');
                    setOptionsVisible(null);
                  }}>
                    <Text style={styles.dropdownOption}>색상 변경</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setMovingFolderId(folder._id);
                    setMoveModalVisible(true);
                    setOptionsVisible(null);
                  }}>
                    <Text style={styles.dropdownOption}>폴더 이동</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ✅ 모달 컴포넌트들 적용 */}
      <AddOptionsModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        onSelect={(action) => {
          if (action === '폴더 생성') openCreateModal();
          setActionModalVisible(false);
        }}
      />

      <FolderFormModal
        visible={folderModalVisible}
        onClose={() => {
          setFolderModalVisible(false);
          setEditMode(false);
          setColorEditMode(false);
          setFolderName('');
        }}
        folderName={folderName}
        setFolderName={setFolderName}
        folderColor={folderColor}
        setFolderColor={setFolderColor}
        onSubmit={editMode ? renameFolder : createFolder}
        nameOnly={true}
        editMode={editMode}
        colorOnly={colorEditMode}
        updateColor={updateFolderColor}
        selectedFolderIndex={selectedIndex}
        folders={folders}
      />

      <FolderMoveModal
        visible={moveModalVisible}
        folders={folders}
        onSelect={handleMove}
        onClose={() => {
          setMoveModalVisible(false);
          setMovingFolderId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f0f0f0',
  },
  headerText: { fontSize: 26, fontWeight: 'bold', color: '#000' },
  scrollContent: { padding: 16 },
  folderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 33,
  },
  folderContainer: {
    width: 150,
    alignItems: 'center',
    marginBottom: 24,
  },
  folderItem: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  folderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdown: { fontSize: 16 },
  dropdownBox: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  dropdownOption: {
    paddingVertical: 4,
    fontSize: 14,
  },
});
