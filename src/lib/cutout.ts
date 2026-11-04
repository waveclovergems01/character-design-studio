import { Application, MeshSimple, Texture } from 'pixi.js';
import type { JointId, JointPositions, RigDirection, RigFrame } from './rig';
import { resolvedNearSide } from './rig';
import type { Point } from './types';

export const CUTOUT_PARTS = [
  {id:'torso',label:'ลำตัว',from:'pelvis',to:'chest',width:.57,start:-.06,end:1.16},
  {id:'head',label:'ศีรษะ / ผม',from:'neck',to:'head',width:.53,start:-.08,end:1.10},
  {id:'arm_left_upper',label:'ต้นแขนซ้าย',from:'shoulder_left',to:'elbow_left',width:.21,start:-.10,end:1.1},
  {id:'arm_left_lower',label:'ปลายแขนซ้าย',from:'elbow_left',to:'wrist_left',width:.20,start:-.07,end:1.12},
  {id:'arm_right_upper',label:'ต้นแขนขวา',from:'shoulder_right',to:'elbow_right',width:.21,start:-.10,end:1.1},
  {id:'arm_right_lower',label:'ปลายแขนขวา',from:'elbow_right',to:'wrist_right',width:.20,start:-.07,end:1.12},
  {id:'leg_left_upper',label:'ต้นขาซ้าย',from:'hip_left',to:'knee_left',width:.27,start:-.09,end:1.1},
  {id:'leg_left_lower',label:'หน้าแข้งซ้าย',from:'knee_left',to:'ankle_left',width:.25,start:-.1,end:1.08},
  {id:'foot_left',label:'รองเท้าซ้าย',from:'knee_left',to:'ankle_left',width:.31,start:.78,end:1.31},
  {id:'leg_right_upper',label:'ต้นขาขวา',from:'hip_right',to:'knee_right',width:.27,start:-.09,end:1.1},
  {id:'leg_right_lower',label:'หน้าแข้งขวา',from:'knee_right',to:'ankle_right',width:.25,start:-.1,end:1.08},
  {id:'foot_right',label:'รองเท้าขวา',from:'knee_right',to:'ankle_right',width:.31,start:.78,end:1.31},
] as const satisfies ReadonlyArray<{id:string;label:string;from:JointId;to:JointId;width:number;start:number;end:number}>;

export type CutoutPartId = typeof CUTOUT_PARTS[number]['id'];
export type CutoutWidths = Partial<Record<CutoutPartId,number>>;
export type CutoutMaskOverrides=Partial<Record<CutoutPartId,{start?:Point;end?:Point;polygon?:Point[]}>>;
/** The secondary (adjacent) bone influence at each mesh vertex, 0..1. Primary is 1-secondary. */
export type CutoutSkinWeights=Partial<Record<CutoutPartId,number[]>>;
export type WeightInfluence='primary'|'secondary';
export type WeightBrushMode='add'|'remove'|'replace'|'smooth';
export const SKIN_GRID_COLUMNS=11;
export const SKIN_GRID_ROWS=15;

type SkinBone={from:JointId;to:JointId;label:string};
const adjacentSkinBone=(id:CutoutPartId):SkinBone=>{
  if(id==='torso')return {from:'chest',to:'neck',label:'หน้าอก → คอ'};
  if(id==='head')return {from:'chest',to:'neck',label:'หน้าอก → คอ'};
  const side=id.includes('left')?'left':'right';
  if(id.startsWith('arm_')&&id.endsWith('_upper'))return {from:'chest',to:`shoulder_${side}` as JointId,label:`หน้าอก → ไหล่${side==='left'?'ซ้าย':'ขวา'}`};
  if(id.startsWith('arm_'))return {from:`shoulder_${side}` as JointId,to:`elbow_${side}` as JointId,label:`ไหล่ → ศอก${side==='left'?'ซ้าย':'ขวา'}`};
  if(id.startsWith('leg_')&&id.endsWith('_upper'))return {from:'pelvis',to:`hip_${side}` as JointId,label:`สะโพกกลาง → โคนขา${side==='left'?'ซ้าย':'ขวา'}`};
  return {from:`hip_${side}` as JointId,to:`knee_${side}` as JointId,label:`สะโพก → เข่า${side==='left'?'ซ้าย':'ขวา'}`};
};
export function skinBonePair(id:CutoutPartId):{primary:SkinBone;secondary:SkinBone}{
  const part=CUTOUT_PARTS.find(item=>item.id===id)!;
  return {primary:{from:part.from,to:part.to,label:`${part.from} → ${part.to}`},secondary:adjacentSkinBone(id)};
}
export function pairedCutoutPart(id:CutoutPartId):CutoutPartId|null{
  const opposite=id.includes('left')?id.replace('left','right'):id.includes('right')?id.replace('right','left'):'';
  return CUTOUT_PARTS.some(part=>part.id===opposite)?opposite as CutoutPartId:null;
}
export type CutoutSlice = {id:CutoutPartId;canvas:HTMLCanvasElement;origin:[number,number];from:JointId;to:JointId;rest:JointPositions;vertices:Float32Array;uvs:Float32Array;indices:Uint32Array;secondaryWeights:Float32Array};
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const px=(p:Point,w:number,h:number):Point=>[p[0]*w/1000,p[1]*h/1000];

const maskPixelBounds=(points:Point[],width:number,height:number)=>{
  const pixels=points.map(p=>px(p,width,height));
  const left=clamp(Math.floor(Math.min(...pixels.map(p=>p[0]))-3),0,width-1);
  const top=clamp(Math.floor(Math.min(...pixels.map(p=>p[1]))-3),0,height-1);
  const right=clamp(Math.ceil(Math.max(...pixels.map(p=>p[0]))+3),left+1,width);
  const bottom=clamp(Math.ceil(Math.max(...pixels.map(p=>p[1]))+3),top+1,height);
  return {left,top,right,bottom};
};

/** Deterministic mesh grid shared by rendering, heatmap and weight-paint hit testing. */
export function skinGridForPart(id:CutoutPartId,rest:JointPositions,width:number,height:number,widths:CutoutWidths={},overrides:CutoutMaskOverrides={}){
  const polygon=getCutoutMaskGeometry(id,rest,width,height,widths,overrides).polygon;
  const {left,top,right,bottom}=maskPixelBounds(polygon,width,height);
  const vertices:Point[]=[];
  for(let row=0;row<SKIN_GRID_ROWS;row++)for(let col=0;col<SKIN_GRID_COLUMNS;col++){
    vertices.push([(left+(right-left)*col/(SKIN_GRID_COLUMNS-1))/width*1000,(top+(bottom-top)*row/(SKIN_GRID_ROWS-1))/height*1000]);
  }
  return {vertices,polygon,bounds:{left,top,right,bottom}};
}

/** Polygon geometry is a hard isolation boundary. A brush cannot assign weights to another part. */
export function pointInSkinPolygon(point:Point,polygon:Point[]):boolean{
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/** Two anatomically adjacent segments only; no distance-based spill into unrelated arms, legs or torso. */
export function autoSkinWeights(id:CutoutPartId,rest:JointPositions,width:number,height:number,widths:CutoutWidths={},overrides:CutoutMaskOverrides={},softness=.35):number[]{
  const {vertices}=skinGridForPart(id,rest,width,height,widths,overrides);
  const part=CUTOUT_PARTS.find(item=>item.id===id)!;
  const a=px(rest[part.from],width,height),b=px(rest[part.to],width,height);
  const dx=b[0]-a[0],dy=b[1]-a[1],length2=Math.max(1,dx*dx+dy*dy);
  const transition=clamp(softness,.08,.85);
  const limit=id.startsWith('foot_')?.22:.72;
  return vertices.map(vertex=>{
    const p=px(vertex,width,height);
    const along=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2;
    const distance=id==='torso'?1-along:along;
    const x=clamp(1-distance/transition,0,1);
    return Math.round(limit*x*x*(3-2*x)*1000)/1000;
  });
}

/** Paint a single selected piece: blue=0% selected bone, red=100%; all other pieces remain unchanged. */
export function paintSkinWeights(id:CutoutPartId,rest:JointPositions,width:number,height:number,widths:CutoutWidths,overrides:CutoutMaskOverrides,current:number[],cursor:Point,radiusPx:number,strength:number,mode:WeightBrushMode,influence:WeightInfluence,replaceValue=.5):number[]{
  const {vertices,polygon}=skinGridForPart(id,rest,width,height,widths,overrides);
  const initial=current.length===vertices.length?current:autoSkinWeights(id,rest,width,height,widths,overrides);
  const selected=initial.map(v=>influence==='secondary'?v:1-v);
  const normalizedRadius=Math.max(1,radiusPx),power=clamp(strength,0,1);
  return initial.map((old,index)=>{
    const v=vertices[index];
    if(!pointInSkinPolygon(v,polygon))return old;
    const distance=Math.hypot((v[0]-cursor[0])*width/1000,(v[1]-cursor[1])*height/1000);
    if(distance>=normalizedRadius)return old;
    const t=1-distance/normalizedRadius,pressure=power*t*t*(3-2*t);
    let next=selected[index];
    if(mode==='smooth'){
      const row=Math.floor(index/SKIN_GRID_COLUMNS),col=index%SKIN_GRID_COLUMNS;
      const neighbors=[] as number[];
      for(let y=Math.max(0,row-1);y<=Math.min(SKIN_GRID_ROWS-1,row+1);y++)for(let x=Math.max(0,col-1);x<=Math.min(SKIN_GRID_COLUMNS-1,col+1);x++){
        const k=y*SKIN_GRID_COLUMNS+x;
        if(pointInSkinPolygon(vertices[k],polygon))neighbors.push(selected[k]);
      }
      const average=neighbors.reduce((sum,n)=>sum+n,0)/Math.max(1,neighbors.length);
      next+=pressure*(average-next);
    }else{
      const target=mode==='add'?1:mode==='remove'?0:clamp(replaceValue,0,1);
      next+=pressure*(target-next);
    }
    return Math.round(clamp(influence==='secondary'?next:1-next,0,1)*1000)/1000;
  });
}

/** Back-to-front draw order. This is a direction-dependent starting rule, not proof of physical 3D occlusion. */
export function autoCutoutOrder(direction:RigDirection,frame:RigFrame):CutoutPartId[] {
  const near=resolvedNearSide(direction,frame.nearSide);
  const front=near==='character_right'?'right':'left';
  const far=front==='left'?'right':'left';
  const arm=(side:string):CutoutPartId[]=>[`arm_${side}_upper`,`arm_${side}_lower`] as CutoutPartId[];
  const leg=(side:string):CutoutPartId[]=>[`leg_${side}_upper`,`leg_${side}_lower`,`foot_${side}`] as CutoutPartId[];
  return [...arm(far),...leg(far),'torso',...leg(front),'head',...arm(front)];
}

export function resolveCutoutOrder(direction:RigDirection,frame:RigFrame):CutoutPartId[]{
  const auto=autoCutoutOrder(direction,frame);
  if(!frame.drawOrder)return auto;
  const valid=frame.drawOrder.filter((s):s is CutoutPartId=>auto.includes(s as CutoutPartId));
  return [...new Set([...valid,...auto])];
}

export function moveCutoutPart(direction:RigDirection,frame:RigFrame,id:CutoutPartId,delta:number):RigFrame {
  const order=resolveCutoutOrder(direction,frame);
  const from=order.indexOf(id);if(from<0)return frame;
  const to=clamp(from+delta,0,order.length-1);
  order.splice(from,1);order.splice(to,0,id);
  return {...frame,drawOrder:order};
}

/** Place one visual layer either behind or in front of another, for this frame only. */
export function placeCutoutRelative(direction:RigDirection,frame:RigFrame,id:CutoutPartId,anchor:CutoutPartId,placement:'before'|'after'):RigFrame{
  if(id===anchor)return frame;
  const order=resolveCutoutOrder(direction,frame);
  const from=order.indexOf(id);
  if(from<0)return frame;
  order.splice(from,1);
  const at=order.indexOf(anchor);
  if(at<0)return frame;
  order.splice(at+(placement==='after'?1:0),0,id);
  return {...frame,drawOrder:order};
}

/** Reorder an anatomical arm or leg as a group, preserving its internal upper/lower/foot order. */
export function placeCutoutLimbRelative(direction:RigDirection,frame:RigFrame,id:CutoutPartId,anchor:CutoutPartId,placement:'before'|'after'):RigFrame{
  const all=resolveCutoutOrder(direction,frame);
  const limb=id.startsWith('arm_')?id.replace(/_(upper|lower)$/,''):id.startsWith('leg_')?id.replace(/_(upper|lower)$/,''):id.startsWith('foot_')?id.replace('foot_','leg_'):'';
  const side=limb.endsWith('_left')?'left':limb.endsWith('_right')?'right':null;
  const group=side&&limb.startsWith('arm_')?[`arm_${side}_upper`,`arm_${side}_lower`]
    :side&&limb.startsWith('leg_')?[`leg_${side}_upper`,`leg_${side}_lower`,`foot_${side}`]:[id];
  if(group.includes(anchor))return frame;
  const members=all.filter(part=>group.includes(part));
  const rest=all.filter(part=>!group.includes(part));
  const pivot=rest.indexOf(anchor);
  if(pivot<0)return frame;
  rest.splice(pivot+(placement==='after'?1:0),0,...members);
  return {...frame,drawOrder:rest};
}

const getMid=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

/** Same exact capsule or custom Polygon geometry used for both editor and source-texture clipping. */
export function getCutoutMaskGeometry(id:CutoutPartId,rest:JointPositions,width:number,height:number,widths:CutoutWidths={},overrides:CutoutMaskOverrides={}){
  const part=CUTOUT_PARTS.find(item=>item.id===id)!;
  const l=px(rest.shoulder_left,width,height),r=px(rest.shoulder_right,width,height);
  const figureWidth=Math.max(40,Math.hypot(l[0]-r[0],l[1]-r[1]));
  const a=px(rest[part.from],width,height),b=px(rest[part.to],width,height);
  const start=overrides[id]?.start?px(overrides[id].start,width,height):getMid(a,b,part.start);
  const end=overrides[id]?.end?px(overrides[id].end,width,height):getMid(a,b,part.end);
  const radius=figureWidth*part.width*clamp((widths[id]??100)/100,.3,2.5);
  const dx=end[0]-start[0],dy=end[1]-start[1],d=Math.max(.001,Math.hypot(dx,dy));
  const ux=dx/d,uy=dy/d,vx=-uy,vy=ux,polygon:Point[]=[];
  const cap=(origin:Point,a:number,b:number)=>{
    for(let i=0;i<=20;i++){
      const theta=a+(b-a)*i/20;
      polygon.push([(origin[0]+radius*(Math.cos(theta)*ux+Math.sin(theta)*vx))/width*1000,(origin[1]+radius*(Math.cos(theta)*uy+Math.sin(theta)*vy))/height*1000]);
    }
  };
  cap(end,-Math.PI/2,Math.PI/2);
  cap(start,Math.PI/2,Math.PI*1.5);
  const custom=overrides[id]?.polygon;
  return {start:[start[0]/width*1000,start[1]/height*1000] as Point,end:[end[0]/width*1000,end[1]/height*1000] as Point,radiusPx:radius,polygon:custom&&custom.length>=3?custom.map(point=>[...point] as Point):polygon};
}

/** Convert the smooth capsule to 16 control points; artists can then refine the silhouette. */
export function makeEditableCutoutPolygon(id:CutoutPartId,rest:JointPositions,width:number,height:number,widths:CutoutWidths={},overrides:CutoutMaskOverrides={}):Point[]{
  const outline=getCutoutMaskGeometry(id,rest,width,height,widths,overrides).polygon;
  if(overrides[id]?.polygon?.length)return outline;
  return [0,3,6,9,12,15,18,20,21,24,27,30,33,36,39,41].map(i=>[...outline[i]] as Point);
}

/** Inserts a new vertex on the nearest edge, using the actual image pixel aspect ratio. */
export function insertCutoutPolygonPoint(polygon:Point[],cursor:Point,width:number,height:number):{polygon:Point[];index:number}{
  if(polygon.length<3)return {polygon,index:-1};
  const pos=px(cursor,width,height);
  let best={edge:0,distance:Infinity,point:cursor};
  for(let i=0;i<polygon.length;i++){
    const a=px(polygon[i],width,height),b=px(polygon[(i+1)%polygon.length],width,height);
    const dx=b[0]-a[0],dy=b[1]-a[1],along=clamp(((pos[0]-a[0])*dx+(pos[1]-a[1])*dy)/Math.max(.001,dx*dx+dy*dy),0,1);
    const projected:[number,number]=[a[0]+dx*along,a[1]+dy*along];
    const distance=Math.hypot(pos[0]-projected[0],pos[1]-projected[1]);
    if(distance<best.distance)best={edge:i,distance,point:[projected[0]/width*1000,projected[1]/height*1000]};
  }
  const index=best.edge+1;
  const result=polygon.map(p=>[...p] as Point);
  result.splice(index,0,best.point as Point);
  return {polygon:result,index};
}

/** Find a vertex within a real viewport-pixel radius (not an image-percent radius). */
export function nearestCutoutPolygonVertex(polygon:Point[],cursor:Point,viewWidth:number,viewHeight:number,maxDistance=22):number|null{
  let nearest:number|null=null,distance=maxDistance;
  for(let index=0;index<polygon.length;index++){
    const point=polygon[index];
    const pixels=Math.hypot((point[0]-cursor[0])*viewWidth/1000,(point[1]-cursor[1])*viewHeight/1000);
    if(pixels<=distance){nearest=index;distance=pixels;}
  }
  return nearest;
}

/** Transform a preview mask point from Rest Pose to an animated frame, or vice versa. */
export function mapCutoutPoint(point:Point,source:JointPositions,target:JointPositions,partId:CutoutPartId,width:number,height:number):Point{
  const part=CUTOUT_PARTS.find(item=>item.id===partId)!;
  const a=px(source[part.from],width,height),b=px(source[part.to],width,height);
  const c=px(target[part.from],width,height),d=px(target[part.to],width,height),p=px(point,width,height);
  const ox=b[0]-a[0],oy=b[1]-a[1],olen=Math.max(.001,Math.hypot(ox,oy));
  const tx=d[0]-c[0],ty=d[1]-c[1],tlen=Math.max(.001,Math.hypot(tx,ty));
  const dx=p[0]-a[0],dy=p[1]-a[1],along=(dx*ox+dy*oy)/(olen*olen),perp=(-dx*oy+dy*ox)/olen;
  return [(c[0]+tx*along-ty/tlen*perp)/width*1000,(c[1]+ty*along+tx/tlen*perp)/height*1000];
}

/** Each canvas holds the original pixels clipped to its exact edited Polygon/Capsule silhouette. */
export function createCutoutSlices(image:HTMLImageElement,rest:JointPositions,widths:CutoutWidths={},overrides:CutoutMaskOverrides={},weightOverrides:CutoutSkinWeights={}):CutoutSlice[]{
  const width=image.naturalWidth,height=image.naturalHeight;
  return CUTOUT_PARTS.map(part=>{
    const mask=getCutoutMaskGeometry(part.id,rest,width,height,widths,overrides);
    const points=mask.polygon.map(point=>px(point,width,height));
    const {left,top,right,bottom}=maskPixelBounds(mask.polygon,width,height);
    const canvas=document.createElement('canvas');canvas.width=right-left;canvas.height=bottom-top;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas ไม่รองรับ Cutout');
    ctx.fillStyle='#fff';ctx.beginPath();
    points.forEach((point,i)=>{if(i===0)ctx.moveTo(point[0]-left,point[1]-top);else ctx.lineTo(point[0]-left,point[1]-top);});
    ctx.closePath();ctx.fill();
    ctx.globalCompositeOperation='source-in';ctx.drawImage(image,-left,-top);ctx.globalCompositeOperation='source-over';
    // Several columns/rows permit future nonlinear skin weights; all existing points deform now.
    const columns=SKIN_GRID_COLUMNS,rows=SKIN_GRID_ROWS,vertices=new Float32Array(columns*rows*2),uvs=new Float32Array(columns*rows*2);
    const indices:number[]=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const i=(y*columns+x)*2, u=x/(columns-1),v=y/(rows-1);
      uvs[i]=u;uvs[i+1]=v;vertices[i]=left+u*canvas.width;vertices[i+1]=top+v*canvas.height;
      if(x<columns-1&&y<rows-1){const k=y*columns+x;indices.push(k,k+1,k+columns,k+1,k+columns+1,k+columns);}
    }
    const painted=weightOverrides[part.id];
    const secondaryWeights=new Float32Array(painted?.length===columns*rows?painted:autoSkinWeights(part.id,rest,width,height,widths,overrides));
    return {id:part.id,canvas,origin:[left,top],from:part.from,to:part.to,rest,vertices,uvs,indices:new Uint32Array(indices),secondaryWeights};
  });
}

/** CPU 2D mesh skinning: stretch along its bone axis, rotate off-axis pixels with the new bone direction. */
export function deformSlice(slice:CutoutSlice,frame:RigFrame,width:number,height:number):Float32Array {
  const origA=px(slice.rest[slice.from],width,height),origB=px(slice.rest[slice.to],width,height);
  const nextA=px(frame.joints[slice.from],width,height),nextB=px(frame.joints[slice.to],width,height);
  const ox=origB[0]-origA[0],oy=origB[1]-origA[1],olen=Math.max(1,Math.hypot(ox,oy));
  const nx=nextB[0]-nextA[0],ny=nextB[1]-nextA[1],nlen=Math.max(1,Math.hypot(nx,ny));
  const neighbor=adjacentSkinBone(slice.id);
  const restN0=px(slice.rest[neighbor.from],width,height),restN1=px(slice.rest[neighbor.to],width,height);
  const poseN0=px(frame.joints[neighbor.from],width,height),poseN1=px(frame.joints[neighbor.to],width,height);
  const ndx=restN1[0]-restN0[0],ndy=restN1[1]-restN0[1],nOrigLen=Math.max(1,Math.hypot(ndx,ndy));
  const npx=poseN1[0]-poseN0[0],npy=poseN1[1]-poseN0[1],nPoseLen=Math.max(1,Math.hypot(npx,npy));
  const result=new Float32Array(slice.vertices.length);
  for(let i=0;i<slice.vertices.length;i+=2){
    const dx=slice.vertices[i]-origA[0],dy=slice.vertices[i+1]-origA[1];
    const along=(dx*ox+dy*oy)/(olen*olen),perp=(-dx*oy+dy*ox)/olen;
    const mainX=nextA[0]+nx*along-ny/nlen*perp;
    const mainY=nextA[1]+ny*along+nx/nlen*perp;
    const neighborX=slice.vertices[i]-restN0[0],neighborY=slice.vertices[i+1]-restN0[1];
    const nAlong=(neighborX*ndx+neighborY*ndy)/(nOrigLen*nOrigLen);
    const nPerp=(-neighborX*ndy+neighborY*ndx)/nOrigLen;
    const secondX=poseN0[0]+npx*nAlong-npy/nPoseLen*nPerp;
    const secondY=poseN0[1]+npy*nAlong+npx/nPoseLen*nPerp;
    const weight=slice.secondaryWeights[i/2];
    result[i]=mainX*(1-weight)+secondX*weight;
    result[i+1]=mainY*(1-weight)+secondY*weight;
  }
  return result;
}

export async function loadCutoutImage(url:string):Promise<HTMLImageElement> {
  const image=new Image();image.src=url;await image.decode();return image;
}

export type CutoutScene={app:Application;update:(frame:RigFrame,direction:RigDirection)=>void;destroy:()=>void};
export async function createCutoutScene(host:HTMLElement,image:HTMLImageElement,rest:JointPositions,frame:RigFrame,direction:RigDirection,widths:CutoutWidths={},overrides:CutoutMaskOverrides={},weightOverrides:CutoutSkinWeights={}):Promise<CutoutScene>{
  const app=new Application();
  await app.init({width:image.naturalWidth,height:image.naturalHeight,backgroundAlpha:0,antialias:true,preference:'webgl',preserveDrawingBuffer:true});
  app.ticker.stop();host.appendChild(app.canvas);
  app.canvas.classList.add('cutout-pixi-canvas');
  const slices=createCutoutSlices(image,rest,widths,overrides,weightOverrides);
  const meshes=slices.map(slice=>{
    const mesh=new MeshSimple({texture:Texture.from(slice.canvas),vertices:new Float32Array(slice.vertices),uvs:slice.uvs,indices:slice.indices});
    mesh.autoUpdate=true;app.stage.addChild(mesh);return {slice,mesh};
  });
  app.stage.sortableChildren=true;
  const update=(nextFrame:RigFrame,nextDir:RigDirection)=>{
    const order=resolveCutoutOrder(nextDir,nextFrame);
    for(const {slice,mesh} of meshes){
      mesh.vertices.set(deformSlice(slice,nextFrame,image.naturalWidth,image.naturalHeight));
      mesh.zIndex=order.indexOf(slice.id);
    }
    app.stage.sortChildren();
    app.renderer.render(app.stage);
  };
  update(frame,direction);
  return {app,update,destroy:()=>{
    for(const {mesh} of meshes)mesh.texture.destroy(true);
    app.destroy(true,{children:true});
  }};
}
