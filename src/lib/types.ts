export type Point = [number, number];
export type Region = Point[][];
export type CharacterSide = 'character_left' | 'character_right' | 'center' | 'both' | 'none';

export interface ColorSwatch {
  role: string;
  hex: string;
  name?: string;
}

export interface CharacterPart {
  id: string;
  name_th: string;
  name_en: string;
  group: string;
  side: CharacterSide;
  pair_key?: string;
  material: string;
  colors: ColorSwatch[];
  technique: string;
  notes: string;
  polygons: Region;
  z_index: number;
  locked: boolean;
  allow_geometry_change: boolean;
  doc_anchor?: string;
  review_status: 'manual_reviewed' | 'ai_suggested' | 'unreviewed';
}

export interface CharacterMap {
  schema_version: '1.0';
  character: { id: string; name: string; style: string; view: string; identity_notes: string };
  image: { width: number; height: number; file?: string };
  coordinate_system: 'normalized_1000';
  parts: CharacterPart[];
}

export type EditAction = 'REPLACE_ITEM' | 'MATERIAL_SWAP' | 'SHAPE_CHANGE' | 'RECOLOR' | 'TEXTURE_EDIT' | 'DETAIL_ADD' | 'DETAIL_REMOVE' | 'STYLE_MATCH';

export interface EditRequest {
  schema_version: '1.0';
  request_id: string;
  character_id: string;
  selected_part_ids: string[];
  action: EditAction;
  instruction: string;
  geometry_expansion: boolean;
  preserve_unselected: boolean;
  region_coordinate_system: 'normalized_1000';
  target_regions: { part_id: string; polygons: Region; side: CharacterSide; material: string; colors: ColorSwatch[] }[];
  protected_part_ids: string[];
  output: { same_dimensions: true; keep_alpha: true; separate_new_version: true };
}
