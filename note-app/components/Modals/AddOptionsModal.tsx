// components/Modals/AddOptionsModal.tsx
// components/Modals/AddOptionsModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: string) => void;
};

// ✅ 함수 선언 스타일 바꿈
function AddOptionsModal({ visible, onClose, onSelect }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>무엇을 추가할까요?</Text>
          <Pressable style={styles.option} onPress={() => onSelect('폴더 생성')}>
            <Text style={styles.optionText}>📁 폴더 생성</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={() => onSelect('PDF 업로드')}>
            <Text style={styles.optionText}>📄 PDF 업로드</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={() => onSelect('이미지 업로드')}>
            <Text style={styles.optionText}>🖼️ 이미지 업로드</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default AddOptionsModal;


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  title: {
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
});

