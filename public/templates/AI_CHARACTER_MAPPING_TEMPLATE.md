# AI Character Mapping Template — My-Game-Design

**Contract version:** 1.0  
**Use with:** the ONE master PNG and this document in the same AI request.  
**Purpose:** produce a human-readable design spec AND precise-ish machine-readable semantic regions.

> วิธีใช้: แนบรูปตัวละครและไฟล์นี้ให้ AI แล้วสั่งให้วิเคราะห์และกรอกข้อมูลทั้งหมด ส่งคืนเป็นไฟล์ Markdown หนึ่งไฟล์ จากนั้นนำรูปและ MD เข้าสู่ Character Design Studio

## Instructions for the AI (follow in order)

1. Analyze **only the attached character image**; do not imagine hidden sides, limbs, or back details.
2. Preserve exact character identity, pose, style, camera, relative sizes, face, hair, costume, and lighting; this is **documentation**, not a redesign.
3. Report the actual image width and height in pixels when available. If unknown, disclose uncertainty.
4. Identify **visible semantic parts**, including separately selectable left and right boots, gloves, sleeves, armor pieces, legs, hair, face, torso garment, belt, accessories. Avoid mapping too many unrelated items as one part.
5. Give every part a permanent unique `id` using lowercase snake_case, Thai/English names, group, material, anatomical `side`, `z_index`, and optional `pair_key` for both-side selection.
6. IMPORTANT: `character_left`/`character_right` refer to **the character's own anatomy**; in a front-facing view, character-left appears on the viewer's right. Never silently mirror.
7. Define each visible area as polygon(s) in `normalized_1000` coordinates, where top-left is [0,0], bottom-right is [1000,1000], regardless of PNG dimensions. Each polygon must contain 3 or more `[x,y]` points. Trace each silhouette closely but do not claim pixel-perfect segmentation from a visual estimate. Use multiple polygons if an item has disconnected islands.
8. For all colors list `role` (`base`, `shadow`, `highlight`, `outline`, `trim`, etc.) and `hex` as `#RRGGBB`; note approximate/inferred colors when exact pixel sampling was not possible. Do not hallucinate exact measured RGB values.
9. For each part explain `technique` (drawing steps: construction, brush, linework, shadow/highlight order, texture, material cues) and `notes` (shape, seams, ornaments, overlaps, layer order, constraints). Don't write generic repeated text for every part.
10. Return a single Markdown document with the REQUIRED fenced `character-map` JSON block, followed by visual identification and painting guidance for each part. Ensure JSON syntax is valid: no comments, no trailing commas, no markdown inside the JSON block.

### Quality checklist

- Polygon positions match the image, not just plausible coordinates.
- Shapes do not extend far outside the part; occluded pieces are not invented.
- Color roles and rendering techniques differ meaningfully by material.
- L/R anatomical labels correct; paired items use matching `pair_key`.
- `z_index`: bigger values indicate parts visually in front when polygons overlap.
- Hair and face may overlap; place the visible face over the base hair region.
- `locked`, `allow_geometry_change`, `review_status`, `doc_anchor` are present.
- Keep unrelated parts protected during later edits.

## Required Machine-Readable Block

Fill the example structure below with **real data extracted from the attached image**. Replace the example part with every visible semantic part. Arrays may contain many parts; never omit the required fields.

```character-map
{
  "schema_version": "1.0",
  "character": {
    "id": "replace_with_stable_character_id",
    "name": "Character Name / Direction",
    "style": "Detailed description of master illustration style",
    "view": "Front / South / etc.",
    "identity_notes": "Identity and non-negotiable traits to preserve"
  },
  "image": { "width": 1024, "height": 1536, "file": "character.png" },
  "coordinate_system": "normalized_1000",
  "parts": [
    {
      "id": "boot_character_left",
      "name_th": "รองเท้าซ้ายของตัวละคร",
      "name_en": "Left leather boot",
      "group": "Footwear",
      "side": "character_left",
      "pair_key": "boots",
      "material": "Brown leather, tan cuff, gold laces",
      "colors": [
        { "role": "base", "hex": "#8D5749", "name": "example only — replace" },
        { "role": "shadow", "hex": "#51302E" },
        { "role": "highlight", "hex": "#C68A6C" }
      ],
      "technique": "Describe painting the boot from contour to shadow and highlights",
      "notes": "Describe location, shape, overlaps and details",
      "polygons": [[[530, 755], [675, 755], [710, 945], [540, 955]]],
      "z_index": 90,
      "locked": false,
      "allow_geometry_change": true,
      "doc_anchor": "boots",
      "review_status": "ai_suggested"
    }
  ]
}
```

## Human-Readable Part Specifications

After the JSON block, for EACH `part.id` add a heading with the same ID, and explain:

1. Visual location (relative to the character, anatomical side)
2. Silhouette and proportions
3. Outline thickness/color/shape language
4. Material and texture
5. Exact or estimated color swatches, including shadows and highlights
6. Steps in a beginner-friendly Krita painting workflow
7. Overlap and layer ordering against adjacent parts
8. What must stay unchanged during an AI edit
9. Any uncertainty that needs human verification
10. `part_id`, `doc_anchor`, and consistent terminology

## Recommended AI Input Prompt

> Analyze my attached character image according to the attached AI_CHARACTER_MAPPING_TEMPLATE.md. Return a completed Markdown spec containing a valid `character-map` JSON block followed by detailed part-by-part painting instructions. Identify anatomical left/right correctly, generate polygons in normalized 0–1000 coordinates, and do not redesign anything. Ensure it imports into Character Design Studio.

## Important

This Markdown template is a **data contract**. A PNG is usually a flat raster, not a layered drawing. AI-proposed polygons are estimates and must be checked/adjusted in the Studio. Automatic SAM-style segmentation or actual generative image editing is **not included in this local MVP**; the Studio generates a prompt, edit JSON and selection mask for external AI use.
