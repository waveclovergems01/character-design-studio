import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Film, Grid2X2, ImagePlus, Images, Info, Pause, Play, RotateCcw, ScanEye, Upload, X } from 'lucide-react';
import { clampPreviewCount, orderedFrameNames, spriteCell } from '../lib/animation-preview';

type Raster={name:string;url:string;image:HTMLImageElement;width:number;height:number};
type SourceMode='individual'|'sheet';
type Anchor='bottom'|'center';
type FrameSource={raster:Raster;region:{x:number;y:number;width:number;height:number}};
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
  const [imageFrames,setImageFrames]=useState<(Raster|null)[]>([]);
  const framesRef=useRef<(Raster|null)[]>([]);
  const [sheet,setSheet]=useState<Raster|null>(null);
  const sheetRef=useRef<Raster|null>(null);
  const [frameCount,setFrameCount]=useState(8);
  const [columns,setColumns]=useState(4);
  const [rows,setRows]=useState(2);
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
  const generation=useRef(0);
  const sheetGeneration=useRef(0);
  const countWasEdited=useRef(false);

  useEffect(()=>()=>{
    generation.current++;
    sheetGeneration.current++;
    framesRef.current.forEach(r=>{if(r)URL.revokeObjectURL(r.url);});
    if(sheetRef.current)URL.revokeObjectURL(sheetRef.current.url);
  },[]);

  useEffect(()=>{if(!active)setPlaying(false);},[active]);

  const takeImages=async(event:ChangeEvent<HTMLInputElement>)=>{
    const files=orderedFrameNames(Array.from(event.currentTarget.files??[]).filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type))).slice(0,256);
    event.currentTarget.value='';if(!files.length)return;
    const token=++generation.current;setPlaying(false);setBusy(true);setMessage('กำลังอ่านรูปแต่ละเฟรม…');
    const results=await Promise.allSettled(files.map(readImage));
    const loaded=results.filter((result):result is PromiseFulfilledResult<Raster>=>result.status==='fulfilled').map(result=>result.value);
    if(token!==generation.current){loaded.forEach(r=>URL.revokeObjectURL(r.url));return;}
    framesRef.current.forEach(r=>{if(r)URL.revokeObjectURL(r.url);});
    framesRef.current=loaded;setImageFrames(loaded);if(!countWasEdited.current)setFrameCount(clampPreviewCount(loaded.length));setFrameIndex(0);setBusy(false);
    setMessage(loaded.length===files.length?`นำเข้าสำเร็จ ${loaded.length} ภาพ · เรียงตามเลขในชื่อไฟล์`:`นำเข้าได้ ${loaded.length}/${files.length} ภาพ · ตรวจไฟล์ที่เปิดไม่ได้`);
  };

  const replaceFrame=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
    const target=replaceIndex.current;
    try{
      const image=await readImage(file),next=[...framesRef.current];
      if(next[target])URL.revokeObjectURL(next[target]!.url);
      next[target]=image;framesRef.current=next;setImageFrames(next);setFrameIndex(target);setPlaying(false);
      setMessage(`กำหนด ${file.name} เป็นเฟรม ${target+1} แล้ว`);
    }catch{setMessage('ไฟล์นี้ไม่สามารถเปิดเป็นรูปภาพได้');}
  };

  const takeSheet=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
    const token=++sheetGeneration.current;
    try{
      setBusy(true);setPlaying(false);
      const loaded=await readImage(file);
      if(token!==sheetGeneration.current){URL.revokeObjectURL(loaded.url);return;}
      if(sheetRef.current)URL.revokeObjectURL(sheetRef.current.url);
      sheetRef.current=loaded;setSheet(loaded);setFrameIndex(0);setBusy(false);
      setMessage(`เปิด Sprite Sheet ${file.name} (${loaded.width} × ${loaded.height} px) แล้ว`);
    }catch{setBusy(false);setMessage('ไม่สามารถอ่านภาพ Sprite Sheet ได้');}
  };

  const resolveFrame=(index:number):FrameSource|null=>{
    if(sourceMode==='individual'){
      const raster=imageFrames[index];return raster?{raster,region:{x:0,y:0,width:raster.width,height:raster.height}}:null;
    }
    if(!sheet)return null;
    const region=spriteCell(sheet.width,sheet.height,columns,rows,index);
    return region?{raster:sheet,region}:null;
  };

  const current=resolveFrame(frameIndex),previous=resolveFrame(frameIndex===0?frameCount-1:frameIndex-1);
  const available=sourceMode==='individual'?imageFrames.slice(0,frameCount).filter(Boolean).length:sheet?Math.min(frameCount,columns*rows):0;
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

  const chooseMode=(next:SourceMode)=>{setSourceMode(next);setPlaying(false);setFrameIndex(0);setMessage('');};
  const setCount=(v:number)=>{countWasEdited.current=true;const count=clampPreviewCount(v);setFrameCount(count);setFrameIndex(i=>Math.min(i,count-1));};
  const goFrame=(index:number)=>{setFrameIndex(Math.max(0,Math.min(frameCount-1,index)));};
  const swapSelected=(delta:number)=>{
    const target=frameIndex+delta;
    if(target<0||target>=frameCount)return;
    const next=[...framesRef.current];[next[frameIndex],next[target]]=[next[target]??null,next[frameIndex]??null];
    framesRef.current=next;setImageFrames(next);setFrameIndex(target);setPlaying(false);
    setMessage(`สลับลำดับเฟรม ${frameIndex+1} กับ ${target+1} แล้ว`);
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
        <div className={`ap-stage ${checker?'checker':''}`} tabIndex={0} onKeyDown={event=>{
          if(event.key==='ArrowLeft'){event.preventDefault();setPlaying(false);goFrame(frameIndex-1);}
          if(event.key==='ArrowRight'){event.preventDefault();setPlaying(false);goFrame(frameIndex+1);}
          if(event.key===' '){event.preventDefault();togglePlay();}
        }} aria-label="พรีวิวรูปภาพ กด Space เพื่อเล่นหรือหยุด และลูกศรเพื่อเปลี่ยนเฟรม">
          <canvas ref={canvasRef} width={STAGE_WIDTH} height={STAGE_HEIGHT}/>
          {!current&&<div className="ap-stage-empty"><div><Images size={32}/></div><h3>{available?`ยังไม่มีรูปสำหรับเฟรม ${frameIndex+1}`:'นำเข้ารูปเพื่อดู Animation'}</h3><p>{sourceMode==='individual'?'เลือกภาพหลายไฟล์ หรือกดที่ช่องเฟรมด้านล่างเพื่อใส่รูปแยก':'นำเข้า Sprite Sheet และกำหนดคอลัมน์กับแถวที่ต้องการแบ่ง'}</p><button onClick={()=>sourceMode==='individual'?bulkInput.current?.click():sheetInput.current?.click()}><Upload size={15}/> นำเข้ารูป</button></div>}
          <span className="ap-stage-tag">{current?`${current.region.width} × ${current.region.height} px`:'NO FRAME'} <span>·</span> {anchor==='bottom'?'BOTTOM ALIGN':'CENTER ALIGN'}</span>
        </div>
        <div className="ap-playback"><div className="ap-transport"><button aria-label="เฟรมก่อนหน้า" disabled={!available} onClick={()=>{setPlaying(false);goFrame(frameIndex-1);}}><ChevronLeft size={22}/></button><button className="ap-play-button" disabled={!available||busy} onClick={togglePlay}>{playing?<><Pause size={19} fill="currentColor"/> หยุด</>:<><Play size={19} fill="currentColor"/> เล่น</>}</button><button aria-label="เฟรมถัดไป" disabled={!available} onClick={()=>{setPlaying(false);goFrame(frameIndex+1);}}><ChevronRight size={22}/></button><button aria-label="เริ่มต้นใหม่" disabled={!available} onClick={resetAll}><RotateCcw size={17}/></button></div><div className="ap-speed"><label htmlFor="ap-fps-slider">ความเร็ว <strong>{fps} FPS</strong></label><input id="ap-fps-slider" type="range" min="1" max="60" value={fps} onChange={e=>setFps(Number(e.target.value))}/><span>{(1000/fps).toFixed(0)} ms / เฟรม</span></div><label className="ap-loop"><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> Loop</label></div>
        <div className="ap-timeline-head"><div><strong>FRAME STRIP</strong><span>คลิกเพื่อหยุดที่เฟรมที่ต้องการ · เลื่อนดูตามแนวนอน</span></div><span>{available} พร้อมใช้งาน</span></div>
        <div className="ap-timeline">{emptySlots(frameCount).map(index=>{const frame=resolveFrame(index);return <button key={index} className={`ap-frame-tile ${frameIndex===index?'selected':''} ${frame?'filled':'missing'}`} onClick={()=>{setPlaying(false);goFrame(index);}} title={frame?`${index+1}: ${frame.raster.name}`:`เฟรม ${index+1} ยังว่าง`}><FrameThumb index={index} source={frame}/><span>{String(index+1).padStart(2,'0')}{frame?<Check size={13}/>:<ImagePlus size={12}/>}</span></button>;})}</div>
      </div>

      <aside className="ap-inspector"><div className="ap-panel-top"><h2><Grid2X2 size={18}/> Input & Slicing</h2><span>NO RIG REQUIRED</span></div>
        <div className="ap-panel-body"><div className="ap-input-mode"><button className={sourceMode==='individual'?'active':''} onClick={()=>chooseMode('individual')}><Images size={16}/> หลายรูป</button><button className={sourceMode==='sheet'?'active':''} onClick={()=>chooseMode('sheet')}><Grid2X2 size={16}/> Sprite Sheet</button></div>
          {sourceMode==='individual'?<div className="ap-upload-section">
            <h3>01 — นำเข้า PNG ทีละเฟรม</h3>
            <p>เลือกรูปทั้งหมดในครั้งเดียว ระบบจัดลำดับตามหมายเลขชื่อไฟล์ เช่น <code>walk_1.png</code> … <code>walk_8.png</code></p>
            <button className="ap-upload-main" disabled={busy} onClick={()=>bulkInput.current?.click()}><Upload size={18}/> {imageFrames.filter(Boolean).length?'นำเข้าชุดรูปใหม่':'เลือกรูปหลายไฟล์'}</button>
            <div className="ap-source-state"><span>รูปที่โหลด</span><strong>{imageFrames.filter(Boolean).length} ภาพ</strong></div>
            <div className="ap-edit-slots">
              <div><strong>จัดการแต่ละเฟรม</strong><small>เลือกรูปใหม่แทนช่องที่ต้องการ</small></div>
              <div className="ap-slot-grid">{emptySlots(Math.min(frameCount,64)).map(index=><button key={index} className={imageFrames[index]?'filled':''} onClick={()=>{replaceIndex.current=index;replaceInput.current?.click();}} title={imageFrames[index]?.name??`ใส่รูปเฟรม ${index+1}`}><span>{index+1}</span>{imageFrames[index]?<Check size={12}/>:<ImagePlus size={12}/>}</button>)}</div>
              {frameCount>64&&<small className="ap-muted">แสดงช่องแก้ไข 64 เฟรมแรก; เลื่อนดูทุกเฟรมใน Timeline ด้านซ้ายได้</small>}
            </div>
          </div>:<div className="ap-upload-section">
            <h3>01 — นำเข้า Sprite Sheet</h3>
            <p>ภาพเดียวมีหลายเฟรม เช่น 4 คอลัมน์ × 2 แถว = 8 ช่อง (หรือใช้เพียง 6 ช่องก็ได้)</p>
            <button className="ap-upload-main" disabled={busy} onClick={()=>sheetInput.current?.click()}><Upload size={18}/> {sheet?'เปลี่ยน Sprite Sheet':'เลือกภาพ Sprite Sheet'}</button>
            {sheet&&<div className="ap-sheet-file"><ImagePlus size={16}/><div><strong title={sheet.name}>{sheet.name}</strong><small>{sheet.width} × {sheet.height} px</small></div></div>}
            <div className="ap-grid-numbers">
              <label>คอลัมน์ (แนวนอน)<input aria-label="จำนวนคอลัมน์ Sprite Sheet" type="number" min="1" max="64" value={columns} onChange={e=>setColumns(clampPreviewCount(Number(e.target.value),64))}/></label>
              <label>แถว (แนวตั้ง)<input aria-label="จำนวนแถว Sprite Sheet" type="number" min="1" max="64" value={rows} onChange={e=>setRows(clampPreviewCount(Number(e.target.value),64))}/></label>
            </div>
            <div className="ap-source-state"><span>ช่องทั้งหมด</span><strong>{sheetCapacity} ช่อง</strong></div>
            {sheet&&columns<=32&&rows<=16&&<div className="ap-sheet-map" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>{Array.from({length:sheetCapacity},(_,index)=><button key={index} disabled={index>=frameCount} className={`${index===frameIndex?'active':''} ${index>=frameCount?'unused':''}`} onClick={()=>{setPlaying(false);goFrame(index);}} title={`แถว ${Math.floor(index/columns)+1}, คอลัมน์ ${index%columns+1}`}>{index+1}</button>)}</div>}
            {sheet&&sheetCapacity>512&&<p className="ap-muted">กริดมีจำนวนมาก จึงซ่อนแผนผังย่อไว้</p>}
            {sheet&&frameCount>sheetCapacity&&<p className="ap-warning">ต้องการ {frameCount} เฟรม แต่กริดมีเพียง {sheetCapacity} ช่อง — เฟรมที่เกินจะแสดงเป็นช่องว่าง</p>}
            <p className="ap-muted">แบ่งจากซ้ายไปขวา ก่อนลงแถวถัดไป คำนวณตำแหน่งตัดจากขนาดภาพจริง</p>
          </div>}
          {sourceMode==='individual'&&<div className="ap-reorder"><strong>สลับลำดับรูปที่เลือก</strong><div><button disabled={frameIndex<=0} onClick={()=>swapSelected(-1)}><ArrowLeft size={14}/> ย้ายซ้าย</button><button disabled={frameIndex>=frameCount-1} onClick={()=>swapSelected(1)}>ย้ายขวา <ArrowRight size={14}/></button></div></div>}
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
