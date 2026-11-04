import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent as ReactDragEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Film, GripVertical, Grid2X2, ImagePlus, Images, Info, Pause, Play, Plus, RotateCcw, ScanEye, Trash2, Upload, X } from 'lucide-react';
import { clampPreviewCount, combinePreviewFrames, movePreviewFrame, orderedFrameNames, spriteCell } from '../lib/animation-preview';

type Raster={name:string;url:string;image:HTMLImageElement;width:number;height:number};
type SourceMode='individual'|'sheet';
type Anchor='bottom'|'center';
type FrameSource={id:number;raster:Raster;region:{x:number;y:number;width:number;height:number};sourceKind:SourceMode;displayName:string};
type ImportAction='append'|'replace';
const STAGE_WIDTH=850,STAGE_HEIGHT=600;
const emptySlots=(count:number)=>Array.from({length:count},(_,i)=>i);

async function readImage(file:File):Promise<Raster>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('รองรับ PNG, JPEG และ WebP');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('ไม่พบขนาดภาพ');
    return {name:file.name,url,image,width:image.naturalWidth,height:image.naturalHeight};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}

/** Uses the same source rectangle for both timeline and the large preview. */
function FrameThumb({source,index}:{source:FrameSource|null;index:number}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    ctx.clearRect(0,0,96,90);if(!source)return;
    const {width,height}=source.region,scale=Math.min(86/width,78/height);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(source.raster.image,source.region.x,source.region.y,width,height,(96-width*scale)/2,(90-height*scale)/2,width*scale,height*scale);
  },[source?.raster,source?.region.x,source?.region.y,source?.region.width,source?.region.height]);
  return <div className="ap-thumb"><canvas ref={ref} width={96} height={90} aria-label={`ตัวอย่างเฟรม ${index+1}`}/>{!source&&<ImagePlus size={21} className="ap-thumb-empty"/>}</div>;
}

export default function AnimationPreviewWorkspace({active=true}:{active?:boolean}){
  const [sourceMode,setSourceMode]=useState<SourceMode>('individual');
  const [frames,setFrames]=useState<(FrameSource|null)[]>([]);
  const framesRef=useRef<(FrameSource|null)[]>([]);
  const [frameCount,setFrameCount]=useState(8);
  const [columns,setColumns]=useState(4);
  const [rows,setRows]=useState(2);
  const [sheetImportCount,setSheetImportCount]=useState(8);
  const [lastSheet,setLastSheet]=useState<{name:string;width:number;height:number}|null>(null);
  const [fps,setFps]=useState(8);
  const [frameIndex,setFrameIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [loop,setLoop]=useState(true);
  const [anchor,setAnchor]=useState<Anchor>('bottom');
  const [zoom,setZoom]=useState(100);
  const [smooth,setSmooth]=useState(true);
  const [checker,setChecker]=useState(true);
  const [onion,setOnion]=useState(false);
  const [showGuides,setShowGuides]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const bulkInput=useRef<HTMLInputElement>(null);
  const sheetInput=useRef<HTMLInputElement>(null);
  const replaceInput=useRef<HTMLInputElement>(null);
  const replaceIndex=useRef(0);
  const importAction=useRef<ImportAction>('append');
  const generation=useRef(0);
  const nextFrameId=useRef(1);
  const countWasEdited=useRef(false);
  const [dragging,setDragging]=useState<number|null>(null);
  const draggingRef=useRef<number|null>(null);
  const [dropTarget,setDropTarget]=useState<{index:number;side:'before'|'after'}|null>(null);

  useEffect(()=>()=>{
    generation.current++;
    new Set(framesRef.current.flatMap(frame=>frame?[frame.raster.url]:[])).forEach(url=>URL.revokeObjectURL(url));
  },[]);

  useEffect(()=>{if(!active)setPlaying(false);},[active]);

  /** Shared timeline. A single Sprite Sheet URL may be referenced by many frames. */
  const commitFrames=(next:(FrameSource|null)[])=>{
    const oldUrls=new Set(framesRef.current.flatMap(frame=>frame?[frame.raster.url]:[]));
    const newUrls=new Set(next.flatMap(frame=>frame?[frame.raster.url]:[]));
    oldUrls.forEach(url=>{if(!newUrls.has(url))URL.revokeObjectURL(url);});
    framesRef.current=next;setFrames(next);
  };
  const openImport=(action:ImportAction,kind:SourceMode)=>{
    if(action==='replace'&&framesRef.current.some(Boolean)&&!window.confirm('นำเข้าชุดใหม่แทนที่รูปทุกเฟรมใน Timeline ใช่หรือไม่?'))return;
    importAction.current=action;
    (kind==='individual'?bulkInput:sheetInput).current?.click();
  };
  const commitImported=(incoming:FrameSource[],action:ImportAction)=>{
    const old=action==='replace'?[]:framesRef.current;
    const remaining=Math.max(0,256-old.length);
    const used=incoming.slice(0,remaining),ignored=incoming.slice(remaining);
    const existingUrls=new Set(old.flatMap(frame=>frame?[frame.raster.url]:[]));
    new Set(ignored.map(frame=>frame.raster.url)).forEach(url=>{if(!existingUrls.has(url)&&!used.some(f=>f.raster.url===url))URL.revokeObjectURL(url);});
    if(!used.length)return 0;
    const next=combinePreviewFrames(framesRef.current,used,action);
    const insertFrom=action==='append'?framesRef.current.length:0;
    if(action==='replace')countWasEdited.current=false;
    commitFrames(next);setFrameCount(prev=>countWasEdited.current?Math.max(prev,next.length):clampPreviewCount(next.length));
    setFrameIndex(Math.min(255,insertFrom));setPlaying(false);
    return used.length;
  };
  const newFrame=(raster:Raster,kind:SourceMode,region:FrameSource['region'],label:string):FrameSource=>({id:nextFrameId.current++,raster,region,sourceKind:kind,displayName:label});

  const takeImages=async(event:ChangeEvent<HTMLInputElement>)=>{
    const files=orderedFrameNames(Array.from(event.currentTarget.files??[]).filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type))).slice(0,256);
    event.currentTarget.value='';if(!files.length)return;
    const token=++generation.current,action=importAction.current;
    setPlaying(false);setBusy(true);setMessage('กำลังอ่านรูปเพื่อเพิ่มใน Timeline…');
    const results=await Promise.allSettled(files.map(readImage));
    const loaded=results.filter((result):result is PromiseFulfilledResult<Raster>=>result.status==='fulfilled').map(result=>result.value);
    if(token!==generation.current){loaded.forEach(r=>URL.revokeObjectURL(r.url));return;}
    const entries=loaded.map(image=>newFrame(image,'individual',{x:0,y:0,width:image.width,height:image.height},image.name));
    const accepted=commitImported(entries,action);
    setBusy(false);
    if(action==='replace'&&accepted)setLastSheet(null);
    setMessage(accepted?`${action==='append'?'เพิ่ม':'แทนที่ทั้งหมดด้วย'} ${accepted} ภาพ · ${accepted<files.length?'บางรูปเกินขีดจำกัด 256 เฟรม หรือเปิดไม่ได้':'เรียงลำดับตามชื่อไฟล์'}`:loaded.length?'ไม่พบช่องว่างสำหรับเพิ่มรูปแล้ว (สูงสุด 256 เฟรม)':'ไม่สามารถเปิดไฟล์รูปที่เลือกได้');
  };

  const replaceFrame=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
    const target=replaceIndex.current,token=generation.current;
    try{
      const raster=await readImage(file);
      if(token!==generation.current){URL.revokeObjectURL(raster.url);return;}
      const next=Array.from({length:Math.max(framesRef.current.length,target+1)},(_,index)=>framesRef.current[index]??null);
      next[target]=newFrame(raster,'individual',{x:0,y:0,width:raster.width,height:raster.height},raster.name);
      commitFrames(next);setFrameIndex(target);setPlaying(false);
      setMessage(`แทนที่เฟรม ${target+1} ด้วย ${file.name} แล้ว`);
    }catch{setMessage('ไฟล์นี้ไม่สามารถเปิดเป็นรูปภาพได้');}
  };

  const takeSheet=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
    const token=++generation.current,action=importAction.current;
    setBusy(true);setPlaying(false);setMessage('กำลังแบ่งช่อง Sprite Sheet…');
    try{
      const raster=await readImage(file);
      if(token!==generation.current){URL.revokeObjectURL(raster.url);return;}
      const count=Math.min(columns*rows,sheetImportCount,256);
      const entries=Array.from({length:count},(_,index)=>{
        const region=spriteCell(raster.width,raster.height,columns,rows,index);
        return region?newFrame(raster,'sheet',region,`${raster.name} · ช่อง ${index+1}`):null;
      }).filter((frame):frame is FrameSource=>frame!==null);
      const accepted=commitImported(entries,action);
      if(!accepted)URL.revokeObjectURL(raster.url);
      if(accepted)setLastSheet({name:raster.name,width:raster.width,height:raster.height});
      setBusy(false);
      setMessage(accepted?`${action==='append'?'เพิ่ม':'แทนที่ Timeline ด้วย'} ${accepted} เฟรมจาก ${raster.name} แล้ว`:'ไม่มีช่องว่างเพียงพอสำหรับ Sprite Sheet นี้');
    }catch{if(token===generation.current){setBusy(false);setMessage('ไม่สามารถอ่านภาพ Sprite Sheet ได้');}}
  };

  const resolveFrame=(index:number):FrameSource|null=>frames[index]??null;
  const current=resolveFrame(frameIndex),previous=resolveFrame(frameIndex===0?frameCount-1:frameIndex-1);
  const available=frames.slice(0,frameCount).filter(Boolean).length;
  const sheetCapacity=columns*rows;

  useEffect(()=>{
    if(!playing||!available||frameCount<=1)return;
    let animationId=0,last=0,elapsed=0;
    const tick=(time:number)=>{
      if(!last)last=time;
      elapsed+=Math.min(300,time-last);last=time;
      const duration=1000/fps;
      if(elapsed>=duration){
        const steps=Math.floor(elapsed/duration);elapsed%=duration;
        setFrameIndex(index=>{
          const next=loop?(index+steps)%frameCount:Math.min(frameCount-1,index+steps);
          return next;
        });
      }
      animationId=requestAnimationFrame(tick);
    };
    animationId=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(animationId);
  },[playing,available,frameCount,fps,loop]);

  useEffect(()=>{if(playing&&!loop&&frameIndex===frameCount-1)setPlaying(false);},[playing,loop,frameIndex,frameCount]);

  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    ctx.clearRect(0,0,STAGE_WIDTH,STAGE_HEIGHT);
    const draw=(source:FrameSource,opacity=1)=>{
      const {width,height}=source.region;
      const scale=Math.min((STAGE_WIDTH-110)/width,(STAGE_HEIGHT-70)/height)*zoom/100;
      const drawW=width*scale,drawH=height*scale;
      const x=(STAGE_WIDTH-drawW)/2,y=anchor==='bottom'?STAGE_HEIGHT-34-drawH:(STAGE_HEIGHT-drawH)/2;
      ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=smooth;
      ctx.drawImage(source.raster.image,source.region.x,source.region.y,width,height,x,y,drawW,drawH);
      ctx.globalAlpha=1;
    };
    if(onion&&previous)draw(previous,.25);
    if(current)draw(current);
    if(showGuides){
      ctx.save();ctx.strokeStyle='rgba(161,245,210,.47)';ctx.lineWidth=1.5;ctx.setLineDash([7,7]);
      ctx.beginPath();ctx.moveTo(STAGE_WIDTH/2,0);ctx.lineTo(STAGE_WIDTH/2,STAGE_HEIGHT);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,STAGE_HEIGHT-34);ctx.lineTo(STAGE_WIDTH,STAGE_HEIGHT-34);ctx.stroke();ctx.restore();
    }
  },[current?.raster,current?.region.x,current?.region.y,current?.region.width,current?.region.height,previous?.raster,previous?.region.x,previous?.region.y,previous?.region.width,previous?.region.height,zoom,smooth,anchor,onion,showGuides]);

  const chooseMode=(next:SourceMode)=>{setSourceMode(next);setPlaying(false);setMessage('');};
  const setCount=(v:number)=>{countWasEdited.current=true;const count=clampPreviewCount(v);setFrameCount(count);setFrameIndex(i=>Math.min(i,count-1));};
  const goFrame=(index:number)=>{setFrameIndex(Math.max(0,Math.min(frameCount-1,index)));};
  const swapSelected=(delta:number)=>{
    const target=frameIndex+delta;
    if(target<0||target>=frameCount)return;
    const next=Array.from({length:Math.max(frameCount,framesRef.current.length)},(_,index)=>framesRef.current[index]??null);
    [next[frameIndex],next[target]]=[next[target],next[frameIndex]];
    commitFrames(next);setFrameIndex(target);setPlaying(false);
    setMessage(`สลับลำดับเฟรม ${frameIndex+1} กับ ${target+1} แล้ว`);
  };
  const removeFrame=(index:number)=>{
    const next=[...framesRef.current];if(!next[index])return;
    next.splice(index,1);commitFrames(next);
    setFrameCount(clampPreviewCount(next.length));
    setFrameIndex(Math.min(index,Math.max(0,next.length-1)));setPlaying(false);
    setMessage(`ลบเฟรม ${index+1} ออกจาก Timeline แล้ว · เฟรมที่เหลือเลื่อนเข้ามาแทน`);
  };
  const clearAll=()=>{
    if(!framesRef.current.some(Boolean))return;
    if(!window.confirm('ล้างรูปทั้งหมดใน Animation Timeline? จะต้องนำเข้ารูปใหม่อีกครั้ง'))return;
    generation.current++;commitFrames([]);setFrameCount(8);setFrameIndex(0);setPlaying(false);setBusy(false);
    countWasEdited.current=false;setLastSheet(null);setMessage('ล้างรูปทุกเฟรมแล้ว พร้อมนำเข้าชุดใหม่');
  };
  const startDragging=(event:ReactDragEvent<HTMLDivElement>,index:number)=>{
    if(!frames[index])return;
    draggingRef.current=index;setDragging(index);setPlaying(false);
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));
  };
  const overFrame=(event:ReactDragEvent<HTMLDivElement>,index:number)=>{
    if(draggingRef.current===null)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    const rect=event.currentTarget.getBoundingClientRect();
    const side=event.clientX<rect.left+rect.width/2?'before':'after';
    setDropTarget(prev=>prev?.index===index&&prev.side===side?prev:{index,side});
  };
  const finishDragging=()=>{draggingRef.current=null;setDragging(null);setDropTarget(null);};
  const dropFrame=(event:ReactDragEvent<HTMLDivElement>,index:number)=>{
    event.preventDefault();
    const from=draggingRef.current;if(from===null||from>=frameCount){finishDragging();return;}
    const rect=event.currentTarget.getBoundingClientRect();
    const side=event.clientX<rect.left+rect.width/2?'before':'after';
    const visible=Array.from({length:frameCount},(_,i)=>framesRef.current[i]??null);
    const hidden=framesRef.current.slice(frameCount);
    const result=movePreviewFrame(visible,from,index+(side==='after'?1:0));
    commitFrames([...result.frames,...hidden]);setFrameIndex(result.index);
    setMessage(`ย้ายภาพจากเฟรม ${from+1} ไปตำแหน่ง ${result.index+1} แล้ว`);
    finishDragging();
  };
  const togglePlay=()=>{if(!available)return;if(!loop&&frameIndex>=frameCount-1)setFrameIndex(0);setPlaying(v=>!v);};
  const resetAll=()=>{setPlaying(false);goFrame(0);};

  return <section className="ap-workspace" aria-label="Animation Preview — พรีวิวสไปรต์แยกจาก Rig">
    <input ref={bulkInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{void takeImages(e);}}/>
    <input ref={sheetInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{void takeSheet(e);}}/>
    <input ref={replaceInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{void replaceFrame(e);}}/>

    <div className="ap-heading"><div className="ap-heading-mark"><Film size={23}/></div><div><span className="ap-eyebrow">INDEPENDENT SPRITE PLAYER</span><h1>Animation Preview <span>ภาพเฟรมสำเร็จรูป</span></h1><p>ตรวจการเดิน วิ่ง หรือ Action จากภาพที่สร้างไว้แล้ว โดยไม่ใช้ Bone, Mask หรือข้อมูล Rig</p></div><div className="ap-heading-stats"><span>{sourceMode==='individual'?'MULTI PNG':'SPRITE SHEET'}</span><strong>{frameCount} FRAMES <i/> {fps} FPS</strong></div></div>

    <div className="ap-layout">
      <div className="ap-theater">
        <div className="ap-preview-toolbar"><strong><ScanEye size={17}/> LIVE MOTION PREVIEW</strong><span>FRAME {frameIndex+1} / {frameCount}</span><div className="ap-view-toggles"><label><input type="checkbox" checked={checker} onChange={e=>setChecker(e.target.checked)}/> Checker</label><label><input type="checkbox" checked={onion} onChange={e=>setOnion(e.target.checked)}/> Onion skin</label><label><input type="checkbox" checked={showGuides} onChange={e=>setShowGuides(e.target.checked)}/> Guide</label></div></div>
        <div className={`ap-stage ${checker?'ap-checker-on':''}`} tabIndex={0} onKeyDown={event=>{
          if(event.key==='ArrowLeft'){event.preventDefault();setPlaying(false);goFrame(frameIndex-1);}
          if(event.key==='ArrowRight'){event.preventDefault();setPlaying(false);goFrame(frameIndex+1);}
          if(event.key===' '){event.preventDefault();togglePlay();}
        }} aria-label="พรีวิวรูปภาพ กด Space เพื่อเล่นหรือหยุด และลูกศรเพื่อเปลี่ยนเฟรม">
          <canvas ref={canvasRef} width={STAGE_WIDTH} height={STAGE_HEIGHT}/>
          {!current&&<div className="ap-stage-empty"><div><Images size={32}/></div><h3>{available?`ยังไม่มีรูปสำหรับเฟรม ${frameIndex+1}`:'นำเข้ารูปเพื่อดู Animation'}</h3><p>{sourceMode==='individual'?'เลือกภาพหลายไฟล์ หรือกดที่ช่องเฟรมด้านล่างเพื่อใส่รูปแยก':'นำเข้า Sprite Sheet และกำหนดคอลัมน์กับแถวที่ต้องการแบ่ง'}</p><button onClick={()=>openImport('append',sourceMode)}><Upload size={15}/> เพิ่มรูปเข้า Timeline</button></div>}
          <span className="ap-stage-tag">{current?`${current.region.width} × ${current.region.height} px`:'NO FRAME'} <span>·</span> {anchor==='bottom'?'BOTTOM ALIGN':'CENTER ALIGN'}</span>
        </div>
        <div className="ap-playback"><div className="ap-transport"><button aria-label="เฟรมก่อนหน้า" disabled={!available} onClick={()=>{setPlaying(false);goFrame(frameIndex-1);}}><ChevronLeft size={22}/></button><button className="ap-play-button" disabled={!available||busy} onClick={togglePlay}>{playing?<><Pause size={19} fill="currentColor"/> หยุด</>:<><Play size={19} fill="currentColor"/> เล่น</>}</button><button aria-label="เฟรมถัดไป" disabled={!available} onClick={()=>{setPlaying(false);goFrame(frameIndex+1);}}><ChevronRight size={22}/></button><button aria-label="เริ่มต้นใหม่" disabled={!available} onClick={resetAll}><RotateCcw size={17}/></button></div><div className="ap-speed"><label htmlFor="ap-fps-slider">ความเร็ว <strong>{fps} FPS</strong></label><input id="ap-fps-slider" type="range" min="1" max="60" value={fps} onChange={e=>setFps(Number(e.target.value))}/><span>{(1000/fps).toFixed(0)} ms / เฟรม</span></div><label className="ap-loop"><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> Loop</label></div>
        <div className="ap-timeline-head"><div><strong>FRAME STRIP</strong><span>คลิกเพื่อดูเฟรม · จับลากการ์ดเพื่อแทรกก่อน/หลัง · กด × เพื่อลบ</span></div><span>{available} พร้อมใช้งาน</span></div>
        <div className="ap-timeline">{emptySlots(frameCount).map(index=>{const frame=resolveFrame(index);return <div key={frame?.id??`blank-${index}`} draggable={Boolean(frame)} onDragStart={e=>startDragging(e,index)} onDragOver={e=>overFrame(e,index)} onDrop={e=>dropFrame(e,index)} onDragEnd={finishDragging}
          className={`ap-frame-tile ${frameIndex===index?'selected':''} ${frame?'filled':'missing'} ${dragging===index?'dragging':''} ${dropTarget?.index===index?`drop-${dropTarget.side}`:''}`} title={frame?`${index+1}: ${frame.displayName} (ลากเพื่อจัดลำดับ)`:`เฟรม ${index+1} ยังว่าง`}>
          <button className="ap-frame-select" onClick={()=>{setPlaying(false);goFrame(index);}} aria-label={`ดูเฟรม ${index+1}${frame?` ${frame.displayName}`:' (ว่าง)'}`}><FrameThumb index={index} source={frame}/><span>{String(index+1).padStart(2,'0')}{frame?<GripVertical size={13}/>:<ImagePlus size={12}/>}</span></button>
          {frame&&<button className="ap-tile-remove" onClick={e=>{e.stopPropagation();removeFrame(index);}} title={`ลบเฟรม ${index+1}`} aria-label={`ลบเฟรม ${index+1}`}><X size={14}/></button>}
        </div>;})}</div>
      </div>

      <aside className="ap-inspector"><div className="ap-panel-top"><h2><Grid2X2 size={18}/> Input & Slicing</h2><span>NO RIG REQUIRED</span></div>
        <div className="ap-panel-body"><div className="ap-input-mode"><button className={sourceMode==='individual'?'active':''} onClick={()=>chooseMode('individual')}><Images size={16}/> หลายรูป</button><button className={sourceMode==='sheet'?'active':''} onClick={()=>chooseMode('sheet')}><Grid2X2 size={16}/> Sprite Sheet</button></div>
          {sourceMode==='individual'?<div className="ap-upload-section">
            <h3>01 — นำเข้า PNG ทีละเฟรม</h3>
            <p>เลือกได้หลายครั้ง ระบบเรียงรูปตามชื่อไฟล์ เช่น <code>walk_1.png</code> … <code>walk_8.png</code> และต่อเข้ากับเฟรมเดิมได้</p>
            <button className="ap-upload-main" disabled={busy||framesRef.current.length>=256} onClick={()=>openImport('append','individual')}><Plus size={18}/> เพิ่มรูปเข้าชุดปัจจุบัน</button>
            <button className="ap-replace-main" disabled={busy} onClick={()=>openImport('replace','individual')}><Upload size={15}/> นำเข้าชุดใหม่ (แทนที่ทั้งหมด)</button>
            <div className="ap-source-state"><span>รวมทุกแหล่ง</span><strong>{frames.filter(Boolean).length} ภาพ</strong></div>
            <div className="ap-edit-slots">
              <div><strong>แทนรูปเฉพาะเฟรม</strong><small>เลือกหมายเลขเพื่อใส่ PNG ใหม่</small></div>
              <div className="ap-slot-grid">{emptySlots(Math.min(frameCount,64)).map(index=><button key={index} className={frames[index]?'filled':''} onClick={()=>{replaceIndex.current=index;replaceInput.current?.click();}} title={frames[index]?.displayName??`ใส่รูปเฟรม ${index+1}`}><span>{index+1}</span>{frames[index]?<Check size={12}/>:<ImagePlus size={12}/>}</button>)}</div>
              {frameCount>64&&<small className="ap-muted">แสดงช่องแก้ไข 64 เฟรมแรก; เลื่อนดูทุกเฟรมใน Timeline ด้านซ้ายได้</small>}
            </div>
          </div>:<div className="ap-upload-section">
            <h3>01 — นำเข้า Sprite Sheet</h3>
            <p>ตั้งกริดสำหรับ <strong>ชีตที่จะนำเข้าครั้งนี้</strong> เช่น 4×2 มี 8 ช่อง แต่เลือกเพิ่มเพียง 6 ช่องได้ นำเข้าชีตอื่นเพิ่มภายหลังได้อีก</p>
            <div className="ap-grid-numbers">
              <label>คอลัมน์ (แนวนอน)<input aria-label="จำนวนคอลัมน์ Sprite Sheet" type="number" min="1" max="64" value={columns} onChange={e=>setColumns(clampPreviewCount(Number(e.target.value),64))}/></label>
              <label>แถว (แนวตั้ง)<input aria-label="จำนวนแถว Sprite Sheet" type="number" min="1" max="64" value={rows} onChange={e=>setRows(clampPreviewCount(Number(e.target.value),64))}/></label>
            </div>
            <label className="ap-sheet-count-label">จำนวนช่องจากชีตที่จะเพิ่ม<input aria-label="จำนวนช่องที่นำเข้าจาก Sprite Sheet" type="number" min="1" max={Math.min(256,sheetCapacity)} value={Math.min(sheetImportCount,sheetCapacity,256)} onChange={e=>setSheetImportCount(Math.min(256,sheetCapacity,clampPreviewCount(Number(e.target.value))))}/></label>
            <div className="ap-source-state"><span>กริดทั้งหมด</span><strong>{sheetCapacity} ช่อง</strong></div>
            {sheetCapacity<=128&&<div className="ap-sheet-map" style={{gridTemplateColumns:`repeat(${Math.min(columns,32)},minmax(0,1fr))`}}>{Array.from({length:sheetCapacity},(_,index)=><span key={index} className={index<Math.min(sheetImportCount,256)?'used':'unused'}>{index+1}</span>)}</div>}
            <button className="ap-upload-main" disabled={busy||framesRef.current.length>=256} onClick={()=>openImport('append','sheet')}><Plus size={18}/> เพิ่มเฟรมจาก Sprite Sheet</button>
            <button className="ap-replace-main" disabled={busy} onClick={()=>openImport('replace','sheet')}><Upload size={15}/> ใช้ชีตใหม่แทนที่ทั้งหมด</button>
            {lastSheet&&<div className="ap-sheet-file"><ImagePlus size={16}/><div><strong title={lastSheet.name}>นำเข้าล่าสุด: {lastSheet.name}</strong><small>{lastSheet.width} × {lastSheet.height} px</small></div></div>}
            <p className="ap-muted">กริดและจำนวนช่องมีผลเฉพาะรอบนำเข้าใหม่ เฟรมจากชีตเก่าที่อยู่ใน Timeline จะไม่ถูกตัดซ้ำ</p>
          </div>}
          <div className="ap-reorder"><strong>จัดการเฟรมใน Timeline</strong><div><button disabled={frameIndex<=0} onClick={()=>swapSelected(-1)}><ArrowLeft size={14}/> สลับซ้าย</button><button disabled={frameIndex>=frameCount-1} onClick={()=>swapSelected(1)}>สลับขวา <ArrowRight size={14}/></button></div><button className="ap-delete-current" disabled={!current} onClick={()=>removeFrame(frameIndex)}><Trash2 size={14}/> ลบเฟรมที่เลือก</button><button className="ap-clear-all" disabled={!frames.some(Boolean)} onClick={clearAll}><RotateCcw size={14}/> ล้างทุกเฟรม</button></div>
          <div className="ap-settings"><h3>02 — จำนวนเฟรมและเวลา</h3><label>จำนวนเฟรมที่ใช้จริง<input aria-label="จำนวนเฟรมที่ใช้จริง" type="number" min="1" max="256" value={frameCount} onChange={e=>setCount(Number(e.target.value))}/></label><label>ความเร็วภาพต่อวินาที (FPS)<input aria-label="จำนวน FPS" type="number" min="1" max="60" value={fps} onChange={e=>setFps(Math.min(60,Math.max(1,Number(e.target.value)||1)))}/></label></div>
          <details className="ap-advanced"><summary><Eye size={16}/> ตั้งค่าการแสดงผล</summary><div><label>จุดจัดแนวภาพ<select value={anchor} onChange={e=>setAnchor(e.target.value as Anchor)}><option value="bottom">ล่างกึ่งกลาง (เท้าตรงกัน)</option><option value="center">กึ่งกลางภาพ</option></select></label><label>ขนาดพรีวิว <strong>{zoom}%</strong><input type="range" min="25" max="250" step="5" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><label className="ap-check"><input type="checkbox" checked={smooth} onChange={e=>setSmooth(e.target.checked)}/> Smooth Image (ปิดเพื่อดูพิกเซลคม)</label></div></details>
          <div className="ap-note"><Info size={16}/><p>เครื่องมือนี้แสดงภาพที่นำเข้าเท่านั้น <strong>ไม่สร้าง Pose ไม่ย้าย Bone และไม่เปลี่ยนพิกเซลภาพ</strong> ช่วยตรวจความลื่นของการเดิน ความต่างของขนาด และรอยกระโดดระหว่างเฟรม</p></div>
          {message&&<div className="ap-message" role="status">{message}<button aria-label="ปิดข้อความ" onClick={()=>setMessage('')}><X size={14}/></button></div>}
        </div>
      </aside>
    </div>
    <div className="ap-footer"><span><ArrowLeft size={14}/> STEP THROUGH</span><span><ArrowRight size={14}/> SPACE TO PLAY</span><span>FRAME-BY-FRAME REVIEW <i/> 1–60 FPS</span></div>
  </section>;
}
