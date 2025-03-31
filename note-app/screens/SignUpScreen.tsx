import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { API_BASE } from '../utils/api';


export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();


  const handleEmailVerify = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
  
      const data = await res.json();
  
      if (res.ok) {
        Alert.alert('인증 메일 전송 완료', '메일함을 확인해주세요!');
      } else {
        Alert.alert('실패', data.message || '메일 전송 실패');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('서버 오류', '이메일 인증 요청 중 문제가 발생했습니다.');
    }
  };
  

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('입력 오류', '모든 정보를 입력해주세요.');
      return;
    }
  
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호가 일치하지 않습니다.');
      return;
    }
  
    try {
      const res = await fetch(`${API_BASE}/api/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
  
      const data = await res.json();
  
      if (res.ok) {
        Alert.alert('회원가입 성공', '이제 로그인해주세요!');
        router.replace('/');
      } else {
        Alert.alert('회원가입 실패', data.message || '서버 오류');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('서버 오류', '회원가입 중 문제가 발생했습니다.');
    }
  };
  
  const checkEmailVerified = async () => {
    if (!email) return;
  
    try {
      const res = await fetch(`${API_BASE}/api/user/is-verified?email=${email}`);
      const data = await res.json();
  
      if (data.verified) {
        setEmailVerified(true);
        console.log('✅ 인증됨! 더 이상 확인 안 함');
        return true; // 인증됨
      }
    } catch (err) {
      console.error('이메일 인증 확인 오류:', err);
    }
  
    return false; // 인증 안 됨
  };
  useEffect(() => {
    if (!email) return;
  
    const interval = setInterval(async () => {
      const verified = await checkEmailVerified();
  
      if (verified) {
        clearInterval(interval); // ✅ 인증 완료 시 더 이상 요청 안 보냄
      }
    }, 3000); // 3초마다 확인
  
    return () => clearInterval(interval); // 화면 벗어나면 정리
  }, [email]);
    
  
  

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>회원가입</Text>

      {/* 이메일 입력 + 인증 버튼 */}
      <View style={styles.emailRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.verifyButton} onPress={handleEmailVerify}>
          <Text style={styles.verifyText}>인증</Text>
        </TouchableOpacity>
      </View>

      {/* 인증 상태 */}
      <Text style={styles.verifyStatus}>
        {emailVerified ? '✅ 이메일 인증 완료' : '❗ 이메일 인증 필요'}
      </Text>

      {/* 비밀번호 입력 */}
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="oneTimeCode"
        autoComplete="off"
        autoCorrect={false}
      />

      {/* 비밀번호 확인 */}
      <TextInput
        style={styles.input}
        placeholder="비밀번호 확인"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="oneTimeCode"
        autoComplete="off"
        autoCorrect={false}
      />

      {/* 회원가입 버튼 */}
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>회원가입</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
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
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 80,
    marginBottom: 32,
    textAlign: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '70%',
    alignSelf: 'center',
  },
  input: {
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    width: '70%',
    alignSelf: 'center',
  },
  verifyButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  verifyText: {
    color: '#fff',
    fontWeight: '600',
  },
  verifyStatus: {
    marginBottom: 16,
    color: '#555',
    fontSize: 14,
    width: '70%',
    alignSelf: 'center',
  },
  
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    width: '70%',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    
  },
});
