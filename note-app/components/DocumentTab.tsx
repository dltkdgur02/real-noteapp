import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PlusIcon from '../assets/images/square-plus-button-icon.svg';

export default function DocumentTab() {
  return (
    <View style={styles.wrapper}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerText}>문서</Text>
      </View>

      {/* 플러스 아이콘 버튼 */}
      <View style={styles.iconWrapper}>
        <TouchableOpacity onPress={() => console.log('아이콘 눌림')}>
          <PlusIcon width={150} height={150} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f0f0f0',
  },
  headerText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#000',
  },
  iconWrapper: {
    paddingTop: 16,
    paddingHorizontal: 20,
  },
});
