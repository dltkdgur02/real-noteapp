// app/pdf-editor.tsx (또는 기존 파일 경로 동일)
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { EDITOR_HTML } from '../components/pdfEditorHtml';

export default function PdfEditor() {
    const webRef = useRef<WebView>(null);
    const router = useRouter();

    const { pdfUri, name = '제목 없음' } =
        useLocalSearchParams<{ pdfUri?: string; name?: string }>();

    const resolvedPdfPath = useMemo(
        () => decodeURIComponent(String(pdfUri || '')),
        [pdfUri]
    );

    const [loading, setLoading] = useState(true);

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

    const onMessage = useCallback(
        (e: any) => {
            try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'READY') loadPdfToWeb();
                if (data.type === 'BACK') router.back();
            } catch {
                // no-op
            }
        },
        [resolvedPdfPath]
    );

    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator />
                    <Text style={{ color: '#fff', marginTop: 8 }}>PDF 불러오는 중…</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
