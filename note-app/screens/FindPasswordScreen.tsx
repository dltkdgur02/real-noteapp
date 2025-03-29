import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

export default function FindpasswordScreen() {
  const [email, setEmail] = useState('');
  const router = useRouter();
  const API_BASE = 'http://192.168.219.113:5001'; // 너의 서버 IP 주소로 변경

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/user/find-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert('이메일 발송 완료', '비밀번호 재설정 링크가 이메일로 전송되었습니다.');
        router.back(); // 메인으로 돌아가기
      } else {
        Alert.alert('오류', data.message || '문제가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('서버 오류', '요청 중 문제가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>비밀번호 재설정</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일 주소"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleSendResetLink}>
        <Text style={styles.buttonText}>링크 보내기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 28,
  },
  title: {
    width: '70%',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    alignSelf: 'center',
  },
  input: {
    width: '70%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignSelf: 'center',
  },
  button: {
    width: '70%',
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
