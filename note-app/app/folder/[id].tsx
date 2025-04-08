import { useEffect } from 'react';
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
  } = useFolderManager();

  const currentFolder = folders.find(f => f._id === currentFolderId);

  useEffect(() => {
    if (currentFolderId) {
      setSelectedFolderId(currentFolderId);
    }
  }, [currentFolderId]);

  const handleAction = (action: string) => {
    if (action === '폴더 생성') {
      setSelectedFolderId(currentFolderId);
      setFolderModalVisible(true);
    }
  };

  const colors = [
    '#FFD700', // gold
    '#FF7F50', // coral
    '#87CEFA', // light blue
    '#90EE90', // light green
    '#DDA0DD', // plum
    '#FF69B4', // hot pink
    '#FFA500', // orange
    '#6A5ACD', // slate blue
    '#20B2AA', // light sea green
    '#A0522D', // sienna
    '#FF6347', // tomato
    '#00CED1', // dark turquoise
    '#BDB76B', // dark khaki
    '#DC143C', // crimson
  ];
  

  const renderColorOptions = () => (
    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
      {colors.map(color => (
        <TouchableOpacity
          key={color}
          onPress={() => setFolderColor(color)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: color,
            borderWidth: folderColor === color ? 2 : 0,
            borderColor: '#000',
          }}
        />
      ))}
    </View>
  );

  const renderChildFolders = () => {
    return folders
      .filter(folder => folder.parentId === currentFolderId)
      .map((folder, index) => (
        <View key={folder._id} style={styles.folderContainer}>
        <TouchableOpacity
            style={styles.folderItem}
            onPress={() => {
              setSelectedFolderId(folder._id);
              router.push(`/folder/${folder._id}`);
            }}
          >
            <View
              style={[
                styles.folderItem,
              ]}
            >
              <FolderIcon width={150} height={150} color={folder.color || '#999'} />
            </View>
        </TouchableOpacity>
          <View style={styles.folderLabelRow}>
            <Text style={styles.folderText}>{folder.name}</Text>
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
                  setFolderName(folder.name);
                  setFolderModalVisible(true);
                  setOptionsVisible(null);
                }}
              >
                <Text style={styles.dropdownOption}>이름 변경</Text>
              </Pressable>
              <Pressable onPress={() => deleteFolder(folder._id)}>
                <Text style={styles.dropdownOption}>폴더 삭제</Text>
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

      <View style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/main?tab=document');
              }
            }}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <Text style={styles.headerText}>📁 {buildBreadcrumbString(currentFolderId)}</Text>
          </View>
        </View>

     

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.folderRow}>
          <TouchableOpacity style={styles.folderContainer} onPress={() => handleAction('폴더 생성')}>
            <View style={styles.folderItem}>
              <PlusIcon width={150} height={150} />
            </View>
          </TouchableOpacity>

            {renderChildFolders()}
          </View>
        </ScrollView>
      </View>

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
            <Text style={{ fontWeight: 'bold', marginTop: 8 }}>폴더 색상 선택</Text>
            {renderColorOptions()}

            <TouchableOpacity
              style={styles.createButton}
              onPress={editMode ? renameFolder : createFolder}
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
    flexDirection: 'row',
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
  cancelText: { marginTop: 16, color: '#999' },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  
  breadcrumbText: {
    fontSize: 14,
    color: '#666',
  },
  
});
