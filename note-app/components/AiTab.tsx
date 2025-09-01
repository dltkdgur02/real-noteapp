// note-app/components/AiTab.tsx
import React, { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import { runAI, prompts } from "../utils/ai";

export default function AiTab() {
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [docText, setDocText] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState("");
    const webRef = useRef<WebView>(null);

    const pickPdf = async () => {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
        if (res.assets && res.assets.length > 0) {
            setPdfUri(res.assets[0].uri);
        }
    };

    const onWebMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "TEXT_EXTRACTED") {
                setDocText(data.text);
            }
        } catch {}
    };

    async function runSummary() {
        if (!docText.trim()) { setResult("❗ 먼저 PDF를 불러와 주세요."); return; }
        setLoading(true);
        const out = await runAI("너는 강의 노트를 요약하는 조교야.", prompts.summarize(docText));
        setResult(out || "결과 없음");
        setLoading(false);
    }

    return (
        <View style={{ flex:1, backgroundColor:"#fff" }}>
            <Pressable style={s.btn} onPress={pickPdf}>
                <Text style={s.btnText}>📂 PDF 불러오기</Text>
            </Pressable>

            {pdfUri && (
                <WebView
                    ref={webRef}
                    style={{ height:0 }} // 화면엔 안 보이고 텍스트 추출만
                    source={{ html: PDF_TEXT_EXTRACTOR }}
                    onMessage={onWebMessage}
                    onLoad={() => webRef.current?.postMessage(JSON.stringify({ type:"LOAD_PDF", uri: pdfUri }))}
                />
            )}

            <View style={s.box}>
                <Pressable style={s.btn} onPress={runSummary}>
                    <Text style={s.btnText}>AI 요약 실행</Text>
                </Pressable>
            </View>

            <ScrollView style={{flex:1, padding:12}}>
                {loading ? <ActivityIndicator/> : <Text>{result}</Text>}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    box:{ padding:12 },
    btn:{ backgroundColor:"#1f3a63", padding:12, borderRadius:8, marginBottom:10 },
    btnText:{ color:"#fff", fontWeight:"600", textAlign:"center" },
});

// 간단 pdf.js 기반 텍스트 추출기 (html)
const PDF_TEXT_EXTRACTOR = `
<!DOCTYPE html><html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head><body>
<script>
 const RN = window.ReactNativeWebView;
 function post(t,p){ RN.postMessage(JSON.stringify({type:t,...p})); }
 pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

 async function loadPdf(url){
   const pdf = await pdfjsLib.getDocument(url).promise;
   let full="";
   for (let i=1;i<=pdf.numPages;i++){
     const pg=await pdf.getPage(i);
     const txt=await pg.getTextContent();
     full += "\\n[Page "+i+"] " + txt.items.map(it=>it.str).join(" ");
   }
   post("TEXT_EXTRACTED",{ text: full });
 }

 window.addEventListener("message",e=>{
   try{ const d=JSON.parse(e.data); if(d.type==="LOAD_PDF"){ loadPdf(d.uri); } }catch{}
 });
</script>
</body></html>`;
