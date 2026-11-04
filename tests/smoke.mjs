import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  const { default: RigToolPanel } = await server.ssrLoadModule('/src/components/RigToolPanel.tsx');
  const { default: RigExportHub } = await server.ssrLoadModule('/src/components/RigExportHub.tsx');
  const { default: AnimationPreviewWorkspace } = await server.ssrLoadModule('/src/components/AnimationPreviewWorkspace.tsx');
  const { spriteCell, spriteCells, orderedFrameNames, clampPreviewCount, nextPreviewFrame, movePreviewFrame, combinePreviewFrames } = await server.ssrLoadModule('/src/lib/animation-preview.ts');
  const { default: WorkspaceModeNav } = await server.ssrLoadModule('/src/components/WorkspaceModeNav.tsx');
  const { initialJoints, makeWalkFrames, makeMotionFrames, resampleRigFrames, makeRigBatchPrompt, defaultNearSide, updateJoint, makeRigPrompt, boneIsNear } = await server.ssrLoadModule('/src/lib/rig.ts');
  const { autoCutoutOrder, moveCutoutPart, resolveCutoutOrder, pairedCutoutPart, placeCutoutRelative, placeCutoutLimbRelative, getCutoutMaskGeometry, makeEditableCutoutPolygon, insertCutoutPolygonPoint, nearestCutoutPolygonVertex, mapCutoutPoint, createCutoutSlices, deformSlice, autoSkinWeights, skinGridForPart, pointInSkinPolygon, paintSkinWeights, skinBonePair, SKIN_GRID_COLUMNS, SKIN_GRID_ROWS } = await server.ssrLoadModule('/src/lib/cutout.ts');
  const { makeZip } = await server.ssrLoadModule('/src/lib/zip.ts');
  const { traceColorRegion } = await server.ssrLoadModule('/src/lib/auto-outline.ts');
  const { mirrorRegion } = await server.ssrLoadModule('/src/lib/shape-guide.ts');

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

  // New mode navigation is independent of the Inspector (and readable on its own).
  const navHtml = renderToStaticMarkup(React.createElement(WorkspaceModeNav,{value:'rig',onChange:()=>{}}));
  assert.match(navHtml, /Rig &amp; Motion/);
  assert.match(navHtml, /สี \/ Tag/);
  assert.match(navHtml, /MD \/ Data/);
  assert.match(navHtml, /Animation Preview/);
  assert.match(navHtml, /aria-current="page"/);
  const playerHtml=renderToStaticMarkup(React.createElement(AnimationPreviewWorkspace));
  assert.match(playerHtml,/Animation Preview/);
  assert.match(playerHtml,/ap-stage ap-checker-on/, 'The checker stage must use a namespaced CSS class');
  assert.doesNotMatch(playerHtml,/ap-stage checker/, 'Global .checker positions elements absolutely and breaks the page');
  const previewCss=await readFile(new URL('../src/studio-v11.css',import.meta.url),'utf8');
  assert.match(previewCss,/\.ap-stage\.ap-checker-on\{/, 'Checker style is scoped to the Animation Preview stage');
  assert.match(playerHtml,/Sprite Sheet/);
  assert.match(playerHtml,/หลายรูป/);
  assert.match(playerHtml,/FRAME 1 \/ 8/);
  assert.match(playerHtml,/จำนวนเฟรมที่ใช้จริง/);
  assert.match(playerHtml,/เพิ่มรูปเข้าชุดปัจจุบัน/);
  assert.match(playerHtml,/นำเข้าชุดใหม่ \(แทนที่ทั้งหมด\)/);
  assert.match(playerHtml,/ลบเฟรมที่เลือก/);
  assert.match(playerHtml,/ล้างทุกเฟรม/);
  assert.match(playerHtml,/จับลากการ์ดเพื่อแทรกก่อน\/หลัง/);
  assert.match(playerHtml,/1–60 FPS/);
  assert.deepEqual(spriteCell(1024,512,4,2,5),{index:5,column:1,row:1,x:256,y:256,width:256,height:256});
  assert.deepEqual(spriteCells(1024,512,4,2,6).map(item=>item.index),[0,1,2,3,4,5], 'A six-frame animation uses only the first six of eight grid cells');
  assert.equal(spriteCell(1024,512,4,2,8),null,'Grid cells outside the source image are not playable');
  assert.equal(spriteCell(1001,333,4,2,3)?.x+spriteCell(1001,333,4,2,3)?.width,1001,'Uneven sheet widths exactly cover the rightmost pixel');
  assert.equal(spriteCell(1001,333,4,2,7)?.y+spriteCell(1001,333,4,2,7)?.height,333,'Uneven sheet heights exactly cover the last row');
  assert.deepEqual(orderedFrameNames([{name:'walk10.png'},{name:'walk2.png'},{name:'walk1.png'}]).map(v=>v.name),['walk1.png','walk2.png','walk10.png']);
  assert.equal(clampPreviewCount(500),256);
  assert.equal(nextPreviewFrame(5,6,true),0);
  assert.equal(nextPreviewFrame(5,6,false),5);
  assert.deepEqual(combinePreviewFrames(['a','b'],['c','d'],'append'),['a','b','c','d'], 'Repeated imports append frames, rather than replacing old frames');
  assert.deepEqual(combinePreviewFrames(['a','b'],['c','d'],'replace'),['c','d'], 'Replace-all imports discard the old sequence');
  assert.deepEqual(combinePreviewFrames(['a','b'],['c','d'],'append',3),['a','b','c'], 'The timeline respects the 256-frame (or provided) cap');
  assert.deepEqual(movePreviewFrame(['a','b','c','d'],0,3),{frames:['b','c','a','d'],index:2}, 'Dragging first card before fourth inserts at the drop position');
  assert.deepEqual(movePreviewFrame(['a','b','c','d'],3,1),{frames:['a','d','b','c'],index:1}, 'Dragging a later card before an earlier card inserts it correctly');
  assert.deepEqual(movePreviewFrame(['a','b','c','d'],0,4),{frames:['b','c','d','a'],index:3}, 'Dropping after the final card moves the dragged frame to the end');
  assert.deepEqual(movePreviewFrame(['a',null,'b'],2,1),{frames:['a','b',null],index:1}, 'An empty frame slot is a valid drop target');

  // Anatomical left is viewer-right at S (front), but viewer-left at N (back).
  const front = initialJoints(undefined,'S');
  const back = initialJoints(undefined,'N');
  const west = initialJoints(undefined,'W');
  assert.ok(front.shoulder_left[0] > front.shoulder_right[0]);
  assert.ok(back.shoulder_left[0] < back.shoulder_right[0]);
  assert.ok(Math.abs(west.shoulder_left[0]-west.shoulder_right[0]) < Math.abs(front.shoulder_left[0]-front.shoulder_right[0]));
  assert.equal(defaultNearSide('W'),'character_left');
  assert.equal(defaultNearSide('E'),'character_right');
  assert.equal(defaultNearSide('S'),'balanced');
  assert.equal(boneIsNear('knee_left','W','auto'),true);
  assert.equal(boneIsNear('knee_right','W','auto'),false);
  const walk=makeWalkFrames(front,'W');
  assert.equal(walk.length,8);
  assert.ok(walk[2].joints.ankle_left[0]>walk[2].joints.ankle_right[0]);
  assert.ok(walk[6].joints.ankle_left[0]<walk[6].joints.ankle_right[0]);
  const moved=updateJoint(walk[0],'elbow_left',[333,444]);
  assert.deepEqual(moved.joints.elbow_left,[333,444]);
  assert.notDeepEqual(walk[0].joints.elbow_left,[333,444],'Editing a frame cannot mutate the source frame');
  const ikMoved=updateJoint(walk[0],'ankle_left',[710,650]);
  const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  assert.ok(Math.abs(dist(ikMoved.joints.hip_left,ikMoved.joints.knee_left)-dist(walk[0].joints.hip_left,walk[0].joints.knee_left))<2,'Upper leg length should survive IK ankle dragging');
  assert.ok(Math.abs(dist(ikMoved.joints.knee_left,ikMoved.joints.ankle_left)-dist(walk[0].joints.knee_left,walk[0].joints.ankle_left))<2,'Lower leg length should survive IK ankle dragging');
  const bonePrompt=makeRigPrompt('master.png',256,256,'W',3,walk[3]);
  assert.match(bonePrompt,/character_left is the default NEAR side/i);
  assert.match(bonePrompt,/256x256/);
  const idle=makeMotionFrames(front,'S','idle',4),run=makeMotionFrames(front,'W','run',6);
  assert.equal(idle.length,4);
  assert.equal(run.length,6);
  assert.deepEqual(idle[0].joints.ankle_left,idle[3].joints.ankle_left,'Idle feet should stay in place');
  assert.notDeepEqual(run[0].joints.ankle_left,run[1].joints.ankle_left,'Run strides should animate');
  assert.equal(resampleRigFrames(walk,4).length,4);
  assert.deepEqual(resampleRigFrames(walk,4)[1].joints,walk[2].joints,'Resample 8 to 4 should align every other keyframe');
  const shortPrompt=makeRigPrompt('master.png',256,256,'S',3,idle[3],'idle',4);
  assert.match(shortPrompt,/MOTION: IDLE/);
  assert.match(shortPrompt,/FRAME: 4 \/ 4/);
  const batch=makeRigBatchPrompt('master.png',256,256,'W','run',run);
  assert.match(batch,/6 CONSISTENT/);
  assert.match(batch,/FRAME 06 \/ 6/);
  const order=autoCutoutOrder('W',walk[0]);
  assert.equal(order.length,12);
  for(const direction of ['S','SW','W','NW','N','NE','E','SE']){
    const clip=makeWalkFrames(initialJoints(undefined,direction),direction);
    const layers=autoCutoutOrder(direction,clip[0]);
    assert.equal(layers.length,12,`${direction}: Draw Order must include all 12 parts even with balanced nearSide`);
    assert.equal(new Set(layers).size,12,`${direction}: no duplicated or missing arm/leg layers`);
  }
  assert.ok(order.indexOf('arm_left_lower')>order.indexOf('arm_right_lower'),'Near limb should render above far limb');
  const movedLayer=moveCutoutPart('W',walk[0],'arm_right_lower',1);
  assert.equal(resolveCutoutOrder('W',movedLayer).indexOf('arm_right_lower'),order.indexOf('arm_right_lower')+1);
  assert.equal(walk[0].drawOrder,undefined,'Moving draw order must not mutate source frame');
  const behindTorso=placeCutoutRelative('W',walk[0],'arm_left_lower','torso','before');
  const inFrontOfTorso=placeCutoutRelative('W',behindTorso,'arm_left_lower','torso','after');
  assert.ok(resolveCutoutOrder('W',behindTorso).indexOf('arm_left_lower')<resolveCutoutOrder('W',behindTorso).indexOf('torso'));
  assert.ok(resolveCutoutOrder('W',inFrontOfTorso).indexOf('arm_left_lower')>resolveCutoutOrder('W',inFrontOfTorso).indexOf('torso'));
  const armBehind=resolveCutoutOrder('W',placeCutoutLimbRelative('W',walk[0],'arm_left_lower','torso','before'));
  const legInFront=resolveCutoutOrder('W',placeCutoutLimbRelative('W',walk[0],'foot_right','torso','after'));
  assert.ok(['arm_left_upper','arm_left_lower'].every(id=>armBehind.indexOf(id)<armBehind.indexOf('torso')));
  assert.ok(['leg_right_upper','leg_right_lower','foot_right'].every(id=>legInFront.indexOf(id)>legInFront.indexOf('torso')));
  assert.equal(walk[0].drawOrder,undefined,'Per-frame order edits must not alter other frames');
  assert.equal(pairedCutoutPart('arm_left_lower'),'arm_right_lower');
  assert.equal(pairedCutoutPart('foot_right'),'foot_left');
  assert.equal(pairedCutoutPart('torso'),null);
  const defaultMask=getCutoutMaskGeometry('arm_left_lower',front,1024,1536);
  const wideMask=getCutoutMaskGeometry('arm_left_lower',front,1024,1536,{arm_left_lower:150});
  assert.ok(wideMask.radiusPx>defaultMask.radiusPx*1.49);
  assert.equal(defaultMask.polygon.length,42,'Capsule polygon must outline the same stroked clipping region');
  const customStart=getCutoutMaskGeometry('arm_left_lower',front,1024,1536,{}, {arm_left_lower:{start:[360,350]}}).start;
  assert.ok(Math.hypot(customStart[0]-360,customStart[1]-350)<.001);
  const editable=makeEditableCutoutPolygon('arm_left_lower',front,1024,1536);
  assert.equal(editable.length,16,'Converting a capsule yields manageable pen control points');
  const inserted=insertCutoutPolygonPoint(editable,[450,540],1024,1536);
  assert.equal(inserted.polygon.length,17);
  assert.equal(inserted.polygon[inserted.index-1][0],editable[inserted.index-1][0]);
  const nearestAtZoom=nearestCutoutPolygonVertex(editable,editable[3],1220,1850,26);
  assert.equal(nearestAtZoom,3,'Right-click on a vertex should select exactly the touched point');
  assert.equal(nearestCutoutPolygonVertex(editable,[0,0],1200,1800,26),null,'Do not accidentally delete a remote point');
  assert.equal(nearestCutoutPolygonVertex([[500,500],[510,500],[510,520]], [505,500],1000,1000,7),1,'Nearest selection must use on-screen pixels');
  const handDrawn=[[380,380],[460,380],[430,510],[380,510]];
  const maskGeometry=getCutoutMaskGeometry('arm_left_lower',front,1024,1536,{}, {arm_left_lower:{polygon:handDrawn}});
  assert.deepEqual(maskGeometry.polygon,handDrawn,'Edited polygon must completely replace capsule outline');
  assert.equal(SKIN_GRID_COLUMNS*SKIN_GRID_ROWS,165);
  const grid=skinGridForPart('arm_left_lower',front,1024,1536);
  assert.equal(grid.vertices.length,165,'Mesh grid must match the Weight Paint grid');
  const autoWeights=autoSkinWeights('arm_left_lower',front,1024,1536);
  assert.equal(autoWeights.length,165);
  assert.ok(autoWeights.every(n=>n>=0&&n<=1),'Auto weights are normalized');
  assert.equal(skinBonePair('arm_left_lower').secondary.to,'elbow_left','Forearm weights can blend with upper arm but never opposite arm');
  const insideIndex=grid.vertices.findIndex(point=>pointInSkinPolygon(point,grid.polygon));
  assert.ok(insideIndex>=0);
  const cursor=grid.vertices[insideIndex];
  const painted=paintSkinWeights('arm_left_lower',front,1024,1536,{}, {},autoWeights,cursor,100,.9,'add','secondary');
  assert.ok(painted[insideIndex]>autoWeights[insideIndex],'Brush increases influence on the selected mesh');
  const erased=paintSkinWeights('arm_left_lower',front,1024,1536,{}, {},painted,cursor,100,.9,'remove','secondary');
  assert.ok(erased[insideIndex]<painted[insideIndex],'Brush remove reduces selected bone influence');
  const smoothed=paintSkinWeights('arm_left_lower',front,1024,1536,{}, {},painted,cursor,100,.65,'smooth','secondary');
  assert.equal(smoothed.length,165);
  assert.ok(smoothed.every(n=>n>=0&&n<=1));
  assert.deepEqual(autoWeights,autoSkinWeights('arm_left_lower',front,1024,1536),'Auto Weight is deterministic');
  const calls={filled:0,drawn:0};
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){calls.filled++;},drawImage(){calls.drawn++;}})})};
  try {
    const slices=createCutoutSlices({naturalWidth:1024,naturalHeight:1536},front,{}, {arm_left_lower:{polygon:handDrawn}});
    assert.equal(slices.length,12);
    assert.ok(slices.find(s=>s.id==='arm_left_lower').canvas.width<130,'Exact Polygon bounds should shrink the extracted PNG');
    assert.equal(calls.filled,12,'All cutouts should use filled polygon clipping');
    assert.equal(calls.drawn,12,'All cutouts should copy source pixels through their mask');
    assert.equal(slices[0].secondaryWeights.length,165,'Each cutout has per-vertex skin weights');
    const weightedSlices=createCutoutSlices({naturalWidth:1024,naturalHeight:1536},front,{}, {},{arm_left_lower:painted});
    assert.ok(Math.abs(weightedSlices.find(s=>s.id==='arm_left_lower').secondaryWeights[insideIndex]-painted[insideIndex])<.001);
    const movedArm=updateJoint({joints:front,nearSide:'auto'},'wrist_left',[700,500]);
    const originalMesh=deformSlice(weightedSlices.find(s=>s.id==='arm_left_lower'),movedArm,1024,1536);
    assert.equal(originalMesh.length,165*2);
    assert.ok(originalMesh.every(Number.isFinite),'Weighted deform never creates NaN or infinite vertex positions');
    const lowerArm=weightedSlices.find(s=>s.id==='arm_left_lower');
    const allPrimary=deformSlice({...lowerArm,secondaryWeights:new Float32Array(165)},movedArm,1024,1536);
    const allSecondary=deformSlice({...lowerArm,secondaryWeights:new Float32Array(165).fill(1)},movedArm,1024,1536);
    const fiftyFifty=deformSlice({...lowerArm,secondaryWeights:new Float32Array(165).fill(.5)},movedArm,1024,1536);
    assert.ok(Math.abs(allPrimary[0]-allSecondary[0])>.01,'Primary and neighboring bones transform mesh differently');
    assert.ok(Math.abs(fiftyFifty[0]-(allPrimary[0]+allSecondary[0])/2)<.0001,'Mesh vertices blend both bone transforms by painted weights');
  } finally {if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
  const samplePoint=[470,510],movedPoint=mapCutoutPoint(samplePoint,front,walk[2].joints,'arm_left_upper',1024,1536);
  const restoredPoint=mapCutoutPoint(movedPoint,walk[2].joints,front,'arm_left_upper',1024,1536);
  assert.ok(Math.hypot(restoredPoint[0]-samplePoint[0],restoredPoint[1]-samplePoint[1])<.01,'Overlay mask points should stay aligned when moving between rest and preview poses');
  const zip=await makeZip([{name:'guides/example.txt',data:'ตัวอย่าง'},{name:'prompts/01.txt',data:'POSE 1'}]);
  const zipBytes=new Uint8Array(await zip.arrayBuffer()),zipView=new DataView(zipBytes.buffer);
  assert.equal(zipView.getUint32(0,true),0x04034b50,'Browser ZIP begins with local header');
  assert.equal(zipView.getUint32(zipBytes.length-22,true),0x06054b50,'Browser ZIP ends with central directory footer');
  assert.equal(zipView.getUint16(zipBytes.length-22+10,true),2,'Both named items exist in archive');
  const rigProps={
    editorTab:'mask',onEditorTab:()=>{},boneVisible:true,onBoneVisible:()=>{},boneEdit:false,onBoneEdit:()=>{},boneMirror:false,onBoneMirror:()=>{},
    weightPaintEnabled:false,onWeightPaintEnabled:()=>{},weightShowHeatmap:true,onWeightShowHeatmap:()=>{},
    weightInfluence:'primary',onWeightInfluence:()=>{},weightMode:'add',onWeightMode:()=>{},
    weightStrength:.65,onWeightStrength:()=>{},weightRadius:55,onWeightRadius:()=>{},weightReplaceValue:.5,onWeightReplaceValue:()=>{},
    autoWeightSoftness:.35,onAutoWeightSoftness:()=>{},weightIsCustom:false,onAutoWeights:()=>{},onResetWeights:()=>{},
    imageLoaded:true,direction:'W',onDirection:()=>{},motion:'walk',onMotion:()=>{},frameCount:8,onFrameCount:()=>{},frameIndex:2,onFrame:()=>{},frame:walk[2],
    onNearSide:()=>{},activeJoint:'knee_left',onJoint:()=>{},onAuto:()=>{},onGenerate:()=>{},
    onReset:()=>{},onCopyPrevious:()=>{},playing:false,onPlaying:()=>{},showLabels:true,onLabels:()=>{},
    prompt:bonePrompt,previewCutout:false,onPreviewCutout:()=>{},
    showMasks:true,onShowMasks:()=>{},showAllMasks:true,onShowAllMasks:()=>{},selectedCutout:'arm_left_upper',onSelectedCutout:()=>{},
    cutoutWidth:100,onCutoutWidth:()=>{},pairCutout:'arm_right_upper',onCopyPair:()=>{},linkPairs:true,onLinkPairs:()=>{},
    globalWidth:100,onGlobalWidth:()=>{},onResetMask:()=>{},maskRadiusPx:30,maskEndpointsEdited:true,
    maskIsPolygon:false,maskVertexCount:0,selectedMaskVertex:null,onConvertPolygon:()=>{},onToggleAddPoint:()=>{},addingMaskPoint:false,onDeleteMaskPoint:()=>{},
    drawingMaskPolygon:false,draftMaskPoints:0,onStartDrawMask:()=>{},onFinishDrawMask:()=>{},onUndoDrawPoint:()=>{},onCancelDrawMask:()=>{},
    onLayerBack:()=>{},onLayerFront:()=>{},onAutoLayerOrder:()=>{},
    onLayerBehindTorso:()=>{},onLayerInFrontOfTorso:()=>{},onCopyOrderNext:()=>{},onCopyOrderAll:()=>{},
  };
  const rigHtml=renderToStaticMarkup(React.createElement(RigToolPanel,rigProps));
  assert.match(rigHtml,/FRAME 3 \/ 8/);
  assert.match(rigHtml,/Mask Editor/);
  assert.match(rigHtml,/Pixi Preview/);
  assert.match(rigHtml,/ซ้าย–ขวาพร้อมกัน/);
  assert.match(rigHtml,/ลาก START\/END/);
  assert.match(rigHtml,/> Mask<\/button>/);
  assert.match(rigHtml,/> Depth<\/button>/);
  assert.match(rigHtml,/> Weight<\/button>/);
  assert.match(rigHtml,/rig-v09-pinned/);
  assert.match(rigHtml,/คลิกขวาที่ภาพเพื่อเพิ่ม\/ลบจุด/);
  assert.match(rigHtml,/Backfill/);
  const boneHtml=renderToStaticMarkup(React.createElement(RigToolPanel,{...rigProps,editorTab:'bone'}));
  assert.match(boneHtml,/Edit Bones/);
  assert.match(boneHtml,/Mirror ข้อต่อ/);
  assert.doesNotMatch(boneHtml,/Weight Paint/);
  const weightHtml=renderToStaticMarkup(React.createElement(RigToolPanel,{...rigProps,editorTab:'weight'}));
  assert.match(weightHtml,/Weight Paint/);
  assert.match(weightHtml,/Auto Weight/);
  assert.match(weightHtml,/Strength/);
  assert.match(weightHtml,/น้ำเงิน/);
  assert.match(rigHtml,/เริ่มแก้ขอบแบบ Pen Tool/);
  assert.match(rigHtml,/วาด Polygon ใหม่จากศูนย์/);
  const exportHtml=renderToStaticMarkup(React.createElement(RigExportHub,{
    frameCount:8,imageLoaded:true,hasGuide:true,exporting:false,
    onDownloadAll:()=>{},onDownloadCutout:()=>{},onCopySheet:()=>{},onCopyBatchPrompt:()=>{},
    onCopyGuide:()=>{},onCopyPrompt:()=>{},onDownloadCurrent:()=>{},onExportJson:()=>{},onDownloadTemplate:()=>{},
  }));
  assert.match(exportHtml,/Bone Guides \+ Prompts/);
  assert.match(exportHtml,/Cutout Layers \+ Render PNG ZIP/);
  assert.match(exportHtml,/Export 8 Frames JSON/);

  // Magic wand selects only a local connected color group, not all similar pixels.
  const w=24,h=24,rgba=new Uint8ClampedArray(w*h*4);
  for(let y=4;y<13;y++)for(let x=3;x<11;x++){const i=(y*w+x)*4;rgba[i]=130;rgba[i+1]=60;rgba[i+2]=30;rgba[i+3]=255;}
  for(let y=4;y<13;y++)for(let x=15;x<22;x++){const i=(y*w+x)*4;rgba[i]=130;rgba[i+1]=60;rgba[i+2]=30;rgba[i+3]=255;}
  const selected = traceColorRegion(rgba,w,h,4,6,30);
  assert.ok(selected[0].every(([x])=>x<600),'Magic Wand must not include a disconnected matching-color patch');
  assert.deepEqual(mirrorRegion([[[400,200],[480,200],[480,300]]],500),[[[520,300],[520,200],[600,200]]]);

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
  console.log('✓ Distinct modes and Rig & Motion panel render independently of Properties tabs');
  console.log('✓ 8-direction anatomical near/far rules and variable-length Idle / Walk / Run clips are consistent');
  console.log('✓ IK ankle drag roughly preserves bone lengths, without mutating source keyframe; prompt includes occlusion rules');
  console.log('✓ Batch prompts, cyclic frame resampling, PixiJS cutout draw-order helpers and browser ZIP structure validate');
  console.log('✓ Cutout masks expose exact polygon boundaries, mirrored percentage partners and draggable endpoints mapped across poses');
  console.log('✓ Pen Tool polygons support 16-point conversion, insertion and exact source texture clipping; per-frame arms can switch behind/in front of torso');
  console.log('✓ Rig Mask Editor and left-side Export Center render with separate controls and batch downloads');
  console.log('✓ Color-based wand region and mirrored geometry stay within their selection rules');
  console.log('✓ v0.10 Bone / Mask / Weight / Depth panels, constrained Auto Weight, painting and 2-bone Vertex blending pass');
  console.log('✓ v0.11 independent Animation Preview, natural PNG order, grid slicing and six-of-eight Sprite Sheet frame counts pass');
  console.log('✓ v0.12 shared multi-source timeline, repeated append, replace-all, frame deletion controls and before/after drag insertion pass');
  console.log('✓ v0.12.1 checker CSS no longer collides with the global absolute-position checkerboard');
} finally {
  await server?.close();
}
