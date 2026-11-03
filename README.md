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

1. เปิดแอป: โหลด **Novice Female** ที่มี Region ตัวอย่าง 19 ชิ้นส่วนให้ทันที
2. เลื่อนเมาส์บนภาพ: จุดนั้นเรืองแสง; คลิกเลือกเพื่อดู Material, Hex Palette, Layer, เทคนิควาด
3. Shift+Click หรือกดเครื่องหมายเลือกหน้า Part เพื่อเลือกหลายชิ้น; กด **เลือกคู่** เมื่อต้องการเลือกถุงมือ/รองเท้าทั้งสองข้าง
4. กด **AI Edit** ใส่ข้อความ เช่น `เปลี่ยนบูตหนังทั้งสองเป็นรองเท้าเกราะคริสตัลฟ้าและเงิน` แล้วกด Copy Prompt หรือ Export Edit JSON/Mask PNG เพื่อนำไปใช้กับ AI ภายนอก
5. กด **ดาวน์โหลด AI Template** แล้วส่งพร้อม PNG ให้ AI วิเคราะห์; นำไฟล์ Markdown ที่ AI ส่งกลับมา Import อีกครั้ง
6. ถ้า Polygon ยังไม่ตรง ใช้แท็บ **Tag & Region** เพื่อกดเลือกแล้วลากจุด หรือวาดขอบเขตใหม่
7. Export Markdown ที่แก้แล้วเก็บคู่กับไฟล์ภาพต้นฉบับ

## นำเข้าไฟล์จริง

- กด **นำเข้ารูป** เพื่อเลือก PNG/JPG/WebP; เมื่อนำเข้าภาพใหม่ Annotation เก่าจะถูกล้างเพื่อป้องกัน Tag ผิดรูป
- กด **นำเข้า MD** เลือกเอกสารที่มี fenced block แบบ ` ```character-map `; ระบบตรวจ schema, `part.id`, สี, และ polygon
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

## ขอบเขตและความจริงที่ควรรู้

- Polygon ที่แนบกับตัวอย่าง Novice Female เป็นการ **วาดประมาณตามภาพ** เพื่อสาธิต UI ไม่ใช่ Mask แบบ pixel-perfect
- ตัวอย่างสีเป็นค่าประมาณที่ทำขึ้นสำหรับระบบ ไม่ใช่การคัดสีทุกพิกเซลของภาพแบบ forensic
- PNG ที่นำเข้าเป็นภาพแบน ไม่ใช่ layer ของ Krita; Part บนเว็บเป็น Semantic Overlay
- แอปนี้ **ยังไม่เรียก AI image-edit API จริง** (ไม่มี Cloudflare Workers AI integration); ทำ Prompt + Edit JSON + Mask เพื่อส่งไปใช้เองก่อน
- การนำภาพใหม่มาเปรียบเทียบเป็น Preview ในหน่วยความจำของแท็บ; ต้องเก็บ/Export ไฟล์เอง ไม่มี database และไม่แก้ภาพต้นฉบับอัตโนมัติ
- มีการตรวจข้อมูลเบื้องต้นและแก้ polygon เองได้ แต่ยังไม่มี segmentation AI อัตโนมัติหรือ polygon holes
- โปรดตรวจ L/R: ด้านซ้ายของตัวละครหมายถึงซ้ายตามกายวิภาค **ไม่ใช่ซ้ายของคนมองภาพ**

## โครงสร้าง

```text
src/
  App.tsx                  แอปหลัก Inspector / Tag / AI Edit / Docs
  index.css                Tailwind v4 + custom dark studio theme
  data/demo.ts             Novice Female ตัวอย่างพร้อม Polygon
  lib/types.ts             Character Map types
  lib/character-map.ts     Markdown parser, validation, Markdown exporter
  lib/ai-prompts.ts        Edit request + precise AI prompt builder
  lib/download.ts          File import/export, mask generator
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
