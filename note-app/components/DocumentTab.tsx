import { View } from 'react-native';
import SectionHeader from '../components/common/SectionHeader';

export default function DocumentTab() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SectionHeader title="문서" />
      {/* 나머지 내용 */}
    </View>
  );
}
