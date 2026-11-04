import { Brush, Droplets, Eraser, Paintbrush, RotateCcw, Sparkles, WandSparkles } from 'lucide-react';
import { CUTOUT_PARTS, skinBonePair } from '../lib/cutout';
import type { CutoutPartId, WeightBrushMode, WeightInfluence } from '../lib/cutout';

type Props={
  selected:CutoutPartId;onSelected:(v:CutoutPartId)=>void;
  paintEnabled:boolean;onPaintEnabled:(v:boolean)=>void;
  showHeatmap:boolean;onShowHeatmap:(v:boolean)=>void;
  influence:WeightInfluence;onInfluence:(v:WeightInfluence)=>void;
  mode:WeightBrushMode;onMode:(v:WeightBrushMode)=>void;
  strength:number;onStrength:(v:number)=>void;
  radius:number;onRadius:(v:number)=>void;
  replaceValue:number;onReplaceValue:(v:number)=>void;
  softness:number;onSoftness:(v:number)=>void;
  isCustom:boolean;onAuto:()=>void;onReset:()=>void;
};

const modes:[WeightBrushMode,string,typeof Paintbrush][]=[
  ['add','เพิ่ม',Paintbrush],['remove','ลบ',Eraser],['replace','กำหนด',Droplets],['smooth','เกลี่ย',Brush],
];

export default function WeightToolPanel(p:Props){
  const pair=skinBonePair(p.selected);
  return <section className="rig-v10-weight-editor" aria-label="Weight Paint Editor">
    <div className="rig-v10-section-title"><Paintbrush size={19}/><div><h3>Weight Paint</h3><p>ให้อิทธิพลกระดูกกับ Vertex แบบน้ำเงิน → แดง</p></div></div>
    <div className="rig-v10-weight-status"><span className={p.paintEnabled?'live':'idle'}/><strong>{p.paintEnabled?'PAINT MODE — กำลังวาด':'VIEW MODE — ยังไม่วาด'}</strong><label><input type="checkbox" checked={p.paintEnabled} onChange={e=>p.onPaintEnabled(e.target.checked)}/> Edit / Paint</label></div>
    <label className="mode-field-label">ชิ้นส่วน Mesh ที่จะเพ้นต์ (แยกจากชิ้นอื่น)</label>
    <select className="form-input" value={p.selected} onChange={e=>p.onSelected(e.target.value as CutoutPartId)}>{CUTOUT_PARTS.map(part=><option key={part.id} value={part.id}>{part.label}</option>)}</select>
    <label className="mode-field-label">กระดูกที่ต้องการระบายน้ำหนัก</label>
    <select className="form-input" value={p.influence} onChange={e=>p.onInfluence(e.target.value as WeightInfluence)}><option value="primary">กระดูกหลัก — {pair.primary.label}</option><option value="secondary">กระดูกข้างเคียง — {pair.secondary.label}</option></select>
    <div className="rig-v10-heat-key"><span>0%</span><div className="rig-v10-heat-gradient"/><span>100%</span></div>
    <p className="rig-v10-mini-note">น้ำเงิน = กระดูกที่เลือกมีอิทธิพลน้อย · แดง = มีอิทธิพลมาก · น้ำหนักกระดูกทั้งคู่รวม 100%</p>
    <label className="rig-toggle"><input type="checkbox" checked={p.showHeatmap} onChange={e=>p.onShowHeatmap(e.target.checked)}/> แสดง Heatmap บน Canvas</label>
    <div className="rig-v10-brush-options">
      <label className="mode-field-label">รูปแบบแปรง</label>
      <div className="rig-v10-brush-modes">{modes.map(([id,label,Icon])=><button key={id} className={p.mode===id?'active':''} aria-pressed={p.mode===id} onClick={()=>p.onMode(id)}><Icon size={15}/>{label}</button>)}</div>
      <label>ขนาด Brush <strong>{p.radius}px</strong></label>
      <input type="range" min="5" max="180" step="5" value={p.radius} onChange={e=>p.onRadius(Number(e.target.value))}/>
      <label>Strength <strong>{Math.round(p.strength*100)}%</strong></label>
      <input type="range" min="5" max="100" step="5" value={Math.round(p.strength*100)} onChange={e=>p.onStrength(Number(e.target.value)/100)}/>
      {p.mode==='replace'&&<><label>ค่าน้ำหนักเป้าหมาย <strong>{Math.round(p.replaceValue*100)}%</strong></label><input type="range" min="0" max="100" step="5" value={Math.round(p.replaceValue*100)} onChange={e=>p.onReplaceValue(Number(e.target.value)/100)}/></>}
    </div>
    <div className="rig-v10-auto-tools">
      <div className="rig-v10-section-title"><WandSparkles size={18}/><div><h3>Auto Weight</h3><p>จำกัดไว้ที่โบนข้างเคียงของชิ้นส่วนนี้</p></div></div>
      <label>ความนุ่มบริเวณรอยต่อ <strong>{Math.round(p.softness*100)}%</strong></label>
      <input type="range" min="10" max="80" step="5" value={Math.round(p.softness*100)} onChange={e=>p.onSoftness(Number(e.target.value)/100)}/>
      <button className="rig-v10-auto-button" onClick={p.onAuto}><Sparkles size={16}/> สร้าง Auto Weight ใหม่สำหรับชิ้นนี้</button>
      <button className="rig-v10-reset-button" disabled={!p.isCustom} onClick={p.onReset}><RotateCcw size={14}/> กลับไปใช้ Auto Weight เริ่มต้น</button>
    </div>
    <p className="rig-v10-mini-note">Auto Weight รุ่นนี้ใช้โครงข้อต่อมนุษย์ที่กำหนดไว้ ไม่ใช่ AI วิเคราะห์ภาพ จึงไม่เพิ่มน้ำหนักข้ามไปยังชิ้นส่วนอื่นโดยอัตโนมัติ หากปรับตำแหน่ง Bone หรือแก้ขอบ Polygon หลังเพ้นต์ ให้กด Auto Weight ใหม่และเกลี่ยซ้ำตามจุดรอยต่อ Mesh ที่มีช่องโหว่ของภาพต้นฉบับยังต้องมีภาพ Underlay</p>
  </section>;
}
