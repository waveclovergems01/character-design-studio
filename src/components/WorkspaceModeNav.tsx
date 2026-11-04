import { Bone, BookOpenText, Film, Palette, ScanLine, WandSparkles } from 'lucide-react';

export type WorkspaceMode = 'design'|'shape'|'ai'|'rig'|'animation'|'docs';

export const MODE_INFO: Record<WorkspaceMode,{name:string;description:string;detail:string}> = {
  design:{name:'สีและชิ้นส่วน',description:'Inspect · Tag · สี · Region',detail:'ตรวจสเปกสีและวัสดุ แก้ชื่อ Tag และขอบเขต Polygon โดยไม่เปลี่ยนพิกเซลรูปต้นฉบับ'},
  shape:{name:'ปรับรูปทรง',description:'Shape Guide · Mirror',detail:'วาดเส้นเป้าหมาย ปรับความยาว/องศา และสร้างภาพกำกับให้ AI วาดแก้รูปร่าง'},
  ai:{name:'สั่งแก้ด้วย AI',description:'Edit Prompt · Mask',detail:'เลือก Tag ที่มี Polygon แล้วเตรียมคำสั่งและ Mask เพื่อส่งให้ AI ภายนอกแก้รูป'},
  rig:{name:'โครงกระดูกและโมชั่น',description:'Rig · Cutout · Motion',detail:'Pen Tool วาด Polygon Mask ตามขอบภาพจริง สลับชั้นหน้า–หลังรายเฟรม ทดสอบ PixiJS Cutout และดาวน์โหลดจากแถบซ้าย'},
  animation:{name:'พรีวิวแอนิเมชัน',description:'PNG Frames · Sprite Sheet · FPS',detail:'ดูภาพสำเร็จรูปหลายเฟรมหรือหั่น Sprite Sheet ตามแถวและคอลัมน์โดยไม่ใช้ Rig; ปรับ FPS เล่นวน และหยุดดูเฟรม'},
  docs:{name:'ข้อมูล MD',description:'Template · Import · Export',detail:'ดูคำอธิบายไฟล์ MD, JSON และความเข้ากันได้ของ Mapping กับภาพ Master'},
};

const MODES = [
  {id:'design',icon:Palette,label:'สี / Tag',subtitle:'Inspect & Palette'},
  {id:'shape',icon:ScanLine,label:'Shape',subtitle:'ปรับรูปทรง'},
  {id:'ai',icon:WandSparkles,label:'AI Edit',subtitle:'แก้ภาพด้วย AI'},
  {id:'rig',icon:Bone,label:'Rig & Motion',subtitle:'Cutout / Animations'},
  {id:'animation',icon:Film,label:'Animation Preview',subtitle:'PNG / Sprite Sheet'},
  {id:'docs',icon:BookOpenText,label:'MD / Data',subtitle:'เอกสารข้อมูล'},
] as const;

export default function WorkspaceModeNav({value,onChange}:{value:WorkspaceMode;onChange:(mode:WorkspaceMode)=>void}) {
  return <nav className="workspace-mode-nav" aria-label="เลือกโหมดทำงาน" >
    <span className="mode-nav-label">WORKSPACE MODES</span>
    <div className="mode-nav-items">{MODES.map(({id,icon:Icon,label,subtitle},i)=><button key={id} className={value===id?'active':''} onClick={()=>onChange(id)} aria-current={value===id?'page':undefined} title={MODE_INFO[id].detail}>
      <span className="mode-nav-icon"><Icon size={19}/></span><span className="mode-nav-words"><strong>{label}</strong><small>{subtitle}</small></span><span className="mode-nav-number">0{i+1}</span>
    </button>)}</div>
  </nav>;
}
