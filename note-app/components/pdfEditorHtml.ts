export const EDITOR_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>__DOC_TITLE__</title>
<style>
  :root{ --bar-h:48px; --btn:28px; --bg:#1f3a63; --fg:#fff; --muted:#cbd5e1; }
  html,body{margin:0;height:100%; overflow-y:auto; overflow-x:hidden; background:#111;}
  #topbar{
    position:fixed; inset:0 0 auto 0; height:var(--bar-h);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 6px; background:var(--bg); color:var(--fg); z-index:30;
    box-shadow:0 2px 8px rgba(0,0,0,.25);
  }
  .row{display:flex; align-items:center; gap:4px;}
  .seg{display:flex; align-items:center; gap:2px; background:rgba(255,255,255,.08); padding:2px 4px; border-radius:10px;}
  .btn{
    height:var(--btn); min-width:var(--btn); display:inline-flex; align-items:center; justify-content:center;
    padding:0 6px; border:0; border-radius:8px; background:transparent; color:var(--fg); cursor:pointer;
  }
  .btn.icon{width:var(--btn); padding:0;}
  .btn.icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
  .btn.active{background:rgba(255,255,255,.22);}
  .btn:hover{background:rgba(255,255,255,.12);}
  .dot{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.6);display:inline-block}
  .dot[data-c="#111111"]{background:#111111} .dot[data-c="#ef4444"]{background:#ef4444}
  .dot[data-c="#22c55e"]{background:#22c55e} .dot[data-c="#3b82f6"]{background:#3b82f6}
  .dot[data-c="#facc15"]{background:#facc15} .dot[data-c="#a855f7"]{background:#a855f7}
  .dot.active{outline:2px solid #fff; outline-offset:1px}
  .sheet{
    position:fixed; top:calc(var(--bar-h) + 6px); right:8px; z-index:40;
    background:#fff; color:#111; border-radius:12px; border:1px solid #e5e7eb; padding:10px;
    box-shadow:0 12px 28px rgba(0,0,0,.2); display:none; min-width:180px;
  }
  .sheet.show{display:block;} .sheet .row{gap:8px}
  .sheet label{font:600 12px -apple-system,system-ui; color:#334155; width:42px}
  .sheet input[type="range"]{width:140px}
  #stage{
    position:absolute; left:0; right:0; top:var(--bar-h); bottom:0;
    overflow:auto; -webkit-overflow-scrolling:touch; background:#fff;
  }
  #wrap{position:relative; margin:0 auto;}
  #pdf,#ink,#highlight-canvas{position:absolute; top:0; left:0;}
  #highlight-canvas{ pointer-events:none; }
  #text-input {
    position: absolute;
    z-index: 50;
    border: 1px dashed #3b82f6;
    outline: none;
    background-color: rgba(255, 255, 255, 0.85);
    font-family: -apple-system, system-ui, sans-serif;
    line-height: 1.2;
    resize: none;
    display: none;
    padding: 2px;
    border-radius: 2px;
  }
  #selection-box {
    position: absolute;
    border: 1.5px solid #0ea5e9;
    pointer-events: none;
    display: none;
    z-index: 45;
  }
  .resize-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: #fff;
    border: 1.5px solid #0ea5e9;
    border-radius: 50%;
    pointer-events: auto;
  }
  .resize-handle.br { bottom: -6px; right: -6px; cursor: nwse-resize; }
  .move-handle {
      position: absolute;
      top: -26px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 20px;
      background: #0ea5e9;
      border-radius: 50%;
      cursor: move;
      pointer-events: auto;
  }
  #ink{touch-action:pan-y;}
  .inking #ink{touch-action:none;}
  .inking #stage{overflow:hidden !important; touch-action:none !important;}
  #pager{ position:fixed; left:50%; bottom:8px; transform:translateX(-50%);
    background:rgba(255,255,255,.93); border:1px solid #e5e7eb; border-radius:999px;
    padding:4px 10px; font:600 12px -apple-system,system-ui; color:#111; box-shadow:0 4px 16px rgba(0,0,0,.08); z-index:15; }
  #loading{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#64748b; font:12px -apple-system,system-ui}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
<script>
  const RN=window.ReactNativeWebView, post=(t,x={})=>RN.postMessage(JSON.stringify({type:t,...x}));
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdf, page=1, pages=1, rendering=false;
  let mode='pen', color='#111111', width=4, eraser=14;
  const strokes={}, undo={}, redo={}; const S=(m,k)=> (m[k]??=([]));
  let stage, wrap, cv, ctx, ink, inkx, loading, ptext, hl, hlx;
  let sheetColor, sheetWidth;
  let searchQuery = '', searchResults = [], currentResultIdx = -1;
  let selectedStroke = null, selectionBox = null;
  let dragInfo = { active: false, type: null, startX: 0, startY: 0, stroke: null, original: null };

  function fitScale(pg){
    const pad = 24;
    const containerW = Math.max(320, stage.clientWidth - pad);
    const vp1 = pg.getViewport({scale:1});
    const cssScale = containerW / vp1.width;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2));
    return { cssScale, pixelScale: cssScale * dpr };
  }

  async function renderPage(n){
    if(!pdf || rendering) return;
    rendering=true; loading.style.display='flex';
    try{
      const pg=await pdf.getPage(n);
      const { cssScale, pixelScale } = fitScale(pg);
      const vpCss = pg.getViewport({scale: cssScale});
      const vpPix = pg.getViewport({scale: pixelScale});
      
      hl.width = ink.width = cv.width = vpPix.width;
      hl.height = ink.height = cv.height = vpPix.height;
      hl.style.width = ink.style.width = cv.style.width = "100%";
      hl.style.height = ink.style.height = cv.style.height = "auto";
      
      wrap.style.width = vpCss.width+'px';
      wrap.style.height = vpCss.height+'px';

      await pg.render({ canvasContext: ctx, viewport: vpPix }).promise;
      
      page = n;
      redraw(n);
      ptext.textContent = n + '/' + pages;
    } finally { rendering=false; loading.style.display='none'; }
  }
  
  async function drawHighlights() {
    if (!hl || !pdf) return;
    hlx.clearRect(0, 0, hl.width, hl.height);
    const pageResults = searchResults.filter(r => r.pageNum === page);
    if (pageResults.length === 0) return;

    const pg = await pdf.getPage(page);
    const { pixelScale } = fitScale(pg);
    
    hlx.fillStyle = 'rgba(255, 210, 0, 0.4)';
    pageResults.forEach(res => {
        const { transform, width, height } = res.item;
        hlx.fillRect(transform[4] * pixelScale, (transform[5] - height) * pixelScale, width * pixelScale, height * pixelScale);
    });

    if (currentResultIdx > -1 && searchResults[currentResultIdx].pageNum === page) {
        const res = searchResults[currentResultIdx];
        hlx.fillStyle = 'rgba(255, 120, 0, 0.5)';
        const { transform, width, height } = res.item;
        hlx.fillRect(transform[4] * pixelScale, (transform[5] - height) * pixelScale, width * pixelScale, height * pixelScale);
    }
  }
  
  async function navigateToResult(index) {
    if (searchResults.length === 0) return;
    currentResultIdx = (index + searchResults.length) % searchResults.length;
    const result = searchResults[currentResultIdx];
    if (result.pageNum !== page) {
      await renderPage(result.pageNum);
    } else {
      await drawHighlights();
    }
    const pg = await pdf.getPage(result.pageNum);
    const { cssScale } = fitScale(pg);
    const itemTopCss = (result.item.transform[5] - result.item.height) * cssScale;
    stage.scrollTop = itemTopCss - 100;
    document.getElementById('search-status').textContent = \`\${currentResultIdx + 1}/\${searchResults.length}\`;
  }

  async function performSearch(query) {
      searchQuery = query.trim();
      if (!searchQuery || searchQuery.length < 2) {
          searchResults = []; currentResultIdx = -1;
          document.getElementById('search-status').textContent = '0/0';
          await drawHighlights();
          return;
      }
      loading.textContent = \`"\${searchQuery}" 검색 중...\`;
      loading.style.display = 'flex';
      const pagePromises = Array.from({length: pages}, (_, i) => pdf.getPage(i + 1));
      const pdfPages = await Promise.all(pagePromises);
      const textContentPromises = pdfPages.map(p => p.getTextContent());
      const allTextContents = await Promise.all(textContentPromises);
      const results = [];
      allTextContents.forEach((textContent, pageIndex) => {
        textContent.items.forEach(item => {
          if (item.str.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push({ pageNum: pageIndex + 1, item });
          }
        });
      });
      searchResults = results;
      loading.style.display = 'none'; loading.textContent = '불러오는 중…';
      if (searchResults.length > 0) {
          await navigateToResult(0);
      } else {
          document.getElementById('search-status').textContent = '0/0';
      }
  }

  function redraw(p){
    inkx.clearRect(0,0,ink.width,ink.height);
    for(const s of S(strokes,p)) drawStroke(s);
    drawHighlights();
  }
  
  function drawStroke(s) {
    inkx.save();
    if (s.tool === 'text') {
      inkx.fillStyle = s.color;
      inkx.font = \`\${s.fontSize}px sans-serif\`;
      const lines = s.text.split('\\n');
      lines.forEach((line, i) => {
        inkx.fillText(line, s.x, s.y + (i * s.fontSize * 1.2));
      });
    } else {
      const pts = s.points;
      if (!pts || pts.length < 2) { inkx.restore(); return; }
      if (s.tool === 'hl') {
        inkx.globalAlpha = 0.28;
        inkx.strokeStyle = s.color;
        inkx.lineWidth = s.width * 1.6;
      } else {
        inkx.globalAlpha = 1;
        inkx.strokeStyle = s.color;
        inkx.lineWidth = s.width;
      }
      inkx.lineCap = 'round';
      inkx.lineJoin = 'round';
      inkx.beginPath();
      inkx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) inkx.lineTo(pts[i].x, pts[i].y);
      inkx.stroke();
    }
    inkx.restore();
  }

  function createTextbox(e) {
    const textInput = document.getElementById('text-input');
    if (!textInput || !pdf) return;
    if (textInput.style.display === 'block' && textInput.value.trim() !== '') {
      drawTextOnCanvas(textInput);
    }
    pdf.getPage(page).then(pg => {
        const { cssScale } = fitScale(pg);
        const pos = xy(e);
        const canvasRect = ink.getBoundingClientRect();
        textInput.style.left = \`\${pos.x * (canvasRect.width / ink.width)}px\`;
        textInput.style.top = \`\${pos.y * (canvasRect.height / ink.height)}px\`;
        textInput.style.fontSize = \`\${20 * cssScale}px\`;
        textInput.style.color = color;
        textInput.value = '';
        textInput.style.display = 'block';
        textInput.focus();
        drawing = true;
    });
  }

  function drawTextOnCanvas(inputElement) {
    const text = inputElement.value.trim();
    if (!text) {
        inputElement.style.display = 'none';
        drawing = false;
        return;
    }
    const canvasRect = ink.getBoundingClientRect();
    const x = parseFloat(inputElement.style.left) * (ink.width / canvasRect.width);
    const y = parseFloat(inputElement.style.top) * (ink.height / canvasRect.height);
    const fontSize = parseFloat(inputElement.style.fontSize) * (ink.width / canvasRect.width);
    const newStroke = {
      tool: 'text', text, color, fontSize,
      x: x, y: y + fontSize * 0.9, page: page
    };
    S(strokes, page).push(newStroke);
    redraw(page);
    inputElement.value = '';
    inputElement.style.display = 'none';
    drawing = false;
  }
  
  function getStrokeAtPoint(p) {
    const pageStrokes = S(strokes, page) || [];
    for (const s of [...pageStrokes].reverse()) {
      if (s.tool === 'text') {
        inkx.font = \`\${s.fontSize}px sans-serif\`;
        const lines = s.text.split('\\n');
        const textMetrics = lines.map(line => inkx.measureText(line));
        const width = Math.max(...textMetrics.map(m => m.width));
        const height = lines.length * s.fontSize * 1.2;
        const x = s.x, y = s.y - s.fontSize * 0.9;
        if (p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height) {
          return s;
        }
      }
    }
    return null;
  }

  function showSelectionBox(s) {
    if (!s || s.tool !== 'text') {
      selectionBox.style.display = 'none';
      return;
    }
    const canvasRect = ink.getBoundingClientRect();
    const scaleX = canvasRect.width / ink.width;
    const scaleY = canvasRect.height / ink.height;

    inkx.font = \`\${s.fontSize}px sans-serif\`;
    const lines = s.text.split('\\n');
    const width = Math.max(...lines.map(line => inkx.measureText(line).width));
    const height = lines.length * s.fontSize * 1.2;

    selectionBox.style.left = \`\${s.x * scaleX}px\`;
    selectionBox.style.top = \`\${(s.y - s.fontSize * 0.9) * scaleY}px\`;
    selectionBox.style.width = \`\${width * scaleX}px\`;
    selectionBox.style.height = \`\${height * scaleY}px\`;
    selectionBox.style.display = 'block';
  }

  function startDrag(e, type) {
    e.stopPropagation();
    if (!selectedStroke) return;
    dragInfo = {
      active: true, type, stroke: selectedStroke,
      startX: e.clientX, startY: e.clientY,
      original: { ...selectedStroke }
    };
    document.body.style.cursor = e.target.style.cursor;
  }

  function b64ToU8(b64){
    const bin=atob(b64); const u=new Uint8Array(bin.length);
    for(let j=0;j<bin.length;j++) u[j]=bin.charCodeAt(j);
    return u;
  }
  async function openBase64(b64){
    const u8=b64ToU8(b64);
    pdf=await pdfjsLib.getDocument({data:u8}).promise;
    page=1; pages=pdf.numPages||1;
    await renderPage(page);
  }

  let swipeState = { startX:0, startY:0, dx:0, dy:0, t0:0, active:false };
  let swipeLock = false;
  const SWIPE_MIN = 50, SWIPE_MAX_TIME = 600, SWIPE_DIR_RATIO = 1.5;

  function onTouchStart(e){
    if (rendering || drawing || e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeState = { startX:t.clientX, startY:t.clientY, dx:0, dy:0, t0:Date.now(), active:true };
  }
  function onTouchMove(e){
    if (!swipeState.active) return;
    const t = e.touches[0];
    swipeState.dx = t.clientX - swipeState.startX;
    swipeState.dy = t.clientY - swipeState.startY;
    if (Math.abs(swipeState.dx) > 20 && Math.abs(swipeState.dx) > Math.abs(swipeState.dy) * SWIPE_DIR_RATIO){
      e.preventDefault();
    }
  }
  function onTouchEnd(){
    if (!swipeState.active) return;
    const dt = Date.now() - swipeState.t0;
    const { dx } = swipeState;
    swipeState.active = false;
    if (swipeLock || rendering) return;
    if (Math.abs(dx) > Math.abs(swipeState.dy) * SWIPE_DIR_RATIO && Math.abs(dx) >= SWIPE_MIN && dt <= SWIPE_MAX_TIME){
      swipeLock = true;
      const newPage = dx < 0 ? page + 1 : page - 1;
      if (newPage > 0 && newPage <= pages) renderPage(newPage);
      setTimeout(()=>{ swipeLock=false; }, 350);
    }
  }

  let drawing=false, cur=null, erasePath=[], pending=null;
  const isPen = (e)=> e.pointerType==='pen', isTouch = (e)=> e.pointerType==='touch', isMouse = (e) => e.pointerType === 'mouse';
  
  function xy(ev){
    const r=ink.getBoundingClientRect();
    return { x:(ev.clientX-r.left)*(ink.width/r.width), y:(ev.clientY-r.top)*(ink.height/r.height) };
  }
  
  function begin(e){
    if (mode === 'select') {
      if (dragInfo.active) return;
      const p = xy(e);
      const targetStroke = getStrokeAtPoint(p);
      selectedStroke = targetStroke;
      showSelectionBox(targetStroke);
      return;
    }

    if (mode === 'pen' || mode === 'hl' || mode === 'eraser') {
      if (isTouch(e) || rendering) return;
      if (!isPen(e)) return; 
      e.preventDefault();
      document.body.classList.add('inking');
      ink.setPointerCapture(e.pointerId);
      drawing = true;
      if (mode === 'eraser') { erasePath = [xy(e)]; return; }
      cur = { tool: mode, color, width, page, points: [] };
      addPoint(e);
    } else if (mode === 'text') {
      if (drawing) return;
      createTextbox(e);
    }
  }
  
  function addPoint(e){
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for(const ev of events){ cur.points.push(xy(ev)); }
    if(!pending){
      pending = requestAnimationFrame(drawPending);
    }
  }

  function drawPending() {
    pending = null;
    if (!cur) return;
    const pts = cur.points;
    if (pts.length < 2) return;
    inkx.save();
    if(cur.tool==='hl'){ inkx.globalAlpha=.28; inkx.strokeStyle=cur.color; inkx.lineWidth=cur.width*1.6; }
    else { inkx.globalAlpha=1; inkx.strokeStyle=cur.color; inkx.lineWidth=cur.width; }
    inkx.lineCap='round'; inkx.lineJoin='round';
    inkx.beginPath();
    inkx.moveTo(pts[0].x, pts[0].y);
    for(let i = 1; i < pts.length; i++) inkx.lineTo(pts[i].x, pts[i].y);
    inkx.stroke();
    inkx.restore();
  }

  function move(e){
    if (dragInfo.active) {
      e.preventDefault();
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;
      const canvasRect = ink.getBoundingClientRect();
      const scaleX = ink.width / canvasRect.width;
      const scaleY = ink.height / canvasRect.height;
      const newStroke = { ...dragInfo.stroke };

      if (dragInfo.type === 'move') {
        newStroke.x = dragInfo.original.x + dx * scaleX;
        newStroke.y = dragInfo.original.y + dy * scaleY;
      } else if (dragInfo.type === 'br') {
        inkx.font = \`\${dragInfo.original.fontSize}px sans-serif\`;
        const originalWidth = Math.max(...dragInfo.original.text.split('\\n').map(l => inkx.measureText(l).width));
        const newWidth = originalWidth + dx * scaleX;
        const scaleRatio = newWidth / originalWidth;
        if (scaleRatio > 0.1) {
          newStroke.fontSize = dragInfo.original.fontSize * scaleRatio;
        }
      }
      
      const index = S(strokes, page).indexOf(dragInfo.stroke);
      if (index > -1) S(strokes, page)[index] = newStroke;
      dragInfo.stroke = newStroke;
      
      redraw(page);
      showSelectionBox(newStroke);
      return;
    }

    if(!drawing || isTouch(e) || mode === 'text') return;
    e.preventDefault();
    if(mode==='eraser'){ erasePath.push(xy(e)); return; }
    addPoint(e);
  }

  function end(e){
    if (dragInfo.active) {
      dragInfo.active = false;
      document.body.style.cursor = 'default';
      selectedStroke = dragInfo.stroke;
      return;
    }

    if(isTouch(e) || !drawing || mode === 'text') return;
    e.preventDefault();
    drawing=false;
    document.body.classList.remove('inking');
    if(pending){ cancelAnimationFrame(pending); pending = null; }
    if(mode==='eraser'){ applyErase(erasePath); erasePath=[]; return; }
    if(cur && cur.points.length>=2){ S(strokes,page).push(cur); redraw(page); }
    cur=null;
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
  
  function setMode(m){ 
    const textInput = document.getElementById('text-input');
    if (mode === 'text' && textInput.style.display === 'block') {
      drawTextOnCanvas(textInput);
    }
    mode=m;
    if (m !== 'select') {
      selectedStroke = null;
      showSelectionBox(null);
    }
    syncToolbar();
    document.body.style.cursor = (m === 'text' || m === 'select') ? 'text' : 'default';
  }
  function setColor(c){ color=c; syncToolbar(); }
  function setWidth(w){ width=w; syncToolbar(); }
  function setEraser(r){ eraser=r; syncToolbar(); }

  function onMsg(ev){
    let d=ev.data; try{ if(typeof d==='string') d=JSON.parse(d);}catch(_){}
    if(!d||!d.type) return;
    if(d.type==='LOAD_PDF') openBase64(d.payload?.base64||'');
    if(d.type==='PING') post('READY',{ok:true});
    if(d.type==='SAVE_ANN'){
      const all=[]; Object.keys(strokes).forEach(k=>{ const p=parseInt(k,10); (strokes[p]||[]).forEach(s=>all.push(s)); }); 
      post('ANN_SNAPSHOT',{items:all});
    }
    if(d.type==='PREV' && !rendering && page>1){ renderPage(page-1); }
    if(d.type==='NEXT' && !rendering && page<pages){ renderPage(page+1); }
    if(d.type==='UNDO'){ const u=S(undo,page); if(u.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(redo,page).push(cur); strokes[page]=u.pop(); redraw(page); } }
    if(d.type==='REDO'){ const r=S(redo,page); if(r.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(undo,page).push(cur); strokes[page]=r.pop(); redraw(page); } }
    if(d.type==='CLEAR'){ const u=S(undo,page); u.push(JSON.parse(JSON.stringify(S(strokes,page)))); strokes[page]=[]; redraw(page); }
    if(d.type==='SET_MODE'){ setMode(d.payload?.mode||'pen'); }
    if(d.type==='SET_COLOR'){ setColor(d.payload?.color||'#111111'); }
    if(d.type==='SET_WIDTH'){ setWidth(d.payload?.width||4); }
    if(d.type==='SET_ERASER_RADIUS'){ setEraser(d.payload?.eraserRadius||14); }
    if(d.type==='BACK'){ post('BACK'); }
  }
  
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);

  function syncToolbar(){
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    document.querySelectorAll('.dot').forEach(d=>d.classList.toggle('active', d.dataset.c===color));
    const wVal=document.getElementById('wVal'), eVal=document.getElementById('eVal');
    if(wVal) wVal.textContent = width+'px';
    if(eVal) eVal.textContent = eraser+'px';
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    const barHtml = \`
      <div class="row" id="left">
        <button class="btn icon" id="back" title="뒤로"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <div class="seg">
          <button class="btn icon" id="prev" title="이전 페이지"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button class="btn icon" id="next" title="다음 페이지"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>
      </div>
      <div class="row" id="center">
        <div class="seg" id="tools">
          <button class="btn icon" data-mode="pen" title="펜"><svg viewBox="0 0 24 24"><path d="M12 19l7-7a2 2 0 0 0-3-3l-7 7-2 5 5-2z"/></svg></button>
          <button class="btn icon" data-mode="hl" title="형광펜"><svg viewBox="0 0 24 24"><path d="M3 21l6-2 9-9-4-4-9 9-2 6zM14 5l5 5"/></svg></button>
          <button class="btn icon" data-mode="eraser" title="지우개"><svg viewBox="0 0 24 24"><path d="M19 14l-7-7a2 2 0 0 0-3 0L4 12a2 2 0 0 0 0 3l3 3h9"/><path d="M7 17l5-5"/></svg></button>
          <button class="btn icon" data-mode="select" title="선택"><svg viewBox="0 0 24 24"><path d="M3 12h18M12 3v18"/></svg></button>
          <button class="btn icon" data-mode="text" title="텍스트"><svg viewBox="0 0 24 24" stroke-width="2.5"><path d="M4 7V5h16v2M12 5v14m-5-14h10"/></svg></button>
        </div>
        <div class="seg" id="search-box" style="display:none; margin-left:8px;">
          <input type="search" id="search-input" placeholder="검색" style="width:100px; border:none; background:transparent; color:white;"/>
          <span id="search-status" style="font-size:12px; padding:0 4px; color:var(--muted)">0/0</span>
          <button class="btn icon" id="search-prev" title="이전 결과"><svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button>
          <button class="btn icon" id="search-next" title="다음 결과"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
        </div>
      </div>
      <div class="row" id="right">
        <div class="seg">
          <button class="btn icon" id="paletteBtn" title="색상"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 2-2 2 2 0 0 1 2-2h1a4 4 0 0 0 0-8h-1a2 2 0 0 1-2-2 2 2 0 0 0-2-2h-2z"/></svg></button>
          <button class="btn icon" id="widthBtn" title="굵기"><svg viewBox="0 0 24 24"><path d="M4 6h12"/><path d="M4 12h16"/><path d="M4 18h8"/></svg></button>
        </div>
        <div class="seg">
          <button class="btn icon" id="search-toggle" title="검색"><svg viewBox="0 0 24 24" stroke-width="2.5"><path d="M10 18a8 8 0 1 1 5.6-2.3l4.4 4.3-1.4 1.4-4.4-4.3A8 8 0 0 1 10 18z"/></svg></button>
        </div>
        <div class="seg">
          <button class="btn icon" id="undo" title="실행취소"><svg viewBox="0 0 24 24"><path d="M9 14l-4-4 4-4"/><path d="M20 20a9 9 0 0 0-9-9H5"/></svg></button>
          <button class="btn icon" id="redo" title="다시실행"><svg viewBox="0 0 24 24"><path d="M15 6l4 4-4 4"/><path d="M4 20a9 9 0 0 1 9-9h5"/></svg></button>
        </div>
        <button class="btn icon" id="save" title="저장"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg></button>
      </div>\`;
    const bar=document.createElement('div'); bar.id='topbar'; bar.innerHTML=barHtml;
    document.body.appendChild(bar);
    
    stage=document.createElement('div'); stage.id='stage'; document.body.appendChild(stage);
    wrap=document.createElement('div'); wrap.id='wrap'; stage.appendChild(wrap);
    cv=document.createElement('canvas'); cv.id='pdf'; wrap.appendChild(cv);
    hl=document.createElement('canvas'); hl.id='highlight-canvas'; wrap.appendChild(hl);
    ink=document.createElement('canvas'); ink.id='ink'; wrap.appendChild(ink);
    loading=document.createElement('div'); loading.id='loading'; loading.textContent='불러오는 중…'; wrap.appendChild(loading);
    
    selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.innerHTML = \`<div class="move-handle"></div><div class="resize-handle br"></div>\`;
    wrap.appendChild(selectionBox);
    selectionBox.querySelector('.br').addEventListener('pointerdown', (e) => startDrag(e, 'br'));
    selectionBox.querySelector('.move-handle').addEventListener('pointerdown', (e) => startDrag(e, 'move'));

    const textInput = document.createElement('textarea');
    textInput.id = 'text-input';
    textInput.rows = 1;
    textInput.addEventListener('blur', () => { drawTextOnCanvas(textInput); });
    textInput.addEventListener('input', () => { textInput.style.height = 'auto'; textInput.style.height = textInput.scrollHeight + 'px'; });
    wrap.appendChild(textInput);

    ctx=cv.getContext('2d',{willReadFrequently:true});
    hlx=hl.getContext('2d');
    inkx=ink.getContext('2d',{willReadFrequently:true});

    ink.addEventListener('dblclick', (e) => {
        if (mode !== 'select' || !selectedStroke) return;
        const strokesOnPage = S(strokes, page);
        const index = strokesOnPage.indexOf(selectedStroke);
        if (index > -1) strokesOnPage.splice(index, 1);
        
        const canvasRect = ink.getBoundingClientRect();
        const scaleX = canvasRect.width / ink.width;
        
        textInput.value = selectedStroke.text;
        textInput.style.left = \`\${selectedStroke.x * scaleX}px\`;
        textInput.style.top = \`\${(selectedStroke.y - selectedStroke.fontSize * 0.9) * scaleX}px\`;
        textInput.style.fontSize = \`\${selectedStroke.fontSize * scaleX}px\`;
        textInput.style.color = selectedStroke.color;
        textInput.style.display = 'block';
        textInput.focus();

        selectedStroke = null;
        showSelectionBox(null);
        drawing = true;
    });

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, { passive: false });
    
    ink.addEventListener('pointerdown', begin, {passive:false});
    // ink.addEventListener('pointermove', move, {passive:false}); // 이제 window에서 처리
    // ink.addEventListener('pointerup', end, {passive:false}); // 이제 window에서 처리
    ink.addEventListener('pointercancel', end, {passive:false});
    stage.addEventListener('touchstart', onTouchStart, {passive:true});
    stage.addEventListener('touchmove', onTouchMove, {passive:false});
    stage.addEventListener('touchend', onTouchEnd, {passive:true});
    stage.addEventListener('touchcancel', ()=> swipeState.active=false, {passive:true});
    
    document.getElementById('back').onclick =()=> post('BACK');
    document.getElementById('prev').onclick =()=> { if(!rendering && page>1) renderPage(page-1); };
    document.getElementById('next').onclick =()=> { if(!rendering && page<pages) renderPage(page+1); };
    document.getElementById('undo').onclick =()=> { const u=S(undo,page); if(u.length){ S(redo,page).push(JSON.parse(JSON.stringify(S(strokes,page)))); strokes[page]=u.pop(); redraw(page);} };
    document.getElementById('redo').onclick =()=> { const r=S(redo,page); if(r.length){ S(undo,page).push(JSON.parse(JSON.stringify(S(strokes,page)))); strokes[page]=r.pop(); redraw(page);} };
    document.getElementById('save').onclick =()=> { post('ANN_SNAPSHOT',{items:Object.values(strokes).flat()}); };
    
    const searchBox = document.getElementById('search-box');
    const searchInput = document.getElementById('search-input');
    document.getElementById('search-toggle').onclick = () => {
        const isHidden = searchBox.style.display === 'none';
        searchBox.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) searchInput.focus();
    };
    searchInput.onkeyup = (e) => { if (e.key === 'Enter') performSearch(e.target.value); };
    searchInput.onsearch = (e) => { if (!e.target.value) performSearch(''); };
    document.getElementById('search-prev').onclick = () => navigateToResult(currentResultIdx - 1);
    document.getElementById('search-next').onclick = () => navigateToResult(currentResultIdx + 1);
    
    document.getElementById('tools').addEventListener('click',(e)=>{
      const t=e.target.closest('[data-mode]'); if(t) setMode(t.dataset.mode);
    });
    
    sheetColor=document.createElement('div'); sheetColor.className='sheet'; sheetColor.innerHTML=\`<div class="row" style="justify-content:space-between"><span class="dot" data-c="#111111"></span><span class="dot" data-c="#ef4444"></span><span class="dot" data-c="#22c55e"></span><span class="dot" data-c="#3b82f6"></span><span class="dot" data-c="#facc15"></span><span class="dot" data-c="#a855f7"></span></div>\`; document.body.appendChild(sheetColor);
    sheetWidth=document.createElement('div'); sheetWidth.className='sheet'; sheetWidth.innerHTML=\`<div class="row"><label>굵기</label><input id="wRange" type="range" min="1" max="24" step="1" value="4"><span id="wVal">4px</span></div><div class="row"><label>지우개</label><input id="eRange" type="range" min="6" max="30" step="2" value="14"><span id="eVal">14px</span></div>\`; document.body.appendChild(sheetWidth);
    const pager=document.createElement('div'); pager.id='pager'; pager.innerHTML=\`<span id="ptext">1/?</span>\`; document.body.appendChild(pager); ptext=document.getElementById('ptext');
    document.getElementById('paletteBtn').onclick=()=>{ sheetWidth.classList.remove('show'); sheetColor.classList.toggle('show'); };
    document.getElementById('widthBtn').onclick  =()=>{ sheetColor.classList.remove('show'); sheetWidth.classList.toggle('show'); };
    sheetColor.addEventListener('click',(e)=>{ const d=e.target.closest('.dot'); if(d) setColor(d.dataset.c); });
    sheetWidth.querySelector('#wRange').oninput=(e)=>{ setWidth(parseInt(e.target.value,10)); sheetWidth.querySelector('#wVal').textContent=width+'px'; };
    sheetWidth.querySelector('#eRange').oninput=(e)=>{ setEraser(parseInt(e.target.value,10)); sheetWidth.querySelector('#eVal').textContent=eraser+'px'; };

    syncToolbar();
    post('READY',{ok:true});
    window.addEventListener('resize', ()=> { if(pdf) renderPage(page); }, {passive:true});
  });
<\/script>
</head>
<body></body>
</html>`;