/**
 * รายการเกมทั้งหมด — แหล่งข้อมูลเดียวที่หน้าแรก หน้าเลือกเกม และตัวเลขบนหน้าแรกใช้ร่วมกัน
 * เพิ่มเกมใหม่ที่นี่ที่เดียว ทุกที่ที่นับจำนวนเกมจะตามเอง
 */
import type { BlockPack } from '~/game/blocks/pack'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import { HANOI_PACK } from '~/game/hanoi/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'

/** ภาพย่อที่ GameThumb วาดให้ — ชื่อตรงกับ id ของ pack */
export type GameThumbKind = 'maze' | 'othello' | 'hanoi' | 'chase' | 'dino' | 'line'

export interface GameEntry {
  /** เส้นทางของหน้าเกม — ตรงกับ id ของ pack เสมอ */
  to: string
  name: string
  /** สรุปสั้น ๆ ว่าทำอะไรในเกมนี้ */
  what: string
  /** คำอธิบายยาวสำหรับหน้าเลือกเกม */
  detail: string
  thumb: GameThumbKind
  /** ชุดบล็อกของเกมนั้น — เกมที่เขียน AI ได้มากกว่าหนึ่งฝ่ายก็มีมากกว่าหนึ่งชุด */
  packs: BlockPack[]
}

export const GAMES: GameEntry[] = [
  {
    to: '/maze',
    name: 'เขาวงกต',
    what: 'ต่อบล็อกให้หุ่นหาทางออกเอง',
    detail:
      'สุ่มแผนที่ได้ตั้งแต่เล็กจนใหญ่ วางกำแพงกับโคลนเองก็ได้ แล้วดูว่าวิธีที่คิดไว้พาหุ่นถึงทางออกกี่ก้าว เทียบกับทางที่สั้นที่สุด',
    thumb: 'maze',
    packs: [MAZE_PACK]
  },
  {
    to: '/othello',
    name: 'Othello 8×8',
    what: 'เขียนวิธีคิดให้บอทลงหมากแข่งกัน',
    detail:
      'เล่นเองกับเพื่อน หรือปล่อยบอทสองตัวแข่งกัน บอทที่ใช้บล็อกความจำจะจำผลเกมก่อนไว้ ซ้อมหลายเกมแล้วเก่งขึ้นจริง',
    thumb: 'othello',
    packs: [OTHELLO_PACK]
  },
  {
    to: '/chase',
    name: 'ไล่จับ',
    what: 'เขียน AI ให้ทั้งฝ่ายไล่และฝ่ายหนี',
    detail:
      'สองฝ่ายมีสมองของตัวเองให้แก้คนละชุด ปล่อยให้สองอัลกอริทึมสู้กันเองก็ได้ หรือกดปุ่มลูกศรลงไปเป็นคนหนีเองแล้ววัดว่า AI ที่เราเขียนไว้ต้อนเราติดไหม',
    thumb: 'chase',
    packs: [CHASE_PACK, RUNNER_PACK]
  },
  {
    to: '/dino',
    name: 'วิ่งหลบไม่รู้จบ',
    what: 'เล่นเอง หรือเขียนบอทให้หลบเอง',
    detail:
      'เกมวิ่งข้างเดียวที่ไม่มีเส้นชัย วิ่งไปเรื่อย ๆ จนกว่าจะชน ทุกระดับลู่เร็วขึ้นและของถี่ขึ้น กดปุ่มเล่นเองก็ได้ หรือปล่อยให้โปรแกรมที่ต่อไว้บังคับแทน แล้ววัดกันที่ว่าใครพาไปได้ไกลกว่า',
    thumb: 'dino',
    packs: [DINO_PACK]
  },
  {
    to: '/line',
    name: 'หุ่นเดินตามเส้น',
    what: 'ต่อบล็อกให้หุ่นสองล้อวิ่งตามเส้นดำ',
    detail:
      'หุ่นมีเซนเซอร์แสงห้าตัวใต้ท้องกับมอเตอร์สองข้าง สั่งได้อย่างเดียวคือกำลังของแต่ละล้อ สี่สนามตั้งแต่วงรีไปจนถึงมุมหักศอกและเลขแปดที่เส้นตัดกัน จับเวลาต่อรอบแล้วดูว่าวิธีเลี้ยวแบบไหนพาไปได้เร็วกว่าโดยไม่หลุดเส้น',
    thumb: 'line',
    packs: [LINE_PACK]
  },
  {
    to: '/hanoi',
    name: 'หอคอยฮานอย',
    what: 'ต่อบล็อกให้เครื่องย้ายจานให้ครบ',
    detail:
      'ย้ายจานทีละใบข้ามสามหมุดโดยห้ามเอาจานใหญ่ทับจานเล็ก เกมนี้รู้เฉลยที่สั้นที่สุดอยู่แล้ว จึงบอกได้ทันทีว่าวิธีที่คิดไว้ดีที่สุดเท่าที่เป็นไปได้หรือยัง',
    thumb: 'hanoi',
    packs: [HANOI_PACK]
  }
]
