import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, BookOpenText, Check, ChevronDown, ChevronRight,
  CircleHelp, Copy, Crosshair, Download, FileCode2, FileJson2, FileText, FolderOpen,
  Image as ImageIcon, Layers3, Maximize, MousePointer2, Paintbrush, PenLine, Plus, RotateCcw,
  Save, ScanLine, Search, ShieldCheck, Sparkles, Tag, Trash2, Upload, WandSparkles, X,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import { demoImage, demoMap, groupLabels } from './data/demo';
import { parseCharacterMarkdown, toCharacterMarkdown, validateMap, normalizePoint } from './lib/character-map';
import { ACTIONS, makeEditPrompt, makeEditRequest, makeMappingPrompt } from './lib/ai-prompts';
import { copyText, downloadBlob, downloadText, exportMaskPng, loadImage } from './lib/download';
import type { CharacterMap, CharacterPart, EditAction, Point } from './lib/types';

type WorkTab = 'inspect' | 'tag' | 'ai' | 'docs';
type HistoryItem = { map: CharacterMap; imageUrl: string; imageSize: { width: number; height: number }; docsText: string; version: number };

const starter = () => structuredClone(demoMap);
const basename = (name: string) => name.replace(/\.[^/.]+$/, '').replace(/[^a-z\d_-]+/gi, '_').toLowerCase();
const pointString = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');
const emptyMap = (width: number, height: number, name = 'New Character'): CharacterMap => ({
  schema_version: '1.0', coordinate_system: 'normalized_1000',
  character: { id: basename(name), name, style: 'Hand-painted fantasy chibi RPG character', view: 'Front / South', identity_notes: 'Fill using the AI template and review against the master image.' },
  image: { width, height }, parts: [],
});

function Label({ children }: { children: React.ReactNode }) { return <div className="field-label">{children}</div>; }

function App() {
  const [map, setMap] = useState<CharacterMap>(starter);
  const [imageUrl, setImageUrl] = useState(demoImage);
  const [imageSize, setImageSize] = useState({ width: 1024, height: 1536 });
  const [docsText, setDocsText] = useState(() => toCharacterMarkdown(demoMap));
  const [documentFilename, setDocumentFilename] = useState('novice_female_character_map.md');
  const [selectedIds, setSelectedIds] = useState<string[]>(['boot_character_left']);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkTab>('inspect');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [showOutlines, setShowOutlines] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [dragVertex, setDragVertex] = useState<{ id: string; polygon: number; vertex: number } | null>(null);
  const [action, setAction] = useState<EditAction>('REPLACE_ITEM');
  const [instruction, setInstruction] = useState('เปลี่ยนรองเท้าบูตหนังเป็นรองเท้าเกราะผลึกเพชรสีเงินและฟ้า มีเหลี่ยมผลึกสะท้อนแสง แต่คงตำแหน่งเท้าและสัดส่วน');
  const [expandGeometry, setExpandGeometry] = useState(true);
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null);
  const [compare, setCompare] = useState(50);
  const [version, setVersion] = useState(1);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState('');
  const [docOpen, setDocOpen] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const mdInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const candidateInput = useRef<HTMLInputElement>(null);
  const overlay = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const count = map.parts.length;
  const activePart = map.parts.find(p => p.id === selectedIds.at(-1)) ?? null;
  const selectedParts = map.parts.filter(p => selectedIds.includes(p.id));
  const canEditWithRegions = selectedParts.length > 0 && selectedParts.every(p => p.polygons.some(poly => poly.length >= 3));
  const groups = useMemo(() => [...new Set(map.parts.map(p => p.group))], [map.parts]);
  const sortedRegions = useMemo(() => [...map.parts].sort((a, b) => a.z_index - b.z_index), [map.parts]);
  const selectedPairs = activePart?.pair_key ? map.parts.filter(p => p.pair_key === activePart.pair_key) : [];
  const request = useMemo(() => makeEditRequest(map, selectedIds, action, instruction, expandGeometry), [map, selectedIds, action, instruction, expandGeometry]);
  const prompt = useMemo(() => makeEditPrompt(map, request), [map, request]);
  const mismatchedDimensions = map.image.width !== imageSize.width || map.image.height !== imageSize.height;

  const notify = (message: string) => setToast(message);

  const selectPart = (id: string, multi = false) => {
    if (multi) setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    else setSelectedIds([id]);
  };

  const updatePart = (id: string, changes: Partial<CharacterPart>) => {
    setMap(prev => ({ ...prev, parts: prev.parts.map(p => p.id === id ? { ...p, ...changes } : p) }));
  };

  const resetDemo = () => {
    setMap(starter());
    setImageUrl(demoImage);
    setImageSize({ width: 1024, height: 1536 });
    setDocsText(toCharacterMarkdown(demoMap));
    setDocumentFilename('novice_female_character_map.md');
    setSelectedIds(['boot_character_left']);
    setCandidateUrl(null);
    setDrawing(false);
    setHistory([]);
    setVersion(1);
    setZoom(1);
    notify('โหลด Novice Female Demo พร้อม Tag ตัวอย่างแล้ว');
  };

  const importImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('กรุณาเลือกไฟล์ภาพ PNG/JPG/WebP'); return; }
    const url = URL.createObjectURL(file);
    try {
      const size = await loadImage(url);
      setImageUrl(url);
      setImageSize(size);
      setMap(emptyMap(size.width, size.height, basename(file.name)));
      setSelectedIds([]);
      setDocsText('');
      setDocumentFilename('');
      setCandidateUrl(null);
      setHistory([]);
      setVersion(1);
      setZoom(1);
      setTab('inspect');
      notify(`นำเข้าภาพ ${file.name} สำเร็จ — ตอนนี้รอ MD ที่มี Character Map`);
    } catch (error) { URL.revokeObjectURL(url); notify(error instanceof Error ? error.message : 'เปิดไฟล์ไม่ได้'); }
  };

  const importMd = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    setDocsText(text);
    setDocumentFilename(file.name);
    try {
      const parsed = parseCharacterMarkdown(text);
      setMap(parsed);
      setSelectedIds(parsed.parts.length ? [parsed.parts[0].id] : []);
      setDrawing(false);
      setTab('inspect');
      notify(`ประมวลผล MD แล้ว พบ ${parsed.parts.length} ส่วน — ตรวจ Outline บนรูปอีกครั้ง`);
    } catch (error) {
      setMap(prev => ({ ...prev, parts: [] }));
      setSelectedIds([]);
      setTab('docs');
      notify(error instanceof Error ? error.message : 'MD ยังไม่มีข้อมูลขอบเขต');
    }
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = validateMap(JSON.parse(await file.text()));
      setMap(parsed);
      setSelectedIds(parsed.parts.length ? [parsed.parts[0].id] : []);
      setDocsText(toCharacterMarkdown(parsed));
      setDocumentFilename(file.name);
      notify(`อ่าน JSON สำเร็จ: ${parsed.parts.length} Tag`);
    } catch (error) { notify(error instanceof Error ? error.message : 'ไฟล์ JSON ไม่ถูกต้อง'); }
  };

  const importCandidate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('ต้องเป็นไฟล์รูป'); return; }
    const url = URL.createObjectURL(file);
    try {
      const size = await loadImage(url);
      if (size.width !== imageSize.width || size.height !== imageSize.height) {
        URL.revokeObjectURL(url);
        notify(`ภาพใหม่มีขนาด ${size.width}×${size.height} แต่ต้นฉบับ ${imageSize.width}×${imageSize.height} — ต้องมีขนาดเท่ากัน`);
        return;
      }
      setCandidateUrl(url);
      setCompare(50);
      notify('โหลดภาพผลลัพธ์แล้ว — เลื่อน Compare เพื่อเทียบก่อน/หลัง');
    } catch { URL.revokeObjectURL(url); notify('อ่านภาพผลลัพธ์ไม่ได้'); }
  };

  const downloadMap = () => {
    downloadText(`${map.character.id || 'character'}_map.md`, toCharacterMarkdown(map), 'text/markdown;charset=utf-8');
    notify('Export MD พร้อม Character Map เรียบร้อย');
  };

  const exportJson = () => {
    downloadText(`${map.character.id || 'character'}_map.json`, JSON.stringify(map, null, 2), 'application/json;charset=utf-8');
    notify('Export JSON สำเร็จ');
  };

  const exportMask = async () => {
    if (!canEditWithRegions) { notify('ทุก Part ที่เลือกต้องมี Polygon ก่อนสร้าง Mask'); return; }
    try {
      const blob = await exportMaskPng(selectedParts, imageSize.width, imageSize.height, expandGeometry ? 14 : 0);
      downloadBlob('selection_mask.png', blob);
      notify('Export selection_mask.png แล้ว (พื้นที่ขาวคือส่วนที่เลือก)');
    } catch (error) { notify(error instanceof Error ? error.message : 'สร้าง Mask ไม่สำเร็จ'); }
  };

  const applyCandidate = () => {
    if (!candidateUrl) return;
    setHistory(prev => [...prev, { map: structuredClone(map), imageUrl, imageSize, docsText, version }]);
    setImageUrl(candidateUrl);
    setCandidateUrl(null);
    setVersion(prev => prev + 1);
    setMap(prev => ({ ...prev, parts: prev.parts.map(p => ({ ...p, review_status: 'unreviewed' })) }));
    setTab('tag');
    notify('รับภาพเป็นเวอร์ชันใหม่แล้ว — ควรอัปเดต Polygon / สี / MD ให้ตรงภาพใหม่');
  };

  const undoVersion = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setImageUrl(previous.imageUrl);
    setImageSize(previous.imageSize);
    setMap(previous.map);
    setDocsText(previous.docsText);
    setVersion(previous.version);
    setHistory(prev => prev.slice(0, -1));
    setCandidateUrl(null);
    notify(`ย้อนกลับเป็นเวอร์ชัน ${previous.version}`);
  };

  const downloadTemplate = () => {
    const anchor = document.createElement('a');
    anchor.href = `${import.meta.env.BASE_URL}templates/AI_CHARACTER_MAPPING_TEMPLATE.md`;
    anchor.download = 'AI_CHARACTER_MAPPING_TEMPLATE.md';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  const addPart = () => {
    const id = `custom_part_${Date.now().toString(36)}`;
    const fresh: CharacterPart = {
      id, name_th: 'ส่วนใหม่', name_en: 'New custom part', group: 'Custom', side: 'center',
      material: 'Unknown', colors: [{ role: 'base', hex: '#9A7968' }], technique: '', notes: '',
      polygons: [], z_index: 120, locked: false, allow_geometry_change: true, review_status: 'unreviewed',
    };
    setMap(prev => ({ ...prev, parts: [...prev.parts, fresh] }));
    setSelectedIds([id]);
    setTab('tag');
    setDrawing(true);
    setDrawPoints([]);
    notify('เพิ่ม Tag แล้ว — คลิกจุดรอบชิ้นส่วนบนรูปอย่างน้อย 3 จุด แล้วกด “จบ Polygon”');
  };

  const startDraw = () => {
    if (!activePart) { notify('เลือก Part ที่ต้องการวาดก่อน'); return; }
    setDrawPoints([]);
    setDrawing(true);
    setTab('tag');
  };

  const finishDraw = () => {
    if (!activePart) return;
    if (drawPoints.length < 3) { notify('Polygon ต้องมีอย่างน้อย 3 จุด'); return; }
    updatePart(activePart.id, { polygons: [drawPoints], review_status: 'manual_reviewed' });
    setDrawing(false);
    setDrawPoints([]);
    notify('บันทึก Polygon แล้ว — ลากจุดสีขาวเพื่อปรับขอบเขตละเอียด');
  };

  const toNormalized = (clientX: number, clientY: number): Point => {
    const rect = overlay.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return [0, 0];
    return normalizePoint([(clientX - rect.left) / rect.width * 1000, (clientY - rect.top) / rect.height * 1000]);
  };

  const onSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    if (drawing && event.detail <= 1) setDrawPoints(prev => [...prev, toNormalized(event.clientX, event.clientY)]);
    else if (!drawing && (event.target === overlay.current || (event.target as Element).tagName.toLowerCase() === 'rect')) setSelectedIds([]);
  };

  const onSvgMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragVertex) return;
    const pos = toNormalized(event.clientX, event.clientY);
    setMap(prev => ({
      ...prev,
      parts: prev.parts.map(p => {
        if (p.id !== dragVertex.id) return p;
        const polygons = p.polygons.map(poly => [...poly]);
        if (polygons[dragVertex.polygon]?.[dragVertex.vertex]) polygons[dragVertex.polygon][dragVertex.vertex] = pos;
        return { ...p, polygons, review_status: 'manual_reviewed' };
      }),
    }));
  };

  const handleSvgPointerUp = () => setDragVertex(null);

  const changeColor = (partId: string, index: number, hex: string) => {
    setMap(prev => ({ ...prev, parts: prev.parts.map(p => p.id === partId ? {
      ...p, colors: p.colors.map((c, i) => i === index ? { ...c, hex } : c),
    } : p) }));
  };

  const imageButtons = <>
    <button className="subtle-button" onClick={() => imageInput.current?.click()}><ImageIcon size={16} /> นำเข้ารูป</button>
    <button className="subtle-button" onClick={() => mdInput.current?.click()}><FileText size={16} /> นำเข้า MD</button>
    <button className="subtle-button hidden-lg" onClick={() => jsonInput.current?.click()}><FileJson2 size={16} /> JSON</button>
  </>;

  return (
    <div className="app-shell">
      <input ref={imageInput} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={importImage} />
      <input ref={mdInput} type="file" className="hidden" accept=".md,.markdown,text/markdown,text/plain" onChange={importMd} />
      <input ref={jsonInput} type="file" className="hidden" accept=".json,application/json" onChange={importJson} />
      <input ref={candidateInput} type="file" className="hidden" accept="image/*" onChange={importCandidate} />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={21} strokeWidth={2.15} /></div>
          <div><div className="brand-title">CHARACTER<span>STUDIO</span></div><div className="brand-caption">MY-GAME-DESIGN <span className="version-dot">●</span> LOCAL WORKSPACE</div></div>
        </div>
        <div className="top-actions">{imageButtons}<button className="primary-button" onClick={downloadTemplate}><Download size={16} /> AI Template <span className="hidden-mobile">.md</span></button></div>
      </header>

      <div className="workspace-grid">
        <aside className="sidebar panel-scroll">
          <div className="sidebar-header"><span className="eyebrow">PROJECT EXPLORER</span><button title="โหลด Demo ใหม่" className="icon-button" onClick={resetDemo}><RotateCcw size={16}/></button></div>
          <div className="project-card">
            <div className="project-thumbnail"><img src={imageUrl} alt="Character preview" /></div>
            <div className="min-w-0"><div className="project-name">{map.character.name}</div><div className="project-meta"><span className="status-circle" /> MASTER · V{version}</div><div className="project-size">{imageSize.width} × {imageSize.height}px</div></div>
          </div>

          <div className="library-heading"><span>IMAGE PARTS</span><span className="count-badge">{count}</span></div>
          <div className="search-box"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชิ้นส่วน / Tag ID" /></div>
          <div className="part-list">
            {groups.map(group => {
              const matches = map.parts.filter(p => p.group === group && `${p.name_th} ${p.name_en} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
              if (!matches.length) return null;
              const isCollapsed = collapsed.includes(group);
              return <div className="part-group" key={group}>
                <button className="part-group-button" onClick={() => setCollapsed(prev => isCollapsed ? prev.filter(v => v !== group) : [...prev, group])}>
                  {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>} <span>{groupLabels[group] ?? group}</span><span className="group-count">{matches.length}</span>
                </button>
                {!isCollapsed && matches.map(part => {
                  const selected = selectedIds.includes(part.id);
                  return <div key={part.id} className={`part-entry ${selected ? 'active' : ''} ${hoverId === part.id ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoverId(part.id)} onMouseLeave={() => setHoverId(null)}>
                    <button title="เลือกหรือยกเลิกส่วนนี้" className={`part-check ${selected ? 'checked' : ''}`} onClick={() => selectPart(part.id, true)}>{selected && <Check size={10} strokeWidth={3}/>}</button>
                    <button className="part-entry-main" onClick={e => selectPart(part.id, e.shiftKey)}><span className="part-entry-name">{part.name_th}</span><span className="part-entry-id">{part.id}</span></button>
                    <span className={`part-dot ${part.polygons.length ? '' : 'missing'}`} title={part.polygons.length ? 'มี Polygon' : 'ยังไม่มี Polygon'} />
                  </div>;
                })}
              </div>;
            })}
            {!count && <div className="empty-parts"><ScanLine size={27}/><strong>ยังไม่มี Part Map</strong><span>นำเข้า MD ตาม Template หรือเพิ่ม Tag แล้ววาดขอบเขตเอง</span></div>}
          </div>

          <div className="sidebar-bottom">
            <button className="add-part-button" onClick={addPart}><Plus size={16}/> เพิ่ม Tag / กำหนด Region</button>
            <div className="sidebar-mini-actions"><button onClick={downloadMap}><Save size={15}/> Export MD</button><button onClick={exportJson}><FileJson2 size={15}/> Export JSON</button></div>
            <div className="sidebar-foot"><ShieldCheck size={15}/><span>ข้อมูลทำงานใน Browser · ไม่มีการส่งภาพไปเซิร์ฟเวอร์</span></div>
          </div>
        </aside>

        <main className="main-area">
          <div className="canvas-topbar">
            <div className="document-title"><span className="document-icon"><FolderOpen size={18}/></span><div><h1>{map.character.name}</h1><p><span>REFERENCE BOARD</span><span className="dot-sep">/</span>{map.character.view}</p></div></div>
            <div className="canvas-tools"><button onClick={() => setShowOutlines(v => !v)} className={`tool-chip ${showOutlines ? 'tool-on' : ''}`}><Crosshair size={15}/> <span>Region</span></button><span className="tool-divider"/><button title="ย่อ" onClick={() => setZoom(v => Math.max(.65, +(v - .15).toFixed(2)))} className="icon-button"><ZoomOut size={17}/></button><span className="zoom-readout">{Math.round(zoom * 100)}%</span><button title="ขยาย" onClick={() => setZoom(v => Math.min(2.4, +(v + .15).toFixed(2)))} className="icon-button"><ZoomIn size={17}/></button><button title="รีเซ็ต Zoom" onClick={() => setZoom(1)} className="icon-button"><Maximize size={16}/></button></div>
          </div>

          <div className="canvas-content">
            <div className="canvas-watermark top-left">FIG. 001 <span className="watermark-line"/> CHARACTER REFERENCE</div>
            <div className="canvas-watermark top-right">{map.coordinate_system} <span className="watermark-line"/> {count} PARTS</div>
            <div className="canvas-scroll">
              <div className="artboard" style={{ aspectRatio: `${imageSize.width}/${imageSize.height}`, transform: `scale(${zoom})` }}>
                <div className="checker"/>
                <img src={imageUrl} className="master-image" alt={`Master reference: ${map.character.name}`} draggable={false}/>
                {candidateUrl && <img src={candidateUrl} alt="AI candidate overlay" className="master-image candidate-image" style={{opacity: compare / 100}} draggable={false}/>}
                <svg ref={overlay} className={`region-layer ${drawing ? 'drawing' : ''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" onClick={onSvgClick} onPointerMove={onSvgMove} onPointerUp={handleSvgPointerUp} onPointerCancel={handleSvgPointerUp}>
                  <rect x="0" y="0" width="1000" height="1000" fill="transparent" />
                  {!candidateUrl && sortedRegions.map(part => part.polygons.map((poly, pIndex) => {
                    const selected = selectedIds.includes(part.id);
                    const hovered = hoverId === part.id;
                    return <polygon key={`${part.id}:${pIndex}`} points={pointString(poly)}
                      className={`region-polygon ${selected ? 'selected' : hovered ? 'hovered' : showOutlines ? 'outlines-on' : ''}`}
                      onClick={e => { if (drawing) return; e.stopPropagation(); selectPart(part.id, e.shiftKey); }}
                      onMouseEnter={() => setHoverId(part.id)} onMouseLeave={() => setHoverId(prev => prev === part.id ? null : prev)}>
                      <title>{part.name_th} / {part.name_en}</title>
                    </polygon>;
                  }))}
                  {tab === 'tag' && !candidateUrl && !drawing && activePart?.polygons.map((poly, pIndex) => poly.map(([x, y], vertex) => <circle key={`handle-${pIndex}-${vertex}`} cx={x} cy={y} r={9} className="vertex-handle"
                    onPointerDown={e => { e.stopPropagation(); (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId); setDragVertex({id:activePart.id, polygon:pIndex, vertex}); }}
                    onPointerMove={e => { if (dragVertex?.id === activePart.id) onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>); }}
                    onPointerUp={e => {e.stopPropagation();setDragVertex(null);}}
                    onClick={e => e.stopPropagation()} />))}
                  {drawing && <>
                    {drawPoints.length > 1 && <polyline points={pointString(drawPoints)} fill="none" stroke="#FFDA8B" strokeWidth="4" strokeDasharray="10 7" vectorEffect="non-scaling-stroke"/>}
                    {drawPoints.map(([x,y],i) => <circle key={`draft-${i}`} cx={x} cy={y} r={9} fill="#F8D286" stroke="#2A1B13" strokeWidth="2" />)}
                  </>}
                </svg>
              </div>
            </div>
            {mismatchedDimensions && <div className="canvas-warning"><AlertTriangle size={15}/> MD ระบุ {map.image.width}×{map.image.height} แต่ภาพปัจจุบัน {imageSize.width}×{imageSize.height} — ตรวจ Mapping อีกครั้ง</div>}
            {drawing && <div className="drawing-banner"><PenLine size={17}/><span>คลิกบนรูปเพื่อกำหนดจุด · {drawPoints.length} จุด</span><button onClick={finishDraw} className="banner-finish">จบ Polygon</button><button onClick={() => {setDrawing(false);setDrawPoints([]);}} className="banner-close" title="ยกเลิก"><X size={16}/></button></div>}
            {hoverId && !drawing && !candidateUrl && <div className="hover-label"><span className="hover-indicator"/>{map.parts.find(p => p.id === hoverId)?.name_th} <span>{hoverId}</span></div>}
            <div className="canvas-bottom"><div><span className="coordinate-icon">⊞</span> NORMALIZED REGION SYSTEM <strong>0—1000</strong></div><div><span className="green-small"/> PNG MASTER <span className="bottom-divider"/> <strong>V{version}</strong></div></div>
          </div>

          <div className="bottom-workbar">
            <div><div className="workbar-title"><Sparkles size={16}/> Prompt-driven part editing</div><div className="workbar-subtitle">กำหนดส่วนที่ต้องการแก้ แล้วคัดลอกคำสั่งพร้อม Region ให้ AI ภายนอก</div></div>
            <button className="workbar-cta" onClick={() => setTab('ai')}>เปิด AI Part Editor <ChevronRight size={16}/></button>
          </div>
        </main>

        <aside className="inspector panel-scroll">
          <div className="inspector-head"><div><span className="eyebrow">WORKSPACE TOOLS</span><h2>Properties <span className="head-dot">.</span></h2></div><div className="inspector-tag"><Tag size={12}/> v1.0</div></div>
          <div className="tabs">
            <button className={tab === 'inspect' ? 'current' : ''} onClick={() => setTab('inspect')}><MousePointer2 size={16}/> Inspect</button>
            <button className={tab === 'tag' ? 'current' : ''} onClick={() => setTab('tag')}><PenLine size={16}/> Tag</button>
            <button className={tab === 'ai' ? 'current' : ''} onClick={() => setTab('ai')}><WandSparkles size={16}/> AI Edit</button>
            <button className={tab === 'docs' ? 'current' : ''} onClick={() => setTab('docs')}><BookOpenText size={16}/> MD</button>
          </div>

          {tab === 'inspect' && <div className="inspector-body">
            {activePart ? <>
              <div className="section-kicker">SELECTED ELEMENT <span>01 / {String(count).padStart(2, '0')}</span></div>
              <div className="part-title-block"><div className="part-symbol"><Layers3 size={20}/></div><div><h3>{activePart.name_th}</h3><div>{activePart.name_en}</div></div></div>
              <div className="part-id-row"><code>{activePart.id}</code><button onClick={() => {void copyText(activePart.id);notify('คัดลอก Part ID แล้ว');}} title="Copy ID"><Copy size={13}/></button></div>
              <div className="mini-stats"><div><span>SIDE</span><strong>{activePart.side.replace('character_', '').toUpperCase()}</strong></div><div><span>LAYERS</span><strong>z: {activePart.z_index}</strong></div><div><span>REGIONS</span><strong>{activePart.polygons.length}</strong></div></div>
              {selectedPairs.length > 1 && <button className="pair-button" onClick={() => setSelectedIds(selectedPairs.map(p => p.id))}><ArrowLeftRight size={15}/> เลือกคู่ — {selectedPairs.length} Parts</button>}
              <div className="section-title"><span>MATERIAL & SHADING</span><span className="section-rule"/></div>
              <div className="material-card"><Paintbrush size={18}/><div><small>PRIMARY MATERIAL</small><strong>{activePart.material}</strong></div></div>
              <div className="section-title"><span>COLOR PALETTE</span><span className="section-rule"/></div>
              <div className="colors">{activePart.colors.map((color, index) => <div key={`${activePart.id}-${index}`} className="color-line"><div className="swatch" style={{background:color.hex}}/><div className="color-descriptor"><strong>{color.role}</strong><span>{color.name ?? 'สีในดีไซน์'}</span></div><button title="Copy Hex" onClick={() => {void copyText(color.hex);notify(`คัดลอก ${color.hex}`);}} className="hex-code">{color.hex}</button></div>)}</div>
              <div className="section-title"><span>PAINTING TECHNIQUE</span><span className="section-rule"/></div>
              <div className="info-card"><span className="info-card-icon">✦</span><p>{activePart.technique || 'ยังไม่ได้ระบุเทคนิค — เพิ่มในแท็บ Tag'}</p></div>
              <div className="section-title"><span>FORM & LAYER NOTES</span><span className="section-rule"/></div><p className="notes-text">{activePart.notes || 'ยังไม่มี Notes'}</p>
              <div className="inspector-actions"><button onClick={() => setTab('tag')}><PenLine size={15}/> แก้ข้อมูล Tag</button><button className="mint-outline" onClick={() => setTab('ai')}><WandSparkles size={15}/> สั่ง AI แก้ส่วนนี้</button></div>
            </> : <EmptySelection onAdd={addPart}/>}
          </div>}

          {tab === 'tag' && <div className="inspector-body">
            <div className="section-kicker">SEMANTIC REGION EDITOR <span>LOCAL</span></div>
            {activePart ? <>
              <h3 className="editor-title">แก้ Tag และขอบเขต</h3><p className="editor-explain">ข้อมูลที่แก้จะบันทึกในหน่วยความจำก่อน กด Export MD เพื่อเก็บใช้งานต่อ</p>
              <Label>ชื่อชิ้นส่วน (ไทย)</Label><input className="form-input" value={activePart.name_th} onChange={e => updatePart(activePart.id, { name_th:e.target.value })}/>
              <Label>ชื่อชิ้นส่วน (English)</Label><input className="form-input" value={activePart.name_en} onChange={e => updatePart(activePart.id, { name_en:e.target.value })}/>
              <Label>Material</Label><input className="form-input" value={activePart.material} onChange={e => updatePart(activePart.id, { material:e.target.value })}/>
              <div className="two-col"><div><Label>Group</Label><input className="form-input" value={activePart.group} onChange={e => updatePart(activePart.id, {group:e.target.value})}/></div><div><Label>Z index</Label><input className="form-input" type="number" value={activePart.z_index} onChange={e => updatePart(activePart.id, {z_index:Number(e.target.value)})}/></div></div>
              <Label>Anatomical side</Label><select className="form-input" value={activePart.side} onChange={e => updatePart(activePart.id, {side:e.target.value as CharacterPart['side']})}><option value="center">center</option><option value="character_left">character_left</option><option value="character_right">character_right</option><option value="both">both</option><option value="none">none</option></select>
              <Label>Pair key (เช่น boots / gloves)</Label><input className="form-input" value={activePart.pair_key ?? ''} onChange={e => updatePart(activePart.id, {pair_key:e.target.value})}/>
              <div className="section-title"><span>REGION / POLYGON</span><span className="section-rule"/></div>
              <div className="region-edit-card"><ScanLine size={22}/><div><strong>{activePart.polygons.length} รูปร่าง · {activePart.polygons.reduce((sum,p) => sum + p.length,0)} จุด</strong><span>ลากจุดกลมสีขาวบนรูปเพื่อปรับเส้น หรือวาดใหม่แทนที่ทั้งหมด</span></div></div>
              <button className="mint-button full" onClick={startDraw}><PenLine size={16}/>{drawing ? 'กำลังวาด Polygon…' : 'วาด Polygon ใหม่'}</button>
              {drawing && <div className="draw-edit-controls"><span>{drawPoints.length} จุด</span><button onClick={finishDraw}>จบ Polygon</button><button onClick={() => {setDrawing(false);setDrawPoints([]);}}>ยกเลิก</button></div>}
              <div className="section-title"><span>PALETTE EDIT</span><span className="section-rule"/></div>
              {activePart.colors.map((c,i) => <div className="edit-color" key={`${activePart.id}-color-${i}`}><input type="color" value={c.hex} onChange={e => changeColor(activePart.id,i,e.target.value)}/><span>{c.role}</span><code>{c.hex}</code></div>)}
              <button className="text-action" onClick={() => updatePart(activePart.id, { colors:[...activePart.colors,{role:`accent_${activePart.colors.length}`,hex:'#D8AE75'}] })}><Plus size={14}/> เพิ่มสี</button>
              <Label>เทคนิคการวาด</Label><textarea className="form-textarea" rows={4} value={activePart.technique} onChange={e => updatePart(activePart.id, {technique:e.target.value})}/>
              <Label>รายละเอียด/Layer/การซ้อนทับ</Label><textarea className="form-textarea" rows={4} value={activePart.notes} onChange={e => updatePart(activePart.id, {notes:e.target.value})}/>
              <button className="danger-button" onClick={() => {setMap(prev => ({...prev,parts:prev.parts.filter(p => p.id !== activePart.id)}));setSelectedIds([]);notify('ลบ Tag ออกจากแผนที่แล้ว (ไม่กระทบรูปจริง)');}}><Trash2 size={15}/> ลบ Tag นี้</button>
            </> : <EmptySelection onAdd={addPart}/>}
          </div>}

          {tab === 'ai' && <div className="inspector-body">
            <div className="section-kicker">AI PART EDITOR <span>PROMPT-ONLY MVP</span></div>
            <div className="ai-feature"><div className="ai-feature-icon"><WandSparkles size={21}/></div><div><h3>เปลี่ยนเฉพาะส่วนที่เลือก</h3><p>เตรียม Prompt + JSON + Mask เพื่อส่งเข้า AI ภายนอก โดยรักษาส่วนอื่นของภาพ</p></div></div>
            <div className="section-title"><span>TARGET SELECTION</span><span className="section-rule"/></div>
            {selectedParts.length ? <div className="target-pills">{selectedParts.map(p => <button title="นำออกจากรายการ" key={p.id} onClick={() => selectPart(p.id,true)}>{p.name_th}<X size={12}/></button>)}</div> : <p className="muted-message">เลือกบนภาพหรือจากรายการด้านซ้ายก่อน</p>}
            {selectedPairs.length > 1 && <button className="pair-button" onClick={() => setSelectedIds(selectedPairs.map(p => p.id))}><ArrowLeftRight size={15}/> เลือกชิ้นส่วนคู่กันทั้งหมด</button>}
            <Label>ประเภทการแก้ไข</Label><div className="action-grid">{ACTIONS.map(item => <button key={item.id} className={action === item.id ? 'active' : ''} onClick={() => setAction(item.id)}><span>{item.label}</span><small>{item.subtitle}</small></button>)}</div>
            <Label>ต้องการให้ AI แก้อะไร?</Label><textarea className="form-textarea instruction" rows={5} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="เช่น เปลี่ยนเป็นสนับมือเหล็กปิดทุกนิ้ว…" />
            <label className="toggle-row"><div><strong>ขยายขอบเขตได้เล็กน้อย</strong><small>สำหรับของใหม่ที่ยื่นเกินทรงเดิม เช่น ผลึกบนบูต</small></div><input type="checkbox" checked={expandGeometry} onChange={e => setExpandGeometry(e.target.checked)} /><span className="toggle-visual"/></label>
            <div className="section-title"><span>GENERATED PROMPT</span><span className="section-rule"/></div>
            <div className="prompt-preview"><div className="prompt-top"><span><FileCode2 size={14}/> PREVIEW</span><button onClick={() => {void copyText(prompt);notify('คัดลอก AI Prompt แล้ว');}}><Copy size={14}/> Copy</button></div><pre>{prompt.slice(0,1250)}{prompt.length > 1250 ? '\n…' : ''}</pre></div>
            <button disabled={!canEditWithRegions || !instruction.trim()} className="mint-button full" onClick={() => {void copyText(prompt);notify('คัดลอก Prompt แล้ว — แนบรูปต้นฉบับเมื่อสั่ง AI');}}><Copy size={16}/> Copy Full AI Prompt</button>
            <div className="export-grid"><button disabled={!canEditWithRegions} onClick={() => downloadText('edit_request.json',JSON.stringify(request,null,2),'application/json')}><FileJson2 size={16}/> Edit JSON</button><button disabled={!canEditWithRegions} onClick={() => {void exportMask();}}><ScanLine size={16}/> Mask PNG</button></div>
            {!canEditWithRegions && selectedParts.length > 0 && <p className="muted-message small">บาง Part ยังไม่มี Polygon — เปิดแท็บ Tag แล้ววาด Region ก่อน</p>}
            <div className="callout"><CircleHelp size={17}/><p>แอปยังไม่ส่งรูปไป AI โดยตรง ให้แนบ <strong>รูปต้นฉบับ</strong> และ Prompt ที่คัดลอก; หาก AI รองรับ Mask สามารถแนบ Mask เพิ่มได้</p></div>
            <div className="section-title"><span>BEFORE / AFTER REVIEW</span><span className="section-rule"/></div>
            <button className="outline-button full" onClick={() => candidateInput.current?.click()}><Upload size={15}/> นำเข้าภาพที่ AI แก้แล้ว</button>
            {candidateUrl ? <div className="review-controls"><label>Before <strong>{compare}% AFTER</strong><span>After</span></label><input type="range" min={0} max={100} value={compare} onChange={e => setCompare(Number(e.target.value))}/><div className="review-actions"><button onClick={() => {setCandidateUrl(null);notify('ปฏิเสธภาพ Candidate แล้ว');}}>Reject</button><button onClick={applyCandidate}><Check size={14}/> Accept as V{version+1}</button></div><p>Accept แล้วต้องตรวจและอัปเดต Tag/สีใหม่ด้วย</p></div> : <p className="muted-message small">นำภาพ PNG ขนาดเดิมมาเทียบแบบซ้อนทับ และรับเป็นเวอร์ชันใหม่ได้</p>}
            {history.length > 0 && <button className="undo-button" onClick={undoVersion}><RotateCcw size={14}/> ย้อนกลับเวอร์ชันก่อนหน้า ({history.length})</button>}
          </div>}

          {tab === 'docs' && <div className="inspector-body">
            <div className="section-kicker">SPECIFICATION DOCUMENT <span>MARKDOWN</span></div>
            <div className="doc-summary"><FileText size={24}/><div><h3>{documentFilename || 'ยังไม่ได้เลือก MD'}</h3><p>{docsText.length.toLocaleString()} ตัวอักษร · {map.parts.length} Tags</p></div></div>
            <p className="editor-explain">ระบบอ่านบล็อก <code>```character-map</code> ที่อยู่ใน MD เพื่อตีขอบเขตภาพ แล้วแสดงข้อมูลสี/วัสดุ/เทคนิคจากข้อมูลเดียวกัน</p>
            <div className="doc-actions"><button onClick={downloadTemplate}><Download size={15}/> AI Template</button><button onClick={() => {void copyText(makeMappingPrompt());notify('คัดลอกคำสั่งให้ AI ทำ Mapping แล้ว');}}><Copy size={15}/> คำสั่ง AI</button></div>
            <div className="section-title"><span>DOCUMENT HEADINGS</span><span className="section-rule"/></div>
            <div className="doc-headings">{(docsText.match(/^#{1,3}\s+.+$/gm) ?? []).slice(0,24).map((line,i)=><div key={i}>{line.replace(/^#+\s+/, '')}</div>)}{!docsText && <p>ยังไม่มีไฟล์ MD — Import หรือโหลด Demo</p>}</div>
            <button className="outline-button full" onClick={() => setDocOpen(v => !v)}><BookOpenText size={16}/>{docOpen ? 'ซ่อนเนื้อหา MD' : 'แสดงข้อความ MD'}</button>
            {docOpen && <pre className="doc-raw">{docsText.slice(0,20000)}</pre>}
            <div className="section-title"><span>EXPORT DATA</span><span className="section-rule"/></div>
            <div className="export-grid"><button onClick={downloadMap}><Download size={16}/> Markdown</button><button onClick={exportJson}><Download size={16}/> JSON</button></div>
            <div className="callout"><BadgeCheck size={17}/><p>โครงข้อมูลของ Template เป็นมาตรฐานเดียวกันทั้งการ Inspect, สร้าง Prompt และ Export ส่งให้ AI วิเคราะห์ซ้ำ</p></div>
          </div>}
        </aside>
      </div>

      <div className="status-bar"><div><span className="status-indicator"/> STUDIO READY <span className="status-separator"/> {count} PARTS INDEXED <span className="status-separator"/> 2D REFERENCE</div><div><span>VITE + REACT</span><span className="status-separator"/> <span>LOCAL MODE</span></div></div>
      {toast && <div role="status" className="toast"><Sparkles size={17}/><span>{toast}</span><button onClick={() => setToast('')}><X size={14}/></button></div>}
    </div>
  );
}

function EmptySelection({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-selection"><div className="empty-select-icon"><MousePointer2 size={26}/></div><h3>เลือกชิ้นส่วนบนภาพ</h3><p>คลิกที่รองเท้า ผม เสื้อ หรืออุปกรณ์เพื่อดูรายละเอียดสี วัสดุ และเทคนิคการวาด</p><button onClick={onAdd}><Plus size={15}/> เพิ่ม Tag ใหม่</button></div>;
}

export default App;
