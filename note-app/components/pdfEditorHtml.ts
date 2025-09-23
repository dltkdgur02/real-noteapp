export const EDITOR_HTML = `<!doctype html>
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
  .btn{
    height:var(--btn); min-width:var(--btn); display:inline-flex; align-items:center; justify-content:center;
    padding:0 6px; border:0; border-radius:8px; background:transparent; color:var(--fg);
  }
  .btn.icon{width:var(--btn); padding:0;}
  .btn.icon svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
  .btn.active{background:rgba(255,255,255,.22);}
  .btn:hover{background:rgba(255,255,255,.12);}

  /* 색상 점 */
  .dot{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.6);display:inline-block}
  .dot[data-c="#111111"]{background:#111111}
  .dot[data-c="#ef4444"]{background:#ef4444}
  .dot[data-c="#22c55e"]{background:#22c55e}
  .dot[data-c="#3b82f6"]{background:#3b82f6}
  .dot[data-c="#facc15"]{background:#facc15}
  .dot[data-c="#a855f7"]{background:#a855f7}
  .dot.active{outline:2px solid #fff; outline-offset:1px}

  /* 팝오버(작은 모달 시트) */
  .sheet{
    position:fixed; top:calc(var(--bar-h) + 6px); right:8px; z-index:40;
    background:#fff; color:#111; border-radius:12px; border:1px solid #e5e7eb; padding:10px;
    box-shadow:0 12px 28px rgba(0,0,0,.2); display:none; min-width:200px;
  }
  .sheet.show{display:block;}
  .sheet .row{gap:8px}
  .sheet label{font:600 12px -apple-system,system-ui; color:#334155; width:56px}
  .sheet input[type="range"]{width:140px}

  /* PDF 영역 */
  #stage{
    position:absolute; left:0; right:0; top:var(--bar-h); bottom:0;
    overflow:auto; -webkit-overflow-scrolling:touch; background:#fff;
  }
  #wrap{position:relative; margin:0 auto;}
  #pdf,#ink{position:absolute; top:0; left:0;}
  #pdf{z-index:1;}
  #ink{z-index:2;}

  /* 스크롤/필기 분리 */
  #ink{touch-action:pan-y;}
  .inking #ink{touch-action:none;}
  .inking #stage{overflow:hidden !important;}

  /* 페이지 표시 */
  #pager{ position:fixed; left:50%; bottom:8px; transform:translateX(-50%);
    background:rgba(255,255,255,.93); border:1px solid #e5e7eb; border-radius:999px;
    padding:4px 10px; font:600 12px -apple-system,system-ui; color:#111; box-shadow:0 4px 16px rgba(0,0,0,.08); z-index:15; }

  /* 로딩 레이어 */
  #loading{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#64748b; font:12px -apple-system,system-ui}

  /* ===== 텍스트 박스 ===== */
  .textbox{
    position:absolute;
    min-width:80px; min-height:32px; max-width:90%;
    padding:6px 8px;
    border:1px dashed rgba(255,255,255,.4);
    border-radius:6px;
    background:rgba(0,0,0,.35);
    color:#fff;
    font-size:14px; line-height:1.35;
    outline:none;
    user-select:text; -webkit-user-select:text;
    touch-action:none;
    z-index:3;
  }
  .textbox[contenteditable="true"] { cursor:text; }
  .textbox.dragging { opacity:.85; border-style:solid; }
  .textbox .resize{
    position:absolute; width:12px; height:12px;
    right:-6px; bottom:-6px; border-radius:2px;
    background:rgba(255,255,255,.9); border:1px solid rgba(0,0,0,.35);
    cursor:se-resize;
  }
  .textbox.selected{
    box-shadow:0 0 0 2px rgba(80,180,255,.9);
    border-color:rgba(80,180,255,.9);
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  const RN=window.ReactNativeWebView, post=(t,x={})=>RN.postMessage(JSON.stringify({type:t,...x}));
  pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  let pdf, page=1, pages=1, rendering=false;
  let mode='pen', color='#111111', width=4, eraser=14;
  const strokes={}, undo={}, redo={}; const S=(m,k)=> (m[k]??=([]));
  let stage, wrap, cv, ctx, ink, inkx, loading, ptext;
  let sheetColor, sheetWidth, sheetText;

  /* ===== 텍스트 박스 상태 ===== */
  let textColor = '#ffffff';
  let textSize  = 14;
  let dragState = null;
  let resizeState = null;

  /* ===== LocalStorage Keys ===== */
  const DOC_KEY = (document.title || '__DOC__');
  const LS_PREFIX = 'annot_textboxes_v1:' + DOC_KEY + ':';
  const LS_STROKES_PREFIX = 'annot_strokes_v1:' + DOC_KEY + ':';
  const tk = (n)=> LS_PREFIX + 'p' + String(n);
  const sk = (n)=> LS_STROKES_PREFIX + 'p' + String(n);

  function fitScale(pg){
    const pad = 24;
    const containerW = Math.max(320, stage.clientWidth - pad);
    const vp1 = pg.getViewport({scale:1});
    const cssScale = containerW / vp1.width;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2));
    return { cssScale, pixelScale: cssScale * dpr };
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
      wrap.dataset.page = String(n);

      await pg.render({ canvasContext: ctx, viewport: vpPix, transform: [1,0,0,1,0,0] }).promise;

      /* 복원: strokes -> redraw -> 텍스트 박스 */
      loadStrokes(n);
      redraw(n);
      restoreTextboxesForPage(n);

      ptext.textContent = n + '/' + pages;
    } finally { rendering=false; loading.style.display='none'; }
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

  /* ===== Base64 → PDF 열기 ===== */
  function b64ToU8(b64){
    const ch=32768, chunks=[]; for(let i=0;i<b64.length;i+=ch){
      const bin=atob(b64.slice(i,i+ch)); const u=new Uint8Array(bin.length);
      for(let j=0;j<bin.length;j++) u[j]=bin.charCodeAt(j); chunks.push(u);
    }
    let len=0; chunks.forEach(u=>len+=u.length); const out=new Uint8Array(len);
    let off=0; chunks.forEach(u=>{ out.set(u,off); off+=u.length; }); return out;
  }
  async function openBase64(b64){
    const u8=b64ToU8(b64);
    const task=pdfjsLib.getDocument({data:u8});
    pdf=await task.promise; page=1; pages=pdf.numPages||1;
    await new Promise(r=>requestAnimationFrame(r));
    renderPage(page);
  }

  /* ====== 가로 스와이프 → 페이지 이동 (자동 저장 통합) ====== */
  let swipeState = { startX:0, startY:0, dx:0, dy:0, t0:0, active:false };
  let swipeLock = false;
  const SWIPE_MIN = 50;
  const SWIPE_MAX_TIME = 600;
  const SWIPE_DIR_RATIO = 1.5;

  function onTouchStart(e){
    if (rendering) return;
    if (e.touches.length !== 1) return;
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
    const { dx, dy } = swipeState;
    swipeState.active = false;
    if (swipeLock || rendering) return;

    const isHorizontal = Math.abs(dx) > Math.abs(dy) * SWIPE_DIR_RATIO;
    const farEnough   = Math.abs(dx) >= SWIPE_MIN;
    const fastEnough  = dt <= SWIPE_MAX_TIME;

    if (isHorizontal && farEnough && fastEnough){
      swipeLock = true;
      if (dx < 0 && page < pages){ gotoPage(page+1); }
      else if (dx > 0 && page > 1){ gotoPage(page-1); }
      setTimeout(()=>{ swipeLock=false; }, 350);
    }
  }

  /* ===== 입력 (펜만 필기) ===== */
  let drawing=false, cur=null, erasePath=[], pending=null;
  const isPen = (e)=> e.pointerType==='pen';
  const isTouch = (e)=> e.pointerType==='touch';
  function xy(ev){
    const r=ink.getBoundingClientRect();
    const cx = ev.clientX ?? (ev.pageX - window.scrollX);
    const cy = ev.clientY ?? (ev.pageY - window.scrollY);
    return { x:(cx-r.left)*(ink.width/r.width), y:(cy-r.top)*(ink.height/r.height) };
  }

  function begin(e){
    if(isTouch(e)) return;
    if(!isPen(e) || rendering) return;
    if(mode==='text') return; // 텍스트 모드에서는 펜 입력 차단
    e.preventDefault();
    document.body.classList.add('inking');
    ink.setPointerCapture(e.pointerId);
    drawing=true;

    if(mode==='eraser'){ erasePath=[xy(e)]; return; }
    cur={tool:(mode==='hl'?'hl':'pen'), color, width, page, points:[]};
    addPoint(e);
  }
  function addPoint(e){
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for(const ev of pts){
      const p=xy(ev);
      const arr=cur.points, last=arr[arr.length-1];
      const dx= last?(p.x-last.x):0, dy= last?(p.y-last.y):0;
      if(!last || (dx*dx+dy*dy)>1.2){ arr.push(p); }
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
  function end(e){
    if(isTouch(e)) return;
    if(!drawing) return;
    e.preventDefault();
    drawing=false;
    document.body.classList.remove('inking');
    if(mode==='eraser'){ applyErase(erasePath); erasePath=[]; return; }
    if(cur && cur.points.length>=2){
      S(strokes,page).push(cur);
      saveStrokes(page); // 자동 저장
    }
    cur=null;
  }

  function d2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
  function applyErase(path){
    const arr=S(strokes,page), r2=eraser*eraser, keep=[];
    outer: for(const s of arr){
      for(const sp of s.points){ for(const ep of path){ if(d2(sp,ep)<=r2) continue outer; } }
      keep.push(s);
    }
    strokes[page]=keep; redraw(page); saveStrokes(page);
  }

  /* ===== 텍스트 박스 유틸 (자동 저장 포함) ===== */
  function pageXY(ev){
    const r = wrap.getBoundingClientRect();
    const cx = (ev.clientX ?? (ev.touches?.[0]?.clientX || 0)) - r.left + wrap.scrollLeft;
    const cy = (ev.clientY ?? (ev.touches?.[0]?.clientY || 0)) - r.top  + wrap.scrollTop;
    return { x: cx, y: cy };
  }

  function selectBox(box){
    document.querySelectorAll('.textbox.selected').forEach(el=>el.classList.remove('selected'));
    box.classList.add('selected');
  }
  function isEditing(box){ return box.contentEditable === 'true'; }
  function setEditing(box, on){
    box.contentEditable = on ? 'true' : 'false';
    if(on){
      box.focus();
      const range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // 텍스트 박스 저장: 현재 wrap 크기도 함께 저장하여 복원 시 비율 스케일링
  function persistPage(n){
    try{
      const W = wrap.clientWidth, H = wrap.clientHeight;
      const arr=[];
      wrap.querySelectorAll('.textbox').forEach(box=>{
        arr.push({
          left: parseFloat(box.style.left)||0,
          top:  parseFloat(box.style.top)||0,
          width: parseFloat(box.style.width)||box.offsetWidth,
          height: parseFloat(box.style.height)||box.offsetHeight,
          color: box.style.color || '#fff',
          fontSize: parseInt(box.style.fontSize||'14',10),
          html: box.innerHTML
        });
      });
      localStorage.setItem(tk(n), JSON.stringify({W,H,items:arr}));
    }catch{}
  }

  function clearTextboxes(){
    wrap.querySelectorAll('.textbox').forEach(n=>n.remove());
  }

  function restoreTextboxesForPage(n){
    clearTextboxes();
    const raw = localStorage.getItem(tk(n));
    if(!raw) return;
    let data; try{ data = JSON.parse(raw); }catch{ return; }
    const items = Array.isArray(data?.items) ? data.items : [];
    const W0 = data?.W||wrap.clientWidth, H0=data?.H||wrap.clientHeight;
    const sx = (wrap.clientWidth / (W0||1));
    const sy = (wrap.clientHeight / (H0||1));
    items.forEach(item=>{
      const box = createTextbox(item.left*sx, item.top*sy, {
        width:  (item.width*sx),
        height: (item.height*sy),
        color:  item.color,
        fontSize: Math.max(10, Math.round(item.fontSize* ((sx+sy)/2) )),
        html:   item.html
      });
      setEditing(box,false);
    });
  }

  function createTextbox(x, y, opts={}){
    const box = document.createElement('div');
    box.className='textbox';
    box.contentEditable='false';
    box.style.left = Math.max(4, x - 40) + 'px';
    box.style.top  = Math.max(4, y - 16) + 'px';
    box.style.width  = (opts.width  || 160) + 'px';
    box.style.height = (opts.height || 40)  + 'px';
    box.style.color = opts.color || textColor;
    box.style.fontSize = (opts.fontSize || textSize) + 'px';
    box.innerHTML = opts.html || '텍스트 입력';

    const handle = document.createElement('div');
    handle.className='resize';
    box.appendChild(handle);

    // 선택/더블탭 편집
    let lastTap=0;
    box.addEventListener('click',(e)=>{
      const now=Date.now();
      if(now - lastTap < 300){ setEditing(box,true); }
      lastTap=now;
      selectBox(box);
      e.stopPropagation();
    });

    // 드래그 이동
    box.addEventListener('pointerdown', (e)=>{
      if(e.target===handle) return;
      dragState = {
        box, startX:e.clientX, startY:e.clientY,
        origLeft: parseFloat(box.style.left)||0,
        origTop:  parseFloat(box.style.top)||0
      };
      box.setPointerCapture(e.pointerId);
      box.classList.add('dragging');
    });
    box.addEventListener('pointermove',(e)=>{
      if(!dragState || dragState.box!==box) return;
      const dx=e.clientX - dragState.startX;
      const dy=e.clientY - dragState.startY;
      box.style.left = Math.max(0, dragState.origLeft + dx) + 'px';
      box.style.top  = Math.max(0, dragState.origTop  + dy) + 'px';
    });
    box.addEventListener('pointerup',(e)=>{
      if(dragState?.box===box){
        box.releasePointerCapture(e.pointerId);
        box.classList.remove('dragging');
        dragState=null;
        persistPage(page);
      }
    });

    // 리사이즈
    handle.addEventListener('pointerdown',(e)=>{
      e.stopPropagation();
      resizeState = {
        box, startX:e.clientX, startY:e.clientY,
        origW: parseFloat(box.style.width)||box.offsetWidth,
        origH: parseFloat(box.style.height)||box.offsetHeight
      };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove',(e)=>{
      if(!resizeState || resizeState.box!==box) return;
      const dx=e.clientX - resizeState.startX;
      const dy=e.clientY - resizeState.startY;
      const w = Math.max(80, resizeState.origW + dx);
      const h = Math.max(32, resizeState.origH + dy);
      box.style.width = w + 'px';
      box.style.height= h + 'px';
    });
    handle.addEventListener('pointerup',(e)=>{
      if(resizeState?.box===box){
        handle.releasePointerCapture(e.pointerId);
        resizeState=null;
        persistPage(page);
      }
    });

    // 포커스 아웃 → 저장
    box.addEventListener('blur', ()=>{
      if(isEditing(box)){
        setEditing(box,false);
        persistPage(page);
      }
    }, true);

    // 삭제: 선택 상태에서 백스페이스/딜리트 (편집 중이 아닐 때)
    box.addEventListener('keydown',(e)=>{
      if(e.key==='Escape'){ setEditing(box,false); }
      if((e.key==='Backspace' || e.key==='Delete') && !isEditing(box)){
        box.remove();
        persistPage(page);
      }
    });

    wrap.appendChild(box);
    selectBox(box);
    return box;
  }

  function onWrapClick(ev){
    if(mode!=='text') return;
    if(ev.target.closest('.textbox')) return;
    const {x,y} = pageXY(ev);
    const box = createTextbox(x,y,{ color:textColor, fontSize:textSize, html:'텍스트 입력' });
    setTimeout(()=> setEditing(box,true), 0);
    persistPage(page);
  }

  /* ===== Strokes 저장/복원(해상도 보정 포함) ===== */
  function saveStrokes(n){
    try{
      const W = ink.width, H = ink.height;
      const arr = (S(strokes,n)||[]).map(s => ({
        tool: s.tool, color: s.color, width: s.width,
        points: s.points, canvasW: W, canvasH: H
      }));
      localStorage.setItem(sk(n), JSON.stringify({W,H,items:arr}));
    }catch{}
  }

  function loadStrokes(n){
    const raw = localStorage.getItem(sk(n));
    S(strokes,n).length = 0; // reset in-memory
    if(!raw) return;
    let data; try{ data = JSON.parse(raw); }catch{ return; }
    const W0 = data?.W || ink.width, H0 = data?.H || ink.height;
    const sx = ink.width / (W0||1);
    const sy = ink.height / (H0||1);
    const sItems = Array.isArray(data?.items) ? data.items : [];
    for(const s of sItems){
      const pts = (s.points||[]).map(p => ({ x: p.x*sx, y: p.y*sy }));
      const wScaled = Math.max(1, s.width * ((sx+sy)/2));
      S(strokes,n).push({ tool:s.tool, color:s.color, width:wScaled, page:n, points:pts });
    }
  }

  /* ===== 공용 메시지/버튼 ===== */
  function onMsg(ev){
    let d=ev.data; try{ if(typeof d==='string') d=JSON.parse(d);}catch(_){}
    if(!d||!d.type) return;
    if(d.type==='LOAD_PDF') openBase64(d.payload?.base64||'');
    if(d.type==='PING') post('READY',{ok:true});
    if(d.type==='SAVE_ANN'){
      const all=[]; Object.keys(strokes).forEach(k=>{ const p=parseInt(k,10); (strokes[p]||[]).forEach(s=>all.push(s)); }); 
      post('ANN_SNAPSHOT',{items:all});
    }
    if(d.type==='PREV' && !rendering && page>1){ gotoPage(page-1); }
    if(d.type==='NEXT' && !rendering && page<pages){ gotoPage(page+1); }
    if(d.type==='UNDO'){
      const u=S(undo,page);
      if(u.length){
        const curCopy=JSON.parse(JSON.stringify(S(strokes,page)));
        S(redo,page).push(curCopy);
        strokes[page]=u.pop();
        redraw(page); saveStrokes(page);
      }
    }
    if(d.type==='REDO'){
      const r=S(redo,page);
      if(r.length){
        const curCopy=JSON.parse(JSON.stringify(S(strokes,page)));
        S(undo,page).push(curCopy);
        strokes[page]=r.pop();
        redraw(page); saveStrokes(page);
      }
    }
    if(d.type==='CLEAR'){
      const u=S(undo,page);
      u.push(JSON.parse(JSON.stringify(S(strokes,page))));
      strokes[page]=[]; redraw(page); saveStrokes(page);
    }
    if(d.type==='SET_MODE'){ setMode(d.payload?.mode||'pen'); }
    if(d.type==='SET_COLOR'){ setColor(d.payload?.color||'#111111'); }
    if(d.type==='SET_WIDTH'){ setWidth(d.payload?.width||4); }
    if(d.type==='SET_ERASER_RADIUS'){ setEraser(d.payload?.eraserRadius||14); }
    if(d.type==='BACK'){ post('BACK'); }
    if(d.type==='EXTRACT_TEXT'){ /* AI 제거됨: 무시 */ }
    if(d.type==='SET_TEXT_STYLE'){
      const p=d.payload||{};
      if(typeof p.color==='string') textColor=p.color;
      if(typeof p.fontSize==='number') textSize=p.fontSize|0;
      syncToolbar();
    }
    if(d.type==='EXPORT_TEXTBOXES'){
      const out=[]; wrap.querySelectorAll('.textbox').forEach(box=>{
        out.push({
          page,
          left: parseFloat(box.style.left)||0,
          top:  parseFloat(box.style.top)||0,
          width: parseFloat(box.style.width)||box.offsetWidth,
          height: parseFloat(box.style.height)||box.offsetHeight,
          color: box.style.color||'#fff',
          fontSize: parseInt(box.style.fontSize||'14',10),
          html: box.innerHTML
        });
      });
      post('TEXTBOXES',{payload:out});
    }
    if(d.type==='IMPORT_TEXTBOXES'){
      try{
        const list = Array.isArray(d.payload) ? d.payload : [];
        const cur = list.filter(it=> (it.page||page)===page).map(it=>{
          return {left:it.left, top:it.top, width:it.width, height:it.height, color:it.color, fontSize:it.fontSize, html:it.html};
        });
        localStorage.setItem(tk(page), JSON.stringify({W:wrap.clientWidth,H:wrap.clientHeight,items:cur}));
        restoreTextboxesForPage(page);
      }catch{}
    }
  }

  function setMode(m){ mode=m; syncToolbar(); }
  function setColor(c){ color=c; syncToolbar(); }
  function setWidth(w){ width=w; syncToolbar(); }
  function setEraser(r){ eraser=r; syncToolbar(); }

  /* ===== 페이지 이동 헬퍼(자동 저장 포함) ===== */
  function persistCurrentPage(){
    persistPage(page);
    saveStrokes(page);
  }
  function gotoPage(n){
    if(n===page) return;
    persistCurrentPage();
    page = n;
    renderPage(page);
  }

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
          <!-- 텍스트 도구 -->
          <button class="btn icon" data-mode="text" id="textTool" title="텍스트">
            <svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M12 6v12"/></svg>
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
          <!-- 텍스트 스타일 버튼 -->
          <button class="btn icon" id="textBtn" title="텍스트 스타일">
            <svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M12 6v12"/></svg>
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

    /* 텍스트 스타일 시트 */
    sheetText=document.createElement('div'); sheetText.className='sheet'; sheetText.innerHTML=\`
      <div class="row">
        <label>색상</label>
        <input id="tColor" type="color" value="\${textColor}">
      </div>
      <div class="row" style="margin-top:8px;">
        <label>크기</label>
        <input id="tSize" type="range" min="10" max="48" step="1" value="\${textSize}">
        <span id="tSizeVal">\${textSize}px</span>
      </div>
    \`;
    document.body.appendChild(sheetText);

    const pager=document.createElement('div'); pager.id='pager'; pager.innerHTML=\`<span id="ptext">1/?</span>\`;
    document.body.appendChild(pager); ptext=document.getElementById('ptext');

    stage=document.createElement('div'); stage.id='stage'; document.body.appendChild(stage);
    wrap=document.createElement('div'); wrap.id='wrap'; stage.appendChild(wrap);
    cv=document.createElement('canvas'); cv.id='pdf'; wrap.appendChild(cv);
    ink=document.createElement('canvas'); ink.id='ink'; wrap.appendChild(ink);
    loading=document.createElement('div'); loading.id='loading'; loading.textContent='불러오는 중…'; wrap.appendChild(loading);
    ctx=cv.getContext('2d',{willReadFrequently:true});
    inkx=ink.getContext('2d',{willReadFrequently:true});

    /* 펜/포인터 이벤트 */
    ink.addEventListener('pointerdown', begin, {passive:false});
    ink.addEventListener('pointermove',  move,  {passive:false});
    ink.addEventListener('pointerup',    end,   {passive:false});
    ink.addEventListener('pointercancel',end,   {passive:false});

    /* 텍스트 박스 생성 클릭은 wrap에 */
    wrap.addEventListener('click', onWrapClick, {passive:true});

    /* 손가락 스와이프 이벤트 */
    stage.addEventListener('touchstart', onTouchStart, {passive:true});
    stage.addEventListener('touchmove',  onTouchMove,  {passive:false});
    stage.addEventListener('touchend',   onTouchEnd,   {passive:true});
    stage.addEventListener('touchcancel',()=>{ swipeState.active=false; }, {passive:true});

    /* 버튼 핸들러 (페이지 이동도 자동 저장 포함) */
    document.getElementById('back').onclick =()=> { persistCurrentPage(); post('BACK'); };
    document.getElementById('prev').onclick =()=>{ if(!rendering && page>1){ gotoPage(page-1);} };
    document.getElementById('next').onclick =()=>{ if(!rendering && page<pages){ gotoPage(page+1);} };
    document.getElementById('undo').onclick =()=>{ const u=S(undo,page); if(u.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(redo,page).push(cur); strokes[page]=u.pop(); redraw(page); saveStrokes(page);} };
    document.getElementById('redo').onclick =()=>{ const r=S(redo,page); if(r.length){ const cur=JSON.parse(JSON.stringify(S(strokes,page))); S(undo,page).push(cur); strokes[page]=r.pop(); redraw(page); saveStrokes(page);} };
    document.getElementById('save').onclick =()=>{ persistCurrentPage(); const all=[]; Object.keys(strokes).forEach(k=>{ const p=parseInt(k,10); (strokes[p]||[]).forEach(s=>all.push(s)); }); post('ANN_SNAPSHOT',{items:all}); };
    document.getElementById('paletteBtn').onclick=()=>{ sheetWidth.classList.remove('show'); sheetText.classList.remove('show'); sheetColor.classList.toggle('show'); };
    document.getElementById('widthBtn').onclick  =()=>{ sheetColor.classList.remove('show'); sheetText.classList.remove('show'); sheetWidth.classList.toggle('show'); };
    document.getElementById('textBtn').onclick   =()=>{ sheetColor.classList.remove('show'); sheetWidth.classList.remove('show'); sheetText.classList.toggle('show'); };

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

    // 텍스트 스타일 핸들러
    const tColor=sheetText.querySelector('#tColor');
    const tSize =sheetText.querySelector('#tSize');
    const tSizeVal=sheetText.querySelector('#tSizeVal');
    tColor.oninput=(e)=>{ textColor = e.target.value; syncToolbar(); };
    tSize.oninput =(e)=>{ textSize  = parseInt(e.target.value,10); tSizeVal.textContent = textSize+'px'; syncToolbar(); };

    document.getElementById('tools').addEventListener('click',(e)=>{
      const t=e.target.closest('[data-mode]'); if(!t) return;
      setMode(t.dataset.mode);
    });

    syncToolbar();
    post('READY',{ok:true});
    // 리사이즈 시에도 현재 페이지 저장 후 재렌더 → 비율 복원
    window.addEventListener('resize', ()=>{
      if(!pdf) return;
      persistCurrentPage();
      renderPage(page);
    }, {passive:true});
  });

  function syncToolbar(){
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    document.querySelectorAll('.dot').forEach(d=>d.classList.toggle('active', d.dataset.c===color));
    const wVal=document.getElementById('wVal'), eVal=document.getElementById('eVal');
    if(wVal) wVal.textContent = width+'px';
    if(eVal) eVal.textContent = eraser+'px';
    const tSizeVal=document.getElementById('tSizeVal');
    if(tSizeVal) tSizeVal.textContent = textSize+'px';
    const tColor=document.getElementById('tColor');
    if(tColor && tColor.value!==textColor) tColor.value=textColor;
    const tSize=document.getElementById('tSize');
    if(tSize && parseInt(tSize.value,10)!==textSize) tSize.value=String(textSize);
  }
</script>
</head>
<body></body>
</html>`;
