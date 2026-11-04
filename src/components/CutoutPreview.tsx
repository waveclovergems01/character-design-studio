import { useEffect, useRef, useState } from 'react';
import { createCutoutScene, loadCutoutImage } from '../lib/cutout';
import type { CutoutMaskOverrides, CutoutScene, CutoutSkinWeights, CutoutWidths } from '../lib/cutout';
import type { JointPositions, RigDirection, RigFrame } from '../lib/rig';

type Props={imageUrl:string;rest:JointPositions;frame:RigFrame;direction:RigDirection;widths:CutoutWidths;maskOverrides:CutoutMaskOverrides;skinWeights:CutoutSkinWeights};

export default function CutoutPreview({imageUrl,rest,frame,direction,widths,maskOverrides,skinWeights}:Props){
  const host=useRef<HTMLDivElement>(null);
  const scene=useRef<CutoutScene|null>(null);
  const latest=useRef({frame,direction});
  latest.current={frame,direction};
  const [error,setError]=useState('');
  const restKey=JSON.stringify(rest),widthsKey=JSON.stringify(widths),maskKey=JSON.stringify(maskOverrides),weightsKey=JSON.stringify(skinWeights);
  useEffect(()=>{
    let cancelled=false;
    const target=host.current;if(!target)return;
    setError('');
    // Keep the previous render visible during interactive Polygon dragging; re-cut after edits settle.
    const timer=window.setTimeout(()=>{
      void loadCutoutImage(imageUrl).then(async image=>{
        if(cancelled)return;
        const next=await createCutoutScene(target,image,rest,latest.current.frame,latest.current.direction,widths,maskOverrides,skinWeights);
        if(cancelled){next.destroy();return;}
        const previous=scene.current;
        scene.current=next;
        previous?.destroy();
        next.update(latest.current.frame,latest.current.direction);
      }).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'ไม่สามารถเริ่ม PixiJS ได้');});
    },110);
    return ()=>{
      cancelled=true;window.clearTimeout(timer);
    };
    // restKey and widthsKey intentionally trigger mesh re-cutting only when bone setup changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[imageUrl,restKey,widthsKey,maskKey,weightsKey]);
  useEffect(()=>()=>{scene.current?.destroy();scene.current=null;},[]);
  useEffect(()=>{scene.current?.update(frame,direction);},[frame,direction]);
  return <div className="cutout-preview" ref={host} aria-label="PixiJS Mesh Cutout Preview">{error&&<div className="cutout-preview-error">{error}</div>}</div>;
}
