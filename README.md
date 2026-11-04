# Character Design Studio

เครื่องมือเปิดรูปตัวละคร + Markdown Character Map เพื่อ **เลือกชิ้นส่วนบนภาพ ตรวจสี/เทคนิค และสร้างคำสั่ง AI แก้เฉพาะส่วน** สำหรับงานวาดตัวละคร 2.5D ของ My-Game-Design

โปรเจกต์นี้เป็น Local-first MVP ใช้ **React 19 + TypeScript + Vite 8 + Tailwind CSS 4** ไม่มี backend, database, API key หรือค่า AI ประจำเดือน

## เริ่มใช้งานบน Windows 10 / VS Code

ติดตั้ง Node.js รุ่น 22 หรือ 24 ที่รองรับ (ขั้นต่ำ 20.19.0) แล้วแตก ZIP จากนั้นเปิด Terminal ที่โฟลเดอร์ `character-design-studio`

```bash
npm install
npm run dev
```

เปิด URL ที่ Vite แสดง (ปกติ `http://localhost:5173`)

สร้าง Production build:

```bash
npm run build
npm run preview
```

ไฟล์สำเร็จอยู่ใน `dist/` — นำไปใช้กับ Cloudflare Pages ได้ในอนาคต (`Build command: npm run build`, `Build output directory: dist`). ไม่ต้องตั้ง Worker/API ใน MVP นี้

## เริ่มทดลอง

1. เปิดแอปจะพบ **หน้าแรก (Home)** พร้อมภาพ Novice Male/Female สำหรับโชว์เท่านั้น **ยังไม่โหลดภาพใดเข้าพื้นที่ทำงาน**
2. กดเมนู **Character Design** หรือ **Template Guide** เพื่อเปิด `#guide` ซึ่งมีขั้นตอนเริ่มต้นสำหรับคนที่ยังไม่มีรูปเลย
3. **ขั้นที่ 01 — สร้างรูป Master:** กรอกลักษณะตัวละครในช่อง Concept แล้วกด **คัดลอก Prompt ทั้งหมด** ไปวางที่ AI สร้างภาพ จากนั้นบันทึกภาพตัวละคร (แนะนำ PNG พื้นหลังโปร่งใส) หากมีรูปอยู่แล้วข้ามได้
4. **ขั้นที่ 02 — ดาวน์โหลด AI Template:** กดดาวน์โหลด `AI_CHARACTER_MAPPING_TEMPLATE.md` ซึ่งอธิบายกติกาการแบ่งชิ้นส่วนและรูปแบบข้อมูล
5. **ขั้นที่ 03 — สั่ง AI วิเคราะห์:** แนบ **รูป Master + Template .md สองไฟล์พร้อมกัน** ใน AI ที่รองรับไฟล์แนบ วางคำสั่งที่กดคัดลอกจากหน้า Guide และบันทึกผลลัพธ์เป็น `.md` เช่น `my_character_map.md`
6. **ขั้นที่ 04 — เข้าสู่ Workspace:** กด **นำเข้ารูป** เพื่อเลือกรูปเดิม แล้วกด **นำเข้า MD** เพื่อเลือกไฟล์ที่ AI กรอกให้; ถ้าแผนที่ถูกต้องจะเห็น Part/Region บนรูป (หรือเปิด Example ที่มีตัวอย่าง 19 ส่วน)
7. **Zoom:** คลิกภาพ **หนึ่งครั้งเพื่อ Focus** แล้วหมุนล้อเมาส์เพื่อซูมตามจุดที่เมาส์ชี้ ช่วง **25%–1,000%**; ใช้ปุ่ม `−`, `+` และ Reset 100% ได้เสมอ
8. **Pan:** กด **ล้อเมาส์กลางค้างไว้** แล้วลากซ้าย/ขวา/ขึ้น/ลงเพื่อเลื่อนดูภาพ ใช้ได้แม้คลิกตรง Polygon และเมื่อภาพขนาดพอดี Canvas (พื้นที่เลื่อนมีขอบรอบภาพให้ด้วย)
9. ชี้/คลิกส่วนบนรูปเพื่อดู Material, Hex Palette, Layer, เทคนิควาด; Shift+Click หรือกดเครื่องหมายหน้า Part เพื่อเลือกหลายชิ้น
10. กด **AI Edit** ใส่คำสั่ง เช่น `เปลี่ยนบูตหนังทั้งสองเป็นรองเท้าเกราะคริสตัลฟ้าและเงิน` แล้วคัดลอก Prompt หรือ Export Edit JSON/Mask PNG สำหรับ AI ภายนอก
11. ถ้า Polygon ยังไม่ตรง ใช้แท็บ **Tag & Region** ปรับจุดหรือวาดขอบเขตใหม่ แล้ว Export MD เก็บคู่กับรูปต้นฉบับ
12. **Shape Guide (ใหม่ v0.4):** เมื่อมีภาพ Master แล้ว กดแท็บ **Shape** → เลือก Region จาก Tag (ถ้า MD ตรงภาพ) หรือ **วาดพื้นที่เอง** โดยไม่จำเป็นต้องมี MD → คลิก 3 จุดขึ้นไปบน Canvas → ปรับรูปทรงเป้าหมายด้วยจุดสีเหลืองหรือสไลเดอร์ความกว้าง/สูง/องศา/เลื่อน → ระบุคำขอแก้รูปทรง
13. สำหรับ ChatGPT บนเว็บ กด **Copy รูปต้นฉบับ** แล้วสลับแท็บไป Ctrl+V วางในกล่องแชต → กลับมากด **Copy รูป Shape Guide** แล้วไป Ctrl+V วางเพิ่ม → กลับมากด **Copy Prompt แก้รูปทรง** แล้ววางข้อความ → กดส่ง **ครั้งเดียวเมื่อแนบครบ 2 รูป + คำสั่ง** (Clipboard เก็บรายการล่าสุดเท่านั้น)

**Keyboard shortcuts เมื่อ Focus อยู่ใน Canvas:** `+` ขยาย, `-` ย่อ, `0` กลับ 100%; **กดล้อเมาส์กลางค้างแล้วลาก** เพื่อ Pan. ปุ่มซูมไม่ต้อง Focus ก่อนใช้งาน

### JSON ต่างจาก MD อย่างไร?

- **PNG**: รูปตัวละครจริงที่มองเห็น
- **MD (Markdown)**: ไฟล์คำบรรยายสำหรับคนอ่าน พร้อมบล็อก `character-map` ที่ AI กรอกให้
- **JSON**: ข้อมูลในบล็อก `character-map` ที่อยู่ **ภายใน MD** (เช่น ชื่อ Part, สี HEX, และ Polygon); โปรแกรมนำไปอ่านและวาดกรอบซ้อนบนภาพ

ผู้ใช้ทั่วไป **ไม่ต้องใช้ปุ่มนำเข้า JSON** ถ้า AI ส่งไฟล์ MD ที่ถูกต้องแล้ว ปุ่ม JSON มีไว้รองรับข้อมูลแบบแยกไฟล์หรือใช้ในโค้ดในอนาคต

## นำเข้าไฟล์จริง

- กด **นำเข้ารูป** เพื่อเลือก PNG/JPG/WebP; เมื่อนำเข้าภาพใหม่ Annotation เก่าจะถูกล้างเพื่อป้องกัน Tag ผิดรูป
- กด **นำเข้า MD** เลือกเอกสารที่มี fenced block แบบ ` ```character-map `; ระบบตรวจ schema, `part.id`, สี, และ polygon
- **ป้องกัน MD คนละภาพ (v0.4):** หากขนาด `image.width/height` ใน MD ไม่ตรงรูปปัจจุบัน ระบบบล็อกการนำ Polygon มาแสดงและมีปุ่มนำเข้ารูปต้นทางที่ถูกต้อง หรือ Copy Prompt ขอ AI สร้าง MD ใหม่จากรูปนี้ หากขนาดตรงแต่ชื่อไฟล์ไม่ตรง หรือ MD มีหลายเฟรม/จำนวน Tags ผิดปกติ ระบบซ่อน Region จนกว่าจะกดยืนยันหลังตรวจด้วยตา
- **ตรวจพิกัดบนพื้นโปร่งใส:** ระบบสุ่มจุดใน Polygon มาตรวจว่าไปทับพื้นที่โปร่งใสของ PNG มากผิดปกติหรือไม่ ถ้าผิดจำนวนมากจะซ่อน Region และแจ้งเตือน วิธีนี้เป็นเพียงตัวช่วยเตือน ไม่ใช่ AI Segmentation และอาจพลาดเมื่อ PNG มีพื้นหลังทึบ
- ถ้า MD เดิมเป็นข้อความทั่วไป **ไม่มีพิกัด Region** แอปจะยังเก็บเอกสารให้ดู แต่ไม่สามารถรู้ตำแหน่งแม่นยำได้โดยอัตโนมัติ ต้องใช้ AI Template ขอให้ AI กรอก `character-map` แล้วนำเข้าใหม่ หรือเพิ่ม Tag ด้วยตัวเอง
- ระบบใช้ **normalized_1000** (พิกัดภาพช่วง 0–1000 แยกแกน X/Y) เพื่อไม่ต้องสร้างพิกัดใหม่ตามขนาดจอ

## Export ที่ใช้ได้

| ปุ่ม | ไฟล์ | ประโยชน์ |
|---|---|---|
| Export MD | `character_design_map.md` | สเปกส่วนต่าง ๆ พร้อม JSON และคำอธิบาย |
| Export JSON | `character_map.json` | เปิดโปรเจกต์ต่อหรือใช้กับโค้ดในอนาคต |
| AI Edit > Copy Prompt | ข้อความ | วางใน Image Editing AI พร้อมรูปต้นฉบับ |
| AI Edit > Edit Request | `edit_request.json` | คำสั่งแก้แบบมี part_id/polygon/protected IDs |
| AI Edit > Mask PNG | `selection_mask.png` | PNG โปร่งใส มีพื้นที่ขาวเฉพาะที่เลือก; แล้วแต่ AI provider ว่ารองรับ mask หรือไม่ |
| ดาวน์โหลด AI Template | `.md` | ใช้สั่ง AI เติมข้อมูลผูกรูปกับจุดให้ตรง |
| Shape > Copy รูปต้นฉบับ | Clipboard PNG | วางด้วย Ctrl+V ใน ChatGPT หรือ AI ที่รองรับรูปภาพ |
| Shape > Copy รูป Shape Guide | Clipboard PNG | รูปเดิมพร้อมเส้นสีฟ้า (ขอบเดิม) สีส้ม (รูปทรงที่ต้องการ) และจุดสีเหลือง |
| Shape > Copy Prompt | Clipboard ข้อความ | คำสั่งให้ AI แก้ทรงเฉพาะส่วน รักษาสี วัสดุ ลาย และแสงเงาเดิม |
| Shape > ดาวน์โหลด Shape Guide PNG | `.png` | สำรองสำหรับกรณี Clipboard API ไม่รองรับ |

## ขอบเขตและความจริงที่ควรรู้

- Polygon ที่แนบกับตัวอย่าง Novice Female เป็นการ **วาดประมาณตามภาพ** เพื่อสาธิต UI ไม่ใช่ Mask แบบ pixel-perfect
- ตัวอย่างสีเป็นค่าประมาณที่ทำขึ้นสำหรับระบบ ไม่ใช่การคัดสีทุกพิกเซลของภาพแบบ forensic
- PNG ที่นำเข้าเป็นภาพแบน ไม่ใช่ layer ของ Krita; Part บนเว็บเป็น Semantic Overlay
- แอปนี้ **ยังไม่เรียก AI image-edit API จริง** (ไม่มี Cloudflare Workers AI integration); ทำ Prompt + Edit JSON + Mask เพื่อส่งไปใช้เองก่อน
- **Shape Guide เป็นการทำภาพประกอบคำสั่ง ไม่ใช่การบิด Mesh/Pixels ในแอป:** ภาพต้นฉบับไม่ถูกแก้ด้วยสไลเดอร์; AI ภายนอกจะนำภาพต้นฉบับและภาพเส้นกำกับไปวาดผลลัพธ์ ผู้ใช้ต้องตรวจความต่อเนื่องของแขนขาและสีด้วยตา
- **การส่งเข้า ChatGPT ไม่ใช่การ Inject แท็บเว็บ:** ปุ่มเปิดแท็บและ Copy ช่วยเตรียมให้วาง Ctrl+V ด้วยตัวเองเท่านั้น; ไม่สามารถสั่งการแท็บ ChatGPT ที่เปิดอยู่ หรือรับรูปที่ AI สร้างกลับอัตโนมัติ
- การนำภาพใหม่มาเปรียบเทียบเป็น Preview ในหน่วยความจำของแท็บ; ต้องเก็บ/Export ไฟล์เอง ไม่มี database และไม่แก้ภาพต้นฉบับอัตโนมัติ
- มีการตรวจข้อมูลเบื้องต้นและแก้ polygon เองได้ แต่ยังไม่มี segmentation AI อัตโนมัติหรือ polygon holes
- โปรดตรวจ L/R: ด้านซ้ายของตัวละครหมายถึงซ้ายตามกายวิภาค **ไม่ใช่ซ้ายของคนมองภาพ**

## โครงสร้าง

```text
src/
  App.tsx                  แอปหลัก Inspector / Tag / Shape / AI Edit / Docs + MD guard
  components/HomePage.tsx  หน้าแรกและเมนูเข้า Workspace
  components/GuidePage.tsx หน้าไกด์เริ่มต้น 4 ขั้นตอน + Copy Prompt (v0.3)
  components/ShapeToolPanel.tsx แผงวาด Shape Guide + ชุด Clipboard handoff (v0.4)
  index.css                Tailwind v4 + custom dark studio theme
  guide.css                รูปแบบหน้าไกด์ (v0.3)
  shape.css                สไตล์ Shape Guide และกล่องเตือน Mapping (v0.4)
  data/demo.ts             Novice Female ตัวอย่างพร้อม Polygon
  lib/types.ts             Character Map types
  lib/character-map.ts     Markdown parser, validation, Markdown exporter
  lib/ai-prompts.ts        Edit request + precise AI prompt builder
  lib/download.ts          File import/export, mask generator
  lib/zoom.ts              Fit/Zoom/Mouse Wheel (25%–1000%)
  lib/pan.ts               คำนวณเลื่อนภาพด้วยเมาส์กลาง (v0.3)
  lib/onboarding-prompts.ts สร้าง Prompt สำหรับภาพ Master (v0.3)
  lib/shape-guide.ts       แปลง Polygon, Prompt, วาดภาพกำกับ, Copy PNG (v0.4)
  lib/map-compatibility.ts ตรวจขนาด/ชื่อ/จำนวนเฟรมของ MD เทียบกับรูป (v0.4)
  lib/map-image-quality.ts ตรวจ Region บนพื้นโปร่งใสเบื้องต้น (v0.4)
public/
  examples/                 Master Novice Female/Male PNG ตัวอย่าง
  templates/AI_CHARACTER_MAPPING_TEMPLATE.md
```

## GitHub

```bash
git init
git add .
git commit -m "Initial Character Design Studio MVP"
```

สร้าง repo บน GitHub แล้วเพิ่ม remote ตามคำสั่งจากหน้า GitHub ได้เลย (ไม่ต้อง commit โฟลเดอร์ `node_modules/` หรือ `dist/`).

### การพัฒนาต่อ

1. เพิ่ม Mask แบบ raster/brush/lasso + AI Segmentation suggestion
2. เพิ่ม AI provider adapter (เช่น Cloudflare Workers AI / OpenAI Image Edit) เก็บ key เฉพาะ server ไม่ไว้ใน browser
3. ภาพที่แก้ต้องผ่าน Review ก่อน Accept, Update Polygon/Color Map และ Export Character Pack หลายเวอร์ชัน
4. รองรับ sprite sheets 8 ทิศและ mapping ข้ามเฟรมโดยแยก `direction/frame_id`

---

ตัวอย่างภาพในโปรเจกต์ใช้เพื่อทดลองงานออกแบบตามบริบท My-Game-Design ของผู้ใช้
