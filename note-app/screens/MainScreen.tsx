import { View, Text, StyleSheet } from 'react-native';

export default function MainScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 메인 화면입니다!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
