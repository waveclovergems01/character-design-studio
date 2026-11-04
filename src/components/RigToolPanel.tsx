import { Bone, Check, ChevronLeft, ChevronRight, Eye, Info, Layers3, Paintbrush, PenTool, Play, Plus, RotateCcw, Sparkles, Square, Trash2 } from 'lucide-react';
import WeightToolPanel from './WeightToolPanel';
import { JOINTS, MOTION_LABELS, MOTION_TYPES, RIG_DIRECTIONS, resolvedNearSide } from '../lib/rig';
import type { JointId, MotionType, NearSide, RigDirection, RigFrame } from '../lib/rig';
import { CUTOUT_PARTS, resolveCutoutOrder } from '../lib/cutout';
import type { CutoutPartId, WeightBrushMode, WeightInfluence } from '../lib/cutout';

export type RigEditorTab='bone'|'mask'|'weight'|'layers';

type Props={
  editorTab:RigEditorTab;onEditorTab:(tab:RigEditorTab)=>void;
  boneVisible:boolean;onBoneVisible:(v:boolean)=>void;
  boneEdit:boolean;onBoneEdit:(v:boolean)=>void;
  boneMirror:boolean;onBoneMirror:(v:boolean)=>void;
  weightPaintEnabled:boolean;onWeightPaintEnabled:(v:boolean)=>void;
  weightShowHeatmap:boolean;onWeightShowHeatmap:(v:boolean)=>void;
  weightInfluence:WeightInfluence;onWeightInfluence:(v:WeightInfluence)=>void;
  weightMode:WeightBrushMode;onWeightMode:(v:WeightBrushMode)=>void;
  weightStrength:number;onWeightStrength:(v:number)=>void;
  weightRadius:number;onWeightRadius:(v:number)=>void;
  weightReplaceValue:number;onWeightReplaceValue:(v:number)=>void;
  autoWeightSoftness:number;onAutoWeightSoftness:(v:number)=>void;
  weightIsCustom:boolean;onAutoWeights:()=>void;onResetWeights:()=>void;
  imageLoaded:boolean;direction:RigDirection;onDirection:(v:RigDirection)=>void;
  motion:MotionType;onMotion:(v:MotionType)=>void;frameCount:number;onFrameCount:(v:number)=>void;
  frameIndex:number;onFrame:(v:number)=>void;frame:RigFrame;
  onNearSide:(v:NearSide)=>void;activeJoint:JointId|null;onJoint:(v:JointId)=>void;
  onAuto:()=>void;onGenerate:()=>void;onReset:()=>void;onCopyPrevious:()=>void;
  playing:boolean;onPlaying:(v:boolean)=>void;showLabels:boolean;onLabels:(v:boolean)=>void;
  prompt:string;
  previewCutout:boolean;onPreviewCutout:(v:boolean)=>void;
  showMasks:boolean;onShowMasks:(v:boolean)=>void;showAllMasks:boolean;onShowAllMasks:(v:boolean)=>void;
  selectedCutout:CutoutPartId;onSelectedCutout:(v:CutoutPartId)=>void;
  cutoutWidth:number;onCutoutWidth:(v:number)=>void;
  pairCutout:CutoutPartId|null;onCopyPair:()=>void;linkPairs:boolean;onLinkPairs:(v:boolean)=>void;
  globalWidth:number;onGlobalWidth:(v:number)=>void;onResetMask:()=>void;
  maskRadiusPx:number;maskEndpointsEdited:boolean;
  maskIsPolygon:boolean;maskVertexCount:number;selectedMaskVertex:number|null;
  onConvertPolygon:()=>void;onToggleAddPoint:()=>void;addingMaskPoint:boolean;onDeleteMaskPoint:()=>void;
  drawingMaskPolygon:boolean;draftMaskPoints:number;onStartDrawMask:()=>void;onFinishDrawMask:()=>void;onUndoDrawPoint:()=>void;onCancelDrawMask:()=>void;
  onLayerBack:()=>void;onLayerFront:()=>void;onAutoLayerOrder:()=>void;
  onLayerBehindTorso:()=>void;onLayerInFrontOfTorso:()=>void;
  onCopyOrderNext:()=>void;onCopyOrderAll:()=>void;
};

const sideLabel=(side:NearSide,direction:RigDirection)=>{
  const resolved=resolvedNearSide(direction,side);
  return resolved==='balanced'?'ต้องดูตามท่าที่ไขว้กัน':resolved==='character_left'?'ซ้ายตัวละครอยู่หน้า':'ขวาตัวละครอยู่หน้า';
};

export default function RigToolPanel(p:Props){
  const editorTab=p.editorTab;
  const order=resolveCutoutOrder(p.direction,p.frame);
  const part=CUTOUT_PARTS.find(item=>item.id===p.selectedCutout)!;
  return <div className="inspector-body rig-inspector rig-v07-inspector">
    <div className="rig-v09-pinned">
      <div className="rig-v07-intro"><Bone size={19}/><div><h3>Rig & Motion</h3><p>เลือกเฟรม · จัดชั้น · แก้ขอบ Cutout</p></div></div>
      <div className="rig-motion-select rig-v07-motion"><div><label className="mode-field-label">ทิศ</label><select className="form-input" value={p.direction} onChange={e=>p.onDirection(e.target.value as RigDirection)}>{RIG_DIRECTIONS.map(dir=><option key={dir} value={dir}>{dir}</option>)}</select></div><div><label className="mode-field-label">Motion</label><select className="form-input" value={p.motion} onChange={e=>p.onMotion(e.target.value as MotionType)}>{MOTION_TYPES.map(m=><option key={m} value={m}>{MOTION_LABELS[m]}</option>)}</select></div><div><label className="mode-field-label">เฟรม</label><select className="form-input" value={p.frameCount} onChange={e=>p.onFrameCount(Number(e.target.value))}>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div></div>
      <div className="rig-frame-row"><button aria-label="เฟรมก่อนหน้า" onClick={()=>p.onFrame((p.frameIndex+p.frameCount-1)%p.frameCount)}><ChevronLeft size={18}/></button><strong>FRAME {p.frameIndex+1} / {p.frameCount}</strong><button aria-label="เฟรมถัดไป" onClick={()=>p.onFrame((p.frameIndex+1)%p.frameCount)}><ChevronRight size={18}/></button><button className="rig-play" onClick={()=>p.onPlaying(!p.playing)}>{p.playing?<Square size={15}/>:<Play size={15}/>} {p.playing?'หยุด':'เล่น'}</button></div>
      <div className="rig-frame-dots">{Array.from({length:p.frameCount},(_,i)=><button key={i} className={i===p.frameIndex?'active':''} onClick={()=>p.onFrame(i)}>{i+1}</button>)}</div>
      <div className="rig-v08-editor-tabs rig-v10-editor-tabs" role="group" aria-label="เลือกเครื่องมือ Rig">
        <button className={editorTab==='bone'?'active':''} aria-pressed={editorTab==='bone'} onClick={()=>p.onEditorTab('bone')}><Bone size={16}/> Bone</button>
        <button className={editorTab==='mask'?'active':''} aria-pressed={editorTab==='mask'} onClick={()=>p.onEditorTab('mask')}><PenTool size={16}/> Mask</button>
        <button className={editorTab==='weight'?'active':''} aria-pressed={editorTab==='weight'} onClick={()=>p.onEditorTab('weight')}><Paintbrush size={16}/> Weight</button>
        <button className={editorTab==='layers'?'active':''} aria-pressed={editorTab==='layers'} onClick={()=>p.onEditorTab('layers')}><Layers3 size={16}/> Depth</button>
      </div>
    </div>

    <details className="rig-v09-frame-tools"><summary>สร้างเฟรม / คัดลอกท่า</summary><div className="mode-button-row"><button onClick={p.onGenerate}><Bone size={15}/> สร้าง {p.frameCount} เฟรม</button><button onClick={p.onCopyPrevious}>คัดลอกเฟรมก่อน</button></div></details>

    {editorTab==='bone'&&<section className="rig-v10-bone-panel" aria-label="Bone Editor">
      <div className="rig-v10-section-title"><Bone size={19}/><div><h3>Bone Editor · 19 ข้อต่อ</h3><p>เลือกโหมด Edit ก่อนลากข้อต่อบนภาพ</p></div></div>
      <div className="rig-v10-bone-toggles"><label className="rig-toggle"><input type="checkbox" checked={p.boneVisible} onChange={e=>p.onBoneVisible(e.target.checked)}/> View Bones</label><label className="rig-toggle"><input type="checkbox" checked={p.boneEdit} onChange={e=>p.onBoneEdit(e.target.checked)}/> <strong>Edit Bones</strong></label></div>
      <label className="rig-toggle rig-v10-mirror"><input type="checkbox" checked={p.boneMirror} onChange={e=>p.onBoneMirror(e.target.checked)}/> Mirror ข้อต่อซ้าย–ขวาขณะลาก <small>(เหมาะกับท่าหน้า/หลังสมมาตร)</small></label>
      <div className="rig-v10-bone-state">{p.boneEdit?'EDIT ENABLED — ลากข้อต่อได้':'VIEW ONLY — ล็อกการลาก Bone'}</div>
      <div className="mode-button-row"><button disabled={!p.imageLoaded} onClick={p.onAuto}><Sparkles size={16}/> วางโบนใหม่</button><button onClick={p.onReset}><RotateCcw size={16}/> รีเซ็ตท่า</button></div>
      <label className="rig-toggle"><input type="checkbox" checked={p.showLabels} onChange={e=>p.onLabels(e.target.checked)}/> แสดงชื่อข้อต่อ</label>
      <div className="rig-joint-list">{JOINTS.map(([id,label])=><button key={id} className={p.activeJoint===id?'active':''} onClick={()=>p.onJoint(id)}><span>{label}</span><code>{id}</code>{p.activeJoint===id&&<Check size={13}/>}</button>)}</div>
      <p className="mode-hint">Edit ใช้ได้เฉพาะแท็บ Bone · Mirror ทำงานจากแนวกลางสะโพก และปิดได้สำหรับการเดินหรือท่าที่ไม่สมมาตร</p>
    </section>}

    {editorTab==='weight'&&<WeightToolPanel
      selected={p.selectedCutout} onSelected={p.onSelectedCutout}
      paintEnabled={p.weightPaintEnabled} onPaintEnabled={p.onWeightPaintEnabled}
      showHeatmap={p.weightShowHeatmap} onShowHeatmap={p.onWeightShowHeatmap}
      influence={p.weightInfluence} onInfluence={p.onWeightInfluence}
      mode={p.weightMode} onMode={p.onWeightMode}
      strength={p.weightStrength} onStrength={p.onWeightStrength}
      radius={p.weightRadius} onRadius={p.onWeightRadius}
      replaceValue={p.weightReplaceValue} onReplaceValue={p.onWeightReplaceValue}
      softness={p.autoWeightSoftness} onSoftness={p.onAutoWeightSoftness}
      isCustom={p.weightIsCustom} onAuto={p.onAutoWeights} onReset={p.onResetWeights}
    />}

    {editorTab==='mask'&&<section className="rig-v07-mask-editor" aria-label="แก้ขอบ Mask">
      <div className="rig-v07-section-head"><Eye size={19}/><div><h3>Mask Editor</h3><p>คลิกขวาที่ภาพเพื่อเพิ่ม/ลบจุดใกล้เมาส์</p></div></div>
      <div className="rig-v09-quick-toggles"><label className="rig-toggle"><input type="checkbox" checked={p.showMasks} onChange={e=>p.onShowMasks(e.target.checked)}/> เส้น Mask</label><label className="rig-toggle"><input type="checkbox" checked={p.previewCutout} disabled={!p.imageLoaded} onChange={e=>p.onPreviewCutout(e.target.checked)}/> Pixi Preview</label></div>
      <label className="mode-field-label">ชิ้นส่วนที่กำลังแก้</label>
      <select className="form-input" value={p.selectedCutout} onChange={e=>p.onSelectedCutout(e.target.value as CutoutPartId)}>{CUTOUT_PARTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <div className="rig-mask-visual-note"><span className="rig-mask-dot"/> <strong>{part.label}</strong> <span>แกน: {part.from} → {part.to}</span></div>
      <div className="rig-v08-polygon-editor">
        <div className="rig-v08-polygon-head"><PenTool size={18}/><strong>{p.maskIsPolygon?`Polygon Mask · ${p.maskVertexCount} จุด`:'Capsule Mask (แบบเดิม)'}</strong></div>
        {p.drawingMaskPolygon?<>
          <p>กำลังวาดขอบใหม่: <strong>{p.draftMaskPoints} จุด</strong> · คลิกบนภาพทีละจุดตามเส้นแขน มือ ขา หรือรองเท้า</p>
          <div className="rig-v08-polygon-actions"><button disabled={p.draftMaskPoints<3} onClick={p.onFinishDrawMask}><Check size={15}/> จบ Polygon</button><button disabled={!p.draftMaskPoints} onClick={p.onUndoDrawPoint}>ย้อนจุดล่าสุด</button></div>
          <button className="rig-v08-draw-cancel" onClick={p.onCancelDrawMask}>ยกเลิกการวาด</button>
        </>:p.maskIsPolygon?<>
          <p>คลิกจุดขอบสีเขียวบนภาพแล้วลากให้เข้ากับลายเส้นของแขน/ขา ไม่ต้องยึดเป็นวงเปอร์เซ็นต์</p>
          <div className="rig-v08-polygon-actions"><button className={p.addingMaskPoint?'active':''} onClick={p.onToggleAddPoint}><Plus size={15}/> {p.addingMaskPoint?'กำลังเพิ่มจุด…':'เพิ่มจุดบนขอบ'}</button><button disabled={p.selectedMaskVertex===null||p.maskVertexCount<=3} onClick={p.onDeleteMaskPoint}><Trash2 size={15}/> ลบจุดที่เลือก</button></div>
          <button className="rig-v08-draw-new" onClick={p.onStartDrawMask}><PenTool size={14}/> วาด Polygon ใหม่จากศูนย์</button>
          <small>{p.addingMaskPoint?'คลิกเส้นสีเขียวเพื่อเพิ่มจุดใหม่':'คลิก/ลากจุดบนภาพเพื่อแก้ขอบ · เลือกจุดก่อนกดลบ'} · มีอย่างน้อย 3 จุด</small>
        </>:<>
          <p>Mask ปัจจุบันเป็นวงตามโบน จึงมักติดพิกเซลของชิ้นข้างเคียง แปลงเป็น Polygon เพื่อกำหนดขอบเองได้</p>
          <button className="rig-v08-convert" onClick={p.onConvertPolygon}><PenTool size={16}/> เริ่มแก้ขอบแบบ Pen Tool (16 จุด)</button>
          <button className="rig-v08-draw-new" onClick={p.onStartDrawMask}><Plus size={14}/> หรือวาด Polygon ใหม่จากศูนย์</button>
        </>}
      </div>
      {!p.drawingMaskPolygon&&<details className="rig-v09-advanced"><summary>ตัวเลือกขอบเพิ่มเติม {p.maskIsPolygon?'· Polygon':'· Capsule'} / แสดงทุกชิ้น</summary><div className="rig-v09-advanced-body">
        <label className="rig-toggle"><input type="checkbox" checked={p.showAllMasks} disabled={!p.showMasks} onChange={e=>p.onShowAllMasks(e.target.checked)}/> แสดงเส้นทุกชิ้น</label>
        {!p.maskIsPolygon&&<><div className="rig-width-slider"><label>ความกว้าง Mask ที่เลือก</label><strong>{p.cutoutWidth}%</strong><input aria-label="ความกว้าง Cutout" type="range" min="30" max="250" step="5" value={p.cutoutWidth} onChange={e=>p.onCutoutWidth(Number(e.target.value))}/><small>รัศมี ~{Math.round(p.maskRadiusPx)} px ต่อข้าง · ลาก START/END บนภาพได้ {p.maskEndpointsEdited?'(แก้ปลายแล้ว)':''}</small></div>
        <div className="rig-mask-pair-tools"><label className="rig-toggle"><input type="checkbox" checked={p.linkPairs} onChange={e=>p.onLinkPairs(e.target.checked)}/> ซ้าย–ขวาพร้อมกัน</label><button disabled={!p.pairCutout} onClick={p.onCopyPair}>คัดลอก {p.cutoutWidth}% ไปคู่</button></div>
        <div className="rig-width-slider rig-width-global"><label>ปรับ Capsule ทุกชิ้น</label><strong>{p.globalWidth}%</strong><input aria-label="ความกว้าง Cutout ทุกชิ้น" type="range" min="30" max="250" step="5" value={p.globalWidth} onChange={e=>p.onGlobalWidth(Number(e.target.value))}/></div>
        <div className="rig-mask-edit-tip"><Info size={16}/><span>Polygon ที่ลากเองจะไม่เปลี่ยนตามเปอร์เซ็นต์ Capsule</span></div></>}
      </div></details>}
      <details className="rig-v09-gap-guide"><summary>เห็นเสื้อขาดหรือมีร่องตอนขยับ?</summary><p>ภาพ PNG แบนไม่มีลายเสื้อส่วนที่ถูกแขนบังอยู่ จึงเติมรายละเอียดที่หายไปด้วยการเลื่อน Polygon ไม่ได้</p><ol><li>สร้างชั้น <strong>Underlay / Backfill</strong> เป็นเนื้อเสื้อเต็มพื้นที่ใต้รักแร้</li><li>วาด/เติมรายละเอียดใต้แขนครั้งเดียวใน Krita แล้วบันทึกเป็น PNG แยก</li><li>ในระบบเกมหรือเครื่องมือที่รองรับ Layer ให้วาง Underlay หลังแขน และคุม Draw Order ตามเฟรม</li></ol><p>เวอร์ชันนี้ยังไม่นำเข้า Underlay เป็นชั้นใหม่โดยตรง · รอยบาง 1–2 px อาจใช้ edge bleed ช่วยได้ แต่ร่องกว้างต้องมีพิกเซลเพิ่มจริง ๆ</p></details>
      <button className="rig-reset-mask" onClick={p.onResetMask}><RotateCcw size={15}/> คืนขอบ/ความกว้างชิ้นนี้เป็นค่าเริ่มต้น</button>
    </section>}

    {editorTab==='layers'&&<section className="rig-v08-layers-panel" aria-label="Draw Order รายเฟรม">
      <div className="rig-v07-section-head"><Layers3 size={19}/><div><h3>Draw Order · เฟรม {p.frameIndex+1}</h3><p>กำหนดชิ้นไหนอยู่หน้า / หลัง ในแต่ละเฟรมได้</p></div></div>
      <label className="mode-field-label">ชิ้นส่วนที่จะจัดลำดับ</label>
      <select className="form-input" value={p.selectedCutout} onChange={e=>p.onSelectedCutout(e.target.value as CutoutPartId)}>{CUTOUT_PARTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <div className="rig-v08-order-status">ชิ้นที่เลือก: <strong>{part.label}</strong> · ลำดับ <strong>{order.indexOf(p.selectedCutout)+1} / {order.length}</strong> (เลขมากอยู่หน้า)</div>
      <label className="mode-field-label">ข้างที่อยู่ใกล้กล้อง (เฟรมนี้)</label>
      <select className="form-input" value={p.frame.nearSide} onChange={e=>p.onNearSide(e.target.value as NearSide)}><option value="auto">Auto — {sideLabel('auto',p.direction)}</option><option value="character_left">ซ้ายตัวละครอยู่หน้า</option><option value="character_right">ขวาตัวละครอยู่หน้า</option><option value="balanced">ไม่ฟันธง / กำหนดชั้นเอง</option></select>
      <p className="mode-hint">เลขมากจะวาดอยู่ด้านหน้า แก้แยกได้รายเฟรม และซ้าย/ขวาหมายถึงข้างของตัวละคร</p>
      <div className="rig-layer-order-actions"><button onClick={p.onLayerBack}>◀ ถอยไปหลัง</button><button onClick={p.onLayerFront}>มาหน้า ▶</button><button onClick={p.onAutoLayerOrder}>Auto Order</button></div>
      {p.selectedCutout!=='torso'&&<div className="rig-v08-depth-quick"><button onClick={p.onLayerBehindTorso}>ทั้งแขน/ขาข้างนี้อยู่หลังลำตัว</button><button onClick={p.onLayerInFrontOfTorso}>ทั้งแขน/ขาข้างนี้อยู่หน้าลำตัว</button></div>}
      <div className="rig-draw-order-list">{order.map((id,i)=><button key={id} className={id===p.selectedCutout?'active':''} onClick={()=>p.onSelectedCutout(id)}><span>{String(i+1).padStart(2,'0')}</span>{CUTOUT_PARTS.find(part=>part.id===id)?.label}</button>)}</div>
      <div className="rig-v08-copy-order"><button onClick={p.onCopyOrderNext}>คัดลอก Order ไปเฟรมถัดไป</button><button onClick={p.onCopyOrderAll}>ใช้ Order นี้กับทุกเฟรม</button></div>
      <p className="mode-hint">ก่อนกดคัดลอกทั้งชุด ให้ตรวจจังหวะขาไขว้กันด้วย เพราะเฟรมอื่นอาจต้องสลับหน้า–หลังต่างกัน</p>
    </section>}

    <details className="rig-v07-fold"><summary>ดู Prompt สำหรับเฟรมนี้</summary><div><pre className="rig-v07-prompt">{p.prompt}</pre></div></details>
  </div>;
}
