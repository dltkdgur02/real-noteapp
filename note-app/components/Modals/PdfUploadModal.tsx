import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickPdf: () => void;
};

export default function UploadPDFModal({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePDFPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });
  
      if (!result || !result.assets || result.assets.length === 0) {
        return; // 사용자가 취소하거나 잘못된 결과
      }
  
      setLoading(true);
      setMessage(null);
  
      const { uri, name } = result.assets[0];
      const fileNameWithoutExt = name.replace(/\.pdf$/i, '');
  
      await createNoteFile(uri, fileNameWithoutExt);
  
      setMessage('✅ .note 파일 생성 완료!');
    } catch (error) {
      console.error('PDF 업로드 오류:', error);
      setMessage('⚠️ 업로드 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };
  
  

  const createNoteFile = async (pdfUri: string, fileName: string) => {
    const noteDir = `${FileSystem.documentDirectory}${fileName}.note/`;
    const pdfDest = `${noteDir}document.pdf`;
    const metaDest = `${noteDir}note.json`;

    await FileSystem.makeDirectoryAsync(noteDir, { intermediates: true });

    await FileSystem.copyAsync({ from: pdfUri, to: pdfDest });

    const metadata = {
      title: fileName,
      createdAt: new Date().toISOString(),
      originalFile: 'document.pdf',
    };

    await FileSystem.writeAsStringAsync(metaDest, JSON.stringify(metadata));
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>📄 PDF 업로드</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#000" />
          ) : (
            <>
              <TouchableOpacity style={styles.button} onPress={handlePDFPick}>
                <Text style={styles.buttonText}>PDF 선택하기</Text>
              </TouchableOpacity>
              {message && <Text style={styles.message}>{message}</Text>}
            </>
          )}

          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  cancel: {
    marginTop: 20,
    color: '#999',
  },
});
