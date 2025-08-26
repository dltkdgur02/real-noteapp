// app/pdf-editor.tsx
import React, { useMemo, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";

const PDFJS_HTML = (sourceUrl: string) => `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body { height: 100%; margin:0; padding:0; background:#fff; }
  #toolbar { position: sticky; top: 0; background: #fafafa; border-bottom: 1px solid #ddd; padding: 8px; display:flex; gap:8px; align-items:center; z-index: 10;}
  #toolbar button { padding: 6px 10px; border: 1px solid #ccc; background: #fff; border-radius: 6px; }
  #pages { padding: 8px; }
  .pageWrap { position: relative; margin: 0 auto 16px auto; width: fit-content; }
  canvas.page { display:block; background:#fff; box-shadow: 0 2px 10px rgba(0,0,0,.1); }
  canvas.overlay { position:absolute; left:0; top:0; }
</style>
</head>
<body>
  <div id="toolbar">
    <button id="prev">이전</button>
    <span id="pageInfo">1 / ?</span>
    <button id="next">다음</button>
    <button id="pen">펜</button>
    <button id="hl">형광펜</button>
    <button id="undo">되돌리기</button>
    <button id="save">주석저장</button>
    <button id="export">PDF로 내보내기</button>
  </div>
  <div id="pages"></div>

  <script>
    const RN = window.ReactNativeWebView;
    let pdfDoc = null;
    let scale = 1.2;
    let currentPage = 1;
    let mode = null; // 'pen' | 'hl' | null
    const strokesByPage = {};

     // pdf.js 로드 (v3 UMD 전역 제공 버전 사용 + 다중 CDN 폴백)
    (function loadPdfJs(){
      const cdns = [
        // jsDelivr
        {
          core: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
          worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
        },
        // cdnjs
        {
          core: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
          worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        },
        // unpkg (v3 고정)
        {
          core: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
          worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
        },
      ];

      let idx = 0;
      const tryLoad = () => {
        if (idx >= cdns.length) {
          RN.postMessage(JSON.stringify({ type: 'ERROR', message: 'pdf.js 로드 실패(모든 CDN)' }));
          return;
        }
        const { core, worker } = cdns[idx++];
        const s = document.createElement('script');
        s.src = core;
        s.onload = () => {
          try {
            if (!window['pdfjsLib']) throw new Error('pdfjsLib 전역이 없음(UMD 아님)');
            window['pdfjsLib'].GlobalWorkerOptions.workerSrc = worker;
            window.__pdf_ready = true;
            RN.postMessage(JSON.stringify({ type: 'READY' }));
            console.log('[WEB] pdf.js ready from', core);
          } catch (e){
            console.log('[WEB] pdf.js init 실패, 다음 CDN 시도:', e?.message||e);
        s.onerror = () => {
          console.log('[WEB] pdf.js 로드 실패:', core);
          tryLoad();
        };
        document.head.appendChild(s);
      };
      tryLoad();
    })();

    async function loadFromBase64(b64){
      try{
        console.log('[WEB] loadFromBase64 len=', (b64||'').length);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdfDoc = await loadingTask.promise;
        document.getElementById('pageInfo').textContent = '1 / ' + pdfDoc.numPages;
        await renderAllPages();
      }catch(e){
        RN.postMessage(JSON.stringify({type:'ERROR', message: 'PDF decode/render 실패: ' + (e?.message||e)}));
      }
    }

    async function renderAllPages(){
      const container = document.getElementById('pages');
      container.innerHTML = '';
      for (let i=1;i<=pdfDoc.numPages;i++){
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        const wrap = document.createElement('div');
        wrap.className = 'pageWrap';
        const canvas = document.createElement('canvas');
        canvas.className = 'page';
        canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const overlay = document.createElement('canvas');
        overlay.className = 'overlay';
        overlay.width = viewport.width; overlay.height = viewport.height;
        overlay.style.width = canvas.style.width = viewport.width + 'px';
        overlay.style.height = canvas.style.height = viewport.height + 'px';

        // 드로잉
        let drawing = false; let last = null;
        const lineStyle = () => {
          const o = (mode==='pen') ? {color:'#ff2d55', width:2, alpha:1}
            : (mode==='hl') ? {color:'#ffee58', width:12, alpha:0.35}
            : null;
          return o;
        };
        overlay.addEventListener('touchstart', (e) => { if (!mode) return; drawing = true; last = null; e.preventDefault(); }, {passive:false});
        overlay.addEventListener('touchmove', (e) => {
          if (!mode || !drawing) return;
          const rect = overlay.getBoundingClientRect();
          const t = e.touches[0];
          const x = (t.clientX - rect.left);
          const y = (t.clientY - rect.top);
          const ctx = overlay.getContext('2d');
          const style = lineStyle(); if (!style) return;
          ctx.globalAlpha = style.alpha; ctx.strokeStyle = style.color; ctx.lineWidth = style.width;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          if (last) { ctx.moveTo(last.x,last.y); ctx.lineTo(x,y); }
          else { ctx.moveTo(x,y); ctx.lineTo(x+0.1,y+0.1); }
          ctx.stroke();
          const pageNo = i;
          strokesByPage[pageNo] = strokesByPage[pageNo] || [];
          const lastStroke = strokesByPage[pageNo][strokesByPage[pageNo].length-1];
          if (!last || !lastStroke || lastStroke.__ended) strokesByPage[pageNo].push({points:[{x,y}], ...style});
          else lastStroke.points.push({x,y});
          last = {x,y};
          e.preventDefault();
        }, {passive:false});
        overlay.addEventListener('touchend', () => {
          const arr = strokesByPage[i];
          if (arr && arr.length) arr[arr.length-1].__ended = true;
          drawing = false; last = null;
        });

        wrap.appendChild(canvas);
        wrap.appendChild(overlay);
        container.appendChild(wrap);
      }
    }

    // 툴바
    document.getElementById('prev').onclick = () => {
      if (!pdfDoc) return;
      currentPage = Math.max(1, currentPage-1);
      document.getElementById('pages').scrollTo({top: document.querySelectorAll('.page')[currentPage-1].offsetTop-8, behavior:'smooth'});
      document.getElementById('pageInfo').textContent = currentPage + ' / ' + pdfDoc.numPages;
    };
    document.getElementById('next').onclick = () => {
      if (!pdfDoc) return;
      currentPage = Math.min(pdfDoc.numPages, currentPage+1);
      document.getElementById('pages').scrollTo({top: document.querySelectorAll('.page')[currentPage-1].offsetTop-8, behavior:'smooth'});
      document.getElementById('pageInfo').textContent = currentPage + ' / ' + pdfDoc.numPages;
    };
    document.getElementById('pen').onclick = () => { mode = (mode==='pen'?null:'pen'); };
    document.getElementById('hl').onclick = () => { mode = (mode==='hl'?null:'hl'); };
    document.getElementById('undo').onclick = () => {
      if (!pdfDoc) return;
      const i = currentPage;
      const arr = strokesByPage[i];
      if (!arr || !arr.length) return;
      arr.pop();
      const wrap = document.getElementsByClassName('pageWrap')[i-1];
      const overlay = wrap.querySelector('canvas.overlay');
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0,0,overlay.width,overlay.height);
      arr.forEach(st => {
        ctx.globalAlpha = st.alpha; ctx.strokeStyle = st.color; ctx.lineWidth = st.width;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let j=1;j<st.points.length;j++){
          const a = st.points[j-1], b = st.points[j];
          ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        }
        ctx.stroke();
      });
    };
    document.getElementById('save').onclick = () => RN.postMessage(JSON.stringify({type:'SAVE_ANNOTATIONS', payload: strokesByPage}));
    document.getElementById('export').onclick = async () => {
      try{
        const s1 = document.createElement('script');
        s1.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
        s1.onload = async () => {
          const bin = atob(window.__pdf_b64);
          const bytes = new Uint8Array(bin.length);
          for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
          const { PDFDocument, rgb } = window['PDFLib'];
          const doc = await PDFDocument.load(bytes);
          const pages = doc.getPages();
          for (let p=0;p<pages.length;p++){
            const pg = pages[p];
            const h = pg.getHeight();
            const arr = (strokesByPage[p+1]||[]);
            for (const st of arr){
              for (let i=1;i<st.points.length;i++){
                const a = st.points[i-1], b = st.points[i];
                pg.drawLine({
                  start: { x: a.x, y: (h - a.y) },
                  end:   { x: b.x, y: (h - b.y) },
                  thickness: st.width,
                  color: st.color === '#ffee58' ? rgb(1, 0.93, 0.34) : rgb(1, 0, 0.33),
                  opacity: st.alpha,
                });
              }
            }
          }
          const out = await doc.saveAsBase64({ dataUri: false });
          RN.postMessage(JSON.stringify({type:'EXPORT_PDF', base64: out}));
        };
        s1.onerror = () => RN.postMessage(JSON.stringify({ type:'ERROR', message:'pdf-lib 로드 실패'}));
        document.head.appendChild(s1);
      }catch(e){
        RN.postMessage(JSON.stringify({type:'ERROR', message:e?.message}));
      }
    };

    // RN→WebView 브리지 (injectJavaScript로 호출)
    function handleRN(data){
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'PDF_BASE64'){
          window.__pdf_b64 = msg.base64;
          loadFromBase64(msg.base64);
        } else if (msg.type === 'ERROR'){
          alert('ERROR: ' + msg.message);
        }
      } catch(e){
        console.log('[WEB] handleRN parse error', e);
      }
    }
    window.fromRN = function(obj){
      const data = (typeof obj === 'string') ? obj : JSON.stringify(obj);
      handleRN(data);
    }
  </script>
</body>
</html>`;

export default function PdfEditor() {
    const router = useRouter();
    const { sourceUrl, noteId, name } = useLocalSearchParams<{ sourceUrl: string; noteId?: string; name?: string }>();
    const webRef = useRef<WebView>(null);

    const html = useMemo(() => PDFJS_HTML(String(sourceUrl || "")), [sourceUrl]);

    const sendToWeb = (obj: any) => {
        const js = `window.fromRN(${JSON.stringify(obj)}); true;`;
        webRef.current?.injectJavaScript(js);
    };

    // WebView → RN
    const onMessage = async (e: WebViewMessageEvent) => {
        try {
            const msg = JSON.parse(e.nativeEvent.data || "{}");
            const type = msg?.type;

            if (type === "READY") {
                // ✅ pdf.js 준비 완료 신호를 받은 뒤에만 base64 주입
                try {
                    const uri = String(sourceUrl || "");
                    if (!uri) return;
                    let base64 = "";
                    if (uri.startsWith("file://")) {
                        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    } else {
                        const target = `${FileSystem.cacheDirectory}${(noteId || "temp")}.pdf`;
                        await FileSystem.downloadAsync(uri, target);
                        base64 = await FileSystem.readAsStringAsync(target, { encoding: FileSystem.EncodingType.Base64 });
                    }
                    console.log("📤 [Editor] inject PDF_BASE64, len:", base64.length);
                    sendToWeb({ type: "PDF_BASE64", base64 });
                } catch (err: any) {
                    console.error("❌ [Editor] base64 준비 실패:", err?.message);
                    sendToWeb({ type: "ERROR", message: err?.message || "PDF 로드 실패" });
                }
            } else if (type === "SAVE_ANNOTATIONS") {
                const json = JSON.stringify(msg.payload || {});
                const dir = `${FileSystem.documentDirectory}notes/${noteId || "temp"}.note/`;
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                const target = `${dir}annotations.json`;
                await FileSystem.writeAsStringAsync(target, json);
                Alert.alert("저장됨", "주석을 저장했다.");
            } else if (type === "EXPORT_PDF") {
                const outBase64 = msg.base64 as string;
                const outPath = `${FileSystem.documentDirectory}${noteId || "temp"}.annotated.pdf`;
                await FileSystem.writeAsStringAsync(outPath, outBase64, { encoding: FileSystem.EncodingType.Base64 });
                Alert.alert("완료", "주석 적용된 PDF를 저장했다.", [
                    { text: "열기", onPress: () => router.push({ pathname: "/pdf-viewer", params: { pdfUrl: outPath, name: `${name || "PDF"}(주석)` } }) },
                    { text: "확인" },
                ]);
            } else if (type === "ERROR") {
                Alert.alert("오류", msg.message || "알 수 없는 오류");
            }
        } catch (err: any) {
            console.error("onMessage parse error:", err?.message);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.topbar}>
                <Text style={styles.title} numberOfLines={1}>{typeof name === "string" ? `${name} (편집)` : "PDF 편집"}</Text>
            </View>
            <WebView
                ref={webRef}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                source={{ html }}
                allowFileAccess
                allowUniversalAccessFromFileURLs
                onMessage={onMessage}
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" />
                        <Text style={{ marginTop: 8 }}>PDF.js 로딩 중…</Text>
                    </View>
                )}
                onError={(e) => console.error("❌ editor WebView 오류:", e.nativeEvent)}
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
    },
    title: { fontSize: 16, fontWeight: "600" },
});
