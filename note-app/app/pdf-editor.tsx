// app/pdf-editor.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Alert, Button, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

// OpenAI SDK (default import)
import OpenAI from 'openai';

// 환경변수: Expo에서는 EXPO_PUBLIC_ 접두사만 번들됩니다.
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
if (!apiKey) console.error('🚨 EXPO_PUBLIC_OPENAI_API_KEY is missing');

export const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // RN/WebView 환경용
});

const HEADER_H = Platform.OS === 'ios' ? 0 : 0;

export default function PdfEditor() {
    const webRef = useRef<WebView>(null);
    const router = useRouter();

    const { pdfUri, name = '제목 없음', noteId = '' } =
        useLocalSearchParams<{ pdfUri?: string; name?: string; noteId?: string }>();

    const resolvedPdfPath = useMemo(() => {
        try { return decodeURIComponent(String(pdfUri || '')); }
        catch { return String(pdfUri || ''); }
    }, [pdfUri]);

    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<string>('');

    const postToWeb = (type: string, payload?: any) =>
        webRef.current?.postMessage(JSON.stringify({ type, payload }));

    const loadPdfToWeb = async () => {
        try {
            if (!resolvedPdfPath) throw new Error('PDF 경로가 비어있다.');
            const base64 = await FileSystem.readAsStringAsync(resolvedPdfPath, {
                encoding: FileSystem.EncodingType.Base64,
            });
            postToWeb('LOAD_PDF', { base64 });
        } catch {
            Alert.alert('오류', 'PDF 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const saveAnnotationsJSON = async (items: any[]) => {
        try {
            if (!noteId) return;
            const dir = `${FileSystem.documentDirectory}notes/${noteId}.note/`;
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            await FileSystem.writeAsStringAsync(`${dir}annotations.json`, JSON.stringify(items));
            Alert.alert('저장', '주석을 저장했다.');
        } catch {
            Alert.alert('오류', '주석 저장 실패');
        }
    };

    // WebView에게 "문서 텍스트 추출" 요청
    const runAiSummary = async () => {
        if (!apiKey) {
            Alert.alert('환경 변수 오류', 'EXPO_PUBLIC_OPENAI_API_KEY가 설정되지 않았습니다.');
            return;
        }
        setAiLoading(true);
        setAiResult('');
        // WebView가 pdf.js로 텍스트를 뽑아 RN으로 보내도록 요청
        postToWeb('EXTRACT_TEXT');
    };

    // 텍스트를 받아 실제 OpenAI 호출
    const runOpenAi = async (text: string) => {
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.3,
                messages: [
                    { role: 'system', content: '너는 PDF 내용을 요약하고 퀴즈를 만들어주는 도우미다.' },
                    {
                        role: 'user',
                        content:
                            `다음 PDF의 본문을 기반으로 한국어로 핵심만 bullet로 요약하고, ` +
                            `쉬움/보통/어려움 각 1문항씩 총 3개의 퀴즈(정답 포함)를 만들어줘. ` +
                            `가능하면 추정 페이지도 [p?]처럼 표기해줘.\n\n` +
                            text.slice(0, 12000),
                    },
                ],
            });
            setAiResult(completion.choices?.[0]?.message?.content?.trim() || 'AI 결과 없음');
        } catch (e: any) {
            console.error(e);
            Alert.alert('AI 오류', '요약 생성 실패');
        } finally {
            setAiLoading(false);
        }
    };

    const onMessage = useCallback(
        (e: WebViewMessageEvent) => {
            try {
                const data = JSON.parse(e.nativeEvent.data || '{}');
                if (data.type === 'READY') loadPdfToWeb();
                else if (data.type === 'ANN_SNAPSHOT') saveAnnotationsJSON(data.items);
                else if (data.type === 'TEXT_EXTRACTED') {
                    const text = String(data.text || '');
                    runOpenAi(text);
                } else if (data.type === 'BACK') {
                    if (router.canGoBack()) router.back();
                    else router.replace('/pdf-viewer');
                } else if (data.type === 'ERROR') {
                    Alert.alert('오류', data.message || '편집기 오류');
                }
            } catch {}
        },
        [resolvedPdfPath, noteId]
    );

    return (
        <View style={styles.container}>
            <View style={{ flex: 1 }}>
                {loading && (
                    <View style={styles.loader}>
                        <ActivityIndicator />
                        <Text style={{ marginTop: 6, color: '#666' }}>PDF 불러오는 중…</Text>
                    </View>
                )}
                <WebView
                    ref={webRef}
                    originWhitelist={['*']}
                    onMessage={onMessage}
                    onLoadEnd={() => postToWeb('PING')}
                    source={{ html: EDITOR_HTML.replace('__DOC_TITLE__', String(name)) }}
                    allowFileAccess
                    allowUniversalAccessFromFileURLs
                    allowFileAccessFromFileURLs
                    javaScriptEnabled
                    domStorageEnabled
                    bounces={false}
                    allowsBackForwardNavigationGestures={false}
                />
            </View>

            <View style={styles.aiBox}>
                <Button title="AI 요약 & 퀴즈" onPress={runAiSummary} />
                {aiLoading && <ActivityIndicator style={{ marginTop: 8 }} />}
                {aiResult !== '' && (
                    <ScrollView style={{ marginTop: 8, maxHeight: 240 }}>
                        <Text style={{ color: '#fff', lineHeight: 20 }}>{aiResult}</Text>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loader: {
        position: 'absolute',
        left: 0, right: 0, bottom: 0, top: HEADER_H + 1,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 2,
    },
    aiBox: { backgroundColor: '#1f3a63', padding: 10 },
});

/* ====================== WebView HTML ====================== */
const EDITOR_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>__DOC_TITLE__</title>
<style>
  :root{ --bar-h:48px; --btn:28px; --bg:#1f3a63; --fg:#fff; --muted:#cbd5e1; }
  html,body{margin:0;height:100%; overflow-y:auto; overflow-x:hidden; background:#111;}

  /* 상단 고정 툴바 */
  #topbar{
    position:fixed; inset:0 0 auto 0; height:var(--bar-h);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 6px; background:var(--bg); color:var(--fg); z-index:30;
    box-shadow:0 2px 8px rgba(0,0,0,.25);
  }
  .row{display:flex; align-items:center; gap:4px;}
  .seg{display:flex; align-items:center; gap:2px; background:rgba(255,255,255,.08); padding:2px 4px; border-radius:10px;}
  .btn{height:var(--btn); min-width:var(--btn); display:inline-flex; align-items:center; justify-content:center; padding:0 6px; border:0; border-radius:8px; background:transparent; color:var(--fg);}
  .btn.icon{width:var(--btn); padding:0;}
  .btn.icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
  .btn.active{background:rgba(255,255,255,.22);}
  .btn:hover{background:rgba(255,255,255,.12);}

  /* 팝오버/색상 점 */
  .dot{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.6);display:inline-block}
  .dot[data-c="#111111"]{background:#111111}
  .dot[data-c="#ef4444"]{background:#ef4444}
  .dot[data-c="#22c55e"]{background:#22c55e}
  .dot[data-c="#3b82f6"]{background:#3b82f6}
  .dot[data-c="#facc15"]{background:#facc15}
  .dot[data-c="#a855f7"]{background:#a855f7}
  .dot.active{outline:2px solid #fff; outline-offset:1px}
  .sheet{ position:fixed; top:calc(var(--bar-h) + 6px); right:8px; z-index:40; background:#fff; color:#111; border-radius:12px; border:1px solid #e5e7eb; padding:10px; box-shadow:0 12px 28px rgba(0,0,0,.2); display:none; min-width:180px;}
  .sheet.show{display:block;}
  .sheet .row{gap:8px}
  .sheet label{font:600 12px -apple-system,system-ui; color:#334155; width:42px}
  .sheet input[type="range"]{width:140px}

  /* PDF 영역 */
  #stage{ position:absolute; left:0; right:0; top:var(--bar-h); bottom:0; overflow:auto; -webkit-overflow-scrolling:touch; background:#fff; }
  #wrap{position:relative; margin:0 auto;}
  #pdf{position:absolute; top:0; left:0; z-index:1;}
  /* ✅ 펜 인식 강화: ink는 항상 맨 위 + 포인터 이벤트 온 + 터치액션 none */
  #ink{
    position:absolute; top:0; left:0; z-index:2;
    pointer-events:auto; touch-action:none;   /* ← 핵심 */
  }

  /* 페이지 표시/로딩 */
  #pager{ position:fixed; left:50%; bottom:8px; transform:translateX(-50%); background:rgba(255,255,255,.93); border:1px solid #e5e7eb; border-radius:999px; padding:4px 10px; font:600 12px -apple-system,system-ui; color:#111; box-shadow:0 4px 16px rgba(0,0,0,.08); z-index:15; }
  #loading{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#64748b; font:12px -apple-system,system-ui}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  const RN = window.ReactNativeWebView, post=(t,x={})=>RN.postMessage(JSON.stringify({type:t,...x}));
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdf, page=1, pages=1, rendering=false;
  let mode='pen', color='#111111', width=4, eraser=14;
  const strokes={}, undo={}, redo={}; const S=(m,k)=> (m[k]??=([]));
  let stage, wrap, cv, ctx, ink, inkx, loading, ptext;
  let sheetColor, sheetWidth;

  function fitScale(pg){
    const pad = 24;
    const containerW = Math.max(320, stage.clientWidth - pad);
    const vp1 = pg.getViewport({scale:1});
    const cssScale = containerW / vp1.width;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2));
    return { cssScale, pixelScale: cssScale * dpr };
  }

  function redraw(p){
    inkx.clearRect(0,0,ink.width,ink.height);
    for(const s of S(strokes,p)) drawStroke(s);
  }
  function drawStroke(s){
    const pts=s.points; if(!pts||pts.length<2) return;
    inkx.save();
    if(s.tool==='hl'){ inkx.globalAlpha=.28; inkx.strokeStyle=s.color; inkx.lineWidth=s.width*1.6; }
    else { inkx.globalAlpha=1; inkx.strokeStyle=s.color; inkx.lineWidth=s.width; }
    inkx.lineCap='round'; inkx.lineJoin='round';
    inkx.beginPath(); inkx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++) inkx.lineTo(pts[i].x,pts[i].y);
    inkx.stroke(); inkx.restore();
  }

  function b64ToU8(b64){
    const ch=32768, chunks=[]; 
    for(let i=0;i<b64.length;i+=ch){
      const bin=atob(b64.slice(i,i+ch)); const u=new Uint8Array(bin.length);
      for(let j=0;j<bin.length;j++) u[j]=bin.charCodeAt(j);
      chunks.push(u);
    }
    let len=0; chunks.forEach(u=>len+=u.length); const out=new Uint8Array(len);
    let off=0; chunks.forEach(u=>{ out.set(u,off); off+=u.length; }); 
    return out;
  }

  async function openBase64(b64){
    const u8=b64ToU8(b64);
    const task=pdfjsLib.getDocument({data:u8});
    pdf=await task.promise; page=1; pages=pdf.numPages||1;
    await new Promise(r=>requestAnimationFrame(r));
    renderPage(page);
  }

  async function renderPage(n){
    if(!pdf) return; rendering=true; loading.style.display='flex';
    try{
      const pg=await pdf.getPage(n);
      const { cssScale, pixelScale } = fitScale(pg);
      const vpCss = pg.getViewport({scale: cssScale});
      const vpPix = pg.getViewport({scale: pixelScale});

      cv.width = vpPix.width;  cv.height = vpPix.height;
      ink.width = vpPix.width; ink.height = vpPix.height;

      cv.style.width = "100%"; cv.style.height = "auto";
      ink.style.width = "100%"; ink.style.height = "auto";

      wrap.style.width = vpCss.width+'px';
      wrap.style.height = vpCss.height+'px';

      await pg.render({ canvasContext: ctx, viewport: vpPix, transform: [1,0,0,1,0,0] }).promise;

      redraw(n);
      ptext.textContent = n + '/' + pages;
    } finally { rendering=false; loading.style.display='none'; }
  }

  /* ====== 펜 인식 강화 로직 ====== */
  // 일부 iPad WebView에서 Pencil이 touch로 보고되는 케이스를 보정
  const looksLikePencil = (e) => {
    // pressure > 0 은 펜/펜슬에서만 안정적으로 발생
    // width/height가 1에 가깝고 majorAxis가 작으면 펜 가능성 ↑
    return e.pointerType === 'pen' ||
           (e.pointerType === 'touch' && e.pressure > 0 && (e.width <= 2 || e.height <= 2));
  };

  let drawing=false, cur=null, erasePath=[], pending=null;

  function xy(ev){
    // 스크롤/줌에 안정적인 좌표계 계산
    const r=ink.getBoundingClientRect();
    const cx = (ev.clientX ?? ev.pageX) - r.left;
    const cy = (ev.clientY ?? ev.pageY) - r.top;
    const sx = ink.width / r.width;
    const sy = ink.height / r.height;
    return { x: cx * sx, y: cy * sy };
  }

  function begin(e){
    // 손가락 스크롤과 구분: 진짜 펜으로 판단되면만 필기
    if (!looksLikePencil(e) || rendering) return;
    e.preventDefault();
    drawing=true;
    ink.setPointerCapture(e.pointerId);
    document.body.classList.add('inking');

    if(mode==='eraser'){ erasePath=[xy(e)]; return; }
    cur={tool:(mode==='hl'?'hl':'pen'), color, width, page, points:[]};
    addPoint(e);
  }
  function addPoint(e){
    if(!drawing) return;
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for(const ev of pts){
      const p=xy(ev);
      const arr=cur.points, last=arr[arr.length-1];
      const dx= last?(p.x-last.x):0, dy= last?(p.y-last.y):0;
      if(!last || (dx*dx+dy*dy)>0.8){ arr.push(p); } // 살짝 민감도↑
    }
    if(!pending){
      pending = requestAnimationFrame(()=>{
        pending=null;
        const a=cur.points; if(a.length<2) return;
        const n=a.length-1, A=a[n-1], B=a[n];
        inkx.save();
        if(cur.tool==='hl'){ inkx.globalAlpha=.28; inkx.strokeStyle=cur.color; inkx.lineWidth=cur.width*1.6; }
        else { inkx.globalAlpha=1; inkx.strokeStyle=cur.color; inkx.lineWidth=cur.width; }
        inkx.lineCap='round'; inkx.lineJoin='round';
        inkx.beginPath(); inkx.moveTo(A.x,A.y); inkx.lineTo(B.x,B.y); inkx.stroke(); inkx.restore();
      });
    }
  }
  function move(e){
    if(!drawing) return;
    e.preventDefault();
    if(mode==='eraser'){ erasePath.push(xy(e)); return; }
    addPoint(e);
  }
  function end(e){
    if(!drawing) return;
    e.preventDefault();
    drawing=false;
    document.body.classList.remove('inking');
    if(mode==='eraser'){ applyErase(erasePath); erasePath=[]; return; }
    if(cur && cur.points.length>=2){ S(strokes,page).push(cur); }
    cur=null;
  }

  // 캡처 잃을 때/리브 시 안전하게 종료
  function cancel(){
    if(!drawing) return;
    drawing=false;
    document.body.classList.remove('inking');
    cur=null; erasePath=[];
  }

  function d2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
  function applyErase(path){
    const arr=S(strokes,page), r2=eraser*eraser, keep=[];
    outer: for(const s of arr){
      for(const sp of s.points){ for(const ep of path){ if(d2(sp,ep)<=r2) continue outer; } }
      keep.push(s);
    }
    strokes[page]=keep; redraw(page);
  }

  /* ===== 브리지/명령 ===== */
  function onMsg(ev){
    let d=ev.data; try{ if(typeof d==='string') d=JSON.parse(d);}catch(_){}
    if(!d||!d.type) return;
    if(d.type==='LOAD_PDF') openBase64(d.payload?.base64||'');
    if(d.type==='PING') post('READY',{ok:true});
    if(d.type==='SAVE_ANN'){
      const all=[]; Object.keys(strokes).forEach(k=>{ const p=parseInt(k,10); (strokes[p]||[]).forEach(s=>all.push(s)); }); 
      post('ANN_SNAPSHOT',{items:all});
    }
    if(d.type==='PREV' && !rendering && page>1){ page--; renderPage(page); }
    if(d.type==='NEXT' && !rendering && page<pages){ page++; renderPage(page); }
    if(d.type==='UNDO'){ const u=S(undo,page); if(u.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(redo,page).push(cur); strokes[page]=u.pop(); redraw(page); } }
    if(d.type==='REDO'){ const r=S(redo,page); if(r.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(undo,page).push(cur); strokes[page]=r.pop(); redraw(page); } }
    if(d.type==='CLEAR'){ const u=S(undo,page); u.push(JSON.parse(JSON.stringify(S(strokes,page)))); strokes[page]=[]; redraw(page); }
    if(d.type==='SET_MODE'){ setMode(d.payload?.mode||'pen'); }
    if(d.type==='SET_COLOR'){ setColor(d.payload?.color||'#111111'); }
    if(d.type==='SET_WIDTH'){ setWidth(d.payload?.width||4); }
    if(d.type==='SET_ERASER_RADIUS'){ setEraser(d.payload?.eraserRadius||14); }
    if(d.type==='BACK'){ post('BACK'); }
    if(d.type==='EXTRACT_TEXT'){ extractText(); }
  }

  function setMode(m){ mode=m; syncToolbar(); }
  function setColor(c){ color=c; syncToolbar(); }
  function setWidth(w){ width=w; syncToolbar(); }
  function setEraser(r){ eraser=r; syncToolbar(); }

  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);

  window.addEventListener('DOMContentLoaded', ()=>{
    const bar=document.createElement('div'); bar.id='topbar'; bar.innerHTML=\`
      <div class="row" id="left">
        <button class="btn icon" id="back" title="뒤로">
          <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <div class="seg">
          <button class="btn icon" id="prev" title="이전 페이지">
            <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <button class="btn icon" id="next" title="다음 페이지">
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
      <div class="row" id="center">
        <div class="seg" id="tools">
          <button class="btn icon" data-mode="pen" title="펜">
            <svg viewBox="0 0 24 24"><path d="M12 19l7-7a2 2 0 0 0-3-3l-7 7-2 5 5-2z"/></svg>
          </button>
          <button class="btn icon" data-mode="hl" title="형광펜">
            <svg viewBox="0 0 24 24"><path d="M3 21l6-2 9-9-4-4-9 9-2 6zM14 5l5 5"/></svg>
          </button>
          <button class="btn icon" data-mode="eraser" title="지우개">
            <svg viewBox="0 0 24 24"><path d="M19 14l-7-7a2 2 0 0 0-3 0L4 12a2 2 0 0 0 0 3l3 3h9"/><path d="M7 17l5-5"/></svg>
          </button>
          <button class="btn icon" data-mode="pan" title="이동/손">
            <svg viewBox="0 0 24 24"><path d="M12 22s6-3 6-8V7a2 2 0 0 0-4 0v3"/><path d="M8 10V6a2 2 0 0 1 4 0v6"/><path d="M8 10a2 2 0 0 0-4 2v1"/></svg>
          </button>
        </div>
      </div>
      <div class="row" id="right">
        <div class="seg">
          <button class="btn icon" id="paletteBtn" title="색상">
            <svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 2-2 2 2 0 0 1 2-2h1a4 4 0 0 0 0-8h-1a2 2 0 0 1-2-2 2 2 0 0 0-2-2h-2z"/></svg>
          </button>
          <button class="btn icon" id="widthBtn" title="굵기">
            <svg viewBox="0 0 24 24"><path d="M4 6h12"/><path d="M4 12h16"/><path d="M4 18h8"/></svg>
          </button>
        </div>
        <div class="seg">
          <button class="btn icon" id="undo" title="실행취소">
            <svg viewBox="0 0 24 24"><path d="M9 14l-4-4 4-4"/><path d="M20 20a9 9 0 0 0-9-9H5"/></svg>
          </button>
          <button class="btn icon" id="redo" title="다시실행">
            <svg viewBox="0 0 24 24"><path d="M15 6l4 4-4 4"/><path d="M4 20a9 9 0 0 1 9-9h5"/></svg>
          </button>
        </div>
        <button class="btn icon" id="save" title="저장">
          <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
        </button>
      </div>
    \`;
    document.body.appendChild(bar);

    sheetColor=document.createElement('div'); sheetColor.className='sheet'; sheetColor.innerHTML=\`
      <div class="row" style="justify-content:space-between">
        <span class="dot" data-c="#111111"></span>
        <span class="dot" data-c="#ef4444"></span>
        <span class="dot" data-c="#22c55e"></span>
        <span class="dot" data-c="#3b82f6"></span>
        <span class="dot" data-c="#facc15"></span>
        <span class="dot" data-c="#a855f7"></span>
      </div>
    \`;
    document.body.appendChild(sheetColor);

    sheetWidth=document.createElement('div'); sheetWidth.className='sheet'; sheetWidth.innerHTML=\`
      <div class="row"><label>굵기</label><input id="wRange" type="range" min="1" max="24" step="1" value="\${width}"><span id="wVal">\${width}px</span></div>
      <div class="row"><label>지우개</label><input id="eRange" type="range" min="6" max="30" step="2" value="\${eraser}"><span id="eVal">\${eraser}px</span></div>
    \`;
    document.body.appendChild(sheetWidth);

    const pager=document.createElement('div'); pager.id='pager'; pager.innerHTML=\`<span id="ptext">1/?</span>\`;
    document.body.appendChild(pager); ptext=document.getElementById('ptext');

    stage=document.createElement('div'); stage.id='stage'; document.body.appendChild(stage);
    wrap=document.createElement('div'); wrap.id='wrap'; stage.appendChild(wrap);
    cv=document.createElement('canvas'); cv.id='pdf'; wrap.appendChild(cv);
    ink=document.createElement('canvas'); ink.id='ink'; wrap.appendChild(ink);
    loading=document.createElement('div'); loading.id='loading'; loading.textContent='불러오는 중…'; wrap.appendChild(loading);
    ctx=cv.getContext('2d',{willReadFrequently:true});
    inkx=ink.getContext('2d',{willReadFrequently:true});

    /* 포인터 이벤트 */
    ink.addEventListener('pointerdown', begin, {passive:false});
    ink.addEventListener('pointermove',  move,  {passive:false});
    ink.addEventListener('pointerup',    end,   {passive:false});
    ink.addEventListener('pointercancel',end,   {passive:false});
    ink.addEventListener('pointerleave', end,   {passive:false});
    ink.addEventListener('lostpointercapture', cancel, {passive:false});

    document.getElementById('back').onclick =()=> post('BACK');
    document.getElementById('prev').onclick =()=>{ if(!rendering && page>1){ page--; renderPage(page);} };
    document.getElementById('next').onclick =()=>{ if(!rendering && page<pages){ page++; renderPage(page);} };
    document.getElementById('undo').onclick =()=>{ const u=S(undo,page); if(u.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(redo,page).push(cur); strokes[page]=u.pop(); redraw(page);} };
    document.getElementById('redo').onclick =()=>{ const r=S(redo,page); if(r.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(undo,page).push(cur); strokes[page]=r.pop(); redraw(page);} };
    document.getElementById('save').onclick =()=>{ const all=[]; Object.keys(strokes).forEach(k=>{ const p=parseInt(k,10); (strokes[p]||[]).forEach(s=>all.push(s)); }); post('ANN_SNAPSHOT',{items:all}); };

    document.getElementById('paletteBtn').onclick=()=>{ sheetWidth.classList.remove('show'); sheetColor.classList.toggle('show'); };
    document.getElementById('widthBtn').onclick  =()=>{ sheetColor.classList.remove('show'); sheetWidth.classList.toggle('show'); };

    sheetColor.addEventListener('click',(e)=>{
      const d=e.target.closest('.dot'); if(!d) return;
      setColor(d.dataset.c);
      document.querySelectorAll('.dot').forEach(x=>x.classList.toggle('active', x.dataset.c===color));
    });

    const wRange=sheetWidth.querySelector('#wRange');
    const eRange=sheetWidth.querySelector('#eRange');
    const wVal=sheetWidth.querySelector('#wVal');
    const eVal=sheetWidth.querySelector('#eVal');
    wRange.oninput=(e)=>{ setWidth(parseInt(e.target.value,10)); wVal.textContent=width+'px'; };
    eRange.oninput=(e)=>{ setEraser(parseInt(e.target.value,10)); eVal.textContent=eraser+'px'; };

    document.getElementById('tools').addEventListener('click',(e)=>{
      const t=e.target.closest('[data-mode]'); if(!t) return;
      setMode(t.dataset.mode);
    });

    syncToolbar();
    post('READY',{ok:true});
    window.addEventListener('resize', ()=>{ if(pdf) renderPage(page); }, {passive:true});
  });

  function syncToolbar(){
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    document.querySelectorAll('.dot').forEach(d=>d.classList.toggle('active', d.dataset.c===color));
    const wVal=document.getElementById('wVal'), eVal=document.getElementById('eVal');
    if(wVal) wVal.textContent = width+'px';
    if(eVal) eVal.textContent = eraser+'px';
  }
</script>
</head>
<body></body>
</html>`;
