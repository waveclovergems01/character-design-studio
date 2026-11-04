/** Dependency-free, standards-compliant ZIP/store for browser-side batch exports (no server upload). */
export type ZipEntry={name:string;data:Blob|string|Uint8Array};
const encoder=new TextEncoder();
const table=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let n=0;n<8;n++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
const crc32=(data:Uint8Array)=>{let c=0xffffffff;for(const byte of data)c=(c>>>8)^table[(c^byte)&0xff];return (c^0xffffffff)>>>0;};
const write16=(buf:DataView,at:number,n:number)=>buf.setUint16(at,n,true);
const write32=(buf:DataView,at:number,n:number)=>buf.setUint32(at,n,true);

export async function makeZip(entries:ZipEntry[]):Promise<Blob>{
  if(entries.length>65535)throw new Error('ZIP รองรับไม่เกิน 65,535 รายการ');
  const locals:Uint8Array[]=[],central:Uint8Array[]=[];
  let offset=0;
  for(const entry of entries){
    if(entry.name.startsWith('/')||entry.name.includes('..')||entry.name.includes('\\'))throw new Error('Invalid ZIP path');
    const name=encoder.encode(entry.name);
    const data=typeof entry.data==='string'?encoder.encode(entry.data):entry.data instanceof Blob?new Uint8Array(await entry.data.arrayBuffer()):entry.data;
    if(data.length>=0xffffffff||offset>=0xffffffff)throw new Error('ZIP ใหญ่เกินไป');
    const crc=crc32(data);
    const local=new Uint8Array(30+name.length+data.length),h=new DataView(local.buffer);
    write32(h,0,0x04034b50);write16(h,4,20);write16(h,6,0x800);write16(h,8,0);
    write32(h,14,crc);write32(h,18,data.length);write32(h,22,data.length);write16(h,26,name.length);
    local.set(name,30);local.set(data,30+name.length);locals.push(local);
    const center=new Uint8Array(46+name.length),v=new DataView(center.buffer);
    write32(v,0,0x02014b50);write16(v,4,20);write16(v,6,20);write16(v,8,0x800);
    write32(v,16,crc);write32(v,20,data.length);write32(v,24,data.length);write16(v,28,name.length);write32(v,42,offset);
    center.set(name,46);central.push(center);offset+=local.length;
  }
  const centralSize=central.reduce((sum,c)=>sum+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  write32(e,0,0x06054b50);write16(e,8,entries.length);write16(e,10,entries.length);write32(e,12,centralSize);write32(e,16,offset);
  // ArrayBuffer-backed chunks sidestep newer TS BlobPart typing for Uint8Array<ArrayBufferLike>.
  const parts=[...locals,...central,end].map(bytes=>Uint8Array.from(bytes).buffer);
  return new Blob(parts,{type:'application/zip'});
}
