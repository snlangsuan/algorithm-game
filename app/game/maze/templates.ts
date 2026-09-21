export interface AgentTemplate {
  id: string
  name: string
  description: string

  mode: 'plan' | 'step'
  code: string
}

const starter = `/**
 * เขียนคลาสชื่อ Agent ที่สืบทอดจาก MazeAgent
 * แล้วเลือก override เมธอดใดเมธอดหนึ่ง
 *
 *   solve(state) -> คืน "เส้นทางทั้งเส้น" ทีเดียว (เห็นแผนที่ทั้งใบ)
 *   step(state)  -> คืน "ก้าวถัดไป" ทีละก้าว (ระบบเรียกซ้ำจนถึงทางออก)
 *
 * state = {
 *   grid,        // grid[row][col] : FLOOR(0) | WALL(1) | MUD(2)
 *   width, height,
 *   start,       // { row, col } จุดเริ่ม
 *   goal,        // { row, col } ทางออก
 *   position,    // ช่องที่ยืนอยู่ตอนนี้ (ใช้ในโหมด step)
 *   previous,    // ช่องก่อนหน้า หรือ null
 *   visits,      // จำนวนครั้งที่เคยเหยียบแต่ละช่อง เช่น visits["3,5"]
 *   step,        // ก้าวที่เท่าไร
 *   stepLimit    // เดินได้ไม่เกินกี่ก้าว
 * }
 *
 * ตัวช่วยที่เรียกได้จาก this:
 *   this.neighbors(grid, row, col)   -> ช่องข้างเคียงที่เดินได้ [{ row, col, dir, cost }]
 *   this.walkable(grid, row, col)    -> เดินเข้าไปได้ไหม
 *   this.cost(grid, row, col)        -> ต้นทุนของช่อง (พื้น 1, โคลน 5)
 *   this.key(row, col)               -> "row,col" ใช้เป็น key ของ Map/Set
 *   this.manhattan(a, b)             -> ระยะประมาณสำหรับ A*
 *   this.heap()                      -> คิวลำดับความสำคัญ push(value, priority) / pop() / size
 *   this.rebuild(cameFrom, goal)     -> ประกอบเส้นทางจากรอย cameFrom
 *   this.ahead(point, 'right')       -> ช่องถัดไปทางขวา
 *   this.turn('up', 'right')         -> ทิศหลังหมุนขวา
 *   this.visit(row, col)             -> ระบายสีช่องที่สำรวจ (ไว้ดูว่าอัลกอริทึมค้นไปทางไหน)
 *
 * เส้นทางที่คืนต้องก้าวทีละช่องในแนวตั้ง/แนวนอน ห้ามทะลุกำแพง
 * และคืนได้ทั้ง [{ row, col }, ...] หรือ ['right', 'down', ...]
 */
class Agent extends MazeAgent {
  name = 'ตัวใหม่ของฉัน'

  solve(state) {
    // ตัวอย่างนี้เดินตรงไปทางขวาอย่างเดียว — แก้ให้ฉลาดกว่านี้ได้เลย
    const path = []
    let cell = state.start

    while (cell.col < state.goal.col && this.walkable(state.grid, cell.row, cell.col + 1)) {
      cell = { row: cell.row, col: cell.col + 1 }
      path.push(cell)
    }

    return path
  }
}`

const bfs = `/**
 * BFS — ค้นทีละชั้น
 * ขยายออกจากจุดเริ่มเป็นวงกลมทีละชั้น ชั้นที่เจอทางออกก่อนคือชั้นที่ก้าวน้อยที่สุด
 * จึงได้ "เส้นทางที่ก้าวน้อยที่สุด" เสมอ แต่ไม่สนว่าเหยียบโคลนแพงแค่ไหน
 */
class Agent extends MazeAgent {
  name = 'BFS ค้นทีละชั้น'

  solve(state) {
    const { grid, start, goal } = state

    // คิวของช่องที่รอขยาย + รอยว่าแต่ละช่องเดินมาจากไหน
    const queue = [start]
    const cameFrom = new Map([[this.key(start.row, start.col), null]])
    let head = 0

    while (head < queue.length) {
      const cell = queue[head++]
      this.visit(cell.row, cell.col)

      // เจอทางออกแล้ว หยุดได้เลย ไม่ต้องค้นต่อ
      if (this.same(cell, goal)) break

      for (const next of this.neighbors(grid, cell.row, cell.col)) {
        const id = this.key(next.row, next.col)
        if (cameFrom.has(id)) continue

        cameFrom.set(id, cell)
        queue.push(next)
      }
    }

    return this.rebuild(cameFrom, goal)
  }
}`

const dfs = `/**
 * DFS — ไล่ลึกทางเดียวจนสุด แล้วค่อยถอยกลับมาแยกทางอื่น
 * ใช้ stack แทนคิว ต่างกันแค่บรรทัดเดียวจาก BFS แต่ผลลัพธ์ต่างกันมาก
 * เจอทางออกไวก็จริง แต่เส้นทางที่ได้มักอ้อมกว่าของ BFS
 */
class Agent extends MazeAgent {
  name = 'DFS ไล่ลึก'

  solve(state) {
    const { grid, start, goal } = state

    const stack = [start]
    const cameFrom = new Map([[this.key(start.row, start.col), null]])

    while (stack.length > 0) {
      // ต่างจาก BFS ตรงนี้: หยิบตัวท้ายสุดที่เพิ่งใส่เข้าไป
      const cell = stack.pop()
      this.visit(cell.row, cell.col)

      if (this.same(cell, goal)) break

      for (const next of this.neighbors(grid, cell.row, cell.col)) {
        const id = this.key(next.row, next.col)
        if (cameFrom.has(id)) continue

        cameFrom.set(id, cell)
        stack.push(next)
      }
    }

    return this.rebuild(cameFrom, goal)
  }
}`

const dijkstra = `/**
 * Dijkstra — ค้นตาม "ต้นทุนสะสม" ที่ถูกที่สุดก่อน
 * เดินบนพื้นปกติจ่าย 1 เหยียบโคลนจ่าย 5 อัลกอริทึมนี้จึงยอมเดินอ้อมเพื่อเลี่ยงโคลน
 * ได้เส้นทางที่ต้นทุนถูกที่สุดเสมอ (เปิดโคลนในตั้งค่าแผนที่แล้วเทียบกับ BFS ดู)
 */
class Agent extends MazeAgent {
  name = 'Dijkstra เลี่ยงโคลน'

  solve(state) {
    const { grid, start, goal } = state

    const dist = new Map([[this.key(start.row, start.col), 0]])
    const cameFrom = new Map([[this.key(start.row, start.col), null]])
    const settled = new Set()

    // คิวที่หยิบช่องซึ่งต้นทุนสะสมถูกที่สุดออกมาก่อนเสมอ
    const frontier = this.heap()
    frontier.push(start, 0)

    while (frontier.size > 0) {
      const cell = frontier.pop()
      const id = this.key(cell.row, cell.col)

      // ช่องเดิมอาจถูกใส่คิวหลายรอบ เอาเฉพาะรอบที่ถูกที่สุด
      if (settled.has(id)) continue
      settled.add(id)
      this.visit(cell.row, cell.col)

      if (this.same(cell, goal)) break

      for (const next of this.neighbors(grid, cell.row, cell.col)) {
        const nextId = this.key(next.row, next.col)
        const total = dist.get(id) + next.cost

        if (total >= (dist.get(nextId) ?? Infinity)) continue

        dist.set(nextId, total)
        cameFrom.set(nextId, cell)
        frontier.push(next, total)
      }
    }

    return this.rebuild(cameFrom, goal)
  }
}`

const astar = `/**
 * A* — Dijkstra ที่มีเข็มทิศ
 * ลำดับความสำคัญ = ต้นทุนที่จ่ายมาแล้ว (g) + ระยะที่ "เดา" ว่าเหลืออีกเท่าไร (h)
 * ตัวเดา (heuristic) ต้องไม่ประเมินเกินจริง ผลลัพธ์จึงยังถูกที่สุดเหมือน Dijkstra
 * แต่สำรวจช่องน้อยกว่ามาก — ดูตัวเลข "สำรวจ" ข้างล่างเทียบกันได้เลย
 */
class Agent extends MazeAgent {
  name = 'A* มีเข็มทิศ'

  solve(state) {
    const { grid, start, goal } = state

    const g = new Map([[this.key(start.row, start.col), 0]])
    const cameFrom = new Map([[this.key(start.row, start.col), null]])
    const settled = new Set()

    const frontier = this.heap()
    frontier.push(start, this.guess(start, goal))

    while (frontier.size > 0) {
      const cell = frontier.pop()
      const id = this.key(cell.row, cell.col)

      if (settled.has(id)) continue
      settled.add(id)
      this.visit(cell.row, cell.col)

      if (this.same(cell, goal)) break

      for (const next of this.neighbors(grid, cell.row, cell.col)) {
        const nextId = this.key(next.row, next.col)
        const total = g.get(id) + next.cost

        if (total >= (g.get(nextId) ?? Infinity)) continue

        g.set(nextId, total)
        cameFrom.set(nextId, cell)
        frontier.push(next, total + this.guess(next, goal))
      }
    }

    return this.rebuild(cameFrom, goal)
  }

  // ระยะเดินในกริดแบบมองข้ามกำแพง — น้อยกว่าหรือเท่ากับของจริงเสมอ
  guess(cell, goal) {
    return this.manhattan(cell, goal)
  }
}`

const greedy = `/**
 * Greedy Best-First — พุ่งเข้าหาเป้าหมายอย่างเดียว
 * เรียงคิวด้วยระยะที่เหลือล้วน ๆ ไม่สนต้นทุนที่จ่ายมาแล้ว
 * ผลคือเร็วมากในที่โล่ง แต่พอเจอทางตันจะเสียเวลาวนออก และเส้นทางมักไม่สั้นที่สุด
 * ลองสลับกับ A* บนแผนที่เดียวกันเพื่อดูความต่าง
 */
class Agent extends MazeAgent {
  name = 'Greedy พุ่งเข้าเป้า'

  solve(state) {
    const { grid, start, goal } = state

    const cameFrom = new Map([[this.key(start.row, start.col), null]])
    const frontier = this.heap()
    frontier.push(start, this.manhattan(start, goal))

    while (frontier.size > 0) {
      const cell = frontier.pop()
      this.visit(cell.row, cell.col)

      if (this.same(cell, goal)) break

      for (const next of this.neighbors(grid, cell.row, cell.col)) {
        const id = this.key(next.row, next.col)
        if (cameFrom.has(id)) continue

        cameFrom.set(id, cell)
        // สนใจแค่ "ใกล้เป้าหมายแค่ไหน" ไม่สนว่าเดินมาไกลหรือแพงแค่ไหนแล้ว
        frontier.push(next, this.manhattan(next, goal))
      }
    }

    return this.rebuild(cameFrom, goal)
  }
}`

const wall = `/**
 * เลาะกำแพงขวา (right-hand rule) — โหมดเดินทีละก้าว
 * เอามือขวาแตะกำแพงแล้วเดินไปเรื่อย ๆ ไม่ต้องจำแผนที่เลยสักช่อง
 * ใช้ได้ผลกับ "เขาวงกตแท้" เพราะกำแพงทุกชิ้นเชื่อมถึงกันหมด
 * แต่บนแผนที่ที่มีเกาะกำแพงลอย ๆ (อุปสรรคสุ่ม / ถ้ำ) อาจวนไม่จบจนโดนตัดจำนวนก้าว
 */
class Agent extends MazeAgent {
  name = 'เลาะกำแพงขวา'
  facing = 'right'

  // ลำดับที่ลอง: ขวามือก่อน แล้วค่อยตรงไป ซ้ายมือ และหันหลังกลับ
  step(state) {
    const options = [
      this.turn(this.facing, 'right'),
      this.facing,
      this.turn(this.facing, 'left'),
      this.turn(this.turn(this.facing, 'left'), 'left')
    ]

    for (const dir of options) {
      const next = this.ahead(state.position, dir)
      if (!this.walkable(state.grid, next.row, next.col)) continue

      this.facing = dir
      this.visit(next.row, next.col)
      return dir
    }

    return null
  }
}`

const mouse = `/**
 * หนูหาทาง — โหมดเดินทีละก้าว
 * ไม่วางแผนล่วงหน้า ตัดสินใจจากสิ่งที่เห็นตรงหน้าเท่านั้น
 * กติกา: เลือกช่องที่ "เคยเหยียบน้อยที่สุด" ก่อน ถ้าเท่ากันค่อยเลือกช่องที่ใกล้ทางออกกว่า
 * การนับรอยเท้าทำให้ถอยออกจากทางตันได้เอง (แนวคิดเดียวกับอัลกอริทึมของ Trémaux)
 */
class Agent extends MazeAgent {
  name = 'หนูหาทาง'

  step(state) {
    const { grid, position, goal, visits } = state
    const options = this.neighbors(grid, position.row, position.col)

    let best = null
    let bestScore = Infinity

    for (const next of options) {
      const seen = visits[this.key(next.row, next.col)] ?? 0

      // รอยเท้ามีน้ำหนักมากกว่าระยะ จึงเลี่ยงการวนซ้ำที่เดิมเป็นอันดับแรก
      const score = seen * 1000 + this.manhattan(next, goal)
      if (score >= bestScore) continue

      best = next
      bestScore = score
    }

    if (best) this.visit(best.row, best.col)
    return best
  }
}`

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'bfs',
    name: 'BFS ค้นทีละชั้น',
    mode: 'plan',
    description: 'ขยายออกเป็นวงทีละชั้นด้วยคิว ได้เส้นทางที่ก้าวน้อยที่สุดเสมอ แต่ไม่สนต้นทุนโคลน',
    code: bfs
  },
  {
    id: 'dfs',
    name: 'DFS ไล่ลึก',
    mode: 'plan',
    description: 'ใช้ stack ไล่ลึกทางเดียวจนสุดแล้วถอยกลับ — เจอทางออกไว แต่เส้นทางมักอ้อม',
    code: dfs
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra เลี่ยงโคลน',
    mode: 'plan',
    description: 'ค้นตามต้นทุนสะสมที่ถูกที่สุดก่อน ยอมเดินอ้อมเพื่อเลี่ยงโคลน ได้ทางที่ถูกที่สุดเสมอ',
    code: dijkstra
  },
  {
    id: 'astar',
    name: 'A* มีเข็มทิศ',
    mode: 'plan',
    description: 'Dijkstra + heuristic ระยะที่เหลือ ได้ผลถูกที่สุดเท่ากันแต่สำรวจน้อยกว่ามาก',
    code: astar
  },
  {
    id: 'greedy',
    name: 'Greedy พุ่งเข้าเป้า',
    mode: 'plan',
    description: 'เรียงคิวด้วยระยะที่เหลือล้วน ๆ เร็วในที่โล่ง แต่ติดทางตันง่ายและไม่การันตีทางสั้นสุด',
    code: greedy
  },
  {
    id: 'wall',
    name: 'เลาะกำแพงขวา',
    mode: 'step',
    description: 'เดินทีละก้าวโดยไม่จำแผนที่ ใช้ได้ผลกับเขาวงกตแท้ แต่วนไม่จบบนแผนที่ที่มีเกาะกำแพง',
    code: wall
  },
  {
    id: 'mouse',
    name: 'หนูหาทาง',
    mode: 'step',
    description: 'เดินทีละก้าวตามรอยเท้า เลือกช่องที่เคยเหยียบน้อยสุดก่อน ถอยออกจากทางตันได้เอง',
    code: mouse
  },
  {
    id: 'starter',
    name: 'เทมเพลตเปล่า',
    mode: 'plan',
    description: 'โครงพร้อมคำอธิบาย state และตัวช่วยทั้งหมด สำหรับเริ่มเขียนเอง',
    code: starter
  }
]

export const findTemplate = (id: string): AgentTemplate | undefined =>
  AGENT_TEMPLATES.find((template) => template.id === id)

export const DEFAULT_TEMPLATE_ID = 'bfs'
