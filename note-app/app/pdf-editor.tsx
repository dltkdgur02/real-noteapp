import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Button, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { EDITOR_HTML } from '../components/pdfEditorHtml';
import { summarizeSmart } from '../utils/ai';

export default function PdfEditor() {
    const webRef = useRef<WebView>(null);
    const router = useRouter();

    const { pdfUri, name = '제목 없음', noteId = '' } =
        useLocalSearchParams<{ pdfUri?: string; name?: string; noteId?: string }>();

    const resolvedPdfPath = useMemo(() => decodeURIComponent(String(pdfUri || '')), [pdfUri]);

    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState('');

    const postToWeb = (type: string, payload?: any) =>
        webRef.current?.postMessage(JSON.stringify({ type, payload }));

    const loadPdfToWeb = async () => {
        try {
            const base64 = await FileSystem.readAsStringAsync(resolvedPdfPath, {
                encoding: FileSystem.EncodingType.Base64,
            });
            postToWeb('LOAD_PDF', { base64 });
        } finally {
            setLoading(false);
        }
    };

    const runAiSummary = () => {
        setAiLoading(true);
        setAiResult('');
        postToWeb('EXTRACT_TEXT');
    };

    const onMessage = useCallback((e: any) => {
        try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'READY') loadPdfToWeb();
            if (data.type === 'TEXT_EXTRACTED') summarizeSmart(data.text).then(setAiResult).finally(() => setAiLoading(false));
            if (data.type === 'BACK') router.back();
        } catch {}
    }, [resolvedPdfPath]);

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator />
                    <Text>PDF 불러오는 중…</Text>
                </View>
            )}

            <WebView
                ref={webRef}
                onMessage={onMessage}
                onLoadEnd={() => postToWeb('PING')}
                source={{ html: EDITOR_HTML.replace('__DOC_TITLE__', String(name)) }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess
            />

            <View style={styles.aiBox}>
                <Button title="AI 요약 & 퀴즈" onPress={runAiSummary} />
                {aiLoading && <ActivityIndicator style={{ marginTop: 8 }} />}
                {aiResult !== '' && (
                    <ScrollView style={{ marginTop: 8, maxHeight: 240 }}>
                        <Text style={{ color: '#fff' }}>{aiResult}</Text>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    aiBox: { backgroundColor: '#1f3a63', padding: 10 },
});
