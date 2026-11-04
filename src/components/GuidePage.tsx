import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpenText, Check, ChevronRight, CircleHelp, Copy,
  Download, FileJson2, FileText, Image as ImageIcon, Layers3, MousePointer2,
  ScanLine, Sparkles, Upload, WandSparkles,
} from 'lucide-react';
import { makeMappingPrompt } from '../lib/ai-prompts';
import { copyText } from '../lib/download';
import { makeImagePrompt } from '../lib/onboarding-prompts';

interface GuidePageProps {
  onHome: () => void;
  onOpenStudio: () => void;
  onOpenExample: () => void;
  onDownloadTemplate: () => void;
}

const DEFAULT_CONCEPT = 'An original young fantasy Novice adventurer wearing a warm brown leather tunic, cream sleeves, small metal shoulder guards, leather gloves, a utility belt, knee guards, and high lace-up boots. Friendly expression, short tousled hair, amber eyes.';

export default function GuidePage({ onHome, onOpenStudio, onOpenExample, onDownloadTemplate }: GuidePageProps) {
  const [concept, setConcept] = useState(DEFAULT_CONCEPT);
  const [copied, setCopied] = useState<'image' | 'mapping' | null>(null);
  const imagePrompt = makeImagePrompt(concept);
  const mappingPrompt = makeMappingPrompt();

  const copyPrompt = async (kind: 'image' | 'mapping', value: string) => {
    try {
      await copyText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
      window.alert('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความในกรอบ Prompt แล้วคัดลอกด้วย Ctrl+C');
    }
  };

  return <div className="guide-page">
    <header className="home-nav guide-nav">
      <button className="brand home-brand" onClick={onHome} aria-label="กลับหน้าแรก">
        <div className="brand-mark"><Layers3 size={21} strokeWidth={2.15}/></div>
        <div><div className="brand-title">CHARACTER<span>STUDIO</span></div><div className="brand-caption">MY-GAME-DESIGN <span className="version-dot">●</span> LOCAL WORKSPACE</div></div>
      </button>
      <nav className="home-menu" aria-label="เมนูหลัก">
        <button onClick={onHome}>หน้าแรก</button>
        <span className="home-menu-active">Character Design</span>
        <button onClick={() => document.getElementById('guide-template')?.scrollIntoView({ behavior: 'smooth' })}>Template Guide</button>
      </nav>
      <button className="home-nav-button" onClick={onOpenStudio}>เข้า Workspace <ArrowRight size={16}/></button>
    </header>

    <main className="guide-wrap">
      <div className="guide-breadcrumb"><button onClick={onHome}><ArrowLeft size={14}/> หน้าแรก</button><ChevronRight size={12}/><span>Character Design · Getting Started</span></div>

      <section className="guide-intro">
        <div className="guide-intro-copy">
          <div className="home-eyebrow"><span className="home-pulse"/> START HERE <span className="home-hyphen"/> BEGINNER WORKFLOW</div>
          <h1>จากภาพตัวละคร 1 รูป<br/><span>สู่ดีไซน์ที่เลือกแก้เป็นส่วน ๆ ได้</span></h1>
          <p>ยังไม่เคยใช้มาก่อนก็เริ่มได้ ทำตามลำดับด้านล่าง: สร้างภาพ → ดาวน์โหลด Template → ส่งภาพกับ Template ให้ AI วิเคราะห์ → นำรูปและ MD เข้า Workspace</p>
          <div className="guide-intro-actions"><button onClick={() => document.getElementById('guide-image')?.scrollIntoView({ behavior: 'smooth' })} className="guide-primary-link">เริ่มขั้นตอนที่ 01 <ArrowRight size={16}/></button><button onClick={onOpenStudio}>มีรูปและ MD แล้ว? ข้ามไป Workspace</button></div>
        </div>
        <div className="guide-flow-visual" aria-label="ลำดับการทำงาน">
          <div className="guide-flow-top"><Sparkles size={15}/> DATA PIPELINE <span>NO AI API REQUIRED</span></div>
          <div className="guide-flow-track">
            <div><span><ImageIcon size={21}/></span><strong>IMAGE</strong><small>Master PNG</small></div><ChevronRight size={17}/>
            <div><span><FileText size={21}/></span><strong>TEMPLATE</strong><small>AI .md contract</small></div><ChevronRight size={17}/>
            <div><span><FileJson2 size={21}/></span><strong>MAPPING</strong><small>Completed .md</small></div><ChevronRight size={17}/>
            <div><span><MousePointer2 size={21}/></span><strong>STUDIO</strong><small>Interactive parts</small></div>
          </div>
          <p><Check size={14}/> ภาพตัวอย่างที่หน้าแรกไม่ถูกนำเข้า Workspace อัตโนมัติ</p>
        </div>
      </section>

      <div className="guide-main-grid">
        <div className="guide-steps">
          <article id="guide-image" className="guide-step">
            <div className="guide-step-index"><span>01</span><i/></div>
            <div className="guide-step-body">
              <div className="guide-step-heading"><div><span className="guide-kicker">GENERATE / IMPORT A MASTER IMAGE</span><h2>สร้างรูปตัวละครต้นฉบับ</h2></div><span className="guide-step-pill">ได้ไฟล์รูป .png</span></div>
              <p>ไปที่ AI สร้างภาพที่คุณถนัด เช่น ChatGPT หรือบริการสร้างภาพอื่น แล้วใช้ Prompt ด้านล่าง จะได้ภาพตัวละครยืนเต็มตัว 1 รูป (ถ้ามีรูปอยู่แล้ว ข้ามขั้นตอนนี้ได้เลย)</p>
              <label className="guide-input-label" htmlFor="character-concept">รายละเอียดตัวละครที่ต้องการ <span>แก้ไขได้ก่อนคัดลอก Prompt</span></label>
              <textarea id="character-concept" className="guide-concept" value={concept} onChange={e => setConcept(e.target.value)} rows={3}/>
              <PromptPanel title="01 / IMAGE GENERATION PROMPT" value={imagePrompt} copied={copied === 'image'} onCopy={() => void copyPrompt('image', imagePrompt)}/>
              <div className="guide-tips"><CircleHelp size={16}/><span>บันทึกรูปที่ AI สร้างเป็น <strong>PNG</strong> (พื้นหลังโปร่งใสถ้ารองรับ) และเก็บรูปนี้ไว้เป็น Master ห้ามเปลี่ยนมุมหรือครอปภาพก่อนทำ Mapping</span></div>
            </div>
          </article>

          <article id="guide-template" className="guide-step">
            <div className="guide-step-index"><span>02</span><i/></div>
            <div className="guide-step-body">
              <div className="guide-step-heading"><div><span className="guide-kicker">DOWNLOAD / DATA CONTRACT</span><h2>ดาวน์โหลด AI Template.md</h2></div><span className="guide-step-pill">ได้ไฟล์ .md</span></div>
              <p>ไฟล์นี้เป็นแบบฟอร์มที่บอก AI ว่าต้องแยกตัวละครเป็นชิ้นส่วนอะไรบ้าง และต้องส่งข้อมูลกลับมาในรูปแบบใด เพื่อให้โปรแกรมรู้ว่ารองเท้า ผม ถุงมือ อยู่ตรงไหน</p>
              <div className="guide-template-download"><div className="guide-template-fileicon"><FileText size={27}/></div><div><strong>AI_CHARACTER_MAPPING_TEMPLATE.md</strong><span>Character Map Schema 1.0 · พิกัด 0–1000 · สี / วัสดุ / เทคนิค / Polygon</span></div><button onClick={onDownloadTemplate}><Download size={16}/> ดาวน์โหลด Template</button></div>
              <div className="guide-tips"><Check size={16}/><span>ยัง<strong>ไม่ต้อง</strong>เปิดแก้ไฟล์ Template เอง ให้ดาวน์โหลดไปแนบพร้อมรูปในขั้นตอนที่ 03</span></div>
            </div>
          </article>

          <article id="guide-mapping" className="guide-step">
            <div className="guide-step-index"><span>03</span><i/></div>
            <div className="guide-step-body">
              <div className="guide-step-heading"><div><span className="guide-kicker">ANALYZE / ATTACH BOTH FILES</span><h2>ให้ AI กรอก Template ตามรูป</h2></div><span className="guide-step-pill">ได้ไฟล์ผลลัพธ์ .md</span></div>
              <p>เปิดแชต AI ใหม่ <strong>แนบ 2 ไฟล์ในคำขอเดียวกัน</strong> แล้ววางคำสั่งนี้ AI จะอ่านรูปและ Template เพื่อสร้างไฟล์ Markdown ฉบับสมบูรณ์ที่โปรแกรมนำเข้าได้</p>
              <div className="guide-attachments"><div><ImageIcon size={18}/><span><strong>แนบไฟล์ที่ 1</strong><small>รูปต้นฉบับของคุณ เช่น character.png</small></span></div><span className="guide-attach-plus">+</span><div><FileText size={18}/><span><strong>แนบไฟล์ที่ 2</strong><small>AI_CHARACTER_MAPPING_TEMPLATE.md</small></span></div></div>
              <PromptPanel title="03 / AI MAPPING COMMAND" value={mappingPrompt} copied={copied === 'mapping'} onCopy={() => void copyPrompt('mapping', mappingPrompt)}/>
              <div className="guide-tips"><ScanLine size={16}/><span>สั่งให้ AI ส่งกลับเป็นไฟล์ <strong>.md ที่กรอกข้อมูลแล้ว</strong> ไม่ใช่ไฟล์ Template เดิม เมื่อได้มาแล้วดาวน์โหลด เช่น <code>my_character_map.md</code> และตรวจ Polygon บนภาพอีกครั้ง เพราะ AI ประเมินขอบเขตคลาดเคลื่อนได้</span></div>
            </div>
          </article>

          <article id="guide-workspace" className="guide-step guide-step-last">
            <div className="guide-step-index"><span>04</span></div>
            <div className="guide-step-body guide-finish">
              <div className="guide-step-heading"><div><span className="guide-kicker">IMPORT / INTERACTIVE WORKSPACE</span><h2>นำรูป + MD เข้า Character Design</h2></div><span className="guide-step-pill">พร้อมคลิกดูชิ้นส่วน</span></div>
              <p>กดเข้า Workspace แล้วเลือก <strong>“นำเข้ารูป”</strong> เป็นไฟล์ Master ต้นฉบับ ตามด้วย <strong>“นำเข้า MD”</strong> ที่ AI สร้างในขั้นตอน 03 เมื่อถูกต้องจะเห็นรายชื่อ Part และขอบเขตบนตัวละคร</p>
              <div className="guide-finish-actions"><button onClick={onOpenStudio}><Upload size={18}/> เข้า Workspace เพื่อนำเข้าไฟล์ <ArrowRight size={17}/></button><button onClick={onOpenExample}><Sparkles size={16}/> ลอง Demo ที่เตรียมไว้</button></div>
            </div>
          </article>
        </div>

        <aside className="guide-aside">
          <div className="guide-aside-card"><span className="guide-kicker">QUICK REFERENCE</span><h3>เตรียมไฟล์อะไรบ้าง?</h3><div className="guide-fileline"><ImageIcon size={18}/><div><strong>01 · character.png</strong><small>รูปตัวละครที่คุณสร้าง/มีอยู่</small></div></div><div className="guide-fileline"><BookOpenText size={18}/><div><strong>02 · AI_CHARACTER_MAPPING_TEMPLATE.md</strong><small>ไฟล์กติกาดาวน์โหลดจากหน้านี้</small></div></div><div className="guide-fileline"><FileText size={18}/><div><strong>03 · character_map.md</strong><small>ผลลัพธ์ที่ AI กรอกให้ตามรูป</small></div></div><button onClick={onOpenStudio}>เข้า Workspace <ArrowRight size={15}/></button></div>
          <div className="guide-json-card"><div className="guide-json-icon"><FileJson2 size={20}/></div><h3>JSON คืออะไร?</h3><p><strong>JSON</strong> คือรูปแบบข้อมูลที่โปรแกรมอ่านได้ เช่น รหัสชิ้นส่วน สี และพิกัดขอบเขตของรองเท้า</p><pre>{'{\n  "id": "left_boot",\n  "colors": ["#8D5749"],\n  "polygons": [\n    [[530,755],[675,755],[710,945]]\n  ]\n}'}</pre><p>ไฟล์ <strong>MD</strong> เป็นเอกสารสำหรับคนอ่าน และมี JSON ที่ AI กรอกไว้ข้างใน ดังนั้น <em>นำเข้า MD ไฟล์เดียวก็พอ</em> ไม่จำเป็นต้องกดนำเข้า JSON แยก</p><div className="guide-json-note"><Check size={14}/> ปุ่ม JSON ใน Studio สำหรับผู้ใช้ขั้นสูงหรือการแลกข้อมูลกับโค้ด</div></div>
        </aside>
      </div>
    </main>
    <footer className="home-footer guide-footer"><div><Layers3 size={17}/> CHARACTER STUDIO <span>© My-Game-Design</span></div><span><WandSparkles size={14}/> PROMPT-BASED / LOCAL-FIRST</span><button onClick={onHome}>กลับหน้าแรก <ArrowRight size={14}/></button></footer>
  </div>;
}

function PromptPanel({ title, value, copied, onCopy }: { title: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="guide-prompt-panel"><div className="guide-prompt-head"><span><FileJson2 size={14}/> {title}</span><button onClick={onCopy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'คัดลอกแล้ว' : 'คัดลอก Prompt ทั้งหมด'}</button></div><pre tabIndex={0}>{value}</pre><div className="guide-prompt-foot"><span>เลือกข้อความในกรอบเพื่อคัดลอกเองได้</span><span>{value.length.toLocaleString()} chars</span></div></div>;
}
