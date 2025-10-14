import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { EDITOR_HTML } from '../components/pdfEditorHtml';
import { API_BASE } from '@/utils/api'; // API 주소를 가져옵니다.

export default function PdfEditor() {
    const webRef = useRef<WebView>(null);
    const router = useRouter();

    const { pdfUri, name = '제목 없음', noteId } =
        useLocalSearchParams<{ pdfUri?: string; name?: string, noteId?: string }>();

    const resolvedPdfPath = useMemo(
        () => decodeURIComponent(String(pdfUri || '')),
        [pdfUri]
    );

    const [loading, setLoading] = useState(true);
    const [isScrollEnabled, setScrollEnabled] = useState(true);

    const postToWeb = (type: string, payload?: any) =>
        webRef.current?.postMessage(JSON.stringify({ type, payload }));

    // --- 자동 저장을 위한 API 함수들 ---
    const saveAnnotationsToServer = async (id: string, annotationData: any) => {
        if (!id) return;
        try {
            const response = await fetch(`${API_BASE}/api/notes/${id}/annotations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotationData),
            });
            if (response.ok) {
                console.log('✅ 필기 내용이 서버에 저장되었습니다.');
            } else {
                console.error('🚨 필기 내용 서버 저장 실패:', response.status);
            }
        } catch (e) {
            console.error('🚨 필기 내용 저장 중 네트워크 오류:', e);
        }
    };

    const loadAnnotationsFromServer = async (id: string) => {
        if (!id) return null;
        try {
            const response = await fetch(`${API_BASE}/api/notes/${id}/annotations`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 기존 필기 내용을 서버에서 불러왔습니다.');
                return data;
            }
            console.log('ℹ️ 저장된 필기 내용이 없습니다.');
            return null;
        } catch (e) {
            console.error('🚨 필기 내용 로딩 중 네트워크 오류:', e);
            return null;
        }
    };

    // --- 디바운스 로직 (서버 부하 방지) ---
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const handleSave = (payload: any) => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            if (noteId) {
                saveAnnotationsToServer(noteId, payload);
            }
        }, 1500); // 사용자가 필기를 멈추고 1.5초 후에 저장
    };

    // --- PDF와 필기 데이터를 함께 로드하는 함수 ---
    const loadPdfAndAnnotations = useCallback(async () => {
        try {
            setLoading(true);
            const [base64, annotations] = await Promise.all([
                FileSystem.readAsStringAsync(resolvedPdfPath, {
                    encoding: FileSystem.EncodingType.Base64,
                }),
                loadAnnotationsFromServer(String(noteId))
            ]);

            // 👇 --- 디버깅 로그 추가 --- 👇
            console.log('--- [PDF Editor] 데이터 준비 완료 ---');
            console.log('PDF 데이터 (base64) 길이:', base64?.length);
            console.log('필기 데이터 (annotations):', JSON.stringify(annotations));
            console.log('------------------------------------');

            postToWeb('LOAD_INITIAL_DATA', {
                base64,
                strokes: annotations?.strokes || {}
            });

            console.log('✅ [PDF Editor] LOAD_INITIAL_DATA 메시지 전송 완료');

        } catch(e) {
            console.error("🚨 PDF 또는 필기 데이터 로드 실패:", e);
        }
        // finally 블록은 의도적으로 비워둡니다.
    }, [resolvedPdfPath, noteId]);


    const onMessage = useCallback(
        (e: any) => {
            try {
                const data = JSON.parse(e.nativeEvent.data);

                if (data.type === 'BACK') {
                    console.log('✅ [PDF Editor] "BACK" 메시지 수신! 라우터를 통해 뒤로 이동합니다.');
                    router.back();
                }

                // --- 나머지 핸들러는 그대로 유지 ---
                if (data.type === 'SAVE_DATA') {
                    handleSave({ strokes: data.strokes || {} });
                }
                if (data.type === 'READY') loadPdfAndAnnotations();
                if (data.type === 'SET_SCROLL_ENABLED') {
                    setScrollEnabled(data.payload.enabled);
                }
                if (data.type === 'PAGE_RENDERED') {
                    setLoading(false);
                }
            } catch {
                // no-op
            }
        },
        [loadPdfAndAnnotations]
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
                scrollEnabled={isScrollEnabled}
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