// app/pdf-viewer.tsx
import React, { useMemo } from "react";
import {
    View,
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";

const norm = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? undefined;
const safeDecode = (v?: string) => {
    if (!v) return undefined;
    try {
        return decodeURIComponent(v);
    } catch {
        return v;
    }
};

export default function PdfViewer() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        pdfUri?: string | string[];
        pdfUrl?: string | string[];
        noteId?: string | string[];
        name?: string | string[];
    }>();

    const rawPdf = norm(params.pdfUri) ?? norm(params.pdfUrl);
    const name = norm(params.name) ?? "PDF";
    const noteId = norm(params.noteId) ?? "";
    const pdfUri = safeDecode(rawPdf);

    const isLocal = typeof pdfUri === "string" && pdfUri.startsWith("file://");

    const accessDir = useMemo(() => {
        if (!isLocal || !pdfUri) return undefined;
        return pdfUri.replace(/[^/]+$/, "");
    }, [pdfUri, isLocal]);

    if (!pdfUri) {
        return (
            <View style={styles.center}>
                <Text>❌ PDF URI가 전달되지 않았다.</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {/* 상단 바 */}
            <View style={styles.topbar}>
                {/* 👈 뒤로 가기 버튼 */}
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.action}>뒤로</Text>
                </TouchableOpacity>

                <Text style={styles.title} numberOfLines={1}>
                    {name}
                </Text>

                <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* 편집 화면으로 이동 */}
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: "/pdf-editor",
                                params: {
                                    pdfUri: encodeURIComponent(pdfUri),
                                    noteId,
                                    name,
                                },
                            })
                        }
                    >
                        <Text style={styles.action}>편집</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* WebView */}
            <WebView
                originWhitelist={["*"]}
                source={{ uri: pdfUri }}
                allowingReadAccessToURL={accessDir}
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
    title: { fontSize: 16, fontWeight: "600", maxWidth: "50%" },
    action: { fontSize: 15, color: "#0a84ff", fontWeight: "600" },
});
