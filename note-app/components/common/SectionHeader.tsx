import { View, Text, StyleSheet } from 'react-native';

export default function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 110,
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
});
