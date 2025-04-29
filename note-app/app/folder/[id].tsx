import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFolderManager } from '@/hooks/useFolderManager';
import PlusIcon from '../../assets/images/square-plus-button-icon.svg';
import FolderIcon from '../../assets/images/folder.svg';
import AddOptionsModal from '@/components/Modals/AddOptionsModal';
import FolderFormModal from '@/components/Modals/FolderFormModal';
import FolderMoveModal from '@/components/Modals/FolderMoveModal';
import PdfUploadModal from '@/components/Modals/PdfUploadModal';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { getUserId } from '@/utils/auth'; // 🔥 이 줄이 있어야 getUserId() 사용 가능
import { useNoteManager, uploadNoteToServer } from '@/hooks/useNoteManager';
import { Note } from '@/types/note';
import NoteIcon from '../../assets/images/noteicon.svg';



export default function FolderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const currentFolderId = typeof id === 'string' ? id : null;

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [colorEditMode, setColorEditMode] = useState(false);
  const [nameOnly, setNameOnly] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const { notes, reloadNotes } = useNoteManager(currentFolderId);



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
    openCreateModal,
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

  const generateUUID = async (): Promise<string> => {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.substr(0, 8),
      hex.substr(8, 4),
      '4' + hex.substr(12, 3),
      ((parseInt(hex.substr(16, 2), 16) & 0x3f) | 0x80).toString(16) + hex.substr(18, 2),
      hex.substr(20, 12),
    ].join('-');
  };
  

  const handleMove = (targetId: string) => {
    if (movingFolderId && targetId !== movingFolderId) {
      moveFolder(movingFolderId, targetId);
    }
    setMoveModalVisible(false);
    setMovingFolderId(null);
  };

  const handlePickPdf = async () => {
    console.log('📂 handlePickPdf 함수 시작됨'); 
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled || !result.assets?.length) return;
  
      const pdf = result.assets[0];
      const noteId = await generateUUID();
      const folderPath = `${FileSystem.documentDirectory}notes/${noteId}.note/`;
  
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
  
      const pdfTargetPath = `${folderPath}${pdf.name}`;
      await FileSystem.copyAsync({ from: pdf.uri, to: pdfTargetPath });
  
      const userId = await getUserId();
      if (!userId) {
        console.warn('❗ userId 없음');
        return;
      }
  
      const metadata: Note = {
        id: noteId,
        name: pdf.name.replace(/\.pdf$/, ''),
        createdAt: new Date().toISOString(),
        pdfPath: pdfTargetPath,
        folderId: currentFolderId,
        userId,
      };
  
      await FileSystem.writeAsStringAsync(`${folderPath}metadata.json`, JSON.stringify(metadata));
  
      console.log('📥 로컬 저장 완료:', metadata);
      await uploadNoteToServer(metadata);
    } catch (err) {
      console.error('🚨 PDF 업로드 처리 중 오류:', err);
    }
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
              <TouchableOpacity onPress={() => {
                setSelectedIndex(index);
                setEditMode(true);
                setNameOnly(true);
                setFolderName(folder.name);
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
                setEditMode(false);
                setColorEditMode(true);
                setFolderColor(folder.color || '#FFD700');
                setFolderModalVisible(true);
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
      ));
  };

  return (
    <View style={styles.container}>
      {/* 사이드바 */}
      <View style={styles.sidebar}>
        <Text style={styles.sidebarTitle}>📝 Note-App</Text>
        {['문서', '즐겨찾기', '검색', 'Ai 기능'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => router.push(`/main?tab=${tab}`)}
            style={styles.tabButton}
          >
            <Text style={styles.tabText}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
  
      {/* 메인 컨텐츠 */}
      <View style={styles.wrapper}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/main?tab=document')
            }
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <Text style={styles.headerText}>
              📁 {buildBreadcrumbString(currentFolderId)}
            </Text>
          </View>
        </View>
  
        {/* 폴더 + 노트 목록 */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.folderRow}>
            {/* ➕ 추가 버튼 */}
            <TouchableOpacity
              style={styles.folderContainer}
              onPress={() => setActionModalVisible(true)}
            >
              <View style={styles.folderItem}>
                <PlusIcon width={150} height={150} />
              </View>
            </TouchableOpacity>
  
            {/* 📁 하위 폴더 목록 */}
            {renderChildFolders()}
  
            {/* 📄 노트 목록 */}
            {notes.map((note) => (
              <View key={note.id} style={styles.folderContainer}>
                <TouchableOpacity style={styles.folderItem}>
                  <NoteIcon width={120} height={120} />
                </TouchableOpacity>
                <Text
                  style={styles.folderText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {note.name}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
  
      {/* 모달들 */}
      <AddOptionsModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        onSelect={(action) => {
          if (action === '폴더 생성') {
            openCreateModal();
          } else if (action === 'PDF 업로드') {
            setPdfModalVisible(true);
          }
          setActionModalVisible(false);
        }}
      />
  
      <FolderFormModal
        visible={folderModalVisible}
        onClose={() => {
          setFolderModalVisible(false);
          setEditMode(false);
          setColorEditMode(false);
          setNameOnly(false);
          setFolderName('');
          setFolderColor('#FFD700');
        }}
        folderName={folderName}
        setFolderName={setFolderName}
        folderColor={folderColor}
        setFolderColor={setFolderColor}
        onSubmit={editMode ? renameFolder : createFolder}
        editMode={editMode}
        colorOnly={colorEditMode}
        nameOnly={nameOnly}
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
  
      <PdfUploadModal
        visible={pdfModalVisible}
        onClose={() => setPdfModalVisible(false)}
        onPickPdf={async () => {
          await handlePickPdf(); // PDF 저장 및 서버 업로드
          reloadNotes();         // 노트 목록 갱신
        }}
        currentFolderId={currentFolderId}
      />
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
});
