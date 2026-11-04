import { Copy, Download, FileJson2, Image as ImageIcon, Layers3 } from 'lucide-react';

type Props={
  frameCount:number;imageLoaded:boolean;hasGuide:boolean;exporting:boolean;
  onDownloadAll:()=>void;onDownloadCutout:()=>void;onDownloadCurrent:()=>void;onExportJson:()=>void;
  onCopySheet:()=>void;onCopyBatchPrompt:()=>void;onCopyGuide:()=>void;onCopyPrompt:()=>void;onDownloadTemplate:()=>void;
};

export default function RigExportHub(p:Props){
  return <section className="rig-export-hub" aria-label="ดาวน์โหลดไฟล์ Rig และ Motion">
    <div className="rig-export-heading"><Download size={20}/><div><h3>Export Center</h3><p>ดาวน์โหลดและคัดลอกอยู่ฝั่งนี้ทั้งหมด</p></div></div>
    <button className="rig-export-main" disabled={!p.imageLoaded||p.exporting} onClick={p.onDownloadAll}><Download size={17}/><span><strong>Bone Guides + Prompts</strong><small>ZIP ครบ {p.frameCount} เฟรมในคลิกเดียว</small></span></button>
    <button className="rig-export-secondary" disabled={!p.imageLoaded||p.exporting} onClick={p.onDownloadCutout}><Layers3 size={17}/><span>Cutout Layers + Render PNG ZIP</span></button>
    <details className="rig-export-fold" open><summary>ส่งภาพรวมให้ ChatGPT</summary>
      <button disabled={!p.imageLoaded||p.exporting} onClick={p.onCopySheet}><ImageIcon size={15}/> Copy Master + ทุก Guide (ภาพเดียว)</button>
      <button disabled={!p.imageLoaded} onClick={p.onCopyBatchPrompt}><Copy size={15}/> Copy Prompt รวม {p.frameCount} เฟรม</button>
    </details>
    <details className="rig-export-fold"><summary>เฟรมปัจจุบัน / ไฟล์ข้อมูล</summary>
      <button disabled={!p.hasGuide} onClick={p.onCopyGuide}><ImageIcon size={15}/> Copy Bone Guide PNG</button>
      <button disabled={!p.imageLoaded} onClick={p.onCopyPrompt}><Copy size={15}/> Copy Pose Prompt</button>
      <button disabled={!p.hasGuide} onClick={p.onDownloadCurrent}><Download size={15}/> ดาวน์โหลด Guide PNG เฟรมนี้</button>
      <button disabled={!p.imageLoaded} onClick={p.onExportJson}><FileJson2 size={15}/> Export {p.frameCount} Frames JSON</button>
      <button onClick={p.onDownloadTemplate}><Download size={15}/> ดาวน์โหลด AI Template .md</button>
    </details>
    <p className="rig-export-disclaimer">ZIP มีภาพ Master, Guide เต็มขนาด, Contact Sheet, Prompt แยกรายเฟรม และ JSON · ยังต้องแนบใน ChatGPT เอง</p>
  </section>;
}
