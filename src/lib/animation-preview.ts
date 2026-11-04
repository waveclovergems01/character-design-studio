/** Sprite-sheet cells are read from left to right, then top to bottom. */
export type SpriteCell={index:number;column:number;row:number;x:number;y:number;width:number;height:number};

export function clampPreviewCount(value:number,max=256):number{
  return Math.max(1,Math.min(max,Number.isFinite(value)?Math.round(value):1));
}

/** Round shared boundaries, so odd-sized sheets have no gaps or duplicated pixels. */
export function spriteCell(width:number,height:number,columns:number,rows:number,index:number):SpriteCell|null{
  const cols=clampPreviewCount(columns,64),rowCount=clampPreviewCount(rows,64);
  const w=Math.max(0,Math.floor(width)),h=Math.max(0,Math.floor(height));
  if(index<0||index>=cols*rowCount||!w||!h)return null;
  const column=index%cols,row=Math.floor(index/cols);
  const x=Math.round(column*w/cols),endX=Math.round((column+1)*w/cols);
  const y=Math.round(row*h/rowCount),endY=Math.round((row+1)*h/rowCount);
  if(endX<=x||endY<=y)return null;
  return {index,column,row,x,y,width:endX-x,height:endY-y};
}

export function spriteCells(width:number,height:number,columns:number,rows:number,count:number):SpriteCell[]{
  return Array.from({length:clampPreviewCount(count)},(_,index)=>spriteCell(width,height,columns,rows,index)).filter((v):v is SpriteCell=>v!==null);
}

export function orderedFrameNames<T extends {name:string}>(files:T[]):T[]{
  const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  return [...files].sort((a,b)=>collator.compare(a.name,b.name));
}

export function nextPreviewFrame(current:number,count:number,loop:boolean):number{
  const length=clampPreviewCount(count);
  return current+1<length?current+1:loop?0:length-1;
}
