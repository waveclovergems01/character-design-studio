import type { CharacterMap, CharacterPart, ColorSwatch, Point } from '../lib/types';

type ShortPart = Omit<CharacterPart, 'colors' | 'polygons' | 'locked' | 'allow_geometry_change' | 'review_status'> & {
  colors: [string, string, string?][];
  polygons: Point[][];
};

function part(def: ShortPart): CharacterPart {
  return {
    ...def,
    colors: def.colors.map(([role, hex, name]): ColorSwatch => ({ role, hex, name })),
    polygons: def.polygons,
    locked: false,
    allow_geometry_change: true,
    review_status: 'manual_reviewed',
  };
}

const steel: [string, string, string?][] = [['base', '#928A92', 'Silver steel'], ['highlight', '#F4EBEC'], ['shadow', '#67545A'], ['trim', '#DFA43C', 'Warm gold']];
const leather: [string, string, string?][] = [['base', '#8D5749', 'Warm leather'], ['highlight', '#C68A6C'], ['shadow', '#51302E'], ['outline', '#322126']];
const ivory: [string, string, string?][] = [['base', '#F0D9C0', 'Ivory'], ['highlight', '#FFF3DF'], ['shadow', '#BD9D8E']];

// All points are approximate normalized 0–1000 (image-relative). The original PNG is flat,
// so these are user-reviewable semantic overlays, not extracted raster or Krita layers.
export const demoMap: CharacterMap = {
  schema_version: '1.0',
  character: {
    id: 'novice_female_front',
    name: 'Novice Female · Front',
    style: 'Warm hand-painted chibi fantasy RPG sprite illustration, soft ink outline, metal/leather/cloth material separation, Ragnarok-classic inspired 2.5D',
    view: 'Front / South (S) · 2D orthographic-like character reference',
    identity_notes: 'Girl novice adventurer, warm brown eyes, chestnut half-up bob with soft fringe, fitted brown leather bodice over ivory puff sleeves, short leather pleated skirt, dark fitted leggings, golden-trimmed steel pauldrons/kneeguards, oversized lace-up brown boots. Fixed proportions and neutral pose.',
  },
  image: { width: 1024, height: 1536, file: 'novice_female_front.png' },
  coordinate_system: 'normalized_1000',
  parts: [
    part({ id:'hair', name_th:'ทรงผม', name_en:'Chestnut bob hairstyle', group:'Head', side:'center', material:'Layered chestnut hair', colors:[['base','#916956','Chestnut'],['shadow','#51342F'],['highlight','#D7AA87']], technique:'วาดเป็นกลุ่มช่อใหญ่ก่อน แยกช่อรองด้วยเส้นโค้ง แล้วปาดไฮไลต์ตามแนวผม', notes:'ผมบ๊อบประบ่า ปอยหน้าม้า ผูกด้านบนด้วยริบบิ้นทองเล็ก ๆ; ไม่ให้ช่อผมยุบหายเมื่อเปลี่ยนมุม', z_index:10, polygons:[[[500,18],[558,22],[608,43],[637,77],[644,128],[677,175],[685,216],[657,244],[619,257],[566,254],[534,226],[460,241],[399,260],[347,250],[325,227],[334,180],[344,116],[381,69],[440,31]]], doc_anchor:'hair' }),
    part({ id:'face', name_th:'ใบหน้าและดวงตา', name_en:'Face and eyes', group:'Head', side:'center', material:'Soft skin / facial lineart', colors:[['base','#F8C8A9'],['highlight','#FFE4C9'],['shadow','#DFA18B'],['eyes','#78432A']], technique:'ใช้เซลเชดจาง ๆ บริเวณแก้ม จมูก และใต้ผม ตัดเส้นตาสีน้ำตาลเข้ม', notes:'ตากลมสีน้ำตาล ยิ้มบาง ๆ ตำแหน่งตา/จมูก/ปากต้องคงที่', z_index:42, polygons:[[[440,142],[475,125],[524,119],[566,125],[600,157],[607,195],[584,221],[536,241],[482,238],[439,215],[418,183]]], doc_anchor:'face' }),
    part({ id:'hair_ribbon', name_th:'แถบคาดผมสีทอง', name_en:'Gold hair ribbon', group:'Head', side:'center', material:'Warm satin ribbon', colors:[['base','#DF9E42'],['highlight','#F9D979'],['shadow','#996127']], technique:'เน้นเส้นโค้งไฮไลต์เล็ก ๆ บนขอบริบบิ้น', notes:'เส้นคาดผมส่วนบน อยู่หลังหน้าม้า', z_index:17, polygons:[[[432,43],[484,31],[535,32],[578,45],[588,52],[540,44],[486,42],[440,51]]], doc_anchor:'hair-ribbon' }),
    part({ id:'collar', name_th:'ปกเสื้อคอสูง', name_en:'Ivory high collar', group:'Torso', side:'center', material:'Ivory cotton / linen', colors:ivory, technique:'เก็บเส้นตั้งของผ้าพับข้างลำคอ และเงาขอบปกแบบนุ่ม', notes:'ปกสูงตรงกลาง ด้านล่างเชื่อมเข้ากับคอเสื้อ ไม่เปลี่ยนทรงคอ', z_index:70, polygons:[[[457,238],[479,247],[527,248],[551,243],[562,267],[543,302],[481,305],[454,271]]], doc_anchor:'collar' }),
    part({ id:'pauldron_character_right', name_th:'เกราะไหล่ขวาตัวละคร', name_en:'Right steel pauldron', group:'Armor', side:'character_right', pair_key:'pauldrons', material:'Polished steel with gold rim', colors:steel, technique:'เงาโค้งรอบเกราะ ใช้ไฮไลต์โลหะสั้นคมและขอบสีทองอุ่น', notes:'ข้างขวาตัวละคร = ด้านซ้ายของภาพเมื่อมองตรง', z_index:90, polygons:[[[397,256],[414,261],[434,278],[434,308],[423,321],[387,325],[344,320],[333,310],[349,279],[368,265]]], doc_anchor:'shoulder-armor' }),
    part({ id:'pauldron_character_left', name_th:'เกราะไหล่ซ้ายตัวละคร', name_en:'Left steel pauldron', group:'Armor', side:'character_left', pair_key:'pauldrons', material:'Polished steel with gold rim', colors:steel, technique:'เงาโค้งรอบเกราะ ใช้ไฮไลต์โลหะสั้นคมและขอบสีทองอุ่น', notes:'ข้างซ้ายตัวละคร = ด้านขวาของภาพเมื่อมองตรง', z_index:90, polygons:[[[604,256],[629,268],[659,286],[670,315],[656,325],[620,329],[597,319],[580,306],[585,279]]], doc_anchor:'shoulder-armor' }),
    part({ id:'sleeve_character_right', name_th:'แขนเสื้อพองขวา', name_en:'Right puff sleeve', group:'Arms', side:'character_right', pair_key:'sleeves', material:'Ivory puffed cotton', colors:ivory, technique:'สลับร่องเงาพับผ้าเป็นริ้วโค้ง ใช้ค่าแสงกว้างนุ่ม', notes:'ผ้าพองจากใต้เกราะไหล่ลงมาจนถึงขอบแขนที่จีบ', z_index:44, polygons:[[[347,320],[386,325],[418,322],[413,346],[399,390],[421,408],[409,420],[370,422],[334,408],[304,395],[317,357]]], doc_anchor:'sleeves' }),
    part({ id:'sleeve_character_left', name_th:'แขนเสื้อพองซ้าย', name_en:'Left puff sleeve', group:'Arms', side:'character_left', pair_key:'sleeves', material:'Ivory puffed cotton', colors:ivory, technique:'สลับร่องเงาพับผ้าเป็นริ้วโค้ง ใช้ค่าแสงกว้างนุ่ม', notes:'รักษาขอบแขนที่จีบและทิศทางแสงแบบเดิม', z_index:44, polygons:[[[600,319],[634,328],[665,323],[684,342],[696,374],[688,397],[700,407],[683,419],[630,417],[600,405],[587,380]]], doc_anchor:'sleeves' }),
    part({ id:'bodice', name_th:'เสื้อเกราะหนังช่วงลำตัว', name_en:'Brown leather bodice', group:'Torso', side:'center', material:'Fitted embossed brown leather with brass clasps', colors:[...leather,['trim','#DCA23D','Brass']], technique:'ลงพื้นน้ำตาลกลาง ปัดไฮไลต์หนังตามส่วนโค้งลำตัว เก็บหมุดทองด้วยขอบเข้มและจุดแสง', notes:'ตะขอสีทอง 3 แถว ด้านหน้ามีเส้นผ้าสีครีมพาดกลางตัว', z_index:56, polygons:[[[433,285],[467,281],[502,290],[541,285],[575,276],[604,296],[601,354],[579,417],[605,430],[582,452],[439,452],[414,426],[426,362]]], doc_anchor:'bodice' }),
    part({ id:'belt', name_th:'เข็มขัดและหัวเข็มขัด', name_en:'Leather belt and brass buckle', group:'Torso', side:'center', material:'Brown leather / brass buckle', colors:[...leather,['metal','#E6A936']], technique:'แถบหนังมีรอยเย็บและรูเข็มขัด หัวเข็มขัดสะท้อนทองแบบคม', notes:'อยู่ระดับเอวบนกระโปรง ทับชายเสื้อ', z_index:99, polygons:[[[400,422],[442,424],[483,432],[532,431],[592,422],[635,422],[645,445],[605,458],[557,463],[457,463],[397,452]]], doc_anchor:'belt' }),
    part({ id:'skirt', name_th:'กระโปรงหนังจีบห้าชิ้น', name_en:'Brown pleated leather skirt', group:'Legs', side:'center', material:'Dark warm leather with ivory seams', colors:[...leather,['seam','#F0D9C0']], technique:'แบ่งแพตเทิร์นผ้า 5 แผ่น คุมเงาแต่ละจีบให้แยก อ่านเป็นรูปทรงระฆังอ่อน', notes:'ชายกระโปรงซ้อน 2 ชั้น ขอบแต่ละชิ้นแทรกแถบสีครีม', z_index:57, polygons:[[[415,452],[479,457],[551,457],[607,450],[647,497],[668,526],[657,551],[584,566],[511,570],[443,561],[354,549],[341,522],[371,473]]], doc_anchor:'skirt' }),
    part({ id:'glove_character_right', name_th:'ถุงมือขวาตัวละคร', name_en:'Right fingerless leather glove', group:'Arms', side:'character_right', pair_key:'gloves', material:'Dark leather fingerless glove and wrist cuff', colors:leather, technique:'คุมทรงนิ้วเปิด มีกระดุมทองหนึ่งเม็ดและสันหนังสะท้อนแสงบาง', notes:'มือขวาตัวละครอยู่ซ้ายของภาพ เป็นถุงมือครึ่งนิ้ว', z_index:100, polygons:[[[279,463],[323,467],[349,492],[348,533],[334,557],[312,574],[287,576],[266,551],[261,503]]], doc_anchor:'fingerless-gloves' }),
    part({ id:'glove_character_left', name_th:'ถุงมือซ้ายตัวละคร', name_en:'Left fingerless leather glove', group:'Arms', side:'character_left', pair_key:'gloves', material:'Dark leather fingerless glove and wrist cuff', colors:leather, technique:'คุมทรงนิ้วเปิด มีกระดุมทองหนึ่งเม็ดและสันหนังสะท้อนแสงบาง', notes:'มือซ้ายตัวละครอยู่ขวาของภาพ เป็นถุงมือครึ่งนิ้ว', z_index:100, polygons:[[[678,461],[716,460],[733,485],[738,521],[725,555],[701,576],[676,575],[655,554],[654,505]]], doc_anchor:'fingerless-gloves' }),
    part({ id:'legging_character_right', name_th:'กางเกงรัดรูปขาขวา', name_en:'Right dark legging', group:'Legs', side:'character_right', pair_key:'leggings', material:'Charcoal brown stretch fabric', colors:[['base','#554747'],['shadow','#322C31'],['highlight','#81716D']], technique:'ไล่แสงผ้ายืดนุ่มและสร้างเงาสั้นตามแนวหัวเข่า', notes:'ด้านซ้ายของภาพ ขารัดรูปต่อเนื่องจนเหนือบูต', z_index:20, polygons:[[[356,551],[484,559],[475,642],[471,760],[460,800],[359,794],[351,692]]], doc_anchor:'leggings' }),
    part({ id:'legging_character_left', name_th:'กางเกงรัดรูปขาซ้าย', name_en:'Left dark legging', group:'Legs', side:'character_left', pair_key:'leggings', material:'Charcoal brown stretch fabric', colors:[['base','#554747'],['shadow','#322C31'],['highlight','#81716D']], technique:'ไล่แสงผ้ายืดนุ่มและสร้างเงาสั้นตามแนวหัวเข่า', notes:'ด้านขวาของภาพ ขารัดรูปต่อเนื่องจนเหนือบูต', z_index:20, polygons:[[[526,557],[633,551],[641,694],[654,784],[550,797],[532,748]]], doc_anchor:'leggings' }),
    part({ id:'knee_character_right', name_th:'สนับเข่าขวาตัวละคร', name_en:'Right steel knee guard', group:'Armor', side:'character_right', pair_key:'kneeguards', material:'Convex steel with gold border', colors:steel, technique:'ผิวเหล็กวงรีนูน มีรอยเส้นสะท้อนเฉียงและหมุดทอง', notes:'ด้านซ้ายของภาพ สนับเข่าทับกางเกง', z_index:80, polygons:[[[401,628],[442,625],[466,650],[469,688],[458,713],[422,722],[382,711],[366,683],[371,652]]], doc_anchor:'knee-guards' }),
    part({ id:'knee_character_left', name_th:'สนับเข่าซ้ายตัวละคร', name_en:'Left steel knee guard', group:'Armor', side:'character_left', pair_key:'kneeguards', material:'Convex steel with gold border', colors:steel, technique:'ผิวเหล็กวงรีนูน มีรอยเส้นสะท้อนเฉียงและหมุดทอง', notes:'ด้านขวาของภาพ สนับเข่าทับกางเกง', z_index:80, polygons:[[[577,625],[619,628],[644,652],[645,690],[627,714],[594,722],[553,713],[538,691],[542,652]]], doc_anchor:'knee-guards' }),
    part({ id:'boot_character_right', name_th:'รองเท้าบูตขวาตัวละคร', name_en:'Right brown leather boot', group:'Footwear', side:'character_right', pair_key:'boots', material:'Thick tan leather with suede cuff and golden laces', colors:[...leather,['cuff','#D7A980','Tan cuff'],['laces','#EBAE47','Gold lace']], technique:'ฐานรองเท้าหนังนูนใช้ไฮไลต์วงกว้าง ขอบพื้นเป็นชั้นสีเข้ม ปลอกหนังกลับขอบลายละเอียด', notes:'ด้านซ้ายภาพ ทรงบูตใหญ่ ข้อเท้าบาน ปลายมน ผูกเชือกทอง', z_index:95, polygons:[[[351,752],[392,759],[453,753],[479,767],[470,813],[465,850],[470,905],[476,930],[457,949],[397,960],[315,955],[286,945],[290,919],[299,891],[325,864],[314,815],[321,769]]], doc_anchor:'boots' }),
    part({ id:'boot_character_left', name_th:'รองเท้าบูตซ้ายตัวละคร', name_en:'Left brown leather boot', group:'Footwear', side:'character_left', pair_key:'boots', material:'Thick tan leather with suede cuff and golden laces', colors:[...leather,['cuff','#D7A980','Tan cuff'],['laces','#EBAE47','Gold lace']], technique:'ฐานรองเท้าหนังนูนใช้ไฮไลต์วงกว้าง ขอบพื้นเป็นชั้นสีเข้ม ปลอกหนังกลับขอบลายละเอียด', notes:'ด้านขวาภาพ ทรงบูตใหญ่ ข้อเท้าบาน ปลายมน ผูกเชือกทอง', z_index:95, polygons:[[[552,758],[613,755],[662,769],[674,802],[658,847],[680,881],[699,910],[707,937],[689,950],[624,959],[546,951],[537,933],[543,891],[550,843],[533,794]]], doc_anchor:'boots' }),
  ],
};

export const demoImage = `${import.meta.env.BASE_URL}examples/novice_female_front.png`;

export const groupLabels: Record<string, string> = {
  Head:'ศีรษะและใบหน้า', Torso:'ลำตัวและเครื่องแต่งกาย', Arms:'แขนและมือ', Legs:'ช่วงขา', Armor:'เกราะ', Footwear:'รองเท้า', Custom:'ส่วนที่เพิ่มเอง',
};
