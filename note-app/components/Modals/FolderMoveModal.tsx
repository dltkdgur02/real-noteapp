// components/Modals/FolderMoveModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';

import { Folder } from '@/types/folder';

type Props = {
  visible: boolean;
  folders: Folder[];
  onClose: () => void;
  onSelect: (targetId: string) => void;
  excludeId?: string | null; // 자신이나 자식 폴더 선택 방지
};

const FolderMoveModal = ({ visible, folders, onClose, onSelect, excludeId }: Props) => {
  const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
    return folders
      .filter(folder => folder.parentId === parentId && folder._id !== excludeId)
      .map(folder => (
        <View key={folder._id}>
          <TouchableOpacity
            style={[styles.folderRow, { paddingLeft: depth * 16 }]}
            onPress={() => onSelect(folder._id)}
          >
            <Text style={styles.folderText}>📁 {folder.name}</Text>
          </TouchableOpacity>
          {renderTree(folder._id, depth + 1)}
        </View>
      ));
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>폴더를 어디로 이동할까요?</Text>
          <ScrollView style={styles.scrollContainer}>
            {renderTree()}
          </ScrollView>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  scrollContainer: {
    maxHeight: 300,
  },
  folderRow: {
    paddingVertical: 8,
  },
  folderText: {
    fontSize: 16,
  },
  cancel: {
    marginTop: 16,
    textAlign: 'center',
    color: '#999',
  },
});


export default FolderMoveModal;