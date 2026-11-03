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
  return `Analyze the attached character image and the attached AI_CHARACTER_MAPPING_TEMPLATE.md. Return a COMPLETE Markdown design specification following its schema. Include a valid fenced \`\`\`character-map JSON block, accurate normalized_1000 polygons for each visible semantic part, colors (#RRGGBB), material, rendering techniques, anatomical left/right, z-index, notes, and confidence. Do not invent unseen details or claim exact sampled colors without actual sampling. Keep each part ID stable. The result must be importable into Character Design Studio. Return only the Markdown file contents.`;
}
