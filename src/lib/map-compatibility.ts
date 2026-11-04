import type { CharacterMap } from './types';

export type ImageIdentity = { width: number; height: number; name: string };

export type MapCompatibility = {
  compatible: boolean;
  errors: string[];
  warnings: string[];
  frameCount: number;
  partCount: number;
};

const nameStem = (name: string) => name.trim().replace(/\\/g, '/').split('/').at(-1)?.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';

export function inspectMapCompatibility(map: CharacterMap, image: ImageIdentity): MapCompatibility {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sameDimensions = map.image.width === image.width && map.image.height === image.height;
  if (!sameDimensions) {
    errors.push(`ขนาดไม่ตรง: MD อ้างอิง ${map.image.width}×${map.image.height}px แต่รูปที่เปิด ${image.width}×${image.height}px ระบบจึงไม่วาด Region ผิดรูป`);
  }

  const declaredName = map.image.file?.trim();
  if (declaredName && nameStem(declaredName) && nameStem(image.name) && nameStem(declaredName) !== nameStem(image.name)) {
    warnings.push(`ชื่อภาพไม่ตรง: MD ระบุ “${declaredName}” แต่ภาพปัจจุบันคือ “${image.name}” (หากแค่เปลี่ยนชื่อไฟล์ ให้ตรวจ Region ด้วยตา)`);
  }

  const frames = new Set(map.parts.map(p => p.id.match(/^r\d{2}_c\d{2}_/)?.[0]).filter((v): v is string => Boolean(v)));
  const frameCount = frames.size;
  if (frameCount > 1) warnings.push(`MD มีข้อมูลอย่างน้อย ${frameCount} ช่อง Sprite Sheet ไม่ใช่แผนที่ตัวละครเดี่ยว`);
  if (map.parts.length > 200) warnings.push(`มี ${map.parts.length} Tags — ตรวจว่า AI ไม่สร้างข้อมูลซ้ำจากหลายเฟรม`);
  if (!map.parts.length) warnings.push('MD ยังไม่มี Part ให้แสดงบนภาพ');

  return { compatible: errors.length === 0, errors, warnings, frameCount, partCount: map.parts.length };
}

export function makeMappingRepairPrompt(image: ImageIdentity, blockedMap?: CharacterMap): string {
  return `TASK: Create a NEW accurate Character Design Studio mapping for the SINGLE MASTER IMAGE attached to this message.

CURRENT MASTER IMAGE: ${image.name}, ${image.width} x ${image.height} pixels.
${blockedMap ? `PREVIOUS INCOMPATIBLE MD: ${blockedMap.image.width} x ${blockedMap.image.height}, ${blockedMap.parts.length} parts. Discard ALL its polygons and coordinates. Its source image does not match this PNG.` : ''}

ATTACH BOTH the current master image and AI_CHARACTER_MAPPING_TEMPLATE.md. Analyze the actual attached master image ONLY. If it shows one character, map ONE character, not 32 sprite frames. Never reuse invented row/column IDs from a different sprite sheet.

Follow the exact schema_version "1.0" and coordinate_system "normalized_1000" contract. Report image.width=${image.width}, image.height=${image.height} and image.file="${image.name}". Each visible semantic part must have a stable unique id, material, valid #RRGGBB colors, Thai/English names, technique, notes, anatomical side, polygons of 3+ vertices within 0–1000, numeric z_index, locked, allow_geometry_change and review_status. Include only ACTUALLY VISIBLE parts. Avoid hundreds of duplicate or speculative tags. Preserve correct left/right anatomy.

The polygons must reference the COMPLETE current ${image.width} x ${image.height} PNG, NOT a previously generated sprite sheet, cropped frame or rescaled image. After the fenced \`\`\`character-map JSON block, include part-by-part instructions for painting in Krita. Validate all JSON syntax and output ONLY a complete downloadable Markdown file (.md). Human review of polygon accuracy is still required.`;
}
