import type { Point, Region } from './types';

/** A non-AI magic wand: finds a connected patch of similar RGBA pixels. It cannot identify anatomy. */
export function traceColorRegion(data: Uint8ClampedArray, width:number, height:number, x:number, y:number, tolerance=55):Region {
  if(width<1||height<1||data.length!==width*height*4)throw new Error('Invalid image buffer');
  const sx=Math.max(0,Math.min(width-1,Math.floor(x))),sy=Math.max(0,Math.min(height-1,Math.floor(y)));
  const seed=sy*width+sx,si=seed*4;
  if(data[si+3]<40)throw new Error('คลิกบนตัวละคร ไม่ใช่พื้นหลังโปร่งใส');
  const rgb=[data[si],data[si+1],data[si+2]];
  const visited=new Uint8Array(width*height), mask=new Uint8Array(width*height),queue=new Int32Array(width*height);
  let front=0,back=1,count=0;queue[0]=seed;visited[seed]=1;
  const tol2=tolerance*tolerance*3;
  const visit=(idx:number)=>{if(visited[idx])return;visited[idx]=1;const i=idx*4;const d0=data[i]-rgb[0],d1=data[i+1]-rgb[1],d2=data[i+2]-rgb[2];if(data[i+3]>=50&&d0*d0+d1*d1+d2*d2<=tol2)queue[back++]=idx;};
  while(front<back){
    const p=queue[front++];mask[p]=1;count++;
    const px=p%width,py=Math.floor(p/width);
    if(px>0)visit(p-1);if(px<width-1)visit(p+1);if(py>0)visit(p-width);if(py<height-1)visit(p+width);
    if(count>width*height*.55)throw new Error('สีนี้เชื่อมต่อพื้นที่กว้างเกินไป ลองคลิกสีอีกจุดหรือลดค่า Tolerance');
  }
  if(count<12)throw new Error('พื้นที่สีเล็กเกินไป ลองเพิ่มค่า Tolerance หรือคลิกบริเวณที่ใหญ่ขึ้น');
  const boundary:{x:number;y:number}[]=[];
  for(let idx=0;idx<mask.length;idx++){
    if(!mask[idx])continue;
    const px=idx%width,py=Math.floor(idx/width);
    if(px===0||py===0||px===width-1||py===height-1||!mask[idx-1]||!mask[idx+1]||!mask[idx-width]||!mask[idx+width])boundary.push({x:px+.5,y:py+.5});
  }
  if(boundary.length<3)throw new Error('ไม่พบเส้นขอบพื้นที่สี');
  // Convex hull is an editable approximation, never a semantic/matted mask.
  boundary.sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo:typeof boundary=[],up:typeof boundary=[];
  for(const p of boundary){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=boundary.length-1;i>=0;i--){const p=boundary[i];while(up.length>1&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  const hull=lo.slice(0,-1).concat(up.slice(0,-1));
  const stride=Math.max(1,Math.ceil(hull.length/48));
  const points:Point[]=hull.filter((_,i)=>i%stride===0).map(p=>[
    Math.max(0,Math.min(1000,Math.round(p.x/width*1000))),
    Math.max(0,Math.min(1000,Math.round(p.y/height*1000))),
  ]);
  if(points.length<3)throw new Error('ผลขอบเขตมีจุดไม่เพียงพอ');
  return [points];
}

export async function autoOutlineFromImage(imageUrl:string,xNorm:number,yNorm:number,tolerance=55):Promise<Region>{
  const image=new Image();image.src=imageUrl;await image.decode();
  const ratio=Math.min(1,600/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*ratio)),height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas ไม่พร้อม');
  ctx.drawImage(image,0,0,width,height);
  return traceColorRegion(ctx.getImageData(0,0,width,height).data,width,height,xNorm/1000*width,yNorm/1000*height,tolerance);
}
