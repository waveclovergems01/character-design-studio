import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, BookOpenText, Check, ChevronDown, ChevronRight,
  CircleHelp, Copy, Crosshair, Download, FileCode2, FileJson2, FileText, FolderOpen,
  Image as ImageIcon, Layers3, Maximize, MousePointer2, Paintbrush, PenLine, PenTool, Plus, RotateCcw,
  Save, ScanLine, Search, ShieldCheck, Sparkles, Tag, Trash2, Upload, WandSparkles, X,
  ZoomIn, ZoomOut, House, Shapes, Pipette, Trash, Bone, Palette, Info,
} from 'lucide-react';
import HomePage from './components/HomePage';
import GuidePage from './components/GuidePage';
import ShapeToolPanel from './components/ShapeToolPanel';
import RigToolPanel from './components/RigToolPanel';
import type { RigEditorTab } from './components/RigToolPanel';
import RigExportHub from './components/RigExportHub';
import AnimationPreviewWorkspace from './components/AnimationPreviewWorkspace';
import CutoutPreview from './components/CutoutPreview';
import WorkspaceModeNav, { MODE_INFO } from './components/WorkspaceModeNav';
import type { WorkspaceMode } from './components/WorkspaceModeNav';
import { demoImage, demoMap, groupLabels } from './data/demo';
import { parseCharacterMarkdown, toCharacterMarkdown, validateMap, normalizePoint } from './lib/character-map';
import { ACTIONS, makeEditPrompt, makeEditRequest, makeMappingPrompt } from './lib/ai-prompts';
import { copyText, downloadBlob, downloadText, exportMaskPng, loadImage } from './lib/download';
import { clampZoom, fittedImageSize, stepZoom, wheelZoom } from './lib/zoom';
import { panScrollPosition } from './lib/pan';
import { inspectMapCompatibility, makeMappingRepairPrompt } from './lib/map-compatibility';
import { scanMapImageQuality } from './lib/map-image-quality';
import type { MapImageQuality } from './lib/map-image-quality';
import { cloneRegion, copyPngBlob, DEFAULT_SHAPE_VALUES, imageToPngBlob, makeShapeGuidePrompt, mirrorRegion, renderShapeGuidePng, transformRegion } from './lib/shape-guide';
import { autoOutlineFromImage } from './lib/auto-outline';
import { BONES, boneIsNear, cloneJoints, detectFigureBounds, initialJoints, JOINTS, makeMotionFrames, makeRigBatchPrompt, makeRigPrompt, makeWalkFrames, MOTION_DEFAULT_FRAMES, resampleRigFrames, renderRigGuide, updateJoint } from './lib/rig';
import type { JointId, MotionType, NearSide, RigDirection, RigFrame } from './lib/rig';
import { autoSkinWeights, CUTOUT_PARTS, getCutoutMaskGeometry, insertCutoutPolygonPoint, makeEditableCutoutPolygon, mapCutoutPoint, moveCutoutPart, nearestCutoutPolygonVertex, paintSkinWeights, pairedCutoutPart, placeCutoutLimbRelative, resolveCutoutOrder, skinGridForPart, SKIN_GRID_COLUMNS, SKIN_GRID_ROWS } from './lib/cutout';
import type { CutoutMaskOverrides, CutoutPartId, CutoutSkinWeights, CutoutWidths, WeightBrushMode, WeightInfluence } from './lib/cutout';
import { exportCutoutPack, exportGuidePack, motionPackFilename, renderMotionContactSheet } from './lib/motion-export';
import type { ShapeValues } from './lib/shape-guide';
import type { CharacterMap, CharacterPart, EditAction, Point, Region } from './lib/types';
import './guide.css';
import './shape.css';
import './studio-v05.css';
import './studio-v06.css';
import './studio-v07.css';
import './studio-v08.css';
import './studio-v09.css';
import './studio-v10.css';
import './studio-v11.css';

type WorkTab = 'inspect' | 'tag' | 'shape' | 'ai' | 'rig' | 'animation' | 'docs';
type HistoryItem = { map: CharacterMap; imageUrl: string; imageSize: { width: number; height: number }; docsText: string; version: number };
type ZoomAnchor = { clientX: number; clientY: number; imageX: number; imageY: number };
type Page = 'home' | 'guide' | 'studio';
type PanStart = { pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number };
type RigMaskContext = {clientX:number;clientY:number;partId:CutoutPartId;point:Point;vertexIndex:number|null};
type PendingMap = { value: CharacterMap; filename: string; text: string };
const pageFromHash = (): Page => window.location.hash === '#studio' ? 'studio' : window.location.hash === '#guide' ? 'guide' : 'home';

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
  const [page, setPage] = useState<Page>(pageFromHash);
  const [map, setMap] = useState<CharacterMap>(() => emptyMap(1024, 1536, 'Untitled Character'));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1024, height: 1536 });
  const [imageName, setImageName] = useState('');
  const [pendingMap, setPendingMap] = useState<PendingMap | null>(null);
  const [mapWarnings, setMapWarnings] = useState<string[]>([]);
  const [mapQuality, setMapQuality] = useState<MapImageQuality | null>(null);
  const [regionsApproved, setRegionsApproved] = useState(true);
  const qualitySerial = useRef(0);
  const qualityAcceptedRef = useRef(false);
  const [docsText, setDocsText] = useState('');
  const [documentFilename, setDocumentFilename] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkTab>('inspect');
  const [animationMounted,setAnimationMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [showOutlines, setShowOutlines] = useState(true);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const [canvasFocused, setCanvasFocused] = useState(false);
  const [panning, setPanning] = useState(false);
  const panRef = useRef<PanStart | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 650 });
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [dragVertex, setDragVertex] = useState<{ id: string; polygon: number; vertex: number } | null>(null);
  const [shapeBase, setShapeBase] = useState<Region>([]);
  const [shapeSource, setShapeSource] = useState<Region>([]);
  const [shapeValues, setShapeValues] = useState<ShapeValues>(DEFAULT_SHAPE_VALUES);
  const [shapeDrawing, setShapeDrawing] = useState(false);
  const [shapeDraft, setShapeDraft] = useState<Point[]>([]);
  const [dragShapeVertex, setDragShapeVertex] = useState<{ polygon: number; vertex: number } | null>(null);
  const [shapePartName, setShapePartName] = useState('ขาของตัวละคร');
  const [shapeInstruction, setShapeInstruction] = useState('ปรับรูปทรงส่วนที่เลือกให้ตรงเส้นสีส้ม โดยรักษาสี วัสดุ ลวดลาย และแสงเงาเดิม');
  const [mirrorShape, setMirrorShape] = useState(false);
  const [mirrorAxis, setMirrorAxis] = useState(500);
  const [magicWand, setMagicWand] = useState(false);
  const [wandTolerance, setWandTolerance] = useState(55);
  const [samplingColorIndex, setSamplingColorIndex] = useState<number | null>(null);
  const [masterBlob, setMasterBlob] = useState<Blob | null>(null);
  const [shapeBlob, setShapeBlob] = useState<Blob | null>(null);
  const [rigDirection, setRigDirection] = useState<RigDirection>('S');
  const [rigMotion,setRigMotion] = useState<MotionType>('walk');
  const [rigFrames, setRigFrames] = useState<RigFrame[]>(() => makeWalkFrames(initialJoints(), 'S'));
  const rigProfilesRef = useRef<Record<string,RigFrame[]>>({});
  const rigBoundsRef = useRef({x:300,y:60,width:400,height:870});
  const [rigFrameIndex, setRigFrameIndex] = useState(0);
  const [rigSelectedJoint, setRigSelectedJoint] = useState<JointId|null>('pelvis');
  const [dragRigJoint, setDragRigJoint] = useState<JointId|null>(null);
  const [rigPlaying, setRigPlaying] = useState(false);
  const [rigShowLabels, setRigShowLabels] = useState(true);
  const [rigEditorTab,setRigEditorTab] = useState<RigEditorTab>('mask');
  const [rigBoneVisible,setRigBoneVisible] = useState(true);
  const [rigBoneEdit,setRigBoneEdit] = useState(false);
  const [rigBoneMirror,setRigBoneMirror] = useState(false);
  const [weightPaintEnabled,setWeightPaintEnabled] = useState(false);
  const [weightShowHeatmap,setWeightShowHeatmap] = useState(true);
  const [weightInfluence,setWeightInfluence] = useState<WeightInfluence>('primary');
  const [weightBrushMode,setWeightBrushMode] = useState<WeightBrushMode>('add');
  const [weightStrength,setWeightStrength] = useState(.65);
  const [weightBrushRadius,setWeightBrushRadius] = useState(55);
  const [weightReplaceValue,setWeightReplaceValue] = useState(.5);
  const [autoWeightSoftness,setAutoWeightSoftness] = useState(.35);
  const [cutoutSkinWeights,setCutoutSkinWeights] = useState<CutoutSkinWeights>({});
  const weightStrokeRef=useRef(false);
  const [weightCursor,setWeightCursor]=useState<Point|null>(null);
  const [rigGuideBlob, setRigGuideBlob] = useState<Blob|null>(null);
  const [rigExporting,setRigExporting] = useState<'guides'|'sheet'|'cutout'|null>(null);
  const [cutoutPreview,setCutoutPreview] = useState(false);
  const [cutoutWidths,setCutoutWidths] = useState<CutoutWidths>({});
  const [selectedCutout,setSelectedCutout] = useState<CutoutPartId>('leg_left_upper');
  const [cutoutMaskOverrides,setCutoutMaskOverrides] = useState<CutoutMaskOverrides>({});
  const [showCutoutMasks,setShowCutoutMasks] = useState(true);
  const [showAllCutoutMasks,setShowAllCutoutMasks] = useState(false);
  const [linkCutoutPairs,setLinkCutoutPairs] = useState(false);
  const [globalCutoutWidth,setGlobalCutoutWidth] = useState(100);
  const [dragCutoutMask,setDragCutoutMask] = useState<{id:CutoutPartId;handle:'start'|'end'}|null>(null);
  const [dragCutoutVertex,setDragCutoutVertex] = useState<{id:CutoutPartId;index:number}|null>(null);
  const [selectedCutoutVertex,setSelectedCutoutVertex] = useState<number|null>(null);
  const [maskAddPoint,setMaskAddPoint] = useState(false);
  const [drawingCutoutPolygon,setDrawingCutoutPolygon] = useState(false);
  const [cutoutPolygonDraft,setCutoutPolygonDraft] = useState<Point[]>([]);
  const [rigMaskContext,setRigMaskContext] = useState<RigMaskContext|null>(null);
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
  const canvasViewport = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const mode:WorkspaceMode = tab === 'inspect'||tab === 'tag' ? 'design' : tab;
  const switchMode = (value:WorkspaceMode) => {
    if(value==='animation')setAnimationMounted(true);
    setTab(value === 'design' ? 'inspect' : value);
    setDrawing(false);setDrawPoints([]);setShapeDrawing(false);setShapeDraft([]);
    setSamplingColorIndex(null);setMagicWand(false);setRigPlaying(false);setRigMaskContext(null);setRigBoneEdit(false);weightStrokeRef.current=false;
  };

  const goToPage = (target: Page) => {
    window.location.hash = target === 'home' ? '' : target;
    setPage(target);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handleHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(()=>{
    if(tab!=='shape')setMagicWand(false);
    if(tab!=='tag')setSamplingColorIndex(null);
    if(tab!=='rig')setRigPlaying(false);
  },[tab]);

  useEffect(() => {
    if (page !== 'studio') return;
    const element = canvasViewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [page, imageUrl]);

  // Give the canvas a larger world than the image and center it on first load.
  // This leaves panning room even when the image fits in the viewport.
  useLayoutEffect(() => {
    if (page !== 'studio' || !imageUrl) return;
    const viewport = canvasViewport.current;
    if (!viewport) return;
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
  }, [page, imageUrl, viewportSize.width, viewportSize.height]);

  const requestZoom = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = canvasViewport.current;
    const artboard = artboardRef.current;
    if (!imageUrl || !viewport || !artboard) return;
    const next = clampZoom(nextZoom);
    if (Math.abs(next - zoomRef.current) < .0005) return;
    const viewportRect = viewport.getBoundingClientRect();
    const imageRect = artboard.getBoundingClientRect();
    const x = clientX ?? viewportRect.left + viewportRect.width / 2;
    const y = clientY ?? viewportRect.top + viewportRect.height / 2;
    zoomAnchorRef.current = {
      clientX: x, clientY: y,
      imageX: Math.max(0, Math.min(1, (x - imageRect.left) / imageRect.width)),
      imageY: Math.max(0, Math.min(1, (y - imageRect.top) / imageRect.height)),
    };
    zoomRef.current = next;
    setZoom(next);
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    canvasViewport.current?.focus({ preventScroll: true });
    if (event.button !== 1) return;
    const viewport = canvasViewport.current;
    if (!viewport) return;
    event.preventDefault(); // Suppress browser middle-click auto-scroll.
    panRef.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const viewport = canvasViewport.current;
    if (!pan || !viewport || event.pointerId !== pan.pointerId) return;
    event.preventDefault();
    viewport.scrollLeft = panScrollPosition(pan.scrollLeft, pan.clientX, event.clientX);
    viewport.scrollTop = panScrollPosition(pan.scrollTop, pan.clientY, event.clientY);
  };

  const finishCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const artboard = artboardRef.current;
    const viewport = canvasViewport.current;
    if (!anchor || !viewport || !artboard) return;
    const rect = artboard.getBoundingClientRect();
    viewport.scrollLeft += rect.left + anchor.imageX * rect.width - anchor.clientX;
    viewport.scrollTop += rect.top + anchor.imageY * rect.height - anchor.clientY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  useEffect(() => {
    if (page !== 'studio' || !imageUrl) return;
    const element = canvasViewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== element) return;
      event.preventDefault();
      requestZoom(wheelZoom(zoomRef.current, event.deltaY, event.deltaMode), event.clientX, event.clientY);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [page, imageUrl]);

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
  const renderedSize = fittedImageSize(imageSize.width, imageSize.height, viewportSize.width, viewportSize.height, zoom);
  const stageSize = {
    width: Math.max(viewportSize.width, renderedSize.width + 60) + Math.max(viewportSize.width, 320),
    height: Math.max(viewportSize.height, renderedSize.height + 60) + Math.max(viewportSize.height, 320),
  };
  const pendingCompatibility = pendingMap && imageUrl
    ? inspectMapCompatibility(pendingMap.value, { ...imageSize, name: imageName }) : null;
  const shapePrimaryTarget = useMemo(() => transformRegion(shapeBase, DEFAULT_SHAPE_VALUES, shapeValues), [shapeBase, shapeValues]);
  const shapeTarget = useMemo(() => mirrorShape ? [...shapePrimaryTarget, ...mirrorRegion(shapePrimaryTarget, mirrorAxis)] : shapePrimaryTarget, [shapePrimaryTarget, mirrorShape, mirrorAxis]);
  const shapePrompt = useMemo(() => makeShapeGuidePrompt(
    imageName || 'master_character.png', imageSize.width, imageSize.height,
    shapePartName, `${shapeInstruction}${mirrorShape ? ` Apply matching mirror geometry to both symmetric sides around normalized X=${mirrorAxis}; do not mirror asymmetric hairstyle or unrelated details.` : ''}`, shapeTarget, shapeSource,
  ), [imageName, imageSize.width, imageSize.height, shapePartName, shapeInstruction, shapeTarget, shapeSource, mirrorShape, mirrorAxis]);
  const rigFrame = rigFrames[rigFrameIndex]??rigFrames[0];
  const rigPrompt = useMemo(() => makeRigPrompt(imageName||'master_character.png',imageSize.width,imageSize.height,rigDirection,rigFrameIndex,rigFrame,rigMotion,rigFrames.length),[imageName,imageSize.width,imageSize.height,rigDirection,rigFrameIndex,rigFrame,rigMotion,rigFrames.length]);
  const rigBatchPrompt=useMemo(()=>makeRigBatchPrompt(imageName||'master_character.png',imageSize.width,imageSize.height,rigDirection,rigMotion,rigFrames),[imageName,imageSize.width,imageSize.height,rigDirection,rigMotion,rigFrames]);

  useEffect(()=>{rigProfilesRef.current[`${rigDirection}:${rigMotion}`]=rigFrames;},[rigDirection,rigMotion,rigFrames]);

  useEffect(()=>{
    if(!rigPlaying||tab!=='rig')return;
    const timer=window.setInterval(()=>setRigFrameIndex(i=>(i+1)%rigFrames.length),rigMotion==='idle'?310:rigMotion==='run'?110:180);
    return ()=>window.clearInterval(timer);
  },[rigPlaying,tab,rigMotion,rigFrames.length]);

  useEffect(()=>{
    let live=true;setRigGuideBlob(null);
    if(!imageUrl||tab!=='rig'||rigPlaying)return;
    const timer=window.setTimeout(()=>{void renderRigGuide(imageUrl,imageSize.width,imageSize.height,rigFrame,rigDirection).then(b=>{if(live)setRigGuideBlob(b);}).catch(()=>{if(live)setRigGuideBlob(null);});},170);
    return ()=>{live=false;window.clearTimeout(timer);};
  },[imageUrl,imageSize.width,imageSize.height,tab,rigFrame,rigDirection,rigPlaying]);

  useEffect(() => {
    let live = true;
    setMasterBlob(null);
    if (!imageUrl) return;
    void imageToPngBlob(imageUrl, imageSize.width, imageSize.height)
      .then(blob => { if (live) setMasterBlob(blob); })
      .catch(() => { if (live) setMasterBlob(null); });
    return () => { live = false; };
  }, [imageUrl, imageSize.width, imageSize.height]);

  useEffect(() => {
    let live = true;
    setShapeBlob(null);
    if (!imageUrl || !shapeTarget.some(p => p.length >= 3)) return;
    const timer = window.setTimeout(() => {
      void renderShapeGuidePng(imageUrl, imageSize.width, imageSize.height, shapeSource, shapeTarget)
        .then(blob => { if (live) setShapeBlob(blob); })
        .catch(() => { if (live) setShapeBlob(null); });
    }, 180);
    return () => { live = false; window.clearTimeout(timer); };
  }, [imageUrl, imageSize.width, imageSize.height, shapeSource, shapeTarget]);

  useEffect(() => {
    const token = ++qualitySerial.current;
    setMapQuality(null);
    if (!imageUrl || !map.parts.length) return;
    const timer = window.setTimeout(() => {
      void scanMapImageQuality(map, imageUrl).then(result => {
        if (qualitySerial.current !== token) return;
        setMapQuality(result);
        if (result.suspicious && !qualityAcceptedRef.current) setRegionsApproved(false);
      }).catch(() => { if (qualitySerial.current === token) setMapQuality(null); });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [map, imageUrl]);

  const notify = (message: string) => setToast(message);

  const selectPart = (id: string, multi = false) => {
    setSamplingColorIndex(null);
    if (multi) setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    else setSelectedIds([id]);
  };

  const updatePart = (id: string, changes: Partial<CharacterPart>) => {
    setMap(prev => ({ ...prev, parts: prev.parts.map(p => p.id === id ? { ...p, ...changes } : p) }));
  };

  const resetShape = () => {
    setShapeBase([]);setShapeSource([]);setShapeValues(DEFAULT_SHAPE_VALUES);
    setShapeDrawing(false);setShapeDraft([]);setDragShapeVertex(null);
    setMirrorShape(false);setMagicWand(false);
  };

  const refreshRigForImage = async (url:string) => {
    let bounds={x:300,y:60,width:400,height:870};
    try {bounds=await detectFigureBounds(url);}catch{/* Keep proportional fallback. */}
    rigBoundsRef.current=bounds;rigProfilesRef.current={};
    setRigFrames(makeWalkFrames(initialJoints(bounds),'S'));
    setRigDirection('S');setRigMotion('walk');setRigFrameIndex(0);setRigPlaying(false);setCutoutPreview(false);
    setCutoutWidths({});setCutoutMaskOverrides({});setCutoutSkinWeights({});setGlobalCutoutWidth(100);setDragCutoutMask(null);
    setRigEditorTab('mask');setRigBoneEdit(false);setRigBoneMirror(false);setRigBoneVisible(true);setWeightPaintEnabled(false);weightStrokeRef.current=false;
    setDragCutoutVertex(null);setSelectedCutoutVertex(null);setMaskAddPoint(false);setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);
  };

  const applyParsedMap = (parsed: CharacterMap, sourceText: string, filename: string) => {
    setDocsText(sourceText);
    setDocumentFilename(filename);
    if (!imageUrl) {
      setPendingMap({ value: parsed, text: sourceText, filename });
      setTab('docs');
      notify(`อ่าน MD แล้ว ${parsed.parts.length} Parts — กรุณานำเข้ารูปต้นฉบับที่ตรงกันก่อน`);
      return;
    }
    const report = inspectMapCompatibility(parsed, { ...imageSize, name: imageName });
    if (!report.compatible) {
      setPendingMap({ value: parsed, text: sourceText, filename });
      setTab('docs');
      notify('บล็อก Mapping: ขนาดรูปไม่ตรงกับ MD — ไม่แสดง Polygon ที่ผิดรูป');
      return;
    }
    setMap(parsed);
    setPendingMap(null);
    setMapWarnings(report.warnings);
    setSelectedIds(parsed.parts.length ? [parsed.parts[0].id] : []);
    setDrawing(false);
    qualityAcceptedRef.current = false;
    setRegionsApproved(report.warnings.length === 0);
    setTab('inspect');
    notify(`นำเข้า Mapping ตรงขนาดภาพแล้ว: ${parsed.parts.length} Parts${report.warnings.length?' — มีข้อควรตรวจในแท็บ MD':''}`);
  };

  const resetDemo = () => {
    setMap(starter());
    setImageUrl(demoImage);
    setImageSize({ width: 1024, height: 1536 });
    setImageName('novice_female_front.png');
    setPendingMap(null);setMapWarnings([]);setMapQuality(null);qualityAcceptedRef.current=true;setRegionsApproved(true);
    resetShape();
    void refreshRigForImage(demoImage);
    setSamplingColorIndex(null);
    setDocsText(toCharacterMarkdown(demoMap));
    setDocumentFilename('novice_female_character_map.md');
    setSelectedIds(['boot_character_left']);
    setCandidateUrl(null);
    setDrawing(false);
    setHistory([]);
    setVersion(1);
    setZoom(1);
    zoomRef.current = 1;
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
      setImageName(file.name);
      resetShape();
      void refreshRigForImage(url);
      setSamplingColorIndex(null);
      setMapQuality(null);setMapWarnings([]);qualityAcceptedRef.current=false;setRegionsApproved(true);
      setSelectedIds([]);
      if (pendingMap) {
        const report = inspectMapCompatibility(pendingMap.value, { ...size, name:file.name });
        if (report.compatible) {
          setMap(pendingMap.value);
          setSelectedIds(pendingMap.value.parts.length ? [pendingMap.value.parts[0].id] : []);
          setMapWarnings(report.warnings);
          setRegionsApproved(report.warnings.length === 0);
          setPendingMap(null);
        } else {
          setMap(emptyMap(size.width,size.height,basename(file.name)));
        }
      } else {
        setMap(emptyMap(size.width, size.height, basename(file.name)));
        setDocsText('');setDocumentFilename('');
      }
      setCandidateUrl(null);
      setHistory([]);
      setVersion(1);
      setZoom(1);
      zoomRef.current = 1;
      setTab('inspect');
      notify(pendingMap ? 'นำเข้ารูปแล้ว — ระบบตรวจความตรงกับ MD ที่รออยู่ กรุณาดูแท็บ MD' : `นำเข้าภาพ ${file.name} แล้ว — เพิ่ม Shape Guide ได้แม้ไม่มี MD`);
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
      applyParsedMap(parsed,text,file.name);
    } catch (error) {
      setPendingMap(null);
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
      applyParsedMap(parsed,toCharacterMarkdown(parsed),file.name);
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
    if (!candidateUrl || !imageUrl) return;
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
    if (!imageUrl) { notify('กรุณานำเข้าภาพหรือเปิด Demo ก่อนเพิ่ม Tag'); return; }
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

  const shapeFromSelectedPart = () => {
    if (!regionsApproved) {notify('Mapping ยังไม่ผ่านการตรวจ — เปิดแท็บ MD และยืนยัน Region ก่อน หรือวาด Shape เอง');setTab('docs');return;}
    if (!activePart?.polygons.some(poly => poly.length >= 3)) { notify('เลือก Tag ที่มี Polygon ก่อน หรือใช้วาดพื้นที่เอง'); return; }
    setDrawing(false);setDrawPoints([]);
    setMagicWand(false);
    setShapeDrawing(false);setShapeDraft([]);
    setShapeBase(cloneRegion(activePart.polygons));
    setShapeSource(cloneRegion(activePart.polygons));
    setShapeValues(DEFAULT_SHAPE_VALUES);
    setMirrorShape(false);
    setShapePartName(activePart.name_th);
    setTab('shape');
    notify(`นำ Region ของ “${activePart.name_th}” มาเป็นรูปทรงเริ่มต้นแล้ว — ลากจุดสีเหลืองได้`);
  };

  const startShapeDrawing = () => {
    if (!imageUrl) { notify('นำเข้าภาพก่อนเริ่มวาด Shape'); return; }
    resetShape();setDrawing(false);setDrawPoints([]);
    setShapeDrawing(true);setTab('shape');
    notify('คลิกบนภาพ 3 จุดขึ้นไป เพื่อวาดเส้นรอบรูปทรงเป้าหมาย แล้วกดจบรูปทรง');
  };

  const finishShapeDrawing = () => {
    if (shapeDraft.length < 3) { notify('ต้องวาดอย่างน้อย 3 จุด'); return; }
    setShapeBase([shapeDraft]);setShapeSource([]);setShapeValues(DEFAULT_SHAPE_VALUES);
    setShapeDrawing(false);setShapeDraft([]);
    notify('สร้าง Shape Guide แล้ว — ลากจุดสีเหลืองเพื่อแก้รูปทรงก่อนส่ง AI');
  };

  const autoWandAt = async (point:Point) => {
    if(!imageUrl)return;
    setMagicWand(false);
    try{
      const found=await autoOutlineFromImage(imageUrl,point[0],point[1],wandTolerance);
      setShapeBase(found);setShapeSource([]);setShapeValues(DEFAULT_SHAPE_VALUES);
      setShapeDrawing(false);setShapeDraft([]);
      notify('จับพื้นที่สีต่อเนื่องแล้ว — เป็นขอบ Convex Hull โดยประมาณ กรุณาลากจุดแก้เองก่อนส่ง AI');
    }catch(error){notify(error instanceof Error?error.message:'จับขอบเขตไม่ได้');}
  };

  const setRigJointAt = (id:JointId,pos:Point) => {
    setRigFrames(prev=>prev.map((frame,i)=>{
      if(i!==rigFrameIndex)return frame;
      let result=updateJoint(frame,id,pos);
      const mirrorId=id.includes('_left')?id.replace('_left','_right'):id.includes('_right')?id.replace('_right','_left'):null;
      if(rigBoneMirror&&mirrorId&&JOINTS.some(([key])=>key===mirrorId)){
        const midX=frame.joints.pelvis[0];
        result=updateJoint(result,mirrorId as JointId,[Math.max(0,Math.min(1000,Math.round(2*midX-pos[0]))),pos[1]]);
      }
      return result;
    }));
  };

  const setRigNearSide = (near:NearSide) => {
    setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?{...f,nearSide:near}:f));
  };

  const selectRigProfile=(direction:RigDirection,motion:MotionType)=>{
    rigProfilesRef.current[`${rigDirection}:${rigMotion}`]=rigFrames;
    const key=`${direction}:${motion}`;
    const next=rigProfilesRef.current[key]??makeMotionFrames(initialJoints(rigBoundsRef.current,direction),direction,motion,MOTION_DEFAULT_FRAMES[motion]);
    setRigDirection(direction);setRigMotion(motion);setRigFrames(next);setRigFrameIndex(0);setRigPlaying(false);setRigBoneEdit(false);setRigBoneMirror(false);
  };

  const setRigFrameCount=(count:number)=>{
    setRigFrames(prev=>resampleRigFrames(prev,count));
    setRigFrameIndex(0);setRigPlaying(false);
    notify(`ปรับเป็น ${count} เฟรมโดยคำนวณตำแหน่งระหว่างคีย์เฟรมเก่า — โปรดตรวจท่าต่อเนื่อง`);
  };

  const motionExportOptions=()=>({imageUrl:imageUrl!,imageName:imageName||'master_character.png',width:imageSize.width,height:imageSize.height,direction:rigDirection,motion:rigMotion,frames:rigFrames,widths:cutoutWidths,maskOverrides:cutoutMaskOverrides,skinWeights:cutoutSkinWeights,masterPng:masterBlob});

  const selectedPair=pairedCutoutPart(selectedCutout);
  const selectedMaskGeometry=getCutoutMaskGeometry(selectedCutout,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
  const selectedPolygon=cutoutMaskOverrides[selectedCutout]?.polygon;
  const weightGrid=skinGridForPart(selectedCutout,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
  const selectedWeights=cutoutSkinWeights[selectedCutout]?.length===SKIN_GRID_ROWS*SKIN_GRID_COLUMNS?cutoutSkinWeights[selectedCutout]!:autoSkinWeights(selectedCutout,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
  const weightColor=(primary:number)=>`hsl(${Math.round((1-Math.min(1,Math.max(0,primary)))*240)} 92% 55%)`;
  const heatmapCells:{points:Point[];fill:string;key:number}[]=[];
  if(rigEditorTab==='weight'&&weightShowHeatmap){
    const mapped=(point:Point):Point=>cutoutPreview?mapCutoutPoint(point,rigFrames[0].joints,rigFrame.joints,selectedCutout,imageSize.width,imageSize.height):point;
    for(let row=0;row<SKIN_GRID_ROWS-1;row++)for(let col=0;col<SKIN_GRID_COLUMNS-1;col++){
      const i=row*SKIN_GRID_COLUMNS+col,j=i+SKIN_GRID_COLUMNS;
      const points=[weightGrid.vertices[i],weightGrid.vertices[i+1],weightGrid.vertices[j+1],weightGrid.vertices[j]];
      const secondary=(selectedWeights[i]+selectedWeights[i+1]+selectedWeights[j]+selectedWeights[j+1])/4;
      heatmapCells.push({points:points.map(mapped),fill:weightColor(weightInfluence==='secondary'?secondary:1-secondary),key:i});
    }
  }
  const switchRigEditorTab=(next:RigEditorTab)=>{
    setRigEditorTab(next);setRigBoneEdit(false);setWeightPaintEnabled(false);weightStrokeRef.current=false;setWeightCursor(null);
    setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);setMaskAddPoint(false);setRigMaskContext(null);
  };
  const applyWeightBrush=(clientX:number,clientY:number)=>{
    const cursor=toRestMaskPoint(toNormalized(clientX,clientY),selectedCutout);
    const id=selectedCutout;
    setCutoutSkinWeights(prev=>({
      ...prev,[id]:paintSkinWeights(id,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides,
        prev[id]??autoSkinWeights(id,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides),
        cursor,weightBrushRadius,weightStrength,weightBrushMode,weightInfluence,weightReplaceValue),
    }));
  };
  const setAutoWeightsForSelected=()=>{
    if(cutoutSkinWeights[selectedCutout]&&!window.confirm('สร้าง Auto Weight ใหม่ทับน้ำหนักที่ระบายไว้ของชิ้นนี้?'))return;
    const weights=autoSkinWeights(selectedCutout,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides,autoWeightSoftness);
    setCutoutSkinWeights(prev=>({...prev,[selectedCutout]:weights}));
    notify(`คำนวณ Auto Weight ของ ${CUTOUT_PARTS.find(part=>part.id===selectedCutout)?.label} แล้ว โดยไม่กระจายไปชิ้นอื่น`);
  };
  const selectCutoutPart=(id:CutoutPartId)=>{
    setSelectedCutout(id);setSelectedCutoutVertex(null);setMaskAddPoint(false);setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);
  };
  const toRestMaskPoint=(point:Point,id:CutoutPartId)=>cutoutPreview?mapCutoutPoint(point,rigFrame.joints,rigFrames[0].joints,id,imageSize.width,imageSize.height):point;
  const convertMaskToPolygon=()=>{
    const polygon=makeEditableCutoutPolygon(selectedCutout,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
    setCutoutMaskOverrides(prev=>({...prev,[selectedCutout]:{...prev[selectedCutout],polygon}}));
    setMaskAddPoint(false);setSelectedCutoutVertex(null);setShowCutoutMasks(true);
    notify(`เปลี่ยน ${CUTOUT_PARTS.find(p=>p.id===selectedCutout)?.label} เป็น Polygon ${polygon.length} จุดแล้ว — ลากจุดแต่ละจุดเพื่อกำหนดขอบตัด`);
  };
  const startDrawingCutoutPolygon=()=>{
    setShowCutoutMasks(true);setCutoutPreview(false);setRigPlaying(false);
    setCutoutPolygonDraft([]);setDrawingCutoutPolygon(true);setMaskAddPoint(false);setSelectedCutoutVertex(null);
    notify('เริ่มวาด Polygon ใหม่ — คลิกตามเส้นขอบบนภาพอย่างน้อย 3 จุด แล้วกด จบ Polygon');
  };
  const finishDrawingCutoutPolygon=()=>{
    if(cutoutPolygonDraft.length<3){notify('Polygon ต้องมีอย่างน้อย 3 จุด');return;}
    setCutoutMaskOverrides(prev=>({...prev,[selectedCutout]:{...prev[selectedCutout],polygon:cutoutPolygonDraft.map(p=>[...p] as Point)}}));
    setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);
    notify(`บันทึก Polygon ${cutoutPolygonDraft.length} จุดสำหรับ ${selectedCutout} แล้ว — Preview จะใช้ Mask ตามเส้นใหม่นี้`);
  };
  const deleteMaskVertex=()=>{
    if(!selectedPolygon||selectedPolygon.length<=3||selectedCutoutVertex===null)return;
    setCutoutMaskOverrides(prev=>({...prev,[selectedCutout]:{...prev[selectedCutout],polygon:prev[selectedCutout]!.polygon!.filter((_,i)=>i!==selectedCutoutVertex)}}));
    setSelectedCutoutVertex(null);
  };
  const addMaskVertex=(event:MouseEvent<SVGPolygonElement>,id:CutoutPartId,force=false)=>{
    if((!maskAddPoint&&!force)||id!==selectedCutout)return;
    const polygon=cutoutMaskOverrides[id]?.polygon;
    if(!polygon)return;
    const point=toRestMaskPoint(toNormalized(event.clientX,event.clientY),id);
    const next=insertCutoutPolygonPoint(polygon,point,imageSize.width,imageSize.height);
    setCutoutMaskOverrides(prev=>({...prev,[id]:{...prev[id],polygon:next.polygon}}));
    setSelectedCutoutVertex(next.index);setMaskAddPoint(false);
  };
  const updateCutoutWidth=(value:number)=>{
    setCutoutWidths(prev=>({...prev,[selectedCutout]:value,...(linkCutoutPairs&&selectedPair?{[selectedPair]:value}:{})}));
  };
  const copyCutoutToPair=()=>{
    if(!selectedPair)return;
    setCutoutWidths(prev=>({...prev,[selectedPair]:prev[selectedCutout]??100}));
    notify('คัดลอกเปอร์เซ็นต์ความกว้างไปชิ้นคู่แล้ว');
  };
  const applyAllCutoutWidths=(value:number)=>{
    setGlobalCutoutWidth(value);
    setCutoutWidths(Object.fromEntries(CUTOUT_PARTS.map(p=>[p.id,value])) as CutoutWidths);
  };
  const resetSelectedMask=()=>{
    setCutoutWidths(prev=>({...prev,[selectedCutout]:100}));
    setCutoutMaskOverrides(prev=>{const next={...prev};delete next[selectedCutout];return next;});
    setSelectedCutoutVertex(null);setMaskAddPoint(false);setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);
  };

  const downloadAllGuides=async()=>{
    if(!imageUrl||rigExporting)return;
    setRigExporting('guides');
    try{
      const options=motionExportOptions();
      const blob=await exportGuidePack(options);
      downloadBlob(motionPackFilename(options,'guides'),blob);
      notify(`ดาวน์โหลด ZIP แล้ว: ${rigFrames.length} Bone Guides + Master + Contact Sheet + Prompts + JSON`);
    }catch(error){notify(error instanceof Error?error.message:'ส่งออกชุดไกด์ไม่สำเร็จ');}
    finally{setRigExporting(null);}
  };

  const copyAllGuidesAsSheet=async()=>{
    if(!imageUrl||rigExporting)return;
    setRigExporting('sheet');
    try{
      const blob=await renderMotionContactSheet(motionExportOptions());
      await copyPngBlob(blob);
      notify('คัดลอกภาพรวม Master + ไกด์ทุกเฟรมแล้ว — วางภาพหนึ่งครั้ง แล้ว Copy Prompt รวมอีกครั้ง');
    }catch(error){notify(error instanceof Error?error.message:'คัดลอกภาพรวมไม่สำเร็จ — ใช้ ZIP แทน');}
    finally{setRigExporting(null);}
  };

  const downloadCutoutMotion=async()=>{
    if(!imageUrl||rigExporting)return;
    setRigExporting('cutout');
    try{
      const options=motionExportOptions();
      const blob=await exportCutoutPack(options);
      downloadBlob(motionPackFilename(options,'cutout'),blob);
      notify(`ส่งออก Cutout ${CUTOUT_PARTS.length} ชิ้น + ภาพเคลื่อนไหว PixiJS ${rigFrames.length} เฟรมแล้ว`);
    }catch(error){notify(error instanceof Error?error.message:'ส่งออก Cutout ไม่สำเร็จ');}
    finally{setRigExporting(null);}
  };

  const autoPlaceRig = async () => {
    if(!imageUrl){notify('นำเข้ารูปก่อนวางโบน');return;}
    try{
      const bounds=await detectFigureBounds(imageUrl);
      rigBoundsRef.current=bounds;
      const neutral=initialJoints(bounds,rigDirection);
      setRigFrames(makeMotionFrames(neutral,rigDirection,rigMotion,rigFrames.length));setRigFrameIndex(0);
      notify('วางโครงกระดูกเริ่มต้นตามกรอบภาพแล้ว — โปรดลากแต่ละจุดให้ตรงข้อต่อจริง');
    }catch{notify('วางโครงจากภาพไม่ได้');}
  };

  const copyPreviousRigFrame = () => {
    const index=(rigFrameIndex+rigFrames.length-1)%rigFrames.length;
    setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?{joints:cloneJoints(prev[index].joints),nearSide:prev[index].nearSide,drawOrder:prev[index].drawOrder?.slice()}:f));
    notify(`คัดลอกโครงจากเฟรม ${index+1} มาเฟรม ${rigFrameIndex+1} แล้ว`);
  };

  const sampleColorAt = async (point:Point) => {
    const index=samplingColorIndex;
    setSamplingColorIndex(null);
    if(index===null||!imageUrl||!activePart)return;
    try{
      const image=new Image();image.src=imageUrl;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas ไม่พร้อม');ctx.drawImage(image,0,0);
      const x=Math.min(canvas.width-1,Math.floor(point[0]/1000*canvas.width)),y=Math.min(canvas.height-1,Math.floor(point[1]/1000*canvas.height));
      const rgba=ctx.getImageData(x,y,1,1).data;
      if(rgba[3]<32){notify('จุดนี้โปร่งใส กรุณาเลือกสีบนตัวละคร');return;}
      const hex='#'+Array.from(rgba.slice(0,3)).map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
      const id=activePart.id;
      setMap(prev=>({...prev,parts:prev.parts.map(p=>p.id===id?{...p,colors:p.colors.map((c,i)=>i===index?{...c,hex}:c)}:p)}));
      notify(`ดูดสี ${hex} จากภาพแล้ว (แก้ข้อมูล Palette ไม่ได้เปลี่ยนสีบน PNG)`);
    }catch(error){notify(error instanceof Error?error.message:'อ่านสีจากภาพไม่ได้');}
  };

  const copyShapeImage = async (kind: 'original' | 'guide') => {
    const blob = kind === 'original' ? masterBlob : shapeBlob;
    if (!blob) { notify('กำลังเตรียมภาพ กรุณารอสักครู่'); return; }
    try {
      await copyPngBlob(blob);
      notify(kind === 'original' ? 'คัดลอกรูปต้นฉบับแล้ว — ไป Ctrl+V วางใน ChatGPT ก่อนคัดลอกรูปถัดไป' : 'คัดลอกรูป Shape Guide แล้ว — ไป Ctrl+V วางใน ChatGPT ก่อนคัดลอก Prompt');
    } catch (error) { notify(error instanceof Error ? error.message : 'Copy PNG ไม่สำเร็จ — ดาวน์โหลด PNG แทน'); }
  };

  const toNormalized = (clientX: number, clientY: number): Point => {
    const rect = overlay.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return [0, 0];
    return normalizePoint([(clientX - rect.left) / rect.width * 1000, (clientY - rect.top) / rect.height * 1000]);
  };

  const onRigMaskContextMenu=(event:MouseEvent<SVGSVGElement>)=>{
    if(tab!=='rig'||!imageUrl||rigEditorTab!=='mask')return;
    event.preventDefault();event.stopPropagation();
    if(drawingCutoutPolygon)return;
    const node=(event.target as Element).closest('[data-cutout-part]');
    const found=node?.getAttribute('data-cutout-part');
    const partId=CUTOUT_PARTS.some(part=>part.id===found)?found as CutoutPartId:selectedCutout;
    const polygon=cutoutMaskOverrides[partId]?.polygon;
    const bounds=overlay.current?.getBoundingClientRect();
    const cursor=toNormalized(event.clientX,event.clientY);
    const posed=polygon?.map(point=>cutoutPreview?mapCutoutPoint(point,rigFrames[0].joints,rigFrame.joints,partId,imageSize.width,imageSize.height):point);
    const near=posed&&bounds?nearestCutoutPolygonVertex(posed,cursor,bounds.width,bounds.height,26):null;
    const vertexAttribute=node?.getAttribute('data-cutout-vertex');
    const directVertex=vertexAttribute===null||vertexAttribute===undefined?null:Number(vertexAttribute);
    setSelectedCutout(partId);setSelectedCutoutVertex(directVertex??near);
    setMaskAddPoint(false);setShowCutoutMasks(true);setRigPlaying(false);
    setRigMaskContext({clientX:Math.min(event.clientX,window.innerWidth-254),clientY:Math.min(event.clientY,window.innerHeight-330),partId,point:cursor,vertexIndex:directVertex??near});
  };

  const executeRigMaskContext=(command:'add'|'delete'|'select'|'convert'|'draw'|'reset'|'front'|'behind')=>{
    if(!rigMaskContext)return;
    const {partId,point,vertexIndex}=rigMaskContext;
    setRigMaskContext(null);setSelectedCutout(partId);setMaskAddPoint(false);
    if(command==='add'){
      const base=cutoutMaskOverrides[partId]?.polygon??makeEditableCutoutPolygon(partId,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
      const newPoint=toRestMaskPoint(point,partId);
      const added=insertCutoutPolygonPoint(base,newPoint,imageSize.width,imageSize.height);
      setCutoutMaskOverrides(prev=>({...prev,[partId]:{...prev[partId],polygon:added.polygon}}));
      setSelectedCutoutVertex(added.index);notify(`เพิ่มจุดบนขอบ ${CUTOUT_PARTS.find(p=>p.id===partId)?.label} แล้ว · ลากจุดสีเหลืองเพื่อปรับตำแหน่ง`);
    }else if(command==='delete'){
      if(vertexIndex===null)return;
      setCutoutMaskOverrides(prev=>{
        const polygon=prev[partId]?.polygon;
        if(!polygon||polygon.length<=3||vertexIndex>=polygon.length)return prev;
        return {...prev,[partId]:{...prev[partId],polygon:polygon.filter((_,i)=>i!==vertexIndex)}};
      });
      setSelectedCutoutVertex(null);notify('ลบจุด Polygon ที่อยู่ใกล้เมาส์แล้ว');
    }else if(command==='select'){
      setSelectedCutoutVertex(vertexIndex);
      notify('เลือกจุดบนขอบแล้ว · จับจุดสีเหลืองลากเพื่อแก้เส้นตัด');
    }else if(command==='convert'){
      const polygon=makeEditableCutoutPolygon(partId,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
      setCutoutMaskOverrides(prev=>({...prev,[partId]:{...prev[partId],polygon}}));
      setSelectedCutoutVertex(null);notify(`แปลง ${CUTOUT_PARTS.find(p=>p.id===partId)?.label} เป็น Polygon ${polygon.length} จุดแล้ว`);
    }else if(command==='draw'){
      setCutoutPreview(false);setRigPlaying(false);setCutoutPolygonDraft([]);setDrawingCutoutPolygon(true);setSelectedCutoutVertex(null);
      notify('วาดเส้นขอบใหม่ได้บน Canvas · จิ้มจุดอย่างน้อย 3 จุด แล้วกด จบ Polygon');
    }else if(command==='reset'){
      setCutoutWidths(prev=>({...prev,[partId]:100}));
      setCutoutMaskOverrides(prev=>{const next={...prev};delete next[partId];return next;});
      setSelectedCutoutVertex(null);notify('คืนขอบของชิ้นนี้เป็นค่าเริ่มต้นแล้ว');
    }else if(command==='front'||command==='behind'){
      setRigFrames(prev=>prev.map((frame,i)=>i===rigFrameIndex?placeCutoutLimbRelative(rigDirection,frame,partId,'torso',command==='front'?'after':'before'):frame));
      notify(`ปรับลำดับภาพเฟรม ${rigFrameIndex+1} ให้${command==='front'?'อยู่หน้าลำตัว':'อยู่หลังลำตัว'}แล้ว`);
    }
  };

  useEffect(()=>{
    if(!rigMaskContext)return;
    const onPointerDown=()=>setRigMaskContext(null);
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setRigMaskContext(null);};
    const onScroll=()=>setRigMaskContext(null);
    window.addEventListener('pointerdown',onPointerDown);
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('scroll',onScroll,true);
    return ()=>{window.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('keydown',onKeyDown);window.removeEventListener('scroll',onScroll,true);};
  },[rigMaskContext]);

  const onSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    if(rigMaskContext){setRigMaskContext(null);return;}
    if(tab==='rig'&&drawingCutoutPolygon){if(event.detail===1)setCutoutPolygonDraft(prev=>[...prev,toNormalized(event.clientX,event.clientY)]);return;}
    if(samplingColorIndex!==null){void sampleColorAt(toNormalized(event.clientX,event.clientY));return;}
    if(magicWand){void autoWandAt(toNormalized(event.clientX,event.clientY));return;}
    if (shapeDrawing && event.detail <= 1) setShapeDraft(prev => [...prev, toNormalized(event.clientX, event.clientY)]);
    else if (drawing && event.detail <= 1) setDrawPoints(prev => [...prev, toNormalized(event.clientX, event.clientY)]);
    else if (!drawing && !shapeDrawing && tab !== 'shape' && (event.target === overlay.current || (event.target as Element).tagName.toLowerCase() === 'rect')) setSelectedIds([]);
  };

  const onRigWeightPointerDown=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(tab!=='rig'||rigEditorTab!=='weight'||!weightPaintEnabled||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    setRigPlaying(false);
    weightStrokeRef.current=true;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyWeightBrush(event.clientX,event.clientY);
  };

  const onSvgMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if(tab==='rig'&&rigEditorTab==='weight'){
      setWeightCursor(toNormalized(event.clientX,event.clientY));
      if(weightPaintEnabled&&weightStrokeRef.current)applyWeightBrush(event.clientX,event.clientY);
      return;
    }
    if(dragCutoutVertex){
      const point=toRestMaskPoint(toNormalized(event.clientX,event.clientY),dragCutoutVertex.id);
      setCutoutMaskOverrides(prev=>{
        const current=prev[dragCutoutVertex.id]?.polygon;
        if(!current||!current[dragCutoutVertex.index])return prev;
        const polygon=current.map((old,i)=>i===dragCutoutVertex.index?point:old);
        return {...prev,[dragCutoutVertex.id]:{...prev[dragCutoutVertex.id],polygon}};
      });
      return;
    }
    if(dragCutoutMask){
      const pos=toNormalized(event.clientX,event.clientY);
      const point=cutoutPreview?mapCutoutPoint(pos,rigFrame.joints,rigFrames[0].joints,dragCutoutMask.id,imageSize.width,imageSize.height):pos;
      setCutoutMaskOverrides(prev=>({...prev,[dragCutoutMask.id]:{...prev[dragCutoutMask.id],[dragCutoutMask.handle]:point}}));
      return;
    }
    if(dragRigJoint){setRigJointAt(dragRigJoint,toNormalized(event.clientX,event.clientY));return;}
    if (dragShapeVertex) {
      const pos = toNormalized(event.clientX,event.clientY);
      setShapeBase(prev => prev.map((poly,i) => poly.map((point,j) => i===dragShapeVertex.polygon && j===dragShapeVertex.vertex ? pos : point)));
      return;
    }
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

  const handleSvgPointerUp = () => {weightStrokeRef.current=false;setDragVertex(null);setDragShapeVertex(null);setDragRigJoint(null);setDragCutoutMask(null);setDragCutoutVertex(null);};

  const changeColor = (partId: string, index: number, changes: Partial<CharacterPart['colors'][number]>) => {
    setMap(prev => ({ ...prev, parts: prev.parts.map(p => p.id === partId ? {
      ...p, colors: p.colors.map((c, i) => i === index ? { ...c, ...changes } : c),
    } : p) }));
  };

  const deleteColor = (partId:string,index:number) => {
    setMap(prev=>({...prev,parts:prev.parts.map(p=>p.id===partId?{...p,colors:p.colors.filter((_,i)=>i!==index)}:p)}));
    setSamplingColorIndex(null);
    notify('ลบสีออกจากข้อมูล Palette แล้ว — รูป PNG ไม่เปลี่ยน');
  };

  const imageButtons = <>
    <button className="subtle-button" onClick={() => imageInput.current?.click()}><ImageIcon size={16} /> นำเข้ารูป</button>
    <button className="subtle-button" onClick={() => mdInput.current?.click()}><FileText size={16} /> นำเข้า MD</button>
    <button className="subtle-button hidden-lg" onClick={() => jsonInput.current?.click()}><FileJson2 size={16} /> JSON</button>
  </>;

  if (page === 'home') {
    return <HomePage
      onOpenStudio={() => goToPage('guide')}
      onOpenWorkspace={() => goToPage('studio')}
      onOpenExample={() => { resetDemo(); goToPage('studio'); }}
      onOpenTemplateGuide={() => goToPage('guide')}
      onDownloadTemplate={downloadTemplate}
    />;
  }

  if (page === 'guide') {
    return <GuidePage
      onHome={() => goToPage('home')}
      onOpenStudio={() => goToPage('studio')}
      onOpenExample={() => { resetDemo(); goToPage('studio'); }}
      onDownloadTemplate={downloadTemplate}
    />;
  }

  return (
    <div className="app-shell studio-v05">
      <input ref={imageInput} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={importImage} />
      <input ref={mdInput} type="file" className="hidden" accept=".md,.markdown,text/markdown,text/plain" onChange={importMd} />
      <input ref={jsonInput} type="file" className="hidden" accept=".json,application/json" onChange={importJson} />
      <input ref={candidateInput} type="file" className="hidden" accept="image/*" onChange={importCandidate} />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={21} strokeWidth={2.15} /></div>
          <div><div className="brand-title">CHARACTER<span>STUDIO</span></div><div className="brand-caption">MY-GAME-DESIGN <span className="version-dot">●</span> LOCAL WORKSPACE</div></div>
        </div>
        <div className="top-actions"><button className="subtle-button home-return" onClick={() => goToPage('home')}><House size={16}/> หน้าแรก</button><button className="subtle-button" onClick={() => goToPage('guide')}><BookOpenText size={16}/> คู่มือเริ่มต้น</button>{mode!=='animation'&&imageButtons}{mode!=='rig'&&mode!=='animation'&&<button className="primary-button" onClick={downloadTemplate}><Download size={16} /> AI Template <span className="hidden-mobile">.md</span></button>}</div>
      </header>

      <WorkspaceModeNav value={mode} onChange={switchMode}/>

      {animationMounted&&<div style={{display:mode==='animation'?'block':'none'}}><AnimationPreviewWorkspace active={mode==='animation'}/></div>}
      {mode!=='animation'&&<div className="workspace-grid">
        <aside className="sidebar panel-scroll">
          <div className="sidebar-header"><span className="eyebrow">PROJECT EXPLORER</span><button title="เปิด Novice Female Demo" className="icon-button" onClick={resetDemo}><RotateCcw size={16}/></button></div>
          <div className="project-card">
            <div className="project-thumbnail">{imageUrl ? <img src={imageUrl} alt="Character preview" /> : <ImageIcon size={23}/>}</div>
            <div className="min-w-0"><div className="project-name">{map.character.name}</div><div className="project-meta"><span className="status-circle" /> MASTER · V{version}</div><div className="project-size">{imageSize.width} × {imageSize.height}px</div></div>
          </div>

          {(mode==='design'||mode==='shape'||mode==='ai') ? <>
          <div className="library-heading"><span>IMAGE PARTS / TAGS</span><span className="count-badge">{count}</span></div>
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
          </> : mode==='rig' ? <div className="rig-left-workspace">
            <div className="rig-left-heading"><Bone size={22}/><div><h3>Bone Workspace</h3><p>โครงกระดูก 19 จุด · {rigMotion.toUpperCase()} · {rigDirection}</p></div></div>
            <p className="rig-left-context">ฝั่งขวาใช้แก้ Motion, Mask และ Draw Order ส่วนฝั่งนี้เก็บไฟล์ที่ต้องส่งให้ ChatGPT หรือใช้ในเกม</p>
            <RigExportHub
              frameCount={rigFrames.length} imageLoaded={Boolean(imageUrl)} hasGuide={Boolean(rigGuideBlob)} exporting={rigExporting!==null}
              onDownloadAll={()=>{void downloadAllGuides();}} onDownloadCutout={()=>{void downloadCutoutMotion();}}
              onCopySheet={()=>{void copyAllGuidesAsSheet();}}
              onCopyBatchPrompt={()=>{void copyText(rigBatchPrompt).then(()=>notify(`คัดลอก Prompt รวม ${rigFrames.length} เฟรมแล้ว`));}}
              onCopyGuide={()=>{if(rigGuideBlob){void copyPngBlob(rigGuideBlob).then(()=>notify('คัดลอก Bone Guide แล้ว')).catch(()=>notify('Clipboard ไม่พร้อม ใช้ดาวน์โหลด Guide PNG แทน'));}}}
              onCopyPrompt={()=>{void copyText(rigPrompt).then(()=>notify('คัดลอก Pose Prompt เฟรมนี้แล้ว'));}}
              onDownloadTemplate={downloadTemplate}
              onDownloadCurrent={()=>{if(rigGuideBlob){downloadBlob(`${basename(imageName||'character')}_${rigDirection}_frame_${rigFrameIndex+1}_bone_guide.png`,rigGuideBlob);notify('ดาวน์โหลด Bone Guide PNG แล้ว');}}}
              onExportJson={()=>{downloadText(`${basename(imageName||'character')}_${rigDirection}_${rigMotion}_${rigFrames.length}frames.json`,JSON.stringify({schema_version:'1.2',coordinate_system:'normalized_1000',source_image:imageName,motion:rigMotion,direction:rigDirection,frame_count:rigFrames.length,frames:rigFrames,cutout_width_percent:cutoutWidths,cutout_mask_endpoints:cutoutMaskOverrides,cutout_mask_overrides:cutoutMaskOverrides,skin_weight_secondary_per_mesh_vertex:cutoutSkinWeights},null,2),'application/json');notify(`ส่งออก ${rigFrames.length} Frames JSON แล้ว`);}}
            />
          </div> : <div className="mode-side-panel"><BookOpenText size={30}/><h3>MD / Mapping</h3><p>MD มีทั้งคำอธิบายและ JSON สำหรับโปรแกรม เพื่อเชื่อม Region กับรูป Master</p><div className="mode-side-stat"><span>Part Maps</span><strong>{count}</strong></div><button onClick={()=>mdInput.current?.click()}>นำเข้า MD</button><button onClick={downloadTemplate}>ดาวน์โหลด AI Template</button><p>MD ไม่ใช่ข้อมูลสีจริงจากทุกพิกเซล และไม่ใช่ Layer ของภาพ</p></div>}

          <div className="sidebar-bottom">
            {(mode==='design'||mode==='shape'||mode==='ai')&&<button className="add-part-button" disabled={!imageUrl} onClick={addPart}><Plus size={16}/> เพิ่ม Tag / กำหนด Region</button>}
            {mode!=='rig'&&<div className="sidebar-mini-actions"><button onClick={downloadMap}><Save size={15}/> Export MD</button><button onClick={exportJson}><FileJson2 size={15}/> Export JSON</button></div>}
            <div className="sidebar-foot"><ShieldCheck size={15}/><span>ข้อมูลทำงานใน Browser · ไม่มีการส่งภาพไปเซิร์ฟเวอร์</span></div>
          </div>
        </aside>

        <main className="main-area">
          <div className="canvas-topbar">
            <div className="document-title"><span className="document-icon"><FolderOpen size={18}/></span><div><h1>{map.character.name}</h1><p><span>REFERENCE BOARD</span><span className="dot-sep">/</span>{map.character.view}</p></div></div>
            <div className="canvas-tools"><button onClick={() => mode==='rig'?setShowCutoutMasks(v=>!v):setShowOutlines(v=>!v)} className={`tool-chip ${(mode==='rig'?showCutoutMasks:showOutlines) ? 'tool-on' : ''}`} title={mode==='rig'?'แสดง/ซ่อนเส้น Cutout Mask ที่ใช้ตัดพิกเซลจริง':'แสดงหรือซ่อนเส้น Region สำหรับ Tag (ไม่ใช่การตัดสี)'}><Crosshair size={15}/> <span>{mode==='rig'?'Mask':'Region'}</span></button><span className="tool-divider"/><button disabled={!imageUrl} title="ย่อภาพ (−)" onClick={() => requestZoom(stepZoom(zoomRef.current, -1))} className="icon-button"><ZoomOut size={17}/></button><span className="zoom-readout">{Math.round(zoom * 100)}%</span><button disabled={!imageUrl} title="ขยายภาพ (+)" onClick={() => requestZoom(stepZoom(zoomRef.current, 1))} className="icon-button"><ZoomIn size={17}/></button><button disabled={!imageUrl} title="รีเซ็ต Zoom 100%" onClick={() => requestZoom(1)} className="icon-button"><Maximize size={16}/></button></div>
          </div>

          <div className="canvas-content">
            <div className="canvas-watermark top-left">FIG. 001 <span className="watermark-line"/> CHARACTER REFERENCE</div>
            <div className="canvas-watermark top-right">{map.coordinate_system} <span className="watermark-line"/> {count} PARTS</div>
            {imageUrl ? <div ref={canvasViewport} className={`canvas-scroll ${canvasFocused ? 'canvas-focused' : ''} ${panning ? 'canvas-panning' : ''}`} tabIndex={0} aria-label="พื้นที่ภาพ คลิกเพื่อโฟกัสแล้วหมุนล้อเพื่อซูม กดล้อเมาส์ค้างเพื่อลากดูภาพ" onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={finishCanvasPan} onPointerCancel={finishCanvasPan} onLostPointerCapture={() => {panRef.current = null;setPanning(false);}} onAuxClick={event => {if (event.button === 1) event.preventDefault();}} onFocus={() => setCanvasFocused(true)} onBlur={() => setCanvasFocused(false)} onKeyDown={event => {if (event.key === '+' || event.key === '=') {event.preventDefault();requestZoom(stepZoom(zoomRef.current,1));} else if (event.key === '-') {event.preventDefault();requestZoom(stepZoom(zoomRef.current,-1));} else if (event.key === '0') {event.preventDefault();requestZoom(1);}}}>
              <div className="canvas-stage" style={{ width: stageSize.width, height: stageSize.height }}>
              <div ref={artboardRef} className="artboard" style={{ width: renderedSize.width, height: renderedSize.height }}>
                <div className="checker"/>
                <img src={imageUrl} className="master-image" style={tab==='rig'&&cutoutPreview?{opacity:0}:undefined} alt={`Master reference: ${map.character.name}`} draggable={false}/>
                {tab==='rig'&&cutoutPreview&&<CutoutPreview imageUrl={imageUrl} rest={rigFrames[0].joints} frame={rigFrame} direction={rigDirection} widths={cutoutWidths} maskOverrides={cutoutMaskOverrides} skinWeights={cutoutSkinWeights}/>}
                {candidateUrl && <img src={candidateUrl} alt="AI candidate overlay" className="master-image candidate-image" style={{opacity: compare / 100}} draggable={false}/>}
                <svg ref={overlay} className={`region-layer ${drawing || shapeDrawing || magicWand || samplingColorIndex!==null ? 'drawing' : ''} ${tab === 'shape' ? 'shape-tool-mode' : ''} ${shapeDrawing ? 'shape-drawing-mode' : ''} ${tab==='rig'&&rigEditorTab==='weight'&&weightPaintEnabled?'rig-v10-paint-cursor':''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" onClick={onSvgClick} onContextMenu={onRigMaskContextMenu} onPointerDown={onRigWeightPointerDown} onPointerMove={onSvgMove} onPointerLeave={()=>setWeightCursor(null)} onPointerUp={handleSvgPointerUp} onPointerCancel={handleSvgPointerUp}>
                  <rect x="0" y="0" width="1000" height="1000" fill="transparent" />
                  {regionsApproved && !candidateUrl && mode === 'design' && sortedRegions.map(part => part.polygons.map((poly, pIndex) => {
                    const selected = selectedIds.includes(part.id);
                    const hovered = hoverId === part.id;
                    return <polygon key={`${part.id}:${pIndex}`} points={pointString(poly)}
                      className={`region-polygon ${selected ? 'selected' : hovered ? 'hovered' : showOutlines ? 'outlines-on' : ''}`}
                      onClick={e => { if (drawing) return; e.stopPropagation(); selectPart(part.id, e.shiftKey); }}
                      onMouseEnter={() => setHoverId(part.id)} onMouseLeave={() => setHoverId(prev => prev === part.id ? null : prev)}>
                      <title>{part.name_th} / {part.name_en}</title>
                    </polygon>;
                  }))}
                  {regionsApproved && tab === 'tag' && !candidateUrl && !drawing && activePart?.polygons.map((poly, pIndex) => poly.map(([x, y], vertex) => <circle key={`handle-${pIndex}-${vertex}`} cx={x} cy={y} r={9} className="vertex-handle"
                    onPointerDown={e => { if (e.button !== 0) return; e.stopPropagation(); (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId); setDragVertex({id:activePart.id, polygon:pIndex, vertex}); }}
                    onPointerMove={e => { if (dragVertex?.id === activePart.id) onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>); }}
                    onPointerUp={e => {e.stopPropagation();setDragVertex(null);}}
                    onClick={e => e.stopPropagation()} />))}
                  {drawing && <>
                    {drawPoints.length > 1 && <polyline points={pointString(drawPoints)} fill="none" stroke="#FFDA8B" strokeWidth="4" strokeDasharray="10 7" vectorEffect="non-scaling-stroke"/>}
                    {drawPoints.map(([x,y],i) => <circle key={`draft-${i}`} cx={x} cy={y} r={9} fill="#F8D286" stroke="#2A1B13" strokeWidth="2" />)}
                  </>}
                  {tab === 'shape' && !candidateUrl && <>
                    {shapeSource.map((poly,i) => <polygon key={`shape-old-${i}`} className="shape-original" points={pointString(poly)}/>) }
                    {shapeTarget.map((poly,i) => <polygon key={`shape-new-${i}`} className="shape-target" points={pointString(poly)}/>) }
                    {!shapeDrawing && shapePrimaryTarget.map((poly,pIndex) => poly.map(([x,y],vertex) => <circle key={`shape-vertex-${pIndex}-${vertex}`} className="shape-handle" cx={x} cy={y} r={11}
                      onPointerDown={e => {if(e.button!==0)return;e.stopPropagation();(e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);setShapeBase(cloneRegion(shapePrimaryTarget));setShapeValues(DEFAULT_SHAPE_VALUES);setDragShapeVertex({polygon:pIndex,vertex});}}
                      onPointerMove={e => {if(dragShapeVertex) onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>);}}
                      onPointerUp={e => {e.stopPropagation();setDragShapeVertex(null);}}
                      onClick={e=>e.stopPropagation()}/>))}
                    {shapeDrawing && <g className="shape-draft"><polyline points={pointString(shapeDraft)} fill="none" stroke="#FFB655" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeDasharray="7 5"/>{shapeDraft.map(([x,y],i)=><circle key={`shape-draft-${i}`} cx={x} cy={y} r={9} fill="#FFDA86" stroke="#76542B" strokeWidth="2"/>)}</g>}
                    {mirrorShape && <line x1={mirrorAxis} x2={mirrorAxis} y1="0" y2="1000" className="shape-mirror-axis"/>}
                  </>}
                  {tab==='rig'&&!candidateUrl&&<g className="rig-canvas-overlay">
                    {((rigEditorTab==='mask'&&showCutoutMasks)||rigEditorTab==='weight')&&!drawingCutoutPolygon&&CUTOUT_PARTS.filter(part=>rigEditorTab==='weight'?part.id===selectedCutout:(showAllCutoutMasks||part.id===selectedCutout)).sort((a,b)=>Number(a.id===selectedCutout)-Number(b.id===selectedCutout)).map(part=>{
                      const geometry=getCutoutMaskGeometry(part.id,rigFrames[0].joints,imageSize.width,imageSize.height,cutoutWidths,cutoutMaskOverrides);
                      const mapped=(point:Point)=>cutoutPreview?mapCutoutPoint(point,rigFrames[0].joints,rigFrame.joints,part.id,imageSize.width,imageSize.height):point;
                      const custom=Boolean(cutoutMaskOverrides[part.id]?.polygon?.length);
                      return <polygon key={`mask-${part.id}`} data-cutout-part={part.id} points={pointString(geometry.polygon.map(mapped))} className={`cutout-mask-outline ${part.id===selectedCutout?'selected':'other'} ${part.id===selectedCutout&&maskAddPoint?'adding':''}`}
                        onClick={e=>{e.stopPropagation();if(part.id===selectedCutout&&maskAddPoint)addMaskVertex(e,part.id);else selectCutoutPart(part.id);}}
                        onDoubleClick={e=>{e.stopPropagation();if(part.id===selectedCutout&&custom&&!maskAddPoint)addMaskVertex(e,part.id,true);}}>
                        <title>{part.label} — {custom?'Polygon แบบแก้จุดได้':`Capsule ${cutoutWidths[part.id]??100}%`}</title>
                      </polygon>;
                    })}
                    {rigEditorTab==='mask'&&showCutoutMasks&&!selectedPolygon&&!drawingCutoutPolygon&&(()=>{
                      const start=cutoutPreview?mapCutoutPoint(selectedMaskGeometry.start,rigFrames[0].joints,rigFrame.joints,selectedCutout,imageSize.width,imageSize.height):selectedMaskGeometry.start;
                      const end=cutoutPreview?mapCutoutPoint(selectedMaskGeometry.end,rigFrames[0].joints,rigFrame.joints,selectedCutout,imageSize.width,imageSize.height):selectedMaskGeometry.end;
                      return <g className="cutout-mask-edit-handles">
                        <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} className="cutout-mask-center-line"/>
                        {([{key:'start',point:start},{key:'end',point:end}] as const).map(({key,point})=><g key={key}>
                          <circle cx={point[0]} cy={point[1]} r="12" className={`cutout-mask-anchor ${key}`}
                            onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();setRigPlaying(false);(e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);setDragCutoutMask({id:selectedCutout,handle:key});}}
                            onPointerMove={e=>{if(dragCutoutMask?.id===selectedCutout)onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>);}}
                            onPointerUp={e=>{e.stopPropagation();setDragCutoutMask(null);}}
                            onClick={e=>e.stopPropagation()}/>
                          <text className="cutout-mask-anchor-label" x={point[0]+16} y={point[1]-15}>{key.toUpperCase()}</text>
                        </g>)}
                      </g>;
                    })()}
                    {rigEditorTab==='weight'&&weightShowHeatmap&&<g className="rig-v10-weight-overlay" pointerEvents="none">
                      <defs><clipPath id="rig-v10-weight-clip"><polygon points={pointString(selectedMaskGeometry.polygon.map(point=>cutoutPreview?mapCutoutPoint(point,rigFrames[0].joints,rigFrame.joints,selectedCutout,imageSize.width,imageSize.height):point))}/></clipPath></defs>
                      <g clipPath="url(#rig-v10-weight-clip)">{heatmapCells.map(cell=><polygon key={cell.key} points={pointString(cell.points)} fill={cell.fill} stroke={cell.fill} strokeWidth="1"/>)}</g>
                    </g>}
                    {rigBoneVisible&&<g className={`rig-v10-bone-layer ${rigEditorTab!=='bone'?'ghost':rigBoneEdit?'editing':'locked'}`}>
                    {BONES.map(([a,b])=>{const nearness=boneIsNear(b,rigDirection,rigFrame.nearSide);return <line key={`${a}-${b}`} x1={rigFrame.joints[a][0]} y1={rigFrame.joints[a][1]} x2={rigFrame.joints[b][0]} y2={rigFrame.joints[b][1]} className={`rig-bone ${nearness===true?'rig-near':nearness===false?'rig-far':'rig-center'}`}/>;})}
                    {JOINTS.map(([id,label])=>{const [x,y]=rigFrame.joints[id];return <g key={id}>
                      <circle cx={x} cy={y} r={rigSelectedJoint===id?12:9} className={`rig-joint ${rigSelectedJoint===id?'active':''}`}
                        onPointerDown={e=>{if(e.button!==0||rigEditorTab!=='bone'||!rigBoneEdit)return;e.stopPropagation();setRigPlaying(false);setRigSelectedJoint(id);(e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);setDragRigJoint(id);}}
                        onPointerMove={e=>{if(dragRigJoint===id)onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>);}}
                        onPointerUp={e=>{e.stopPropagation();setDragRigJoint(null);}} onClick={e=>e.stopPropagation()}/>
                      {rigShowLabels&&rigEditorTab==='bone'&&<text x={x+13} y={y-11} className="rig-joint-label">{label}</text>}
                    </g>;})}</g>}
                    {rigEditorTab==='weight'&&weightCursor&&weightPaintEnabled&&<ellipse cx={weightCursor[0]} cy={weightCursor[1]} rx={weightBrushRadius*1000/imageSize.width} ry={weightBrushRadius*1000/imageSize.height} className="rig-v10-brush-ring" pointerEvents="none"/>}
                    {rigEditorTab==='mask'&&showCutoutMasks&&!drawingCutoutPolygon&&selectedPolygon?.map((point,index)=>{
                      const mapped=cutoutPreview?mapCutoutPoint(point,rigFrames[0].joints,rigFrame.joints,selectedCutout,imageSize.width,imageSize.height):point;
                      return <g key={`cutout-vertex-${selectedCutout}-${index}`}>
                        <circle data-cutout-part={selectedCutout} data-cutout-vertex={index} cx={mapped[0]} cy={mapped[1]} r={selectedCutoutVertex===index?11:8} className={`cutout-polygon-vertex ${selectedCutoutVertex===index?'active':''}`}
                          onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();setRigPlaying(false);setMaskAddPoint(false);setSelectedCutoutVertex(index);(e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);setDragCutoutVertex({id:selectedCutout,index});}}
                          onPointerMove={e=>{if(dragCutoutVertex?.id===selectedCutout)onSvgMove(e as unknown as ReactPointerEvent<SVGSVGElement>);}}
                          onPointerUp={e=>{e.stopPropagation();setDragCutoutVertex(null);}}
                          onClick={e=>e.stopPropagation()}><title>จุด Mask #{index+1} — ลากแก้ตำแหน่ง หรือเลือกแล้วกดลบ</title></circle>
                      </g>;
                    })}
                  </g>}
                  {tab==='rig'&&rigEditorTab==='mask'&&drawingCutoutPolygon&&<g className="rig-v08-drawing-overlay">
                    <rect x="0" y="0" width="1000" height="1000" fill="transparent" className="rig-v08-drawing-hitbox"/>
                    {cutoutPolygonDraft.length>0&&<polyline points={pointString(cutoutPolygonDraft)} className="rig-v08-drawing-line"/>}
                    {cutoutPolygonDraft.map(([x,y],i)=><circle key={`mask-draft-${i}`} cx={x} cy={y} r="8" className="rig-v08-drawing-point"/>)}
                  </g>}
                  {(magicWand||samplingColorIndex!==null)&&<rect x="0" y="0" width="1000" height="1000" fill="transparent" className="canvas-picker-hitbox"/>}
                </svg>
              </div>
              </div>
            </div> : <div className="canvas-empty-state"><div className="canvas-empty-icon"><ImageIcon size={29}/></div><div className="canvas-empty-kicker">NEW CHARACTER REFERENCE</div><h2>เริ่มจากนำเข้าภาพตัวละคร</h2><p>ถ้ายังไม่มีภาพหรือ MD ให้เปิดคู่มือเริ่มต้นเพื่อรับ Prompt สร้างรูป ดาวน์โหลด Template และสั่ง AI วิเคราะห์ทีละขั้นตอน</p><div className="canvas-empty-actions"><button onClick={() => imageInput.current?.click()}><Upload size={17}/> นำเข้ารูปภาพ</button><button onClick={() => goToPage('guide')}><BookOpenText size={17}/> คู่มือเริ่มต้น</button><button onClick={resetDemo}><Sparkles size={17}/> เปิด Example</button></div><span>เมื่อมีรูปแล้ว ให้กดนำเข้า MD เพื่อเชื่อมข้อมูลสี วัสดุ และขอบเขต</span></div>}
            {pendingCompatibility && !pendingCompatibility.compatible && <div className="canvas-warning"><AlertTriangle size={15}/> MD ระบุ {pendingMap?.value.image.width}×{pendingMap?.value.image.height} แต่ภาพ {imageSize.width}×{imageSize.height} — บล็อก Region ผิดรูป <button onClick={()=>setTab('docs')}>ดูวิธีแก้</button></div>}
            {imageUrl && mismatchedDimensions && <div className="canvas-warning"><AlertTriangle size={15}/> MD ระบุ {map.image.width}×{map.image.height} แต่ภาพปัจจุบัน {imageSize.width}×{imageSize.height} — ตรวจ Mapping อีกครั้ง</div>}
            {!regionsApproved && mapWarnings.length>0 && <div className="canvas-warning"><AlertTriangle size={15}/> MD มีสิ่งที่ต้องตรวจ ({mapWarnings.length} ข้อ) — ซ่อน Region จนกว่าจะยืนยัน <button onClick={()=>setTab('docs')}>ตรวจสอบ MD</button></div>}
            {mapQuality?.suspicious && !regionsApproved && !mapWarnings.length && <div className="canvas-warning"><AlertTriangle size={15}/> ตรวจพบ {mapQuality.outsideParts}/{mapQuality.checkedParts} Tags บนพื้นโปร่งใส — ซ่อน Region ที่น่าสงสัย <button onClick={()=>setTab('docs')}>ดูผลตรวจ</button></div>}
            {drawing && <div className="drawing-banner"><PenLine size={17}/><span>คลิกบนรูปเพื่อกำหนดจุด · {drawPoints.length} จุด</span><button onClick={finishDraw} className="banner-finish">จบ Polygon</button><button onClick={() => {setDrawing(false);setDrawPoints([]);}} className="banner-close" title="ยกเลิก"><X size={16}/></button></div>}
            {shapeDrawing && <div className="drawing-banner"><Shapes size={17}/><span>Shape Guide · คลิกจุดรอบรูปทรงเป้าหมาย ({shapeDraft.length})</span><button onClick={finishShapeDrawing} disabled={shapeDraft.length<3} className="banner-finish">จบรูปทรง</button><button onClick={()=>{setShapeDrawing(false);setShapeDraft([]);}} className="banner-close" title="ยกเลิก"><X size={16}/></button></div>}
            {hoverId && !drawing && !candidateUrl && <div className="hover-label"><span className="hover-indicator"/>{map.parts.find(p => p.id === hoverId)?.name_th} <span>{hoverId}</span></div>}
            {tab==='rig'&&imageUrl&&!drawingCutoutPolygon&&<div className="rig-v09-canvas-help">{rigEditorTab==='mask'?<><PenTool size={14}/><span>Mask · คลิกขวาบนภาพเพื่อเพิ่ม/ลบจุด</span></>:rigEditorTab==='weight'?<><Paintbrush size={14}/><span>{weightPaintEnabled?'Weight Paint · กดเมาส์ซ้ายค้างแล้วระบายลง Mesh':'Weight View · เปิด Edit / Paint ที่แผงขวาเพื่อเริ่มระบาย'}</span></>:rigEditorTab==='bone'?<><Bone size={14}/><span>{rigBoneEdit?'Bone Edit · ลากข้อต่อ · Mirror ตามตัวเลือก':'Bone View · เปิด Edit Bones ก่อนลากข้อต่อ'}</span></>:<><Layers3 size={14}/><span>Depth · จัดหน้า–หลังแยกตามเฟรม</span></>}</div>}
            <div className="canvas-bottom"><div><span className="coordinate-icon">⊞</span> {imageUrl ? (panning ? 'กำลังจับลาก Canvas ด้วยเมาส์กลาง…' : canvasFocused ? 'WHEEL ZOOM: 25%–1000% · MIDDLE MOUSE: PAN · + / − / 0' : 'คลิก Canvas เพื่อเปิด WHEEL ZOOM · กดล้อเมาส์ค้างเพื่อเลื่อน Canvas') : 'AWAITING IMAGE IMPORT'}</div><div><span className="green-small"/> {imageUrl ? 'PNG MASTER' : 'EMPTY WORKSPACE'} <span className="bottom-divider"/> <strong>V{version}</strong></div></div>
          </div>

          <div className="bottom-workbar">
            {mode==='design'?<><div><div className="workbar-title"><Palette size={16}/> Inspect & Palette</div><div className="workbar-subtitle">เลือก Tag เพื่อตรวจสี/วัสดุ · แก้ Region และสีในข้อมูลได้ แต่ไม่เปลี่ยนสี PNG จริง</div></div><button className="workbar-cta" disabled={!imageUrl} onClick={()=>setTab('tag')}>แก้ Tag / สี <ChevronRight size={16}/></button></>:
             mode==='shape'?<><div><div className="workbar-title"><Shapes size={16}/> Shape Guide</div><div className="workbar-subtitle">วาดรูปทรงเป้าหมายด้วย Polygon / Mirror แล้วส่งภาพกำกับให้ AI</div></div><button className="workbar-cta" disabled={!imageUrl} onClick={startShapeDrawing}>เริ่มวาดรูปทรง <ChevronRight size={16}/></button></>:
             mode==='rig'?<><div><div className="workbar-title"><Bone size={16}/> {rigMotion.toUpperCase()} · {rigFrames.length} Frames · PixiJS Cutout</div><div className="workbar-subtitle">ภาพต้นฉบับยังไม่เปลี่ยน · PixiJS จะดัดชิ้น Cutout แบบประมาณเพื่อดูท่าและตรวจซ้อนทับ</div></div><button className="workbar-cta" disabled={!imageUrl} onClick={()=>setCutoutPreview(v=>!v)}>{cutoutPreview?'ดูภาพ Master':'ดู Cutout Preview'} <ChevronRight size={16}/></button></>:
             mode==='docs'?<><div><div className="workbar-title"><BookOpenText size={16}/> Markdown Character Map</div><div className="workbar-subtitle">MD เก็บข้อมูลมนุษย์อ่าน + JSON สำหรับระบบ ไม่ใช่ Layer ของภาพ</div></div><button className="workbar-cta" onClick={downloadTemplate}>ดาวน์โหลด Template <ChevronRight size={16}/></button></>:
             <><div><div className="workbar-title"><Sparkles size={16}/> Prompt-driven part editing</div><div className="workbar-subtitle">เลือกชิ้นส่วนที่ต้องแก้ แล้วเตรียม Prompt / Mask ให้ AI ภายนอก</div></div><button className="workbar-cta" disabled={!imageUrl} onClick={() => setTab('shape')}>ปรับรูปทรงอีกโหมด <ChevronRight size={16}/></button></>}
          </div>
        </main>

        <aside className="inspector panel-scroll">
          <div className="inspector-head mode-inspector-head"><div><span className="eyebrow">CURRENT WORKSPACE MODE</span><h2>{MODE_INFO[mode].name}<span className="head-dot">.</span></h2><p>{MODE_INFO[mode].description}</p></div><div className="inspector-tag"><Tag size={12}/> v0.5</div></div>
          <details className="mode-help"><summary><CircleHelp size={16}/> โหมดนี้ทำอะไรได้? <span>แตะเพื่อดูคำอธิบาย</span></summary><p>{MODE_INFO[mode].detail}</p></details>
          {mode==='design'&&<div className="design-subnav">
            <button className={tab==='inspect'?'current':''} onClick={()=>setTab('inspect')} title="ดูสเปก สี วัสดุ โดยไม่แก้ภาพ"><MousePointer2 size={18}/><span><strong>Inspect</strong><small>ตรวจสีและวัสดุ</small></span></button>
            <button className={tab==='tag'?'current':''} onClick={()=>setTab('tag')} title="แก้ Tag, Region, Palette และข้อมูลประกอบ"><Palette size={18}/><span><strong>Tag & Palette</strong><small>แก้ขอบและข้อมูลสี</small></span></button>
          </div>}

          {tab === 'inspect' && <div className="inspector-body">
            <div className="mode-explain"><Info size={17}/><span>Inspect แสดงข้อมูลใน MD เช่น ชื่อวัสดุและรหัสสีที่ AI หรือผู้ใช้ระบุ <strong>ไม่ได้ดูดสีหรือแบ่งรูปเป็น Layer ให้อัตโนมัติ</strong></span></div>
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
            <div className="mode-explain"><Info size={17}/><span>Tag คือป้ายชื่อชิ้นส่วน; Region คือกรอบ Polygon ใช้เลือกและบอก AI ว่าจะแก้บริเวณไหน <strong>การเปลี่ยน Region / สี HEX ตรงนี้ยังไม่เปลี่ยนพิกเซลของรูป PNG</strong></span></div>
            {activePart ? <>
              <h3 className="editor-title">แก้ Tag และขอบเขต</h3><p className="editor-explain">ข้อมูลที่แก้จะบันทึกในหน่วยความจำก่อน กด Export MD เพื่อเก็บใช้งานต่อ</p>
              <Label>ชื่อชิ้นส่วน (ไทย)</Label><input className="form-input" value={activePart.name_th} onChange={e => updatePart(activePart.id, { name_th:e.target.value })}/>
              <Label>ชื่อชิ้นส่วน (English)</Label><input className="form-input" value={activePart.name_en} onChange={e => updatePart(activePart.id, { name_en:e.target.value })}/>
              <Label>Material</Label><input className="form-input" value={activePart.material} onChange={e => updatePart(activePart.id, { material:e.target.value })}/>
              <div className="two-col"><div><Label>Group (หมวดชิ้นส่วน)</Label><input className="form-input" value={activePart.group} title="ใช้จัดกลุ่ม Tag ในรายการด้านซ้าย" onChange={e => updatePart(activePart.id, {group:e.target.value})}/></div><div><Label>Z index (ลำดับซ้อน)</Label><input className="form-input" title="ค่าเยอะจะแสดงเส้น Tag ไว้ด้านหน้า ไม่ได้เปลี่ยนว่าแขนขาส่วนใดถูกวาดทับใน PNG" type="number" value={activePart.z_index} onChange={e => updatePart(activePart.id, {z_index:Number(e.target.value)})}/></div></div>
              <Label>Anatomical side (ซ้าย/ขวาของตัวละคร)</Label><select className="form-input" title="ซ้ายและขวาตามร่างกายตัวละคร ไม่ใช่ซ้ายขวาของภาพ" value={activePart.side} onChange={e => updatePart(activePart.id, {side:e.target.value as CharacterPart['side']})}><option value="center">center</option><option value="character_left">character_left</option><option value="character_right">character_right</option><option value="both">both</option><option value="none">none</option></select>
              <Label>Pair key (เช่น boots / gloves)</Label><input className="form-input" value={activePart.pair_key ?? ''} onChange={e => updatePart(activePart.id, {pair_key:e.target.value})}/>
              <div className="section-title"><span>REGION / POLYGON</span><span className="section-rule"/></div>
              <div className="region-edit-card"><ScanLine size={22}/><div><strong>{activePart.polygons.length} รูปร่าง · {activePart.polygons.reduce((sum,p) => sum + p.length,0)} จุด</strong><span>ลากจุดกลมสีขาวบนรูปเพื่อปรับเส้น หรือวาดใหม่แทนที่ทั้งหมด — กรอบนี้เป็นตัวเลือกพื้นที่ ไม่ได้ดึงทุกสีภายในกรอบอัตโนมัติ</span></div></div>
              <button className="mint-button full" onClick={startDraw}><PenLine size={16}/>{drawing ? 'กำลังวาด Polygon…' : 'วาด Polygon ใหม่'}</button>
              {drawing && <div className="draw-edit-controls"><span>{drawPoints.length} จุด</span><button onClick={finishDraw}>จบ Polygon</button><button onClick={() => {setDrawing(false);setDrawPoints([]);}}>ยกเลิก</button></div>}
              <div className="section-title"><span>PALETTE EDIT</span><span className="section-rule"/></div>
              <p className="mode-hint">แต่ละสีเป็นคำอธิบายสำหรับอ้างอิง ไม่ใช่คำสั่งเปลี่ยนสีบนภาพจริง คุณสามารถตั้งชื่อ ดูดสีจากจุดที่คลิกบนรูป หรือเอารายการออกได้</p>
              <div className="palette-edit-list">{activePart.colors.map((c,i) => <div className="palette-edit-card" key={`${activePart.id}-color-${i}`}>
                <div className="palette-color-head"><input aria-label={`เลือกสี ${i+1}`} type="color" value={c.hex} onChange={e => changeColor(activePart.id,i,{hex:e.target.value.toUpperCase()})}/><code>{c.hex}</code><button className={samplingColorIndex===i?'active':''} onClick={()=>setSamplingColorIndex(samplingColorIndex===i?null:i)} title="ดูดสีหนึ่งพิกเซลจากภาพ PNG แล้วเก็บในรายการนี้"><Pipette size={17}/> ดูดสี</button><button className="palette-remove" onClick={()=>deleteColor(activePart.id,i)} title={`ลบรายการสี ${i+1}`}><Trash size={16}/></button></div>
                <label>ชื่อสี / รายละเอียด</label><input className="form-input" value={c.name??''} onChange={e=>changeColor(activePart.id,i,{name:e.target.value})} placeholder="เช่น หนังน้ำตาลอุ่น"/>
                <label>หน้าที่ของสี (Role)</label><input className="form-input" value={c.role} onChange={e=>changeColor(activePart.id,i,{role:e.target.value})} placeholder="base / shadow / highlight"/>
              </div>)}</div>
              {samplingColorIndex!==null&&<div className="mode-explain palette-sampling-hint"><Pipette size={17}/> กำลังดูดสีรายการที่ {samplingColorIndex+1} — คลิกจุดสีบนตัวละครใน Canvas หรือกดปุ่มดูดสีเดิมเพื่อยกเลิก</div>}
              <button className="text-action palette-add" onClick={() => updatePart(activePart.id, { colors:[...activePart.colors,{role:`accent_${activePart.colors.length}`,hex:'#D8AE75',name:'สีใหม่'}] })}><Plus size={14}/> เพิ่มรายการสี</button>
              <Label>เทคนิคการวาด</Label><textarea className="form-textarea" rows={4} value={activePart.technique} onChange={e => updatePart(activePart.id, {technique:e.target.value})}/>
              <Label>รายละเอียด/Layer/การซ้อนทับ</Label><textarea className="form-textarea" rows={4} value={activePart.notes} onChange={e => updatePart(activePart.id, {notes:e.target.value})}/>
              <button className="danger-button" onClick={() => {setMap(prev => ({...prev,parts:prev.parts.filter(p => p.id !== activePart.id)}));setSelectedIds([]);notify('ลบ Tag ออกจากแผนที่แล้ว (ไม่กระทบรูปจริง)');}}><Trash2 size={15}/> ลบ Tag นี้</button>
            </> : <EmptySelection onAdd={addPart}/>}
          </div>}

          {tab === 'shape' && <ShapeToolPanel
            imageLoaded={Boolean(imageUrl)} imageName={imageName} activePart={regionsApproved ? activePart : null}
            target={shapeTarget} source={shapeSource} drawing={shapeDrawing} draftLength={shapeDraft.length}
            values={shapeValues} onValues={setShapeValues} onFromPart={shapeFromSelectedPart} onStart={startShapeDrawing}
            onFinish={finishShapeDrawing} onCancel={()=>{setShapeDrawing(false);setShapeDraft([]);}} onClear={resetShape}
            mirror={mirrorShape} mirrorAxis={mirrorAxis} onMirror={setMirrorShape} onMirrorAxis={setMirrorAxis}
            wandActive={magicWand} wandTolerance={wandTolerance} onWandTolerance={setWandTolerance}
            onWand={()=>{setShapeDrawing(false);setShapeDraft([]);setMagicWand(v=>!v);notify('คลิกบนบริเวณสีของตัวละครเพื่อให้ระบบสร้างขอบสีต่อเนื่องโดยประมาณ');}}
            partDescription={shapePartName} onDescription={setShapePartName} editInstruction={shapeInstruction} onInstruction={setShapeInstruction}
            prompt={shapePrompt} hasMasterPng={Boolean(masterBlob)} hasGuidePng={Boolean(shapeBlob)}
            onCopyMaster={()=>{void copyShapeImage('original');}} onCopyGuide={()=>{void copyShapeImage('guide');}}
            onCopyPrompt={()=>{void copyText(shapePrompt);notify('คัดลอก Prompt แล้ว — ไปวางใน ChatGPT หลังวางรูปทั้งสอง');}}
            onDownloadGuide={()=>{if(shapeBlob){downloadBlob(`${basename(imageName||'character')}_shape_guide.png`,shapeBlob);notify('ดาวน์โหลด Shape Guide PNG แล้ว');}}}
            onOpenChatGpt={()=>{window.open('https://chatgpt.com/','_blank','noopener,noreferrer');}}
          />}

          {tab==='rig'&&<RigToolPanel
            editorTab={rigEditorTab} onEditorTab={switchRigEditorTab}
            boneVisible={rigBoneVisible} onBoneVisible={v=>{setRigBoneVisible(v);if(!v)setRigBoneEdit(false);}}
            boneEdit={rigBoneEdit} onBoneEdit={v=>{setRigBoneEdit(v);if(v)setRigBoneVisible(true);}} boneMirror={rigBoneMirror} onBoneMirror={setRigBoneMirror}
            weightPaintEnabled={weightPaintEnabled} onWeightPaintEnabled={setWeightPaintEnabled}
            weightShowHeatmap={weightShowHeatmap} onWeightShowHeatmap={setWeightShowHeatmap}
            weightInfluence={weightInfluence} onWeightInfluence={setWeightInfluence}
            weightMode={weightBrushMode} onWeightMode={setWeightBrushMode}
            weightStrength={weightStrength} onWeightStrength={setWeightStrength}
            weightRadius={weightBrushRadius} onWeightRadius={setWeightBrushRadius}
            weightReplaceValue={weightReplaceValue} onWeightReplaceValue={setWeightReplaceValue}
            autoWeightSoftness={autoWeightSoftness} onAutoWeightSoftness={setAutoWeightSoftness}
            weightIsCustom={Boolean(cutoutSkinWeights[selectedCutout])} onAutoWeights={setAutoWeightsForSelected}
            onResetWeights={()=>{setCutoutSkinWeights(prev=>{const next={...prev};delete next[selectedCutout];return next;});notify('กลับไปใช้ Auto Weight เริ่มต้นแล้ว');}}
            imageLoaded={Boolean(imageUrl)} direction={rigDirection} onDirection={v=>selectRigProfile(v,rigMotion)}
            motion={rigMotion} onMotion={v=>selectRigProfile(rigDirection,v)} frameCount={rigFrames.length} onFrameCount={setRigFrameCount}
            frameIndex={rigFrameIndex} onFrame={n=>{setRigFrameIndex(n);setRigPlaying(false);}} frame={rigFrame}
            onNearSide={setRigNearSide} activeJoint={rigSelectedJoint} onJoint={setRigSelectedJoint}
            onAuto={()=>{void autoPlaceRig();}}
            onGenerate={()=>{setRigFrames(makeMotionFrames(rigFrames[0].joints,rigDirection,rigMotion,rigFrames.length));setRigFrameIndex(0);notify(`สร้าง ${rigMotion} ${rigFrames.length} เฟรมจากโครงเฟรมแรกแล้ว — ตรวจแต่ละเฟรมก่อนใช้จริง`);}}
            onReset={()=>{setRigFrames(makeMotionFrames(initialJoints(rigBoundsRef.current,rigDirection),rigDirection,rigMotion,rigFrames.length));setRigFrameIndex(0);setRigPlaying(false);notify('กลับเป็นโครงเริ่มต้นแล้ว');}}
            onCopyPrevious={copyPreviousRigFrame} playing={rigPlaying} onPlaying={setRigPlaying}
            showLabels={rigShowLabels} onLabels={setRigShowLabels}
            prompt={rigPrompt} previewCutout={cutoutPreview} onPreviewCutout={setCutoutPreview}
            showMasks={showCutoutMasks} onShowMasks={setShowCutoutMasks}
            showAllMasks={showAllCutoutMasks} onShowAllMasks={setShowAllCutoutMasks}
            selectedCutout={selectedCutout} onSelectedCutout={selectCutoutPart}
            cutoutWidth={cutoutWidths[selectedCutout]??100} onCutoutWidth={updateCutoutWidth}
            pairCutout={selectedPair} onCopyPair={copyCutoutToPair} linkPairs={linkCutoutPairs} onLinkPairs={setLinkCutoutPairs}
            globalWidth={globalCutoutWidth} onGlobalWidth={applyAllCutoutWidths}
            onResetMask={resetSelectedMask} maskRadiusPx={selectedMaskGeometry.radiusPx}
            maskEndpointsEdited={Boolean(cutoutMaskOverrides[selectedCutout]?.start||cutoutMaskOverrides[selectedCutout]?.end)}
            maskIsPolygon={Boolean(selectedPolygon)} maskVertexCount={selectedPolygon?.length??0} selectedMaskVertex={selectedCutoutVertex}
            onConvertPolygon={convertMaskToPolygon} onToggleAddPoint={()=>{setMaskAddPoint(v=>!v);setSelectedCutoutVertex(null);}} addingMaskPoint={maskAddPoint} onDeleteMaskPoint={deleteMaskVertex}
            drawingMaskPolygon={drawingCutoutPolygon} draftMaskPoints={cutoutPolygonDraft.length} onStartDrawMask={startDrawingCutoutPolygon}
            onFinishDrawMask={finishDrawingCutoutPolygon} onUndoDrawPoint={()=>setCutoutPolygonDraft(prev=>prev.slice(0,-1))}
            onCancelDrawMask={()=>{setDrawingCutoutPolygon(false);setCutoutPolygonDraft([]);}}
            onLayerBack={()=>setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?moveCutoutPart(rigDirection,f,selectedCutout,-1):f))}
            onLayerFront={()=>setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?moveCutoutPart(rigDirection,f,selectedCutout,1):f))}
            onAutoLayerOrder={()=>setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?{...f,drawOrder:undefined}:f))}
            onLayerBehindTorso={()=>setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?placeCutoutLimbRelative(rigDirection,f,selectedCutout,'torso','before'):f))}
            onLayerInFrontOfTorso={()=>setRigFrames(prev=>prev.map((f,i)=>i===rigFrameIndex?placeCutoutLimbRelative(rigDirection,f,selectedCutout,'torso','after'):f))}
            onCopyOrderNext={()=>{
              const next=(rigFrameIndex+1)%rigFrames.length;
              if(rigFrames[next].drawOrder&&!window.confirm(`เฟรม ${next+1} มี Draw Order ที่แก้เองแล้ว ต้องการแทนที่หรือไม่?`))return;
              const order=resolveCutoutOrder(rigDirection,rigFrame);
              setRigFrames(prev=>prev.map((f,i)=>i===next?{...f,drawOrder:[...order],nearSide:rigFrame.nearSide}:f));
              notify(`คัดลอก Draw Order เฟรม ${rigFrameIndex+1} → ${next+1} แล้ว`);
            }}
            onCopyOrderAll={()=>{
              if(!window.confirm(`คัดลอก Draw Order เฟรม ${rigFrameIndex+1} ไปทุก ${rigFrames.length} เฟรม? การจัด Layer เดิมในเฟรมอื่นจะถูกแทนที่`))return;
              const order=resolveCutoutOrder(rigDirection,rigFrame);
              setRigFrames(prev=>prev.map(f=>({...f,drawOrder:[...order]})));
              notify(`ใช้ Draw Order เดียวกันกับทั้ง ${rigFrames.length} เฟรมแล้ว`);
            }}
          />}

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
            {pendingMap && <div className="map-validation-card">
              <div className="map-validation-head"><AlertTriangle size={19}/><strong>{imageUrl ? 'ไฟล์ MD ไม่ตรงกับรูปปัจจุบัน' : 'กำลังรอภาพต้นฉบับของ MD'}</strong></div>
              <p>MD มี {pendingMap.value.parts.length} Tags · อ้างอิง {pendingMap.value.image.width}×{pendingMap.value.image.height}px · ชื่อรูป: {pendingMap.value.image.file || 'ไม่ได้ระบุ'}</p>
              {pendingCompatibility?.errors.map((message,i)=><p key={`err-${i}`} className="map-issue">{message}</p>)}
              {pendingCompatibility?.warnings.map((message,i)=><p key={`warn-${i}`} className="map-issue">{message}</p>)}
              <p><strong>วิธีแก้:</strong> นำเข้ารูปที่ AI ใช้สร้าง MD นี้จริง ๆ หรือคัดลอกคำสั่งด้านล่างไปให้ AI ทำ MD ใหม่โดยอ้างอิงภาพ PNG ปัจจุบันเท่านั้น</p>
              <div className="map-validation-actions"><button onClick={()=>imageInput.current?.click()}><ImageIcon size={15}/> นำเข้ารูปที่ตรง MD</button><button disabled={!imageUrl} onClick={()=>{void copyText(makeMappingRepairPrompt({...imageSize,name:imageName},pendingMap.value));notify('คัดลอกคำสั่งแก้ MD แล้ว — แนบ PNG ปัจจุบันกับ Template ส่ง AI');}}><Copy size={15}/> Copy คำสั่งแก้ MD</button></div>
              <button className="map-clear-pending" onClick={()=>{setPendingMap(null);setDocsText('');setDocumentFilename('');notify('ยกเลิก MD ที่ไม่ตรงภาพแล้ว');}}>ยกเลิก MD นี้</button>
            </div>}
            {mapWarnings.length>0 && <div className="map-validation-card"><strong>สิ่งที่ต้องตรวจใน Mapping</strong>{mapWarnings.map((text,i)=><p key={`warning-${i}`} className="map-issue">{text}</p>)}{!regionsApproved && <button className="map-review-button" onClick={()=>{qualityAcceptedRef.current=true;setRegionsApproved(true);notify('ยืนยันแสดง Region แล้ว — โปรดตรวจรูปทรงบน Canvas ทีละ Tag');}}>ฉันตรวจแล้ว · แสดง Region เพื่อแก้ไข</button>}</div>}
            {mapQuality?.transparentBackground && <div className={`map-validation-card ${mapQuality.suspicious?'map-validation-danger':''}`}><div className="map-validation-head"><ScanLine size={18}/><strong>Region Alignment Check</strong></div><p>ตรวจการซ้อนทับกับพื้นที่ทึบของ PNG แล้ว {mapQuality.checkedParts} Tags · พบ {mapQuality.outsideParts} Tags ที่อยู่บนพื้นโปร่งใสเกือบทั้งหมด</p><p>เป็นการตรวจเบื้องต้นจาก Alpha ไม่ใช่การ Segmentation ที่แม่นยำ 100%</p>{mapQuality.suspicious && <button className="map-review-button" onClick={()=>{qualityAcceptedRef.current=true;setRegionsApproved(true);}}>ยืนยันแสดง Region เพื่อตรวจด้วยตา</button>}</div>}
            <p className="editor-explain">ระบบอ่านบล็อก <code>```character-map</code> ที่อยู่ใน MD เพื่อตีขอบเขตภาพ แล้วแสดงข้อมูลสี/วัสดุ/เทคนิคจากข้อมูลเดียวกัน <strong>JSON คือข้อมูลสำหรับโปรแกรมที่ฝังอยู่ใน MD</strong> จึงไม่จำเป็นต้องนำเข้า JSON แยก</p>
            <div className="doc-actions"><button onClick={downloadTemplate}><Download size={15}/> AI Template</button><button onClick={() => {void copyText(makeMappingPrompt());notify('คัดลอกคำสั่งให้ AI ทำ Mapping แล้ว');}}><Copy size={15}/> คำสั่ง AI</button></div><button className="outline-button full" style={{marginTop:10}} onClick={() => goToPage('guide')}><BookOpenText size={15}/> ดูคู่มือครบ 4 ขั้นตอน</button>
            <div className="section-title"><span>DOCUMENT HEADINGS</span><span className="section-rule"/></div>
            <div className="doc-headings">{(docsText.match(/^#{1,3}\s+.+$/gm) ?? []).slice(0,24).map((line,i)=><div key={i}>{line.replace(/^#+\s+/, '')}</div>)}{!docsText && <p>ยังไม่มีไฟล์ MD — Import หรือโหลด Demo</p>}</div>
            <button className="outline-button full" onClick={() => setDocOpen(v => !v)}><BookOpenText size={16}/>{docOpen ? 'ซ่อนเนื้อหา MD' : 'แสดงข้อความ MD'}</button>
            {docOpen && <pre className="doc-raw">{docsText.slice(0,20000)}</pre>}
            <div className="section-title"><span>EXPORT DATA</span><span className="section-rule"/></div>
            <div className="export-grid"><button onClick={downloadMap}><Download size={16}/> Markdown</button><button onClick={exportJson}><Download size={16}/> JSON</button></div>
            <div className="callout"><BadgeCheck size={17}/><p>โครงข้อมูลของ Template เป็นมาตรฐานเดียวกันทั้งการ Inspect, สร้าง Prompt และ Export ส่งให้ AI วิเคราะห์ซ้ำ</p></div>
          </div>}
        </aside>
      </div>}

      {rigMaskContext&&tab==='rig'&&<div className="rig-v09-context-menu" role="menu" aria-label="คำสั่งแก้ Polygon บน Canvas" style={{left:Math.max(8,rigMaskContext.clientX),top:Math.max(8,rigMaskContext.clientY)}} onPointerDown={event=>event.stopPropagation()} onContextMenu={event=>event.preventDefault()}>
        <div className="rig-v09-context-title"><PenTool size={15}/><div><strong>{CUTOUT_PARTS.find(part=>part.id===rigMaskContext.partId)?.label}</strong><small>{cutoutMaskOverrides[rigMaskContext.partId]?.polygon?'Polygon · เลือกจุดที่ขอบได้':'Capsule · กดเพิ่มจุดเพื่อแปลงเป็น Polygon'}</small></div><button onClick={()=>setRigMaskContext(null)} title="ปิดเมนู"><X size={14}/></button></div>
        <button role="menuitem" onClick={()=>executeRigMaskContext('add')}><Plus size={16}/> เพิ่มจุดตรงขอบใกล้เมาส์</button>
        <button role="menuitem" disabled={rigMaskContext.vertexIndex===null} onClick={()=>executeRigMaskContext('select')}><MousePointer2 size={15}/> เลือกจุดใกล้เมาส์</button>
        <button role="menuitem" disabled={rigMaskContext.vertexIndex===null||(cutoutMaskOverrides[rigMaskContext.partId]?.polygon?.length??0)<=3} onClick={()=>executeRigMaskContext('delete')}><Trash2 size={15}/> ลบจุดใกล้เมาส์</button>
        <div className="rig-v09-context-divider"/>
        <button role="menuitem" disabled={Boolean(cutoutMaskOverrides[rigMaskContext.partId]?.polygon)} onClick={()=>executeRigMaskContext('convert')}><Shapes size={15}/> แปลง Capsule เป็น Polygon</button>
        <button role="menuitem" onClick={()=>executeRigMaskContext('draw')}><PenLine size={15}/> วาด Polygon ใหม่</button>
        <div className="rig-v09-context-divider"/>
        {rigMaskContext.partId!=='torso'&&<><button role="menuitem" onClick={()=>executeRigMaskContext('front')}><Layers3 size={15}/> ทั้งแขน/ขานี้อยู่หน้าลำตัว</button><button role="menuitem" onClick={()=>executeRigMaskContext('behind')}><Layers3 size={15}/> ทั้งแขน/ขานี้อยู่หลังลำตัว</button></>}
        <button role="menuitem" className="danger" onClick={()=>executeRigMaskContext('reset')}><RotateCcw size={15}/> คืนขอบชิ้นนี้เป็นค่าเริ่มต้น</button>
      </div>}
      <div className="status-bar"><div><span className="status-indicator"/> STUDIO READY <span className="status-separator"/> {mode==='animation'?'INDEPENDENT SPRITE PREVIEW':`${count} PARTS INDEXED`} <span className="status-separator"/> {mode==='animation'?'NO BONE / RIG REQUIRED':'2D REFERENCE'}</div><div><span>VITE + REACT</span><span className="status-separator"/> <span>LOCAL MODE</span></div></div>
      {toast && <div role="status" className="toast"><Sparkles size={17}/><span>{toast}</span><button onClick={() => setToast('')}><X size={14}/></button></div>}
    </div>
  );
}

function EmptySelection({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-selection"><div className="empty-select-icon"><MousePointer2 size={26}/></div><h3>เลือกชิ้นส่วนบนภาพ</h3><p>คลิกที่รองเท้า ผม เสื้อ หรืออุปกรณ์เพื่อดูรายละเอียดสี วัสดุ และเทคนิคการวาด</p><button onClick={onAdd}><Plus size={15}/> เพิ่ม Tag ใหม่</button></div>;
}

export default App;
