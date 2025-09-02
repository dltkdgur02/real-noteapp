// note-app/components/AiTab.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { WebView } from "react-native-webview";
import { runAI, prompts } from "../utils/ai";


export default function AiTab() {
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [docText, setDocText] = useState("");
  const [loading, setLoading] = useState(false);
  const [wvReady, setWvReady] = useState(false);
  const [result, setResult] = useState("");
  const webRef = useRef<WebView>(null);

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", multiple: false });
    if (res.assets && res.assets.length > 0) {
      setPdfUri(res.assets[0].uri);
    }
  };

  // WebView → RN 메시지
  const onWebMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "TEXT_EXTRACTED") {
        setDocText(data.text);
      } else if (data.type === "ERROR") {
        setResult(`❌ 추출 에러: ${data.message}`);
      }
    } catch {}
  };

  // RN → WebView로 PDF(Base64) 전송
  const sendPdfToWeb = async (uri: string) => {
    try {
      // Base64로 읽어서 WebView에 전송 (content://, file:// 모두 안전)
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      webRef.current?.postMessage(JSON.stringify({ type: "LOAD_PDF_B64", base64: b64 }));
    } catch (e: any) {
      // 혹시 실패하면 URL 전달 시도 (일부 환경에서 file:// 동작)
      webRef.current?.postMessage(JSON.stringify({ type: "LOAD_PDF_URL", uri }));
    }
  };

  // WebView가 준비되거나 pdfUri가 바뀌면 전송
  useEffect(() => {
    if (wvReady && pdfUri) {
      sendPdfToWeb(pdfUri);
    }
  }, [wvReady, pdfUri]);

  async function runSummary() {
    if (!docText.trim()) {
      setResult("❗ 먼저 PDF를 불러와 주세요.");
      return;
    }
    setLoading(true);
    try {
      const out = await runAI(
        "너는 강의 노트를 요약하는 조교야.",
        prompts.summarize(docText)
      );
      setResult(out || "결과 없음");
    } catch (e: any) {
      setResult(`요약 실패: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Ai 기능</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        <Pressable style={styles.card}>
          <Text style={styles.cardIcon}>📑</Text>
          <Text style={styles.cardText}>PDF 요약</Text>
        </Pressable>

        <Pressable style={styles.card}>
          <Text style={styles.cardIcon}>❓</Text>
          <Text style={styles.cardText}>문제 생성</Text>
        </Pressable>

        <Pressable style={styles.card}>
          <Text style={styles.cardIcon}>📝</Text>
          <Text style={styles.cardText}>예시1111</Text>
        </Pressable>

        <Pressable style={styles.card}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardText}>예시 222</Text>
        </Pressable>

        <Pressable style={styles.card}>
                  <Text style={styles.cardIcon}>📊</Text>
                  <Text style={styles.cardText}>예시 333</Text>
        </Pressable>

        <Pressable style={styles.card}>
                <Text style={styles.cardIcon}>📊</Text>
                <Text style={styles.cardText}>예시 444</Text>
        </Pressable>
      </ScrollView>

    </View>
  );



}

const styles = StyleSheet.create({
 header: {
         paddingTop: 60,
         paddingBottom: 16,
         paddingHorizontal: 20,
         backgroundColor: '#f0f0f0',
     },
     headerText: { fontSize: 26, fontWeight: 'bold', color: '#000' },
      grid: {
         flexDirection: "row",
         flexWrap: "wrap",           // 줄바꿈
         justifyContent: "space-between",
         padding: 16,
       },
       card: {
         backgroundColor: "#f1f5f9",
         width: "48%",               // 한 줄에 2개
         aspectRatio: 1,             // 정사각형
         marginBottom: 16,
         borderRadius: 16,
         justifyContent: "center",
         alignItems: "center",
         shadowColor: "#000",
         shadowOpacity: 0.05,
         shadowRadius: 3,
         elevation: 2,
       },
       cardIcon: { fontSize: 36, marginBottom: 8 },
       cardText: { fontSize: 14, fontWeight: "600", color: "#1e293b" },

});

// ---- 간단 pdf.js 기반 텍스트 추출기 (WebView HTML) ----
const PDF_TEXT_EXTRACTOR = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
<script>
  const RN = window.ReactNativeWebView;
  function post(t, p){ RN.postMessage(JSON.stringify({ type: t, ...p })); }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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
        full += "\\n[Page " + i + "] " + txt.items.map(it => it.str).join(" ");
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
      // 일부 환경에서 file:// fetch가 막힐 수 있음
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      await extractFromPDF(pdf);
    } catch (e) {
      post("ERROR", { message: "PDF 로드 실패(URL): " + e + " (" + url + ")" });
    }
  }

  // RN → WebView
  window.addEventListener("message", (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === "LOAD_PDF_B64") return loadPdfFromBase64(d.base64);
      if (d.type === "LOAD_PDF_URL")  return loadPdfFromUrl(d.uri);
    } catch {}
  });

  // 초기화 완료 알림은 필요하면 추가
</script>
</body>
</html>
`;
