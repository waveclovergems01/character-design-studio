import { ArrowRight, Box, ChevronRight, Download, FileText, Layers3, MousePointer2, ScanLine, Sparkles, WandSparkles } from 'lucide-react';

interface HomePageProps {
  onOpenStudio: () => void;
  onOpenWorkspace: () => void;
  onOpenExample: () => void;
  onOpenTemplateGuide: () => void;
  onDownloadTemplate: () => void;
}

export default function HomePage({ onOpenStudio, onOpenWorkspace, onOpenExample, onOpenTemplateGuide, onDownloadTemplate }: HomePageProps) {
  return <div className="home-page">
    <header className="home-nav">
      <button className="brand home-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Character Studio หน้าแรก">
        <div className="brand-mark"><Layers3 size={21} strokeWidth={2.15}/></div>
        <div><div className="brand-title">CHARACTER<span>STUDIO</span></div><div className="brand-caption">MY-GAME-DESIGN <span className="version-dot">●</span> LOCAL WORKSPACE</div></div>
      </button>
      <nav className="home-menu" aria-label="เมนูหลัก">
        <span className="home-menu-active">หน้าแรก</span>
        <button onClick={onOpenStudio}>Character Design</button>
        <button onClick={onOpenTemplateGuide}>Template Guide</button>
      </nav>
      <button className="home-nav-button" onClick={onOpenWorkspace}>เข้า Workspace <ArrowRight size={16}/></button>
    </header>

    <main>
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><span className="home-pulse"/> THE CREATIVE WORKSPACE <span className="home-hyphen"/> VERSION 0.12.1</div>
          <h1>Character design,<br/><span>under control.</span></h1>
          <h2>ให้ทุกรายละเอียดของตัวละคร<br/>มีตำแหน่ง สี และคำอธิบายที่ชัดเจน</h2>
          <p>นำเข้าภาพและ Markdown Spec เพื่อแบ่งชิ้นส่วนแบบ Interactive คลิกตรวจสีและเทคนิคการวาด ปรับ Region และสร้างคำสั่งให้ AI แก้เฉพาะส่วนที่เลือก</p>
          <div className="home-hero-actions">
            <button className="home-main-cta" onClick={onOpenStudio}><Layers3 size={19}/> เริ่มต้น Character Design <ArrowRight size={17}/></button>
            <button className="home-secondary-cta" onClick={onDownloadTemplate}><Download size={17}/> ดาวน์โหลด AI Template</button>
          </div>
          <div className="home-hero-note"><ScanLine size={15}/> เริ่มต้นในพื้นที่ว่าง — ภาพตัวอย่างจะโหลดเมื่อคุณเลือกเองเท่านั้น</div>
          <div className="home-metrics"><div><strong>01</strong><span>REFERENCE IMAGE</span></div><div><strong>02</strong><span>SEMANTIC MAP</span></div><div><strong>03</strong><span>AI EDIT PROMPT</span></div></div>
        </div>

        <div className="home-showcase" aria-label="ตัวอย่างงานตัวละคร">
          <div className="home-showcase-top"><span><span className="home-showcase-dot"/> CHARACTER REFERENCE / PREVIEW ONLY</span><span>NOT LOADED</span></div>
          <div className="home-preview-pair">
            <div className="home-preview-figure"><img src={`${import.meta.env.BASE_URL}examples/novice_female_front.png`} alt="ตัวอย่างตัวละคร Novice ผู้หญิง"/><div>Novice / Female</div></div>
            <div className="home-preview-figure"><img src={`${import.meta.env.BASE_URL}examples/novice_male_front.png`} alt="ตัวอย่างตัวละคร Novice ผู้ชาย"/><div>Novice / Male</div></div>
          </div>
          <div className="home-showcase-bottom"><div><div className="home-showcase-caps">DEMO ASSETS</div><strong>Novice character collection</strong><p>ตัวอย่างสำหรับศึกษาการแบ่งชิ้นส่วนเท่านั้น</p></div><button onClick={onOpenExample}>ลองเปิด Demo <ChevronRight size={16}/></button></div>
        </div>
      </section>

      <section className="home-modules" id="modules">
        <div className="home-section-head"><div><span className="home-section-kicker">TOOLS / MODULES</span><h2>เลือกพื้นที่ทำงาน</h2></div><p>เริ่มจากการจัดการตัวละคร แล้วค่อยต่อยอดเป็นเครื่องมืออื่นในโปรเจกต์ My-Game-Design</p></div>
        <div className="home-module-grid">
          <button className="home-module-card home-module-featured" onClick={onOpenStudio}><div className="home-module-icon"><MousePointer2 size={24}/></div><div className="home-module-tag">AVAILABLE NOW</div><h3>Character Design</h3><p>เริ่มจากคู่มือสร้างรูป + AI Template + Prompt ก่อนนำรูปและ MD เข้าดู Region สี วัสดุ และเทคนิค</p><div className="home-module-bottom"><span>START 4-STEP GUIDE</span><ArrowRight size={18}/></div></button>
          <button className="home-module-card" onClick={onOpenTemplateGuide}><div className="home-module-icon"><FileText size={24}/></div><div className="home-module-tag secondary">DATA CONTRACT</div><h3>AI Mapping Template</h3><p>กำหนดรูปแบบข้อมูลให้ AI วิเคราะห์ภาพและส่ง Markdown ที่นำเข้าระบบได้</p><div className="home-module-bottom"><span>VIEW TEMPLATE GUIDE</span><ArrowRight size={18}/></div></button>
          <div className="home-module-card muted"><div className="home-module-icon"><WandSparkles size={24}/></div><div className="home-module-tag muted-tag">FUTURE MODULE</div><h3>AI Image Generator</h3><p>การเชื่อมต่อ AI Provider เพื่อสร้างหรือแก้ภาพภายในแอป จะเพิ่มในเวอร์ชันถัดไป</p><div className="home-module-bottom"><span>PLANNED</span><Box size={17}/></div></div>
        </div>
      </section>

      <section className="home-workflow" id="workflow"><div><span className="home-section-kicker">WORKFLOW</span><h2>เริ่มต้นจากศูนย์</h2><p>ตอนนี้มีหน้าไกด์พร้อม Prompt ทั้งสำหรับสร้างภาพและสั่ง AI ให้ทำ Character Map</p></div><div className="home-workflow-steps"><div><span>01</span><strong>สร้างรูป Master</strong><p>ใช้ Prompt กับ AI ใดก็ได้</p></div><ChevronRight size={20}/><div><span>02</span><strong>ดาวน์โหลด Template</strong><p>แนบคู่รูปให้ AI วิเคราะห์</p></div><ChevronRight size={20}/><div><span>03</span><strong>นำรูป + MD เข้า Studio</strong><p>คลิกดูรายละเอียดหรือแก้ Tag</p></div></div></section>
    </main>
    <footer className="home-footer"><div><Layers3 size={17}/> CHARACTER STUDIO <span>© My-Game-Design</span></div><span><Sparkles size={14}/> LOCAL-FIRST / NO AI API REQUIRED</span><button onClick={onOpenStudio}>ดูคู่มือเริ่มต้น <ArrowRight size={14}/></button></footer>
  </div>;
}
