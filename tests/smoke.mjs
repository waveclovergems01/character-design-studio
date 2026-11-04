import assert from 'node:assert/strict';
import { createServer } from 'vite';

let server;
try {
  server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const [home, template, image] = await Promise.all([
    fetch(`${origin}/`),
    fetch(`${origin}/templates/AI_CHARACTER_MAPPING_TEMPLATE.md`),
    fetch(`${origin}/examples/novice_female_front.png`),
  ]);
  assert.equal(home.status, 200);
  assert.equal(template.status, 200);
  assert.equal(image.status, 200);
  assert.match(await home.text(), /Character Design Studio/i);
  assert.match(await template.text(), /```character-map/);
  assert.match(image.headers.get('content-type') ?? '', /image\/png/);

  const { demoMap } = await server.ssrLoadModule('/src/data/demo.ts');
  const { default: HomePage } = await server.ssrLoadModule('/src/components/HomePage.tsx');
  const { default: GuidePage } = await server.ssrLoadModule('/src/components/GuidePage.tsx');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const landingHtml = renderToStaticMarkup(React.createElement(HomePage, {
    onOpenStudio: () => {}, onOpenWorkspace: () => {}, onOpenExample: () => {}, onOpenTemplateGuide: () => {}, onDownloadTemplate: () => {},
  }));
  assert.match(landingHtml, /Character Design/);
  assert.match(landingHtml, /PREVIEW ONLY/);
  assert.match(landingHtml, /NOT LOADED/);
  const guideHtml = renderToStaticMarkup(React.createElement(GuidePage, {
    onHome: () => {}, onOpenStudio: () => {}, onOpenExample: () => {}, onDownloadTemplate: () => {},
  }));
  assert.match(guideHtml, /สร้างรูปตัวละครต้นฉบับ/);
  assert.match(guideHtml, /ดาวน์โหลด AI Template.md/);
  assert.match(guideHtml, /แนบ 2 ไฟล์ในคำขอเดียวกัน/);
  assert.match(guideHtml, /JSON คืออะไร/);
  assert.match(guideHtml, /เข้า Workspace เพื่อนำเข้าไฟล์/);
  assert.doesNotMatch(guideHtml, /href="#guide-image"/, 'In-page guide navigation must not replace the hash route');
  const { clampZoom, wheelZoom, stepZoom, fittedImageSize } = await server.ssrLoadModule('/src/lib/zoom.ts');
  const { panScrollPosition } = await server.ssrLoadModule('/src/lib/pan.ts');
  const { makeImagePrompt } = await server.ssrLoadModule('/src/lib/onboarding-prompts.ts');
  const { validateMap, parseCharacterMarkdown, toCharacterMarkdown } = await server.ssrLoadModule('/src/lib/character-map.ts');
  const { makeEditRequest, makeEditPrompt, makeMappingPrompt } = await server.ssrLoadModule('/src/lib/ai-prompts.ts');
  const { inspectMapCompatibility, makeMappingRepairPrompt } = await server.ssrLoadModule('/src/lib/map-compatibility.ts');
  const { analyzeAlphaAlignment } = await server.ssrLoadModule('/src/lib/map-image-quality.ts');
  const { DEFAULT_SHAPE_VALUES, transformRegion, makeShapeGuidePrompt } = await server.ssrLoadModule('/src/lib/shape-guide.ts');
  const { default: ShapeToolPanel } = await server.ssrLoadModule('/src/components/ShapeToolPanel.tsx');

  assert.match(makeImagePrompt('A silver-haired mage'), /A silver-haired mage/);
  assert.match(makeImagePrompt(''), /Novice/);
  assert.match(makeMappingPrompt(), /AI_CHARACTER_MAPPING_TEMPLATE\.md/);
  assert.match(makeMappingPrompt(), /normalized_1000/);
  assert.match(makeMappingPrompt(), /schema_version/);
  assert.match(makeMappingPrompt(), /three backticks immediately followed by character-map/);
  assert.match(makeMappingPrompt(), /ONE character in ONE image/i);

  assert.equal(validateMap(demoMap).parts.length, 19);
  const parsed = parseCharacterMarkdown(toCharacterMarkdown(demoMap));
  assert.equal(parsed.parts.length, demoMap.parts.length);
  assert.equal(parsed.image.width, 1024);
  assert.equal(parsed.coordinate_system, 'normalized_1000');

  const bothBoots = parsed.parts.filter(p => p.pair_key === 'boots').map(p => p.id);
  assert.equal(bothBoots.length, 2);
  const request = makeEditRequest(parsed, bothBoots, 'REPLACE_ITEM', 'เปลี่ยนเป็นรองเท้าคริสตัล', true);
  assert.equal(request.selected_part_ids.length, 2);
  assert.equal(request.protected_part_ids.length, 17);
  assert.equal(request.target_regions.length, 2);
  const prompt = makeEditPrompt(parsed, request);
  assert.match(prompt, /รองเท้าคริสตัล/);
  assert.match(prompt, /same/i);
  assert.match(prompt, /character_left/);

  assert.throws(() => parseCharacterMarkdown('# Ordinary MD without coordinates'), /character-map/);
  const invalid = structuredClone(demoMap);
  invalid.parts[0].colors[0].hex = 'not-a-hex';
  assert.throws(() => validateMap(invalid), /HEX/);

  // A 32-frame sprite MD must never be drawn onto an unrelated 256x256 single image.
  const spriteMap = structuredClone(demoMap);
  spriteMap.image = { width: 960, height: 1920, file: 'novice-male-idle.png' };
  spriteMap.parts = Array.from({ length: 852 }, (_, i) => ({
    ...structuredClone(demoMap.parts[i % demoMap.parts.length]),
    id: `r${String(Math.floor(i / 108)).padStart(2,'0')}_c${String(Math.floor(i % 108 / 27)).padStart(2,'0')}_part_${i}`,
  }));
  const mismatch = inspectMapCompatibility(spriteMap, { width: 256, height: 256, name: 'novice-male-bald-front-pixellab-v002.png' });
  assert.equal(mismatch.compatible, false);
  assert.equal(mismatch.partCount, 852);
  assert.ok(mismatch.frameCount > 1);
  assert.match(mismatch.errors.join(' '), /960×1920px/);
  assert.match(makeMappingRepairPrompt({ width: 256, height: 256, name: 'front.png' }, spriteMap), /Discard ALL its polygons/);
  const sameImage = inspectMapCompatibility(demoMap, { width: 1024, height: 1536, name: 'novice_female_front.png' });
  assert.equal(sameImage.compatible, true);
  assert.equal(sameImage.warnings.length, 0);
  const renamed = inspectMapCompatibility(demoMap, { width: 1024, height: 1536, name: 'different_image.png' });
  assert.equal(renamed.compatible, true);
  assert.match(renamed.warnings.join(' '), /ชื่อภาพไม่ตรง/);

  // Alpha alignment is a warning, not a pixel-perfect segmentation claim.
  const syntheticMap = structuredClone(demoMap);
  syntheticMap.parts = demoMap.parts.slice(0, 6).map((part, i) => ({
    ...part, polygons: [[[750 + i, 750], [900 + i, 750], [900 + i, 900], [750 + i, 900]]],
  }));
  const alpha = new Uint8ClampedArray(100 * 100);
  for (let y = 0; y < 35; y++) for (let x = 0; x < 35; x++) alpha[y*100+x] = 255;
  const quality = analyzeAlphaAlignment(syntheticMap, alpha, 100, 100);
  assert.equal(quality.transparentBackground, true);
  assert.equal(quality.checkedParts, 6);
  assert.equal(quality.outsideParts, 6);
  assert.equal(quality.suspicious, true);
  const opaque = analyzeAlphaAlignment(syntheticMap, new Uint8ClampedArray(10000).fill(255), 100, 100);
  assert.equal(opaque.suspicious, false);

  const original = [[[200,300],[400,300],[400,600],[200,600]]];
  assert.deepEqual(transformRegion(original, DEFAULT_SHAPE_VALUES, DEFAULT_SHAPE_VALUES), original);
  const wider = transformRegion(original, DEFAULT_SHAPE_VALUES, { ...DEFAULT_SHAPE_VALUES, width: 150 });
  assert.deepEqual(wider[0][0], [150,300]);
  assert.deepEqual(wider[0][1], [450,300]);
  const offset = transformRegion(original, DEFAULT_SHAPE_VALUES, {...DEFAULT_SHAPE_VALUES, offsetY: 50 });
  assert.deepEqual(offset[0][0], [200,350]);
  const shapePrompt = makeShapeGuidePrompt('front.png',256,256,'ขาซ้าย','ยืดขาให้ยาว',wider,original);
  assert.match(shapePrompt, /ORIGINAL MASTER IMAGE: front.png \(256 x 256px\)/);
  assert.match(shapePrompt, /KEEP the original material, textures/);
  assert.match(shapePrompt, /ยืดขาให้ยาว/);
  const shapeHtml = renderToStaticMarkup(React.createElement(ShapeToolPanel, {
    imageLoaded: true, imageName: 'front.png', activePart: null,
    target: wider, source: original, drawing: false, draftLength: 0,
    values: DEFAULT_SHAPE_VALUES, onValues:()=>{}, onFromPart:()=>{}, onStart:()=>{},
    onFinish:()=>{}, onCancel:()=>{}, onClear:()=>{}, partDescription:'ขา', onDescription:()=>{},
    editInstruction:'ยืดขา', onInstruction:()=>{}, prompt:shapePrompt,
    hasMasterPng:true,hasGuidePng:true,onCopyMaster:()=>{},onCopyGuide:()=>{},
    onCopyPrompt:()=>{},onDownloadGuide:()=>{},onOpenChatGpt:()=>{},
  }));
  assert.match(shapeHtml, /Copy รูปต้นฉบับ/);
  assert.match(shapeHtml, /Copy รูป Shape Guide/);
  assert.match(shapeHtml, /Copy Prompt แก้รูปทรง/);

  assert.equal(clampZoom(10), 10);
  assert.equal(clampZoom(100), 10);
  assert.equal(clampZoom(0.01), 0.25);
  assert.ok(wheelZoom(1, -120) > 1, 'Wheel up should zoom in');
  assert.ok(wheelZoom(1, 120) < 1, 'Wheel down should zoom out');
  assert.ok(stepZoom(1, 1) > 1 && stepZoom(1, -1) < 1);
  const fit = fittedImageSize(1024, 1536, 800, 700);
  assert.ok(fit.width <= 740 && fit.height <= 640);
  assert.equal(panScrollPosition(300, 100, 150), 250, 'Drag right shifts content right by lowering scrollLeft');
  assert.equal(panScrollPosition(300, 100, 50), 350, 'Drag left shifts content left by raising scrollLeft');

  console.log('✓ Dev server serves app, Template and example PNG');
  console.log('✓ Landing renders navigation and example-only showcase');
  console.log('✓ Beginner guide renders 4 steps, copyable prompts and JSON explanation');
  console.log('✓ 19 sample parts validate and MD roundtrip succeeds');
  console.log('✓ Both-boot edit request protects the other 17 parts');
  console.log('✓ Invalid MD and color codes produce validation errors');
  console.log('✓ Mouse Wheel zoom, buttons and fit-to-viewport are bounded 25%–1000%');
  console.log('✓ Middle-mouse drag scroll math is correct');
  console.log('✓ Wrong-dimension 852-part / 32-frame mapping is blocked, while a renamed image receives review warnings');
  console.log('✓ Alpha alignment check flags mostly-transparent polygons');
  console.log('✓ Shape Guide transforms regions, preserves edit instructions and renders the Clipboard handoff');
} finally {
  await server?.close();
}
