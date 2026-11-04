import { Check, Copy, Download, ExternalLink, MousePointer2, PenLine, RotateCcw, ScanLine, Sparkles } from 'lucide-react';
import type { CharacterPart, Region } from '../lib/types';
import type { ShapeValues } from '../lib/shape-guide';

type Props = {
  imageLoaded: boolean;
  imageName: string;
  activePart: CharacterPart | null;
  target: Region;
  source: Region;
  drawing: boolean;
  draftLength: number;
  values: ShapeValues;
  onValues: (next: ShapeValues) => void;
  onFromPart: () => void;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onClear: () => void;
  partDescription: string;
  onDescription: (value: string) => void;
  editInstruction: string;
  onInstruction: (value: string) => void;
  prompt: string;
  hasMasterPng: boolean;
  hasGuidePng: boolean;
  onCopyMaster: () => void;
  onCopyGuide: () => void;
  onCopyPrompt: () => void;
  onDownloadGuide: () => void;
  onOpenChatGpt: () => void;
};

function Slider({ title, value, min, max, unit, onChange }: { title: string; value: number; min: number; max: number; unit: string; onChange: (v: number)=>void }) {
  return <label className="shape-slider"><span>{title}<strong>{value}{unit}</strong></span><input type="range" value={value} min={min} max={max} step={1} onChange={e => onChange(Number(e.target.value))}/></label>;
}

export default function ShapeToolPanel(props: Props) {
  const hasShape = props.target.some(poly => poly.length >= 3);
  const canUsePart = Boolean(props.activePart?.polygons.some(poly => poly.length >= 3));
  return <div className="inspector-body shape-inspector">
    <div className="section-kicker">SHAPE GUIDE EDITOR <span>NO AI API</span></div>
    <div className="shape-intro"><div className="shape-intro-icon"><ScanLine size={21}/></div><div><h3>วาดรูปทรงที่ต้องการ</h3><p>ปรับแนวขา ความกว้าง ความยาว หรือมุมการวางจาก Canvas แล้วใช้เป็นภาพกำกับให้ AI แก้รูป</p></div></div>
    <div className="shape-safety">รูปต้นฉบับจะไม่เปลี่ยนพิกเซลในโหมดนี้ เส้นสีส้มคือ <strong>เป้าหมาย</strong> ที่ต้องการให้ AI แก้ตาม</div>

    <div className="section-title"><span>1 / เลือกพื้นที่</span><span className="section-rule"/></div>
    <p className="shape-help">หาก MD ตรงภาพแล้วให้เลือก Tag ทางซ้าย หรือวาด Polygon ใหม่เองได้เลย <strong>แม้ไม่มี MD</strong></p>
    <div className="shape-action-row"><button disabled={!canUsePart} onClick={props.onFromPart}><MousePointer2 size={15}/> จาก Tag ที่เลือก</button><button disabled={!props.imageLoaded} onClick={props.onStart}><PenLine size={15}/> วาดพื้นที่เอง</button></div>
    {props.drawing && <div className="shape-drawing"><strong>กำลังวาด {props.draftLength} จุด</strong><p>คลิกลงบนรูป 3 จุดขึ้นไป แล้วกดจบรูปทรง</p><div><button disabled={props.draftLength<3} onClick={props.onFinish}><Check size={14}/> จบรูปทรง</button><button onClick={props.onCancel}>ยกเลิก</button></div></div>}
    {hasShape && <>
      <div className="shape-current"><span>มี Target Polygon {props.target.length} รูปร่าง</span><button onClick={props.onClear}><RotateCcw size={13}/> เริ่มใหม่</button></div>
      <div className="section-title"><span>2 / ปรับรูปทรงเป้าหมาย</span><span className="section-rule"/></div>
      <p className="shape-help">ลากจุดสีเหลืองบน Canvas หรือปรับค่าด้านล่าง แสดงเส้นประสีฟ้าเป็น Region เดิม (ถ้ามี)</p>
      <div className="shape-controls">
        <Slider title="ความกว้าง" value={props.values.width} min={45} max={180} unit="%" onChange={v=>props.onValues({...props.values,width:v})}/>
        <Slider title="ความยาว / สูง" value={props.values.height} min={45} max={180} unit="%" onChange={v=>props.onValues({...props.values,height:v})}/>
        <Slider title="องศาการเอียง" value={props.values.rotation} min={-90} max={90} unit="°" onChange={v=>props.onValues({...props.values,rotation:v})}/>
        <Slider title="เลื่อนแนวนอน" value={props.values.offsetX} min={-200} max={200} unit="" onChange={v=>props.onValues({...props.values,offsetX:v})}/>
        <Slider title="เลื่อนแนวตั้ง" value={props.values.offsetY} min={-200} max={200} unit="" onChange={v=>props.onValues({...props.values,offsetY:v})}/>
      </div>
      <div className="section-title"><span>3 / ระบุส่วนและคำสั่ง</span><span className="section-rule"/></div>
      <label className="shape-label">ชิ้นส่วนที่ต้องแก้</label><input className="form-input" value={props.partDescription} onChange={e=>props.onDescription(e.target.value)} placeholder="เช่น ขาซ้ายของตัวละคร"/>
      <label className="shape-label">ต้องการให้ AI แก้อย่างไร?</label><textarea rows={4} className="form-textarea" value={props.editInstruction} onChange={e=>props.onInstruction(e.target.value)} placeholder="เช่น ทำขาให้ยาวขึ้นและกางออก แต่รักษาสีและชุดเกราะเดิม"/>
    </>}

    <div className="section-title"><span>4 / ส่งให้ ChatGPT</span><span className="section-rule"/></div>
    <div className="shape-clipboard-note">ลำดับสำคัญ: <strong>คัดลอกรูป → ไปวางใน ChatGPT → กลับมาคัดลอกรูปกำกับ → ไปวาง → คัดลอก Prompt → ไปวาง → ส่ง</strong> เพราะ Clipboard เก็บเนื้อหาล่าสุดที่คัดลอก</div>
    <div className="shape-clipboard-steps">
      <button disabled={!props.hasMasterPng} onClick={props.onCopyMaster}><span>01</span><Copy size={15}/><strong>Copy รูปต้นฉบับ</strong></button>
      <button disabled={!hasShape || !props.hasGuidePng} onClick={props.onCopyGuide}><span>02</span><Copy size={15}/><strong>Copy รูป Shape Guide</strong></button>
      <button disabled={!hasShape} onClick={props.onCopyPrompt}><span>03</span><Copy size={15}/><strong>Copy Prompt แก้รูปทรง</strong></button>
    </div>
    <button className="shape-chat-button" onClick={props.onOpenChatGpt}><Sparkles size={16}/> เปิด ChatGPT อีกแท็บ <ExternalLink size={15}/></button>
    <button className="outline-button full shape-download" disabled={!props.hasGuidePng} onClick={props.onDownloadGuide}><Download size={15}/> ดาวน์โหลด Shape Guide PNG (กรณี Copy ไม่ได้)</button>
    {hasShape && <div className="prompt-preview shape-prompt"><div className="prompt-top"><span>SHAPE EDIT PROMPT</span><button onClick={props.onCopyPrompt}><Copy size={13}/> Copy</button></div><pre>{props.prompt.slice(0,1400)}{props.prompt.length>1400?'\n…':''}</pre></div>}
    <p className="shape-footnote">การส่งภาพทำผ่าน Clipboard และการวางด้วย Ctrl+V ด้วยตัวคุณเอง ไม่มีการ Inject หรือส่งข้อมูลเข้าแท็บ ChatGPT อัตโนมัติ</p>
  </div>;
}
