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
import NoteIcon from '../assets/images/noteicon.svg';
import { useRouter } from 'expo-router';
import { useFolderManager } from '../hooks/useFolderManager';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Note } from '@/types/note';
import * as FileSystem from 'expo-file-system';
import { getUserId } from '@/utils/auth';
import { useNoteManager, uploadNoteToServer, deleteNote } from '@/hooks/useNoteManager';
import { API_BASE } from "@/utils/api";

// 모달 컴포넌트
import AddOptionsModal from '@/components/Modals/AddOptionsModal'
import FolderFormModal from '@/components/Modals/FolderFormModal';
import FolderMoveModal from '@/components/Modals/FolderMoveModal';
import PdfUploadModal from '@/components/Modals/PdfUploadModal';

async function resolveLocalPdfPathByNoteId(noteId: string): Promise<string | null> {
    try {
        const notesRoot = `${FileSystem.documentDirectory}notes/`;
        const noteDir   = `${notesRoot}${noteId}.note/`;
        const metaPath  = `${noteDir}metadata.json`;

        console.log("🔎 복구 시작");
        console.log("  • notesRoot:", notesRoot);
        console.log("  • noteDir  :", noteDir);
        console.log("  • metaPath :", metaPath);

        const metaInfo = await FileSystem.getInfoAsync(metaPath);
        console.log("  • meta exists?:", metaInfo.exists);

        if (metaInfo.exists) {
            const metaRaw = await FileSystem.readAsStringAsync(metaPath);
            let meta: any = {};
            try { meta = JSON.parse(metaRaw); } catch (e) { console.warn("  • meta JSON parse 실패:", e); }

            if (meta?.pdfPath) {
                const pdfInfo = await FileSystem.getInfoAsync(meta.pdfPath);
                console.log("  • meta.pdfPath exists?:", pdfInfo.exists);
                if (pdfInfo.exists) return meta.pdfPath;
            }
            if (meta?.name) {
                const guess1 = `${noteDir}${meta.name}.pdf`;
                const guess2 = `${noteDir}${meta.name.replace(/\.pdf$/i, '')}.pdf`;
                const g1 = await FileSystem.getInfoAsync(guess1);
                const g2 = await FileSystem.getInfoAsync(guess2);
                if (g1.exists) return guess1;
                if (g2.exists) return guess2;
            }
        } else {
            console.warn("  • metadata.json 없음. noteDir을 직접 스캔한다.");
        }

        const dirInfo = await FileSystem.getInfoAsync(noteDir);
        if (dirInfo.exists) {
            const children = await FileSystem.readDirectoryAsync(noteDir);
            const pdfFile = children.find((f) => f.toLowerCase().endsWith(".pdf"));
            if (pdfFile) {
                const p = `${noteDir}${pdfFile}`;
                const pi = await FileSystem.getInfoAsync(p);
                if (pi.exists) return p;
            }
            const maybePdf = children.find((f) => f.toLowerCase().includes("pdf"));
            if (maybePdf) {
                const p = `${noteDir}${maybePdf}`;
                const pi = await FileSystem.getInfoAsync(p);
                if (pi.exists) return p;
            }
        }

        console.warn("  • 복구 실패: 해당 noteId의 PDF를 찾지 못함");
        return null;
    } catch (e) {
        console.error("❌ resolveLocalPdfPathByNoteId 실패:", e);
        return null;
    }
}

// 🌐 서버에서 이 노트의 PDF URL 조회 (백엔드에 맞게 엔드포인트 수정)
async function fetchServerPdfUrl(noteId: string): Promise<string | null> {
    try {
        // 예시: GET /notes/:id → { fileUrl: "https://..." }
        const res = await axios.get(`https://<YOUR_API_BASE>/notes/${noteId}`);
        const url = res?.data?.fileUrl || res?.data?.pdfUrl;
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            console.log("🌐 서버 fileUrl:", url);
            return url;
        }
        console.warn("🌐 서버에 fileUrl 없음:", res?.data);
        return null;
    } catch (e) {
        console.error("🌐 서버 fileUrl 조회 실패:", e);
        return null;
    }
}

// 🔗 사용자가 파일을 다시 선택해 이 노트에 연결(재링크)
async function relinkPdfForNote(noteId: string, displayName: string) {
    try {
        const pick = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
        if (pick.canceled || !pick.assets?.length) return null;
        const pdf = pick.assets[0];

        const notesRoot = `${FileSystem.documentDirectory}notes/`;
        const noteDir   = `${notesRoot}${noteId}.note/`;
        await FileSystem.makeDirectoryAsync(noteDir, { intermediates: true });

        const target = `${noteDir}${pdf.name}`;
        await FileSystem.copyAsync({ from: pdf.uri, to: target });

        const metadataPath = `${noteDir}metadata.json`;
        const meta = {
            id: noteId,
            name: displayName?.replace(/\.pdf$/i, '') || pdf.name.replace(/\.pdf$/i, ''),
            createdAt: new Date().toISOString(),
            pdfPath: target,
        };
        await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(meta));
        console.log("🔗 재연결 완료:", target);
        return target;
    } catch (e) {
        console.error("🔗 재연결 실패:", e);
        return null;
    }
}

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
    const { reloadNotes } = useNoteManager(currentFolderId);
    const { notes } = useNoteManager(null);
    const [nameOnly, setNameOnly] = useState(false);

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
                pdfPath: pdfTargetPath,   // ✅ 이 경로가 클릭 시 복구 대상
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

                    {/* 📁 폴더 목록 */}
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

                    {/* 📄 노트 목록 (PDF) */}
                    {notes.map((note) => (
                        <View
                            key={note.noteId || note._id}   // ✅ 고유한 key 보장
                            style={styles.folderContainer}
                        >
                            <TouchableOpacity
                                style={styles.folderItem}
                                // (중략) Note 아이템 onPress 부분
                                onPress={async () => {
                                    try {
                                        console.log("👉 PDF 클릭:", note);
                                        // 이미 서버 스트리밍을 바로 여는 경우:
                                        // const fileUrl = `${API_BASE}/api/notes/${note.noteId}/file`;
                                        // router.push({ pathname: "/pdf-viewer", params: { pdfUrl: fileUrl, noteId: note.noteId, name: note.name } });

                                        // 로컬 캐시 후 열기 (ATS 회피용)
                                        const url = `${API_BASE}/api/notes/${note.noteId}/file`;
                                        const target = `${FileSystem.documentDirectory}${note.noteId}.pdf`;
                                        const result = await FileSystem.downloadAsync(url, target);
                                        router.push({
                                            pathname: "/pdf-viewer",
                                            params: { pdfUrl: result.uri, noteId: note.noteId, name: note.name },
                                        });
                                    } catch (err) {
                                        console.error("❌ PDF 열기 실패:", err);
                                    }
                                }}
                            >
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

            {/* ✅ 모달 컴포넌트들 */}
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
                    await handlePickPdf();
                    reloadNotes(); // 노트 목록 갱신
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
        width: 150,
        height: 150,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
});
