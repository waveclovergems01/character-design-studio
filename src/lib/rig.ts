import type { Point } from './types';

export const RIG_DIRECTIONS = ['S','SW','W','NW','N','NE','E','SE'] as const;
export type RigDirection = typeof RIG_DIRECTIONS[number];
export const MOTION_TYPES = ['idle','walk','run','custom'] as const;
export type MotionType = typeof MOTION_TYPES[number];
export const MOTION_LABELS: Record<MotionType,string> = {idle:'Idle / หายใจ',walk:'Walk / เดิน',run:'Run / วิ่ง',custom:'Custom / กำหนดเอง'};
export const MOTION_DEFAULT_FRAMES: Record<MotionType,number> = {idle:4,walk:8,run:8,custom:4};
export type NearSide = 'auto' | 'character_left' | 'character_right' | 'balanced';

export const JOINTS = [
  ['head','ศีรษะ'], ['face','ใบหน้า'], ['eye_left','ตาซ้าย'], ['eye_right','ตาขวา'], ['neck','คอ'], ['chest','หน้าอก'], ['pelvis','สะโพกกลาง'],
  ['shoulder_left','ไหล่ซ้าย'], ['elbow_left','ศอกซ้าย'], ['wrist_left','ข้อมือซ้าย'],
  ['shoulder_right','ไหล่ขวา'], ['elbow_right','ศอกขวา'], ['wrist_right','ข้อมือขวา'],
  ['hip_left','สะโพกซ้าย'], ['knee_left','เข่าซ้าย'], ['ankle_left','ข้อเท้าซ้าย'],
  ['hip_right','สะโพกขวา'], ['knee_right','เข่าขวา'], ['ankle_right','ข้อเท้าขวา'],
] as const;
export type JointId = typeof JOINTS[number][0];
export type JointPositions = Record<JointId, Point>;
export type RigFrame = { joints: JointPositions; nearSide: NearSide; drawOrder?: string[] };

export const BONES: [JointId, JointId][] = [
  ['pelvis','chest'],['chest','neck'],['neck','head'],['head','face'],['face','eye_left'],['face','eye_right'],
  ['chest','shoulder_left'],['shoulder_left','elbow_left'],['elbow_left','wrist_left'],
  ['chest','shoulder_right'],['shoulder_right','elbow_right'],['elbow_right','wrist_right'],
  ['pelvis','hip_left'],['hip_left','knee_left'],['knee_left','ankle_left'],
  ['pelvis','hip_right'],['hip_right','knee_right'],['knee_right','ankle_right'],
];

export function defaultNearSide(direction: RigDirection): Exclude<NearSide, 'auto'> {
  if (['W','SW','NW'].includes(direction)) return 'character_left';
  if (['E','SE','NE'].includes(direction)) return 'character_right';
  return 'balanced';
}

export function resolvedNearSide(direction: RigDirection, selection: NearSide): Exclude<NearSide,'auto'> {
  return selection === 'auto' ? defaultNearSide(direction) : selection;
}

/** Bounds are normalized_1000. This is only a proportion-based starting layout, not human pose estimation. */
export function initialJoints(bounds: { x: number; y: number; width: number; height: number } = { x: 300, y: 60, width: 400, height: 870 },direction:RigDirection='S'): JointPositions {
  const c = (x: number, y: number): Point => [Math.round(bounds.x + x * bounds.width), Math.round(bounds.y + y * bounds.height)];
  const j:JointPositions = {
    head:c(.5,.13),face:c(.5,.16),eye_left:c(.545,.14),eye_right:c(.455,.14),neck:c(.5,.265),chest:c(.5,.36),pelvis:c(.5,.525),
    shoulder_left:c(.66,.32),elbow_left:c(.76,.47),wrist_left:c(.75,.62),
    shoulder_right:c(.34,.32),elbow_right:c(.24,.47),wrist_right:c(.25,.62),
    hip_left:c(.58,.54),knee_left:c(.60,.73),ankle_left:c(.62,.94),
    hip_right:c(.42,.54),knee_right:c(.40,.73),ankle_right:c(.38,.94),
  };
  const factor = ['W','E'].includes(direction) ? .22 : ['SW','SE','NW','NE'].includes(direction) ? .65 : 1;
  const mirrorBack = ['N','NW','NE'].includes(direction) ? -1 : 1;
  if(direction!=='S')for(const [id] of JOINTS){
    if(/_(left|right)$/.test(id)) j[id][0]=Math.round(bounds.x + (.5+(j[id][0]-c(.5,0)[0])/bounds.width * factor * mirrorBack)*bounds.width);
  }
  return j;
}

export function cloneJoints(joints: JointPositions): JointPositions {
  return Object.fromEntries(JOINTS.map(([id]) => [id, [...joints[id]]])) as JointPositions;
}

export function makeMotionFrames(base: JointPositions, direction: RigDirection, motion: MotionType, requestedCount = MOTION_DEFAULT_FRAMES[motion]): RigFrame[] {
  const count = Math.min(16,Math.max(1,Math.round(requestedCount)));
  const sideView = ['W','E','NW','NE','SW','SE'].includes(direction);
  return Array.from({length:count},(_,i) => {
    const phase = i * Math.PI * 2 / count;
    const j = cloneJoints(base);
    const bob = motion==='idle' ? Math.round(2*Math.sin(phase)) : motion==='custom' ? 0 : Math.round((motion==='run'?7:4)*(1 - Math.cos(2*phase)));
    for (const id of ['pelvis','chest','neck','head','face','eye_left','eye_right','shoulder_left','shoulder_right','elbow_left','elbow_right','wrist_left','wrist_right'] as JointId[]) {
      j[id][1] = base[id][1] + bob;
    }
    if(motion==='idle') {
      // A short breathing loop; feet and pelvis stay planted.
      for(const id of ['chest','neck','head','face','eye_left','eye_right','shoulder_left','shoulder_right'] as JointId[])j[id][1]-=Math.round(4*Math.sin(phase));
      j.shoulder_left[0]+=Math.round(2*Math.sin(phase));
      j.shoulder_right[0]-=Math.round(2*Math.sin(phase));
    }
    for (const [side,offset] of [['left',0],['right',Math.PI]] as const) {
      if(motion==='idle'||motion==='custom')continue;
      const wave = Math.sin(phase + offset);
      const lift = Math.max(0,wave);
      const stride = (sideView ? (motion==='run'?92:65) : (motion==='run'?35:20)) * wave;
      const kneeId = `knee_${side}` as JointId, ankleId = `ankle_${side}` as JointId;
      const elbowId = `elbow_${side}` as JointId, wristId = `wrist_${side}` as JointId;
      j[kneeId] = [Math.round(base[kneeId][0] + stride * .52),Math.round(base[kneeId][1] - lift * (motion==='run'?43:26) + bob)];
      j[ankleId] = [Math.round(base[ankleId][0] + stride),Math.round(base[ankleId][1] - lift * (motion==='run'?58:38))];
      j[elbowId] = [Math.round(base[elbowId][0] - stride * .3),Math.round(base[elbowId][1] + bob)];
      j[wristId] = [Math.round(base[wristId][0] - stride * .65),Math.round(base[wristId][1] + bob)];
    }
    return { joints:j, nearSide:'auto' };
  });
}

/** Preserve user-authored key poses when changing frame count by resampling the cyclic timeline. */
export function resampleRigFrames(frames: RigFrame[], count: number): RigFrame[] {
  const size=Math.min(16,Math.max(1,Math.round(count)));
  if(!frames.length)throw new Error('No keyframes to resample');
  if(size===frames.length)return frames.map(f=>({...f,joints:cloneJoints(f.joints),drawOrder:f.drawOrder?.slice()}));
  return Array.from({length:size},(_,i)=>{
    const oldPosition=i*frames.length/size;
    const a=Math.floor(oldPosition),b=(a+1)%frames.length,t=oldPosition-a;
    const joints=cloneJoints(frames[a].joints);
    for(const [id] of JOINTS){
      joints[id]=[0,1].map(axis=>Math.round(frames[a].joints[id][axis]*(1-t)+frames[b].joints[id][axis]*t)) as Point;
    }
    const nearest=frames[Math.round(oldPosition)%frames.length];
    return {joints,nearSide:nearest.nearSide,drawOrder:nearest.drawOrder?.slice()};
  });
}

export const makeWalkFrames = (base:JointPositions,direction:RigDirection):RigFrame[]=>makeMotionFrames(base,direction,'walk',8);

function solveTwoBone(parent:Point,mid:Point,end:Point,desired:Point):{mid:Point;end:Point}{
  const length=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  const l1=length(parent,mid),l2=length(mid,end);
  if(l1<1||l2<1)return {mid,end:desired};
  const dx=desired[0]-parent[0],dy=desired[1]-parent[1],dist=Math.max(.001,Math.hypot(dx,dy));
  const reach=Math.max(.001,Math.min(l1+l2-.001,Math.max(Math.abs(l1-l2)+.001,dist)));
  const ux=dx/dist,uy=dy/dist;
  const a=(l1*l1-l2*l2+reach*reach)/(2*reach),h=Math.sqrt(Math.max(0,l1*l1-a*a));
  const cross=(end[0]-parent[0])*(mid[1]-parent[1])-(end[1]-parent[1])*(mid[0]-parent[0]);
  const sign=cross>=0?1:-1;
  return {
    mid:[Math.round(parent[0]+ux*a-uy*h*sign),Math.round(parent[1]+uy*a+ux*h*sign)],
    end:[Math.round(parent[0]+ux*reach),Math.round(parent[1]+uy*reach)],
  };
}

export function updateJoint(frame: RigFrame, id: JointId, position: Point): RigFrame {
  const joints = cloneJoints(frame.joints);
  const target=position.map(n => Math.max(0,Math.min(1000,Math.round(n)))) as Point;
  const match=id.match(/^(ankle|wrist)_(left|right)$/);
  if(match){
    const root=`${match[1]==='ankle'?'hip':'shoulder'}_${match[2]}` as JointId;
    const middle=`${match[1]==='ankle'?'knee':'elbow'}_${match[2]}` as JointId;
    const solution=solveTwoBone(joints[root],joints[middle],joints[id],target);
    joints[middle]=solution.mid;joints[id]=solution.end;
  }else joints[id]=target;
  return {...frame,joints};
}

export function boneIsNear(id: JointId, direction: RigDirection, near: NearSide): boolean | null {
  const match = id.match(/_(left|right)$/);
  if (!match) return null;
  const side = resolvedNearSide(direction, near);
  return side === 'balanced' ? null : side === `character_${match[1]}`;
}

export function makeRigPrompt(imageName:string, width:number, height:number, direction:RigDirection, frameIndex:number, frame:RigFrame, motion:MotionType='walk', frameCount=8):string {
  const near = resolvedNearSide(direction,frame.nearSide);
  return `TASK: Draw ONE character animation frame that follows the attached editable 2D BONE POSE GUIDE.\n\nATTACHMENTS: (1) ORIGINAL MASTER PNG: ${imageName} (${width}x${height}) (2) BONE GUIDE PNG of the SAME image with labeled joints and lines.\nDIRECTION: ${direction}. MOTION: ${motion.toUpperCase()}. CYCLE FRAME: ${frameIndex+1} / ${frameCount}.\nCHARACTER ANATOMY: suffix _left and _right always mean the CHARACTER's left/right, NEVER screen left/right. Do not swap limbs.\nOCCLUSION: ${near === 'balanced' ? 'FRONT/BACK VIEW — evaluate limb overlap per pose; there is no fixed near side.' : near+' is the default NEAR side from this viewing direction. The nearer limb should usually render over the farther limb at intersections unless this specific pose crosses them.'}\nDRAW ORDER BACK-TO-FRONT: ${frame.drawOrder?.join(' → ')??'Auto by direction and near/far preference'}\n\nJOINT TARGETS (normalized_1000 across the FULL image):\n${JSON.stringify(frame.joints,null,2)}\n\nIMPORTANT:\n- Treat joints and bone lines as a structural pose reference, NOT shapes or colors to render. Remove all guide lines and labels in final artwork.\n- Preserve original face, hair, body proportions, clothing, material colors, rendering style and lighting.\n- Redraw limb contours and occlusions naturally around these joint positions; don't rotate flat texture stickers. Maintain knee/elbow joint continuity, standing height and plausible step length.\n- Each anatomical leg/arm must connect to its OWN shoulder/hip, with consistent far/near layering and contralateral arm swing.\n- Do NOT hallucinate a new camera angle or swap the character's left/right.\n- OUTPUT ONE full PNG (${width}x${height}) with transparent background and same alignment. No spritesheet unless explicitly requested later. Make a new version; do not modify the master.\n`;
}

export function makeRigBatchPrompt(imageName:string,width:number,height:number,direction:RigDirection,motion:MotionType,frames:RigFrame[]):string {
  return `TASK: Generate ${frames.length} CONSISTENT, INDIVIDUALLY NUMBERED transparent PNG animation frames for ${motion.toUpperCase()} facing ${direction}.\nMASTER: ${imageName} (${width}x${height}). Also use the numbered bone guides (or contact sheet). Each guide maps to exactly one numbered output PNG. Do not draw guide marks. Anatomical _left/_right always refer to the CHARACTER, not the screen. Keep the same face, hair, clothes, colors, proportions and canvas alignment across all frames. Preserve proper limb ownership and occlusion; redraw moving joints naturally. Output ${frames.length} independent frames, not a composite sheet. If unable to output all frames reliably at once, complete frames in order without redesigning the character.\n\n`+
    frames.map((frame,index)=>`===== FRAME ${String(index+1).padStart(2,'0')} / ${frames.length} =====\nNEAR SIDE: ${resolvedNearSide(direction,frame.nearSide)}\nDRAW ORDER (back-to-front): ${frame.drawOrder?.join(' > ')??'automatic near/far based on direction'}\nJOINTS: ${JSON.stringify(frame.joints)}`).join('\n\n')+
    '\n\nReview frame-to-frame limb continuity before making a final sprite sheet.';
}

export async function renderRigGuide(imageUrl:string,width:number,height:number,frame:RigFrame,direction:RigDirection):Promise<Blob> {
  const image = new Image();image.src=imageUrl;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas ไม่พร้อม');
  ctx.drawImage(image,0,0,width,height);
  const x=(p:Point)=>p[0]/1000*width, y=(p:Point)=>p[1]/1000*height;
  const scale=Math.max(2,Math.min(width,height)/90);
  for(const [a,b] of BONES){const near=boneIsNear(b,direction,frame.nearSide);ctx.beginPath();ctx.moveTo(x(frame.joints[a]),y(frame.joints[a]));ctx.lineTo(x(frame.joints[b]),y(frame.joints[b]));ctx.lineWidth=scale*1.2;ctx.strokeStyle=near===false?'#FBAA71':near===true?'#74F4D3':'#FDE28E';ctx.stroke();}
  ctx.font=`${Math.max(9,scale*3)}px sans-serif`;
  for(const [id,label] of JOINTS){const pos=frame.joints[id];ctx.beginPath();ctx.arc(x(pos),y(pos),scale*1.3,0,2*Math.PI);ctx.fillStyle='#FFF1B5';ctx.fill();ctx.strokeStyle='#20342D';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#FFF7DE';ctx.strokeStyle='#1D1B1B';ctx.lineWidth=2.6;ctx.strokeText(label,x(pos)+scale*1.8,y(pos)-scale);ctx.fillText(label,x(pos)+scale*1.8,y(pos)-scale);}
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Export PNG ไม่สำเร็จ')),'image/png'));
}

export async function detectFigureBounds(imageUrl:string):Promise<{x:number;y:number;width:number;height:number}> {
  const image=new Image();image.src=imageUrl;await image.decode();
  const canvas=document.createElement('canvas');const scale=Math.min(1,320/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas ไม่พร้อม');ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1,transparent=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const a=d[(y*canvas.width+x)*4+3];if(a<20){transparent++;continue;}if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
  // For opaque background or empty files, do not pretend to know the silhouette.
  if(maxX<0||transparent/(canvas.width*canvas.height)<.05) return {x:300,y:60,width:400,height:870};
  return {x:Math.round(minX/canvas.width*1000),y:Math.round(minY/canvas.height*1000),width:Math.max(100,Math.round((maxX-minX+1)/canvas.width*1000)),height:Math.max(200,Math.round((maxY-minY+1)/canvas.height*1000))};
}
