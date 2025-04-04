// app/folder/[name].tsx

import { useState } from 'react';
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

import PlusIcon from '../../assets/images/square-plus-button-icon.svg';
import FolderIcon from '../../assets/images/folder.svg';

export default function FolderScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams();

  const [modalVisible, setModalVisible] = useState(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [optionsVisible, setOptionsVisible] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleAction = (action: string) => {
    if (action === '폴더 생성') {
      setFolderModalVisible(true);
    }
    setModalVisible(false);
  };

  const handleCreateFolder = () => {
    if (folderName.trim() === '') return;
    setFolders((prev) => [...prev, folderName]);
    setFolderName('');
    setFolderModalVisible(false);
  };

  const handleDeleteFolder = (index: number) => {
    const updated = [...folders];
    updated.splice(index, 1);
    setFolders(updated);
    setOptionsVisible(null);
  };

  const handleRenameFolder = () => {
    if (folderName.trim() === '' || selectedIndex === null) return;
    const updated = [...folders];
    updated[selectedIndex] = folderName;
    setFolders(updated);
    setFolderName('');
    setSelectedIndex(null);
    setEditMode(false);
    setFolderModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* 사이드바 */}
      <View style={styles.sidebar}>
        <Text style={styles.sidebarTitle}>📝 Note-App</Text>
        <TouchableOpacity onPress={() => router.push('/main?tab=document')} style={styles.tabButton}>
          <Text style={styles.tabText}>문서</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/main?tab=favorite')} style={styles.tabButton}>
          <Text style={styles.tabText}>즐겨찾기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/main?tab=search')} style={styles.tabButton}>
          <Text style={styles.tabText}>검색</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/main?tab=ai')} style={styles.tabButton}>
          <Text style={styles.tabText}>Ai 기능</Text>
        </TouchableOpacity>
      </View>

      {/* 오른쪽 콘텐츠 */}
      <View style={styles.wrapper}>
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text style={styles.headerText}>📁 {name}</Text>
        </View>
      </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.folderRow}>
            {/* 플러스 버튼 */}
            <TouchableOpacity style={styles.folderContainer} onPress={() => setModalVisible(true)}>
              <View style={styles.folderItem}>
                <PlusIcon width={150} height={150} />
              </View>
            </TouchableOpacity>

            {/* 폴더 아이템 */}
            {folders.map((item, index) => (
              <View key={index} style={styles.folderContainer}>
                <TouchableOpacity
                  style={styles.folderItem}
                  onPress={() => router.push(`/folder/${item}`)}
                >
                  <FolderIcon width={150} height={150} />
                </TouchableOpacity>
                <View style={styles.folderLabelRow}>
                  <Text style={styles.folderText}>{item}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setOptionsVisible(optionsVisible === index ? null : index)
                    }
                  >
                    <Text style={styles.dropdown}>▼</Text>
                  </TouchableOpacity>
                </View>

                {optionsVisible === index && (
                  <View style={styles.dropdownBox}>
                    <Pressable
                      onPress={() => {
                        setSelectedIndex(index);
                        setEditMode(true);
                        setFolderName(item);
                        setFolderModalVisible(true);
                        setOptionsVisible(null);
                      }}
                    >
                      <Text style={styles.dropdownOption}>이름 변경</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteFolder(index)}>
                      <Text style={styles.dropdownOption}>폴더 삭제</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 옵션 모달 */}
      <Modal transparent visible={modalVisible} animationType="fade">
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
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 폴더 생성 / 수정 모달 */}
      <Modal transparent visible={folderModalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editMode ? '이름 변경' : '폴더 이름을 입력하세요'}
            </Text>
            <TextInput
              placeholder="예: 수학노트"
              style={styles.input}
              value={folderName}
              onChangeText={setFolderName}
            />
            <TouchableOpacity
              style={styles.createButton}
              onPress={editMode ? handleRenameFolder : handleCreateFolder}
            >
              <Text style={styles.createButtonText}>
                {editMode ? '변경' : '생성'}
              </Text>
            </TouchableOpacity>
            <Pressable
              onPress={() => {
                setFolderModalVisible(false);
                setEditMode(false);
                setFolderName('');
              }}
            >
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
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#000',
  },
  tabButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  tabText: {
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
  },
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    alignItems: 'center',
    flexDirection:'row',
    height: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  scrollContent: { padding: 16 },
  folderRow: {
    
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 33,
  },
  backText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginRight: 12,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
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
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  option: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: { fontSize: 16 },
  cancelText: { marginTop: 16, color: '#999' },
  input: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: { color: '#fff', fontWeight: 'bold' },
});
