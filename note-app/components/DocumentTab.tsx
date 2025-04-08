import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { useState } from 'react';
import PlusIcon from '../assets/images/square-plus-button-icon.svg';
import FolderIcon from '../assets/images/folder.svg';
import { useRouter } from 'expo-router';
import { useFolderManager } from '../hooks/useFolderManager';

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
  } = useFolderManager();

  const [modalVisible, setModalVisible] = useState(false);
  const [colorEditMode, setColorEditMode] = useState(false);

  const handleAction = (action: string) => {
    if (action === '폴더 생성') {
      openCreateModal();
    }
    setModalVisible(false);
  };

  const colors = [
    '#999', '#FFD700', '#FF7F50', '#87CEFA', '#90EE90', '#DDA0DD',
    '#FF69B4', '#FFA500', '#6A5ACD', '#20B2AA', '#A0522D',
    '#FF6347', '#00CED1', '#BDB76B', '#DC143C',
  ];

  const renderColorOptions = (onSelect: (color: string) => void, selected?: string) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 }}>
      {colors.map(color => (
        <TouchableOpacity
          key={color}
          onPress={() => onSelect(color)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: color,
            borderWidth: selected === color ? 2 : 0,
            borderColor: '#000',
          }}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerText}>문서</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.folderRow}>
          <TouchableOpacity style={styles.folderContainer} onPress={() => setModalVisible(true)}>
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
                  <Pressable onPress={() => {
                    setSelectedIndex(index);
                    setEditMode(true);
                    setFolderName(folder.name);
                    setFolderColor(folder.color || '#FFD700');
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
                    setFolderColor(folder.color || '#FFD700');
                    setColorEditMode(true);
                    setFolderModalVisible(true);
                    setOptionsVisible(null);
                  }}>
                    <Text style={styles.dropdownOption}>색상 변경</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 플러스 메뉴 */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>무엇을 추가할까요?</Text>
            <Pressable style={styles.option} onPress={() => handleAction('폴더 생성')}>
              <Text style={styles.optionText}>📁 폴더 생성</Text>
            </Pressable>
            <Pressable style={styles.option}><Text style={styles.optionText}>📄 PDF 업로드</Text></Pressable>
            <Pressable style={styles.option}><Text style={styles.optionText}>🖼️ 이미지 업로드</Text></Pressable>
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 폴더 생성/수정/색상 변경 모달 */}
      <Modal transparent visible={folderModalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!colorEditMode && (
              <>
                <Text style={styles.modalTitle}>{editMode ? '이름 변경' : '폴더 이름을 입력하세요'}</Text>
                <TextInput
                  placeholder="예: 수학노트"
                  style={styles.input}
                  value={folderName}
                  onChangeText={setFolderName}
                />
              </>
            )}
            <Text style={{ fontWeight: 'bold', marginTop: 8 }}>폴더 색상 선택</Text>
            {renderColorOptions(colorEditMode ? async (color) => {
              if (selectedIndex !== null) {
                const folder = folders[selectedIndex];
                await updateFolderColor(folder._id, color);
              }
              setFolderModalVisible(false);
              setColorEditMode(false);
            } : setFolderColor, folderColor)}

            {!colorEditMode && (
              <TouchableOpacity style={styles.createButton} onPress={editMode ? renameFolder : createFolder}>
                <Text style={styles.createButtonText}>{editMode ? '변경' : '생성'}</Text>
              </TouchableOpacity>
            )}

            <Pressable onPress={() => {
              setFolderModalVisible(false);
              setColorEditMode(false);
              setEditMode(false);
              setFolderName('');
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
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  option: {
    paddingVertical: 12, width: '100%', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  optionText: { fontSize: 16 },
  cancelText: { marginTop: 16, color: '#999' },
  input: {
    width: '100%', height: 44,
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, paddingHorizontal: 12, marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
