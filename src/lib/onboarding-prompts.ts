/** Prompt for obtaining one master character illustration before mapping its parts. */
export function makeImagePrompt(concept: string): string {
  const subject = concept.trim() || 'An original young fantasy adventurer (Novice class), with a simple leather outfit, gloves, belt, knee guards and boots.';
  return `Create ONE original 2D character MASTER REFERENCE illustration for a hand-painted fantasy MMORPG character design workflow.

CHARACTER CONCEPT:
${subject}

COMPOSITION AND CAMERA:
- Exactly ONE complete standing character, front view (South), orthographic-like camera, centered in frame.
- Show the entire silhouette from the top of the hair to the bottom of both boots; do not crop limbs or equipment.
- Symmetrical neutral standing/idle pose, arms slightly apart from the body, hands and fingers visible where possible, both feet clearly separated.
- Cute chibi/anime proportions suitable for a classic 2.5D fantasy RPG; carefully painted, crisp outer linework and soft hand-painted shading.
- Clearly defined individual objects (hair, face, torso garment, sleeves, gloves, belt, leg armor, boots, decorations) with readable boundaries and overlapping layers.
- Consistent light source, material-specific highlights and shadows. Use a coherent color palette.

DELIVERABLE:
- ONE full-body PNG with a transparent background (alpha), preferably 1024 x 1536 pixels, if supported.
- No floor, scenery, ground shadows, decorative frame, labels, text, logo, guide lines, animation frames, sprite sheet, other characters, or watermarks.
- Preserve this exact character design as the MASTER image for later analysis and localized edits.

If transparency or the exact dimensions are unavailable, produce the cleanest single-character image possible and tell me what needs to be adjusted manually. Do not add anything outside the requested character.`;
}
