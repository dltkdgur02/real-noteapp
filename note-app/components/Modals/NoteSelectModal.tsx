// components/Modals/NoteSelectModal.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import FolderIcon from "../../assets/images/folder.svg";
import NoteIcon from "../../assets/images/noteicon.svg";
import { useNoteManager } from "../../hooks/useNoteManager"; // ⬅️ 추가

type Props = {
  visible: boolean;
  onClose: () => void;
  folders: any[];
  onSelect: (item: any) => void; // note 선택 시 콜백
};

export default function NoteSelectModal({ visible, onClose, folders, onSelect }: Props) {
  const [currentFolder, setCurrentFolder] = useState<any | null>(null);

  // 폴더 변경될 때마다 해당 폴더의 노트만 로드
  const { notes, reloadNotes, loading } = useNoteManager(currentFolder?._id ?? null);

  // 모달 닫힐 때 루트로 리셋
  useEffect(() => {
    if (!visible) setCurrentFolder(null);
  }, [visible]);

  const childFolders = folders.filter(
    (f) => f.parentId === (currentFolder?._id ?? null)
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          {/* 상단 네비게이션 */}
          <View style={styles.headerRow}>
            {currentFolder && (
              <TouchableOpacity onPress={() => setCurrentFolder(null)}>
                <Text style={styles.backBtn}>◀︎</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              문서 선택{currentFolder ? ` - ${currentFolder.name}` : ""}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : (
            <ScrollView>
              {/* 폴더들 */}
              {childFolders.map((f) => (
                <TouchableOpacity key={f._id} style={styles.item} onPress={() => setCurrentFolder(f)}>
                  <FolderIcon width={32} height={32} color={f.color || "#999"} />
                  <Text style={styles.text}>{f.name}</Text>
                </TouchableOpacity>
              ))}

              {/* 현재 폴더의 노트들 */}
              {notes.map((n: any) => (
                <TouchableOpacity key={n.id || n._id} style={styles.item} onPress={() => onSelect(n)}>
                  <NoteIcon width={32} height={32} />
                  <Text style={styles.text}>{n.name}</Text>
                </TouchableOpacity>
              ))}

              {/* 빈 상태 */}
              {childFolders.length === 0 && notes.length === 0 && (
                <Text style={{ paddingVertical: 12, color: "#666" }}>내용이 없습니다.</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  box: { width: "80%", maxHeight: "70%", backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  backBtn: { fontSize: 18, color: "#1f3a63", marginRight: 6 },
  title: { fontSize: 18, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  text: { fontSize: 16 },
  closeBtn: { marginTop: 12, padding: 12, backgroundColor: "#eee", borderRadius: 8, alignItems: "center" },
  closeText: { fontWeight: "600" }
});
