import type { CharacterMap, CharacterPart, Point } from './types';

const HEX = /^#[\da-fA-F]{6}$/;

export function normalizePoint([x, y]: Point): Point {
  return [Math.max(0, Math.min(1000, Math.round(x))), Math.max(0, Math.min(1000, Math.round(y)))];
}

export function validateMap(input: unknown): CharacterMap {
  if (!input || typeof input !== 'object') throw new Error('ไม่พบข้อมูล Character Map');
  const data = input as Record<string, unknown>;
  if (data.schema_version !== '1.0' || data.coordinate_system !== 'normalized_1000') {
    throw new Error('Schema ไม่ตรง: ต้องใช้ schema_version 1.0 และ coordinate_system normalized_1000');
  }
  if (!data.character || typeof data.character !== 'object') throw new Error('ไม่มี character');
  const character = data.character as Record<string, unknown>;
  if (typeof character.id !== 'string' || typeof character.name !== 'string') throw new Error('character.id/name ต้องเป็นข้อความ');
  if (!data.image || typeof data.image !== 'object') throw new Error('ไม่มี image');
  const image = data.image as Record<string, unknown>;
  if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || Number(image.width) <= 0 || Number(image.height) <= 0) {
    throw new Error('image.width/height ต้องเป็นเลขมากกว่า 0');
  }
  if (!Array.isArray(data.parts)) throw new Error('ไม่มี parts array');
  const ids = new Set<string>();
  for (const item of data.parts) {
    const part = item as CharacterPart;
    if (!part || typeof part.id !== 'string' || !part.id.trim() || ids.has(part.id)) throw new Error('part.id ว่างหรือซ้ำกัน');
    ids.add(part.id);
    if (!part.name_th || !part.name_en || !part.group || !part.material) throw new Error(`${part.id}: ต้องระบุชื่อ/กลุ่ม/วัสดุ`);
    if (!['character_left', 'character_right', 'center', 'both', 'none'].includes(part.side)) throw new Error(`${part.id}: side ไม่ถูกต้อง`);
    if (!Number.isFinite(part.z_index)) throw new Error(`${part.id}: z_index ต้องเป็นตัวเลข`);
    if (typeof part.technique !== 'string' || typeof part.notes !== 'string') throw new Error(`${part.id}: ต้องระบุ technique และ notes (เป็นข้อความ)`);
    if (typeof part.locked !== 'boolean' || typeof part.allow_geometry_change !== 'boolean') throw new Error(`${part.id}: locked/allow_geometry_change ต้องเป็น boolean`);
    if (!['manual_reviewed', 'ai_suggested', 'unreviewed'].includes(part.review_status)) throw new Error(`${part.id}: review_status ไม่ถูกต้อง`);
    if (!Array.isArray(part.colors) || part.colors.some(c => !c.role || !HEX.test(c.hex))) throw new Error(`${part.id}: สีต้องเป็น HEX #RRGGBB`);
    if (!Array.isArray(part.polygons)) throw new Error(`${part.id}: ไม่มี polygons`);
    for (const poly of part.polygons) {
      if (!Array.isArray(poly) || (poly.length > 0 && poly.length < 3)) throw new Error(`${part.id}: polygon ต้องมีอย่างน้อย 3 จุด`);
      for (const p of poly) {
        if (!Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1000)) {
          throw new Error(`${part.id}: จุดต้องเป็น [x,y] ในช่วง 0–1000`);
        }
      }
    }
  }
  return data as unknown as CharacterMap;
}

export function parseCharacterMarkdown(markdown: string): CharacterMap {
  const tagged = markdown.match(/```character-map\s*\r?\n([\s\S]*?)\r?\n```/i);
  const generic = markdown.match(/```json\s*\r?\n([\s\S]*?)\r?\n```/i);
  const contents = (tagged ?? generic)?.[1];
  if (!contents) throw new Error('ไม่พบ ```character-map ใน MD — ดาวน์โหลด Template แล้วให้ AI กรอกก่อน หรือสร้าง Tag เอง');
  let data: unknown;
  try { data = JSON.parse(contents); } catch { throw new Error('JSON ใน character-map ไม่ถูกต้อง โปรดตรวจเครื่องหมาย , และ "'); }
  return validateMap(data);
}

export function toCharacterMarkdown(map: CharacterMap, extra?: string): string {
  const list = map.parts.map((p, index) => {
    const swatches = p.colors.map(c => `\`${c.role}\` ${c.hex}`).join(', ') || '-';
    return `### ${index + 1}. ${p.name_th} / ${p.name_en}\n\n- Part ID: \`${p.id}\`\n- Material: ${p.material}\n- Colors: ${swatches}\n- Technique: ${p.technique || '-'}\n- Notes: ${p.notes || '-'}\n`;
  }).join('\n');
  return `# ${map.character.name} — Character Design Map\n\n> Schema v1.0 · Coordinate system: 0–1000 (x/y), normalized to the image.\n> AI-generated regions must be reviewed by a human before editing.\n\n## Identity & Style\n\n${map.character.identity_notes}\n\nStyle: ${map.character.style}  \nView: ${map.character.view}  \nImage: ${map.image.width} × ${map.image.height} px\n\n## Character Map (machine-readable)\n\n\`\`\`character-map\n${JSON.stringify(map, null, 2)}\n\`\`\`\n\n## Painting Details\n\n${list}${extra ? `\n## Original Source Notes\n\n${extra}\n` : ''}`;
}

export function partCounts(map: CharacterMap): Record<string, number> {
  return map.parts.reduce<Record<string, number>>((all, part) => ({ ...all, [part.group]: (all[part.group] ?? 0) + 1 }), {});
}
