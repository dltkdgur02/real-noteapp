// note-app/components/AiTab.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { WebView } from "react-native-webview";
import NoteSelectModal from "./Modals/NoteSelectModal";
import { useFolderManager } from "../hooks/useFolderManager";
import { useNoteManager } from "../hooks/useNoteManager";
import { summarizeSmart, quizSmart } from "../utils/ai";

// 진행 단계 타입
type Phase =
    | "idle"
    | "pdf_extract"
    | "summ_chunk"
    | "summ_merge"
    | "quiz_prepare"
    | "quiz_generate"
    | "done";

export default function AiTab() {
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [docText, setDocText] = useState("");
    const [loading, setLoading] = useState(false);
    const [wvReady, setWvReady] = useState(false);
    const [wvJsReady, setWvJsReady] = useState(false);
    const [result, setResult] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 진행률/취소
    const [phase, setPhase] = useState<Phase>("idle");
    const [step, setStep] = useState(0);
    const [total, setTotal] = useState(0);
    const [hint, setHint] = useState<string | null>(null);
    const cancelRef = useRef({ cancelled: false });
    const abortRef = useRef<AbortController | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const webRef = useRef<WebView>(null);

    const { folders } = useFolderManager();
    const { notes } = useNoteManager(null);
    const [selectVisible, setSelectVisible] = useState(false);
    const [selectedAction, setSelectedAction] = useState<"summary" | "quiz" | null>(null);

    // PDF 선택
    const pickPdf = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: "application/pdf",
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (res.assets && res.assets.length > 0) {
                setErrorMsg(null);
                setResult("");
                setDocText("");
                setPdfUri(res.assets[0].uri);
                setPhase("pdf_extract");
                setHint("PDF에서 텍스트를 추출한다.");
            }
        } catch (e: any) {
            setErrorMsg(`PDF 선택 실패: ${e?.message || String(e)}`);
        }
    };

    // WebView → RN 메시지
    const onWebMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === "READY") {
                setWvJsReady(true);
                return;
            }
            if (data.type === "LOG") {
                console.log("[WV]", data.msg);
                return;
            }
            if (data.type === "TEXT_EXTRACTED") {
                setDocText(data.text || "");
                if (!data.text) {
                    setErrorMsg("텍스트가 비어 있다(스캔 PDF 가능성). OCR 기능이 필요할 수 있다.");
                } else {
                    setPhase("idle");
                    setHint(null);
                }
            } else if (data.type === "ERROR") {
                setErrorMsg(`추출 에러: ${data.message}`);
                setPhase("idle");
            }
        } catch {
            // 파싱 실패 무시
        }
    };

    // RN → WebView: PDF 전송
    const sendPdfToWeb = async (uri: string) => {
        try {
            const b64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            webRef.current?.postMessage(JSON.stringify({ type: "LOAD_PDF_B64", base64: b64 }));
        } catch {
            webRef.current?.postMessage(JSON.stringify({ type: "LOAD_PDF_URL", uri }));
        }
    };

    // 준비되면 PDF 전송
    useEffect(() => {
        if (wvReady && wvJsReady && pdfUri) {
            sendPdfToWeb(pdfUri);
        }
    }, [wvReady, wvJsReady, pdfUri]);

    // 로딩 시작/종료/취소
    function beginLoading(nextPhase: Phase) {
        setLoading(true);
        setPhase(nextPhase);
        setStep(0);
        setTotal(0);
        setHint(null);
        cancelRef.current.cancelled = false;

        // 이전 요청 중단
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        // 장시간 경고
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setHint("진행이 길어지고 있다. 문서가 크거나 네트워크가 느릴 수 있다.");
        }, 45_000);
    }

    function endLoading() {
        setLoading(false);
        setPhase("done");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }

    function cancelWork() {
        cancelRef.current.cancelled = true;
        abortRef.current?.abort();
        setHint("요청을 취소했다.");
        setLoading(false);
        setPhase("idle");
    }

    // AI 요약(장문)
    async function runSummary() {
        if (!docText.trim()) {
            setResult("❗ 먼저 PDF를 불러와 텍스트를 추출한다.");
            return;
        }
        beginLoading("summ_chunk");
        setErrorMsg(null);
        try {
            const out = await summarizeSmart(docText, {
                temperature: 0.3,
                model: "gpt-4o-mini",
                signal: abortRef.current?.signal,
                isCancelled: () => cancelRef.current.cancelled,
                onProgress: (p: { phase: "chunk" | "merge"; index?: number; total?: number }) => {
                    if (p.phase === "chunk") {
                        setPhase("summ_chunk");
                        setStep(p.index || 0);
                        setTotal(p.total || 0);
                        setHint(`조각 요약 진행: ${p.index}/${p.total}`);
                    } else {
                        setPhase("summ_merge");
                        setHint("부분 요약을 하나로 병합한다.");
                    }
                },
            } as any);
            setResult(out || "결과 없음");
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (msg.includes("AbortError") || msg.includes("취소")) {
                setErrorMsg("요약을 취소했다.");
            } else {
                setErrorMsg(`요약 실패: ${msg}`);
            }
            setResult("");
        } finally {
            endLoading();
        }
    }

    // AI 퀴즈(12문항, 해설 포함)
    async function runQuiz() {
        if (!docText.trim()) {
            setResult("❗ 먼저 PDF를 불러와 텍스트를 추출한다.");
            return;
        }
        beginLoading("quiz_prepare");
        setErrorMsg(null);
        try {
            const out = await quizSmart(docText, 12, {
                temperature: 0.4,
                model: "gpt-4o-mini",
                signal: abortRef.current?.signal,
                isCancelled: () => cancelRef.current.cancelled,
                onProgress: (p: { phase: "prepare" | "generate" }) => {
                    if (p.phase === "prepare") {
                        setPhase("quiz_prepare");
                        setHint("길이 때문에 먼저 핵심 요약을 준비한다.");
                    } else {
                        setPhase("quiz_generate");
                        setHint("객관식 문항을 생성한다.");
                    }
                },
            } as any);
            setResult(out || "결과 없음");
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (msg.includes("AbortError") || msg.includes("취소")) {
                setErrorMsg("문제 생성을 취소했다.");
            } else {
                setErrorMsg(`문제 생성 실패: ${msg}`);
            }
            setResult("");
        } finally {
            endLoading();
        }
    }

    // WebView용 pdf.js 추출기
    const PDF_TEXT_EXTRACTOR = useMemo(
        () => `
<!DOCTYPE html><html><head><meta charset="utf-8" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head><body>
<script>
  const RN = window.ReactNativeWebView;
  const post = (t, p={}) => RN.postMessage(JSON.stringify({ type: t, ...p }));
  let isReady = false;
  const queue = [];

  function b64ToUint8(b64) {
    try {
      const raw = atob(b64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return arr;
    } catch (e) { post("ERROR", { message: "Base64 디코딩 실패: " + e }); return null; }
  }

  async function extractFromPDF(pdf) {
    try {
      let full = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const txt = await pg.getTextContent();
        const line = txt.items.map(it => it.str).join(" ");
        full += "\\n[Page " + i + "] " + line;
      }
      post("TEXT_EXTRACTED", { text: full });
    } catch (e) {
      post("ERROR", { message: "텍스트 추출 실패: " + e });
    }
  }

  async function loadPdfFromBase64(b64) {
    const data = b64ToUint8(b64);
    if (!data) return;
    try {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      await extractFromPDF(pdf);
    } catch (e) {
      post("ERROR", { message: "PDF 로드 실패(Base64): " + e });
    }
  }

  async function loadPdfFromUrl(url) {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      await extractFromPDF(pdf);
    } catch (e) {
      post("ERROR", { message: "PDF 로드 실패(URL): " + e + " (" + url + ")" });
    }
  }

  function handleMessageData(d) {
    try {
      if (d.type === "LOAD_PDF_B64") return loadPdfFromBase64(d.base64);
      if (d.type === "LOAD_PDF_URL")  return loadPdfFromUrl(d.uri);
    } catch (e) { post("ERROR", { message: "메시지 처리 실패: " + e }); }
  }

  function onAnyMessage(e) {
    try {
      const d = JSON.parse(e.data);
      if (!isReady) { queue.push(d); return; }
      handleMessageData(d);
    } catch {}
  }

  window.addEventListener("message", onAnyMessage);
  document.addEventListener("message", onAnyMessage);

  (async function waitPdfJs() {
    try {
      while (typeof pdfjsLib === "undefined") {
        await new Promise(r => setTimeout(r, 50));
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      isReady = true;
      post("READY");
      while (queue.length) handleMessageData(queue.shift());
    } catch (e) {
      post("ERROR", { message: "초기화 실패: " + e });
    }
  })();
</script>
</body></html>
`,
        []
    );

    const phaseLabel = (() => {
        switch (phase) {
            case "pdf_extract": return "PDF 텍스트 추출 중…";
            case "summ_chunk":  return total ? `요약(조각) ${step}/${total}` : "요약(조각) 진행 중…";
            case "summ_merge":  return "요약 병합 중…";
            case "quiz_prepare":return "퀴즈 준비 중…";
            case "quiz_generate":return "퀴즈 생성 중…";
            case "done":        return "완료";
            default:            return null;
        }
    })();

    return (
        <View style={styles.wrapper}>
            {/* 헤더 */}
            <View style={styles.header}>
                <Text style={styles.headerText}>AI 기능</Text>

                <View style={styles.headerRow}>
                    <Pressable style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={pickPdf} disabled={loading}>
                        <Text style={styles.primaryBtnText}>PDF 불러오기</Text>
                    </Pressable>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator />
                            {phaseLabel ? <Text style={styles.loadingText}>{phaseLabel}</Text> : null}
                            <Pressable style={styles.cancelBtn} onPress={cancelWork}>
                                <Text style={styles.cancelBtnText}>취소</Text>
                            </Pressable>
                        </View>
                    ) : null}
                </View>

                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>
                        {pdfUri ? `선택됨: ${pdfUri.split("/").pop()}` : "PDF 미선택"}
                    </Text>
                    <Text style={styles.statusText}>
                        {docText ? "텍스트 추출 완료" : "텍스트 미추출"}
                    </Text>
                </View>
                {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            </View>

            {/* 기능 카드 */}
            <ScrollView contentContainerStyle={styles.grid}>
                <Pressable
                    style={[styles.card, loading && styles.cardDisabled]}
                    disabled={loading}
                    onPress={() => { setSelectedAction("summary"); setSelectVisible(true); }}
                >
                    <Text style={styles.cardIcon}>📑</Text>
                    <Text style={styles.cardText}>상세 요약(장문)</Text>
                </Pressable>

                <Pressable
                    style={[styles.card, loading && styles.cardDisabled]}
                    disabled={loading}
                    onPress={() => { setSelectedAction("quiz"); setSelectVisible(true); }}
                >
                    <Text style={styles.cardIcon}>❓</Text>
                    <Text style={styles.cardText}>풍부한 객관식 퀴즈</Text>
                </Pressable>
            </ScrollView>

            {/* 결과 */}
            <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>결과</Text>
                <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingBottom: 24 }}>
                    <Text style={styles.resultText}>{result || "결과 없음"}</Text>
                </ScrollView>
            </View>

            {/* 숨김 WebView */}
            <WebView
                ref={webRef}
                onMessage={onWebMessage}
                onLoadEnd={() => setWvReady(true)}
                originWhitelist={["*"]}
                source={{ html: PDF_TEXT_EXTRACTOR }}
                allowFileAccess
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
                allowingReadAccessToURL={FileSystem.documentDirectory || ""}
                style={{ width: 0, height: 0, opacity: 0 }}
            />

            {/* 노트 선택 모달 */}
            <NoteSelectModal
                visible={selectVisible}
                onClose={() => setSelectVisible(false)}
                folders={folders}
                onSelect={() => {
                    setSelectVisible(false);
                    if (selectedAction === "summary") runSummary();
                    else if (selectedAction === "quiz") runQuiz();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: "#ffffff" },

    header: { paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: "#f0f0f0" },
    headerText: { fontSize: 26, fontWeight: "bold", color: "#000" },

    headerRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
    loadingWrap: { flexDirection: "row", alignItems: "center", marginLeft: 12, gap: 8 },
    loadingText: { marginLeft: 8, fontSize: 12, color: "#334155" },

    primaryBtn: { backgroundColor: "#1e40af", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    primaryBtnText: { color: "#fff", fontWeight: "700" },

    cancelBtn: { marginLeft: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ef4444", borderRadius: 8 },
    cancelBtnText: { color: "#fff", fontWeight: "700" },

    statusRow: { marginTop: 8 },
    statusText: { fontSize: 12, color: "#334155" },
    hintText: { marginTop: 4, fontSize: 12, color: "#7c3aed" },
    errorText: { marginTop: 6, color: "#b91c1c", fontSize: 12 },

    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", padding: 16 },
    card: {
        backgroundColor: "#f1f5f9",
        width: "48%",
        aspectRatio: 1,
        marginBottom: 16,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    cardDisabled: { opacity: 0.5 },
    cardIcon: { fontSize: 36, marginBottom: 8 },
    cardText: { fontSize: 14, fontWeight: "600", color: "#1e293b" },

    resultBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0", padding: 16 },
    resultTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#0f172a" },
    resultText: { fontSize: 14, color: "#0f172a", lineHeight: 20 },
});
