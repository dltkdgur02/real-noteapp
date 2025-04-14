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
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Note } from '@/types/note';
import * as FileSystem from 'expo-file-system';
import { getUserId } from '@/utils/auth'; // 🔥 이 줄이 있어야 getUserId() 사용 가능
import { useNoteManager, uploadNoteToServer } from '@/hooks/\buseNoteManager';
import { deleteNote } from '@/hooks/\buseNoteManager';



// 분리한 모달 컴포넌트 import
import AddOptionsModal from '@/components/Modals/AddOptionsModal'
import FolderFormModal from '@/components/Modals/FolderFormModal';
import FolderMoveModal from '@/components/Modals/FolderMoveModal';
import PdfUploadModal from '@/components/Modals/PdfUploadModal';


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
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const {  reloadNotes } = useNoteManager(currentFolderId);
  const { notes } = useNoteManager(null);



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
  

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerText}>문서</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 📁 폴더 목록 */}
        <View style={styles.folderRow}>
          <TouchableOpacity
            style={styles.folderContainer}
            onPress={() => setActionModalVisible(true)}
          >
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

        {/* 📄 노트 목록 */}
        <View style={{ marginTop: 16 }}>
        {notes.map(note => (
              <View key={note.noteId} style={styles.noteItem}>
            <Text>{note.name}</Text>
            <Text>{note.createdAt}</Text>
          </View>
        ))}
      </View>

      </ScrollView>


      {/* ✅ 모달 컴포넌트들 적용 */}
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


    <PdfUploadModal
      visible={pdfModalVisible}
      onClose={() => setPdfModalVisible(false)}
      onPickPdf={async () => {
        await handlePickPdf(); // ← PDF 저장 & 서버 업로드
        reloadNotes();         // ← 노트 목록 갱신 💥 중요!
      }}
      currentFolderId={currentFolderId}
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
  noteItem: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
});
