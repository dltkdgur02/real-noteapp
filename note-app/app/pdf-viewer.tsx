// app/pdf-viewer.tsx
import React, { useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Platform, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function PdfViewer() {
    const router = useRouter();
    const { pdfUrl, noteId, name } = useLocalSearchParams<{ pdfUrl: string; noteId?: string; name?: string }>();
    const isLocal = typeof pdfUrl === "string" && pdfUrl.startsWith("file://");

    const accessDir = useMemo(() => {
        if (!isLocal || !pdfUrl) return undefined;
        return pdfUrl.replace(/[^/]+$/, ""); // 파일이 있는 디렉터리
    }, [pdfUrl, isLocal]);

    if (!pdfUrl) {
        return (
            <View style={styles.center}>
                <Text>❌ PDF URL이 전달되지 않았다.</Text>
            </View>
        );
    }

    // 보기 전용: WKWebView에게 파일/URL을 직접 주면 내부 뷰어가 다중 페이지 스크롤을 처리한다.
    return (
        <View style={{ flex: 1 }}>
            <View style={styles.topbar}>
                <Text style={styles.title} numberOfLines={1}>
                    {typeof name === "string" ? name : "PDF"}
                </Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* 편집 화면으로 이동 */}
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: "/pdf-editor",
                                params: { sourceUrl: pdfUrl, noteId: noteId ?? "", name: name ?? "" },
                            })
                        }
                    >
                        <Text style={styles.action}>편집</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <WebView
                originWhitelist={["*"]}
                source={{ uri: pdfUrl }}                   // ← http/https/file 모두 지원(https 권장)
                allowingReadAccessToURL={accessDir}       // ← iOS에서 file:// 접근 허용
                allowFileAccess
                allowUniversalAccessFromFileURLs
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" />
                        <Text style={{ marginTop: 8 }}>PDF 불러오는 중…</Text>
                    </View>
                )}
                onError={(e) => console.error("❌ WebView 오류:", e.nativeEvent)}
                style={{ flex: 1 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    topbar: {
        height: 52,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: "#ddd",
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    title: { fontSize: 16, fontWeight: "600", maxWidth: "70%" },
    action: { fontSize: 15, color: "#0a84ff", fontWeight: "600" },
});
