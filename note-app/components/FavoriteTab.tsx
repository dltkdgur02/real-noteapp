import { View } from 'react-native';
import SectionHeader from '../components/common/SectionHeader';

export default function DocumentTab() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SectionHeader title="즐겨찾기" />
      {/* 나머지 내용 */}
    </View>
  );
}
