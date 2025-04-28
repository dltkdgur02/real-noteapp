// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveUserId = async (userId: string) => {
  try {
    await AsyncStorage.setItem('userId', userId);
  } catch (err) {
    console.error('userId 저장 실패', err);
  }
};

export const getUserId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('userId');
  } catch (err) {
    console.error('userId 가져오기 실패', err);
    return null;
  }
};
