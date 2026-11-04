import type { CharacterMap, CharacterPart, EditAction, EditRequest } from './types';

export const ACTIONS: { id: EditAction; label: string; subtitle: string }[] = [
  { id: 'REPLACE_ITEM', label: 'เปลี่ยนอุปกรณ์', subtitle: 'Replace item' },
  { id: 'MATERIAL_SWAP', label: 'เปลี่ยนวัสดุ', subtitle: 'Material swap' },
  { id: 'SHAPE_CHANGE', label: 'เปลี่ยนรูปทรง', subtitle: 'Shape change' },
  { id: 'RECOLOR', label: 'เปลี่ยนสี', subtitle: 'Recolor' },
  { id: 'TEXTURE_EDIT', label: 'เปลี่ยน Texture', subtitle: 'Texture edit' },
  { id: 'DETAIL_ADD', label: 'เพิ่มลวดลาย', subtitle: 'Add detail' },
  { id: 'DETAIL_REMOVE', label: 'ลบลวดลาย', subtitle: 'Remove detail' },
  { id: 'STYLE_MATCH', label: 'ปรับให้เข้าธีม', subtitle: 'Style match' },
];

export function makeEditRequest(map: CharacterMap, selected: string[], action: EditAction, instruction: string, expand: boolean): EditRequest {
  const parts = map.parts.filter(p => selected.includes(p.id));
  return {
    schema_version: '1.0', request_id: `edit-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`,
    character_id: map.character.id, selected_part_ids: parts.map(p => p.id), action,
    instruction: instruction.trim(), geometry_expansion: expand, preserve_unselected: true,
    region_coordinate_system: 'normalized_1000',
    target_regions: parts.map(p => ({ part_id: p.id, polygons: p.polygons, side: p.side, material: p.material, colors: p.colors })),
    protected_part_ids: map.parts.filter(p => !selected.includes(p.id)).map(p => p.id),
    output: { same_dimensions: true, keep_alpha: true, separate_new_version: true },
  };
}

function partDetail(part: CharacterPart): string {
  const colors = part.colors.map(c => `${c.role} ${c.hex}`).join(', ');
  return `- ${part.name_th} (${part.name_en}) [${part.id}], anatomical side: ${part.side}\n  region: ${JSON.stringify(part.polygons)}\n  source material: ${part.material}; colors: ${colors}; painting: ${part.technique}`;
}

export function makeEditPrompt(map: CharacterMap, request: EditRequest): string {
  const targets = map.parts.filter(p => request.selected_part_ids.includes(p.id));
  const protectedNames = map.parts.filter(p => !request.selected_part_ids.includes(p.id)).map(p => p.name_en).join(', ');
  return `TASK: Localized 2D character illustration editing.\n\nREFERENCE: Use the attached MASTER character image as the only source of truth.\nCHARACTER: ${map.character.name} (${map.character.id}).\nSTYLE: ${map.character.style}.\nVIEW: ${map.character.view}.\nIDENTITY: ${map.character.identity_notes}.\n\nACTION: ${request.action}\nREQUEST (Thai): ${request.instruction}\n\nTARGET PARTS (anatomical left/right, NOT screen left/right):\n${targets.map(partDetail).join('\n')}\n\nREGION COORDINATES: normalized 0–1000 relative to the complete source image. Use the regions as approximate selection hints, not as real layer or pixel-perfect masks.\n${request.geometry_expansion ? 'GEOMETRY: New shape may extend beyond the original target silhouette only when necessary. Allow a small controlled margin; preserve surrounding anatomy and overlap.' : 'GEOMETRY: Preserve the existing silhouette; keep edits inside the selected regions.'}\n\nPRESERVE: Do not redesign facial identity, head/body proportions, camera, pose, light direction, color language, transparent background, or any UNSELECTED clothing, hair, limbs, accessories. Protect especially: ${protectedNames || 'all other pixels'}.\nMATERIAL RENDERING: Hand-painted fantasy chibi RPG style with coherent outlines, physically legible overlapping shapes, soft midtone shading and selective highlights. Keep new part visually integrated with the source.\nOUTPUT: One full character PNG, SAME ${map.image.width}x${map.image.height} dimensions and alignment as input, transparent background, no labels, no cropped parts; make a NEW VERSION.\nVALIDATE: Compare before/after. Only intended parts should change. Preserve left/right anatomy and occlusion ordering. If changed, issue a revised character-map Markdown with updated part polygons/colors/materials/painting techniques in the same schema.\n\nSTRUCTURED EDIT REQUEST:\n${JSON.stringify(request, null, 2)}`;
}

export function makeMappingPrompt(): string {
  return `TASK: Create an IMPORTABLE character design mapping Markdown file for Character Design Studio (My-Game-Design).

ATTACHMENTS (BOTH REQUIRED):
1. My master character image (PNG/JPG/WebP).
2. AI_CHARACTER_MAPPING_TEMPLATE.md (the required data contract and example format).

Analyze ONLY the attached image. Read and follow the entire attached template. Preserve character identity; do not generate, repaint or redesign the image.

CRITICAL SOURCE CHECK BEFORE MAPPING:
- Read the ACTUAL attached image width, height, filename, and layout. The master image is the only source of truth: do not use an older image, conversation image, example, or a filename mentioned in this prompt.
- If the actual attachment is ONE character in ONE image, map that ONE character only. Do not invent sprite-sheet rows, frames, 8 directions, or IDs like r00_c00_* unless the attachment really is a sprite sheet.
- If the attachment IS a sprite sheet, explicitly describe the visible row/column layout and map every polygon to the complete sheet, never to a separate enlarged frame. Never fabricate hundreds of repeated parts without checking the actual image.
- image.width and image.height MUST match the attached source image exactly, and image.file MUST name that source image. Never silently substitute an imagined 960x1920 or 1024x1536 canvas.

OUTPUT REQUIREMENTS:
1. Return ONE COMPLETE .md Markdown document. Put the required machine-readable data in exactly one fenced block starting with three backticks immediately followed by character-map, a newline, valid JSON, and closing three backticks. Do NOT wrap the entire Markdown document in another code fence.
2. Use schema_version "1.0" and coordinate_system "normalized_1000" exactly. The JSON must include character, image.width, image.height and parts, using the exact keys and types from the template. Report the real image dimensions; do not silently assume 1024x1536.
3. For EACH visible independent part, include a unique stable snake_case ID, Thai/English name, group, anatomical side, material, HEX #RRGGBB color roles, detailed technique, notes, polygons, numeric z_index, locked, allow_geometry_change, review_status. Add pair_key for left/right matching parts.
4. Coordinates are based on the FULL attached image: top-left (0,0), bottom-right (1000,1000). Each visible polygon has at least 3 [x,y] vertices, integers 0–1000. Trace the ACTUAL location and silhouette, including left/right boots, gloves, hair and clothing. Polygons are approximate visual estimates and must be reviewed by a human. DO NOT map multiple tiny imaginary frames onto a single character.
5. Anatomical character_left and character_right mean the character's own left/right, NOT the viewer's screen left/right. Separate paired pieces when visible.
6. After the data block, write detailed part-by-part painting instructions for beginners using Krita: contour construction, color placement, shadow/highlight, brush/material treatment, overlap and layer order.
7. Do not invent unseen parts or pretend colors were sampled precisely when you can only estimate. If image information is insufficient, explain the uncertainty separately, not inside the JSON.
8. Validate that the JSON parses: double-quoted keys/strings, no comments, no trailing commas, no NaN, no invalid HEX codes. Follow the template exactly and do not omit required fields.

The completed Markdown must be importable directly via Character Design Studio > นำเข้า MD, paired with the SAME unchanged master image. Return the Markdown document ONLY, with no prefatory chat response.`;
}
