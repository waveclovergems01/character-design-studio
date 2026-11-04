import { createCutoutScene, createCutoutSlices, getCutoutMaskGeometry, loadCutoutImage, resolveCutoutOrder } from './cutout';
import type { CutoutMaskOverrides, CutoutSkinWeights, CutoutWidths } from './cutout';
import { imageToPngBlob } from './shape-guide';
import { makeRigBatchPrompt, makeRigPrompt, renderRigGuide } from './rig';
import type { MotionType, RigDirection, RigFrame } from './rig';
import { makeZip } from './zip';
import type { ZipEntry } from './zip';

type Options={imageUrl:string;imageName:string;width:number;height:number;direction:RigDirection;motion:MotionType;frames:RigFrame[];widths?:CutoutWidths;maskOverrides?:CutoutMaskOverrides;skinWeights?:CutoutSkinWeights;masterPng?:Blob|null};
const pad=(n:number)=>String(n).padStart(2,'0');
const fileStem=(name:string)=>name.replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,45)||'character';
const asPng=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('บันทึก PNG ไม่สำเร็จ')),'image/png'));
const motionData=(options:Options)=>({schema_version:'1.2',coordinate_system:'normalized_1000',source_image:options.imageName,image:{width:options.width,height:options.height},direction:options.direction,motion:options.motion,frame_count:options.frames.length,frames:options.frames,cutout_width_percent:options.widths??{},cutout_mask_endpoints:options.maskOverrides??{},cutout_mask_overrides:options.maskOverrides??{},skin_weight_secondary_per_mesh_vertex:options.skinWeights??{}});

export async function renderMotionContactSheet(options:Options):Promise<Blob>{
  const {imageUrl,width,height,frames,direction,motion}=options;
  const tileWidth=frames.length>8?320:440,tileHeight=Math.ceil(tileWidth*height/width);
  const columns=Math.min(4,frames.length+1),rows=Math.ceil((frames.length+1)/columns),gap=14,labelHeight=42;
  const canvas=document.createElement('canvas');canvas.width=columns*(tileWidth+gap)+gap;canvas.height=rows*(tileHeight+labelHeight+gap)+gap;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas ไม่พร้อม');
  ctx.fillStyle='#192129';ctx.fillRect(0,0,canvas.width,canvas.height);
  const paint=async (index:number,blob:Blob,label:string)=>{
    const col=index%columns,row=Math.floor(index/columns),x=gap+col*(tileWidth+gap),y=gap+row*(tileHeight+labelHeight+gap);
    ctx.fillStyle='#2b3842';ctx.fillRect(x,y,tileWidth,tileHeight+labelHeight);
    const bitmap=await createImageBitmap(blob);
    ctx.drawImage(bitmap,x,y,tileWidth,tileHeight);bitmap.close();
    ctx.fillStyle='#d5f7e8';ctx.font='bold 19px Arial,sans-serif';ctx.fillText(label,x+12,y+tileHeight+28);
  };
  const master=options.masterPng??await imageToPngBlob(imageUrl,width,height);
  await paint(0,master,'MASTER — original character');
  for(let i=0;i<frames.length;i++){
    const guide=await renderRigGuide(imageUrl,width,height,frames[i],direction);
    await paint(i+1,guide,`${direction} / ${motion.toUpperCase()} / FRAME ${pad(i+1)} of ${pad(frames.length)}`);
  }
  return asPng(canvas);
}

export async function exportGuidePack(options:Options):Promise<Blob>{
  const {imageUrl,imageName,width,height,direction,motion,frames}=options;
  const entries:ZipEntry[]=[];
  const all=makeRigBatchPrompt(imageName,width,height,direction,motion,frames);
  entries.push({name:'START_HERE_รวมคำสั่งทุกเฟรม.txt',data:all});
  entries.push({name:'data/motion_keyframes.json',data:JSON.stringify(motionData(options),null,2)});
  entries.push({name:'original/master.png',data:options.masterPng??await imageToPngBlob(imageUrl,width,height)});
  for(let i=0;i<frames.length;i++){
    const filename=`${direction}_${motion}_frame_${pad(i+1)}`;
    entries.push({name:`guides/${filename}_bone_guide.png`,data:await renderRigGuide(imageUrl,width,height,frames[i],direction)});
    entries.push({name:`prompts/${filename}.txt`,data:makeRigPrompt(imageName,width,height,direction,i,frames[i],motion,frames.length)});
  }
  entries.push({name:'overview_ALL_FRAMES.png',data:await renderMotionContactSheet(options)});
  entries.push({name:'README_วิธีใช้งาน.txt',data:`Character Studio | ${direction} / ${motion} | ${frames.length} frames\n\n1. ส่ง original/master.png พร้อม overview_ALL_FRAMES.png ไปยัง ChatGPT แล้ววางข้อความ START_HERE_รวมคำสั่งทุกเฟรม.txt\n2. ถ้าต้องการความแม่นยำ ให้ส่ง guides/FRAME...png ที่ความละเอียดจริงพร้อม prompts/FRAME...txt ของเฟรมที่ AI กำลังวาด\n3. รูป Bone Guide เป็นเส้นอ้างอิงเท่านั้น ไม่ใช่ภาพสำเร็จรูป และไม่ใช่ชิ้น Cutout\n4. การแนบหลายภาพพร้อมกันขึ้นอยู่กับขีดจำกัดของ ChatGPT; ZIP ไม่สามารถแนบและสั่งให้ AI แก้ทุกภาพโดยอัตโนมัติได้\n5. ตรวจแขน/ขาซ้าย-ขวาและลำดับหน้า-หลังทุกเฟรมก่อนสร้าง Sprite Sheet\n`});
  return makeZip(entries);
}

export async function exportCutoutPack(options:Options):Promise<Blob>{
  const {imageUrl,direction,frames,motion}=options;
  const image=await loadCutoutImage(imageUrl),widths=options.widths??{};
  const rest=frames[0].joints,slices=createCutoutSlices(image,rest,widths,options.maskOverrides??{},options.skinWeights??{});
  const entries:ZipEntry[]=[
    {name:'data/motion_keyframes.json',data:JSON.stringify(motionData(options),null,2)},
    {name:'data/cutout_layers.json',data:JSON.stringify({source_image:options.imageName,rest_pose:rest,skin_grid_columns:11,skin_grid_rows:15,weight_schema:'secondary_influence_0_to_1;primary=1-secondary',parts:slices.map(s=>({id:s.id,file:`layers/${s.id}.png`,joint_from:s.from,joint_to:s.to,source_origin_px:s.origin,size_px:[s.canvas.width,s.canvas.height],width_percent:widths[s.id]??100,mask_type:options.maskOverrides?.[s.id]?.polygon?'polygon':'capsule',mask_polygon_normalized_1000:getCutoutMaskGeometry(s.id,rest,image.naturalWidth,image.naturalHeight,widths,options.maskOverrides).polygon,skin_secondary_vertex_weights:Array.from(s.secondaryWeights),draw_order_per_frame:frames.map(f=>resolveCutoutOrder(direction,f).indexOf(s.id))}))},null,2)},
  ];
  entries.push({name:'original/master.png',data:options.masterPng??await imageToPngBlob(imageUrl,options.width,options.height)});
  for(const slice of slices)entries.push({name:`layers/${slice.id}.png`,data:await asPng(slice.canvas)});
  const host=document.createElement('div');let scene:Awaited<ReturnType<typeof createCutoutScene>>|null=null;
  try{
    scene=await createCutoutScene(host,image,rest,frames[0],direction,widths,options.maskOverrides??{},options.skinWeights??{});
    for(let i=0;i<frames.length;i++){
      scene.update(frames[i],direction);
      // Wait for the WebGL canvas to become available to the browser PNG encoder.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      entries.push({name:`rendered/${direction}_${motion}_${pad(i+1)}.png`,data:await asPng(scene.app.canvas)});
    }
  }finally{scene?.destroy();}
  entries.push({name:'README_CUTOUT.txt',data:`PixiJS SKELETAL CUTOUT + WEIGHTED 2-BONE MESH / TEST RENDER\nMotion ${motion}, Direction ${direction}, Frames ${frames.length}\n\nRendered frames use PixiJS MeshSimple textured 11x15 vertex grids, interpolated two-bone vertex weights, and per-frame zIndex. Each layer is clipped to a capsule or manually edited Polygon silhouette stored in data/cutout_layers.json. The primary and adjacent secondary bone weights sum to 1.0 for each grid vertex. The only permitted secondary bone is an anatomically neighboring segment of the SAME body part. This prototype is not an AI human anatomy analyzer, unrestricted Spine skinning, or a true 3D model.\n\nThe source is a SINGLE FLAT PNG: hidden clothing/body pixels are not present and weight blending cannot invent those pixels. Texture duplicates and unpainted holes may remain. The file layers/*.png contains cropped source textures; data/cutout_layers.json includes exact normalized mask polygon, pixel offsets, bone anchors, skin_secondary_vertex_weights and per-frame Draw Order. For final quality, repaint missing pixels behind overlapping limbs or use manually prepared independent Underlay layers.\n`});
  return makeZip(entries);
}

export function motionPackFilename(options:Pick<Options,'imageName'|'direction'|'motion'|'frames'>,kind:'guides'|'cutout'){
  return `${fileStem(options.imageName)}_${options.direction}_${options.motion}_${options.frames.length}frames_${kind}.zip`;
}
