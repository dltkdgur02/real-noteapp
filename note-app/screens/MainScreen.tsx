import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DocumentTab from '../components/DocumentTab';
import FavoriteTab from '../components/FavoriteTab';
import SearchTab from '../components/SearchTab';
import AiTab from '../components/AiTab';

export default function MainScreen() {
  const router = useRouter();
  const { tab: queryTab } = useLocalSearchParams();
  const [tab, setTab] = useState<'document' | 'favorite' | 'search' | 'ai'>('document');

  useEffect(() => {
    if (
      queryTab === 'document' ||
      queryTab === 'favorite' ||
      queryTab === 'search' ||
      queryTab === 'ai'
    ) {
      setTab(queryTab as any);
    }
  }, [queryTab]);

  const navigateToTab = (newTab: typeof tab) => {
    setTab(newTab);
    router.push(`/main?tab=${newTab}`); // URL도 함께 변경
  };

  const renderContent = () => {
    switch (tab) {
      case 'document':
        return <DocumentTab />;
      case 'favorite':
        return <FavoriteTab />;
      case 'search':
        return <SearchTab />;
      case 'ai':
        return <AiTab />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <Text style={styles.sidebarTitle}>📝 Note-App</Text>

        <TouchableOpacity
          style={[styles.tabButton, tab === 'document' && styles.activeTab]}
          onPress={() => navigateToTab('document')}
        >
          <Text style={[styles.tabText, tab === 'document' && styles.activeText]}>문서</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'favorite' && styles.activeTab]}
          onPress={() => navigateToTab('favorite')}
        >
          <Text style={[styles.tabText, tab === 'favorite' && styles.activeText]}>즐겨찾기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'search' && styles.activeTab]}
          onPress={() => navigateToTab('search')}
        >
          <Text style={[styles.tabText, tab === 'search' && styles.activeText]}>검색</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'ai' && styles.activeTab]}
          onPress={() => navigateToTab('ai')}
        >
          <Text style={[styles.tabText, tab === 'ai' && styles.activeText]}>Ai 기능</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#f0f0f0',
    paddingTop: 40,
    paddingHorizontal: 8,
  },
  tabButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  activeTab: {
    backgroundColor: '#000',
    opacity: 0.5,
  },
  tabText: {
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  activeText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  sidebarTitle: {
    height: 50,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#000',
  },
});