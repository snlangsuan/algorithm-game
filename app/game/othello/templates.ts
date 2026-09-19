export interface AgentTemplate {
  id: string
  name: string
  description: string
  code: string
}

const starter = `/**
 * เขียนคลาสชื่อ Agent ที่สืบทอดจาก OthelloAgent
 * ระบบจะเรียก chooseMove(state) ทุกครั้งที่ถึงตาของฝั่งนี้
 *
 * state = {
 *   board,       // board[row][col] : EMPTY(0) | BLACK(1) | WHITE(2)
 *   player,      // สีของเรา
 *   opponent,    // สีของคู่ต่อสู้
 *   validMoves,  // [{ row, col, flips: [[r, c], ...] }, ...]
 *   turn,        // ตาที่เท่าไร เริ่มจาก 1
 *   lastMove     // ตาที่คู่ต่อสู้เพิ่งลง หรือ null
 * }
 *
 * ตัวช่วยที่เรียกได้จาก this:
 *   this.validMoves(board, player)          -> ตาที่ลงได้ทั้งหมด
 *   this.simulate(board, move, player)      -> กระดานใหม่หลังลงหมาก
 *   this.count(board)                       -> { black, white, empty }
 *   this.score(board, player)               -> ผลต่างจำนวนหมาก
 *   this.rival(player)                      -> สีของอีกฝ่าย
 *   this.clone(board), this.notation(r, c)
 *
 * คืนค่าเป็น { row, col } หรือ [row, col] และต้องเป็นตาที่อยู่ใน validMoves
 */
class Agent extends OthelloAgent {
  name = 'ตัวใหม่ของฉัน'

  chooseMove(state) {
    return state.validMoves[0]
  }
}`

const random = `class Agent extends OthelloAgent {
  name = 'สุ่ม'

  chooseMove(state) {
    const index = Math.floor(Math.random() * state.validMoves.length)
    return state.validMoves[index]
  }
}`

const greedy = `class Agent extends OthelloAgent {
  name = 'กินเยอะสุด'

  // เลือกตาที่พลิกหมากคู่ต่อสู้ได้มากที่สุดในตานี้
  chooseMove(state) {
    let best = state.validMoves[0]

    for (const move of state.validMoves) {
      if (move.flips.length > best.flips.length) best = move
    }

    return best
  }
}`

const positional = `// ให้คะแนนแต่ละช่องตามความสำคัญ มุมดีที่สุด ช่องข้างมุมแย่ที่สุด
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

class Agent extends OthelloAgent {
  name = 'ยึดมุม'

  chooseMove(state) {
    let best = null
    let bestScore = -Infinity

    for (const move of state.validMoves) {
      // น้ำหนักตำแหน่ง + โบนัสเล็กน้อยจากจำนวนหมากที่พลิกได้
      const score = WEIGHTS[move.row][move.col] + move.flips.length

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }
}`

const bst = `// ใช้ Binary Search Tree เป็นโครงสร้างข้อมูลจัดอันดับตาที่ลงได้
//
//   insert   ใส่ทุกตาลงต้นไม้ โดยใช้คะแนนเป็น key (คะแนนเท่ากันเก็บรวมใน node เดียว)
//   findMin  / findMax   ซ้ายสุดคือแย่สุด ขวาสุดคือดีสุด
//   remove   ตัดตาที่ตำแหน่งต่ำกว่าค่ากลางทิ้งทั้งกิ่ง
//   search   ดึง node ของคะแนนที่ต้องการกลับมา
//   inOrder  เดินซ้าย-ราก-ขวา ได้ผลเรียงจากน้อยไปมาก
//
// ต้นไม้ใช้คัดตัวเลือกให้เหลือครึ่งเดียว แล้วค่อยตัดสินด้วยจำนวนตาที่คู่ต่อสู้เหลือ

const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

class Agent extends OthelloAgent {
  name = 'BST จัดอันดับตา'

  chooseMove(state) {
    // 1) สร้างต้นไม้จากตาที่ลงได้ทั้งหมด key คือคะแนนของตำแหน่ง
    let root = null
    for (const move of state.validMoves) {
      root = this.insert(root, this.positionScore(move), move)
    }

    // 2) ขวาสุดคือตำแหน่งดีที่สุด ถ้าเป็นมุมก็ยึดเลย
    //    search ดึง node นั้นกลับมาเพราะตาคะแนนเท่ากันถูกเก็บรวมไว้ที่เดียว
    const top = this.findMax(root)
    if (top.key >= 100) return this.search(root, top.key).moves[0]

    // 3) ตัดตาที่ตำแหน่งต่ำกว่าค่ากลางทิ้ง เหลือไว้แต่ครึ่งบน
    //    เก็บ key ไว้ก่อนค่อยลบ เพราะการลบ node ที่มีลูกสองข้าง
    //    จะย้าย key ของ successor ขึ้นมาแทนที่
    const mid = (this.findMin(root).key + top.key) / 2
    const keys = this.inOrder(root).map((node) => node.key)

    for (const key of keys) {
      if (key < mid) root = this.remove(root, key)
    }

    // 4) เดิน in-order ดูเฉพาะตาที่รอด แล้วเลือกตาที่บีบให้คู่ต่อสู้เดินได้น้อยที่สุด
    //    ขั้นนี้เองที่ทำให้การตัดกิ่งมีผล ไม่ใช่แค่หยิบ findMax มาใช้
    let best = null
    let fewest = Infinity

    for (const node of this.inOrder(root)) {
      for (const move of node.moves) {
        const replies = this.countReplies(state, move)

        if (replies < fewest || (replies === fewest && move.flips.length < best.flips.length)) {
          fewest = replies
          best = move
        }
      }
    }

    return best ?? state.validMoves[0]
  }

  // ---------- เมธอดของ Binary Search Tree ----------

  insert(node, key, move) {
    if (!node) return { key, moves: [move], left: null, right: null }

    if (key < node.key) node.left = this.insert(node.left, key, move)
    else if (key > node.key) node.right = this.insert(node.right, key, move)
    else node.moves.push(move)

    return node
  }

  // ค้นหาจาก key — ตัดครึ่งต้นไม้ทุกครั้งที่ลงลึกหนึ่งชั้น
  search(node, key) {
    if (!node) return null
    if (key === node.key) return node
    return key < node.key ? this.search(node.left, key) : this.search(node.right, key)
  }

  findMin(node) {
    if (!node) return null
    return node.left ? this.findMin(node.left) : node
  }

  findMax(node) {
    if (!node) return null
    return node.right ? this.findMax(node.right) : node
  }

  // ลบ node ถ้ามีลูกสองข้างให้ยก in-order successor ขึ้นมาแทน
  remove(node, key) {
    if (!node) return null

    if (key < node.key) {
      node.left = this.remove(node.left, key)
      return node
    }

    if (key > node.key) {
      node.right = this.remove(node.right, key)
      return node
    }

    if (!node.left) return node.right
    if (!node.right) return node.left

    const successor = this.findMin(node.right)
    node.key = successor.key
    node.moves = successor.moves
    node.right = this.remove(node.right, successor.key)
    return node
  }

  // เดินซ้าย -> ราก -> ขวา ได้ node เรียงจากคะแนนน้อยไปมาก
  inOrder(node, out = []) {
    if (!node) return out
    this.inOrder(node.left, out)
    out.push(node)
    this.inOrder(node.right, out)
    return out
  }

  // ---------- ตัวช่วยให้คะแนน ----------

  positionScore(move) {
    return WEIGHTS[move.row][move.col]
  }

  // ลงตานี้แล้วคู่ต่อสู้จะเหลือกี่ทางเดิน
  countReplies(state, move) {
    const next = this.simulate(state.board, move, state.player)
    return this.validMoves(next, state.opponent).length
  }
}`

const dfs = `// Depth-First Search บนต้นไม้เกม
// ไล่ลึกไปตามกิ่งหนึ่งจนสุดความลึกที่กำหนด แล้วค่อยถอยกลับมาเดินกิ่งถัดไป (backtrack)
//
// เป็นแกนเดียวกับ minimax แต่ยังไม่ตัดกิ่ง — ใส่ alpha-beta เมื่อไหร่ก็กลายเป็น minimax
// จึงต้องเปิดครบทุกกิ่ง ทำให้ลึกได้น้อยกว่าในเวลาเท่ากัน

const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

const DEPTH = 3

class Agent extends OthelloAgent {
  name = 'DFS ไล่ลึก'

  chooseMove(state) {
    let best = state.validMoves[0]
    let bestScore = -Infinity

    for (const move of state.validMoves) {
      const next = this.simulate(state.board, move, state.player)
      const score = this.dive(next, this.rival(state.player), state.player, DEPTH - 1)

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // ลงลึกทีละกิ่ง สุดทางแล้วถอยกลับมาเดินกิ่งถัดไป
  dive(board, turn, me, depth) {
    if (depth === 0) return this.evaluate(board, me)

    const moves = this.validMoves(board, turn)
    if (moves.length === 0) return this.evaluate(board, me)

    // ตาเรา = อยากได้คะแนนมากสุด, ตาคู่ต่อสู้ = เขาจะเลือกตาที่ทำให้เราแย่สุด
    const maximizing = turn === me
    let best = maximizing ? -Infinity : Infinity

    for (const move of moves) {
      const next = this.simulate(board, move, turn)
      const score = this.dive(next, this.rival(turn), me, depth - 1)
      best = maximizing ? Math.max(best, score) : Math.min(best, score)
    }

    return best
  }

  evaluate(board, me) {
    const foe = this.rival(me)
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === me) score += WEIGHTS[row][col]
        else if (board[row][col] === foe) score -= WEIGHTS[row][col]
      }
    }

    return score + (this.validMoves(board, me).length - this.validMoves(board, foe).length) * 10
  }
}`

const bfs = `// Breadth-First Search บนต้นไม้เกม
// ขยายทีละชั้นด้วยคิว: ดูตาที่ลงได้ตอนนี้ให้ครบก่อน แล้วค่อยไปดูตาถัดไปของทุกกิ่งพร้อมกัน
//
// ปัญหาของ BFS คือชั้นถัดไปโตเร็วมาก (แตกกิ่งเฉลี่ย ~10 ตา)
// จึงต้องคัดเหลือ WIDTH กิ่งที่ดีที่สุดของแต่ละตาราก ไม่งั้นจำง่าย ๆ ว่าหน่วยความจำระเบิด

const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

const LEVELS = 3
const WIDTH = 4

class Agent extends OthelloAgent {
  name = 'BFS ไล่ทีละชั้น'

  chooseMove(state) {
    const me = state.player

    // ชั้นที่ 1 ของคิว: หนึ่ง node ต่อหนึ่งตาที่ลงได้ จำไว้ว่ามาจากตารากไหน
    let queue = state.validMoves.map((move) => ({
      root: move,
      board: this.simulate(state.board, move, me),
      turn: this.rival(me)
    }))

    // คะแนนที่แย่ที่สุดที่แต่ละตารากพาไปเจอ (มองแบบระวังตัว)
    const worst = new Map()
    for (const node of queue) worst.set(node.root, this.evaluate(node.board, me))

    // ขยายทีละชั้น
    for (let level = 1; level < LEVELS && queue.length > 0; level++) {
      queue = this.expand(queue, me)

      for (const node of queue) {
        const score = this.evaluate(node.board, me)
        if (score < worst.get(node.root)) worst.set(node.root, score)
      }
    }

    // เลือกตารากที่กรณีแย่สุดยังดีที่สุด
    let best = state.validMoves[0]
    let bestScore = -Infinity

    for (const [move, score] of worst) {
      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // ขยายทุก node ในคิวไปอีกหนึ่งชั้น แล้วคัดให้เหลือเท่าที่ไหว
  expand(queue, me) {
    const next = []

    for (const node of queue) {
      for (const move of this.validMoves(node.board, node.turn)) {
        next.push({
          root: node.root,
          board: this.simulate(node.board, move, node.turn),
          turn: this.rival(node.turn)
        })
      }
    }

    return this.narrow(next, me)
  }

  // เก็บแค่ WIDTH กิ่งที่ดีที่สุดของแต่ละตาราก
  narrow(nodes, me) {
    const groups = new Map()

    for (const node of nodes) {
      const list = groups.get(node.root)
      if (list) list.push(node)
      else groups.set(node.root, [node])
    }

    const kept = []

    for (const list of groups.values()) {
      const scored = list.map((node) => ({ node, score: this.evaluate(node.board, me) }))
      scored.sort((a, b) => b.score - a.score)
      for (const item of scored.slice(0, WIDTH)) kept.push(item.node)
    }

    return kept
  }

  evaluate(board, me) {
    const foe = this.rival(me)
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === me) score += WEIGHTS[row][col]
        else if (board[row][col] === foe) score -= WEIGHTS[row][col]
      }
    }

    return score
  }
}`

const trap = `// ทริค: ไม่ต้องเก่งกว่าคู่ต่อสู้ แค่ "อ่านทาง" เขาให้ออก
//
// คู่ต่อสู้ที่เป็นโค้ดเกือบทั้งหมดเดินเหมือนเดิมเสมอเมื่อเจอกระดานเดิม (deterministic)
// ทริคนี้เลยทำสองอย่างควบกัน:
//
//   1) จดว่าเจอกระดานไหนแล้วคู่ต่อสู้เดินท่าอะไร -> ได้ "แบบจำลองคู่ต่อสู้"
//      เวลาค้นหาต้นไม้เกม ตาของเขาจึงเหลือกิ่งเดียวคือท่าที่เขาจะเดินจริง
//      แทนที่จะต้องเดาสิบกว่ากิ่ง เลยมองได้ลึกกว่าคู่ต่อสู้ในเวลาเท่ากัน
//
//   2) เกมไหนชนะ จดทั้งเส้นไว้เป็นสูตร เจอกระดานเดิมอีกก็เดินซ้ำท่าเดิม ชนะซ้ำได้เรื่อย ๆ
//
// ต้องกด "ฝึกซ้อม" ก่อนสัก 5-10 เกม เพื่อให้มันเก็บข้อมูลคู่ต่อสู้
// ใช้ไม่ได้กับคู่ต่อสู้ที่สุ่ม เพราะกระดานไม่ซ้ำเดิมให้จำ

const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

// ความลึกที่ค้นหา (นับเป็นตา ทั้งของเราและของเขา)
// ตาของเขาที่จำได้เหลือกิ่งเดียว ความลึกเท่านี้จึงถูกกว่าที่เห็นมาก
const DEPTH = 8
// ตาของคู่ต่อสู้ที่ยังไม่เคยเห็น ให้เผื่อไว้กี่กิ่ง (เดากิ่งเดียวแล้วเดาผิดคือพัง)
const GUESSES = 2
// กันสมุดโน้ตไม่ให้ใหญ่เกินโควตาความจำ
const MAX_ENTRIES = 4000

class Agent extends OthelloAgent {
  name = 'จอมกล (อ่านทางคู่ต่อสู้)'

  model = null
  book = null
  path = []
  lastOwnBoard = null
  me = null

  onGameStart(player) {
    this.me = player
    this.path = []
    this.lastOwnBoard = null
    this.load()
  }

  chooseMove(state) {
    this.load()
    if (this.me === null) this.me = state.player

    // จดท่าที่คู่ต่อสู้เพิ่งเดินจากกระดานก่อนหน้า
    this.learnReply(state)

    const key = this.positionKey(state.board, state.player)
    const remembered = this.book[key]

    // เคยชนะจากกระดานนี้แล้ว เดินซ้ำท่าเดิมเลย ไม่ต้องคิดใหม่
    if (remembered) {
      const known = state.validMoves.find((move) => this.notation(move.row, move.col) === remembered)
      if (known) return this.commit(key, known, state)
    }

    return this.commit(key, this.search(state), state)
  }

  onGameEnd(board, winner) {
    // ชนะแล้วจดทั้งเส้นไว้เป็นสูตร
    if (winner === this.me) {
      for (const step of this.path) this.write(this.book, step.key, step.move)
    }

    this.save(winner === this.me)
    this.path = []
  }

  // ---------- จำคู่ต่อสู้ ----------

  learnReply(state) {
    if (!state.lastMove || !this.lastOwnBoard) return

    const key = this.positionKey(this.lastOwnBoard, state.opponent)
    this.write(this.model, key, this.notation(state.lastMove.row, state.lastMove.col))
  }

  commit(key, move, state) {
    this.path.push({ key, move: this.notation(move.row, move.col) })
    this.lastOwnBoard = this.simulate(state.board, move, state.player)
    return move
  }

  // ---------- ค้นหาโดยรู้ทางคู่ต่อสู้ ----------

  search(state) {
    let best = state.validMoves[0]
    let bestScore = -Infinity

    for (const move of this.ordered(state.validMoves)) {
      const next = this.simulate(state.board, move, state.player)
      const score = this.look(next, state.opponent, DEPTH - 1, bestScore, Infinity)

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // alpha-beta ธรรมดา ต่างกันตรงที่ตาของคู่ต่อสู้เหลือกิ่งเดียวถ้าเราจำท่าเขาได้
  look(board, turn, depth, alpha, beta) {
    if (depth <= 0) return this.evaluate(board)

    const moves = this.validMoves(board, turn)

    if (moves.length === 0) {
      if (this.validMoves(board, this.rival(turn)).length === 0) return this.finalScore(board)
      return this.look(board, this.rival(turn), depth - 1, alpha, beta)
    }

    if (turn !== this.me) {
      const known = this.model[this.positionKey(board, turn)]
      const exact = known && moves.find((move) => this.notation(move.row, move.col) === known)
      // จำได้ = รู้แน่ว่าเขาเดินอะไร ไม่ต้องเผื่อกิ่งอื่นเลย
      const branches = exact ? [exact] : this.ordered(moves).slice(0, GUESSES)

      let worst = Infinity

      for (const move of branches) {
        const value = this.look(this.simulate(board, move, turn), this.rival(turn), depth - 1, alpha, beta)
        if (value < worst) worst = value
        if (worst < beta) beta = worst
        if (beta <= alpha) break
      }

      return worst
    }

    let best = -Infinity

    for (const move of this.ordered(moves)) {
      const value = this.look(this.simulate(board, move, turn), this.rival(turn), depth - 1, alpha, beta)
      if (value > best) best = value
      if (best > alpha) alpha = best
      if (beta <= alpha) break
    }

    return best
  }

  // เรียงตาที่น่าเล่นก่อน ช่วยให้เจอเส้นดี ๆ ไวขึ้น
  ordered(moves) {
    return [...moves].sort((a, b) => WEIGHTS[b.row][b.col] - WEIGHTS[a.row][a.col])
  }

  evaluate(board) {
    const foe = this.rival(this.me)
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === this.me) score += WEIGHTS[row][col]
        else if (board[row][col] === foe) score -= WEIGHTS[row][col]
      }
    }

    return score
  }

  // จบเกมแล้วสนใจอย่างเดียวว่าชนะหรือแพ้
  finalScore(board) {
    const diff = this.score(board, this.me)
    return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0
  }

  // ---------- ความจำ ----------

  load() {
    if (this.model && this.book) return

    const saved = this.memory || {}
    this.model = saved.model && typeof saved.model === 'object' ? saved.model : {}
    this.book = saved.book && typeof saved.book === 'object' ? saved.book : {}
  }

  write(store, key, value) {
    if (!store[key] && Object.keys(store).length >= MAX_ENTRIES) return
    store[key] = value
  }

  save(won) {
    const past = this.memory || {}
    const games = (past.games || 0) + 1
    const wins = (past.wins || 0) + (won ? 1 : 0)

    this.saveMemory({
      label: 'อ่านทางไว้ ' + Object.keys(this.model).length + ' ท่า · ชนะ ' + wins + '/' + games + ' เกม',
      games,
      wins,
      model: this.model,
      book: this.book
    })
  }

  // ย่อกระดาน + ฝั่งที่ถึงตา ให้เป็นคีย์สั้น ๆ ด้วย FNV-1a
  positionKey(board, side) {
    let hash = 2166136261 ^ side

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        hash ^= board[row][col] + row * 8 + col
        hash = Math.imul(hash, 16777619)
      }
    }

    return (hash >>> 0).toString(36)
  }
}`

const genetic = `// Genetic Algorithm แบบแชมป์–ผู้ท้าชิง
//
// ยีนหนึ่งชุด = น้ำหนักของช่อง 10 กลุ่ม (กระดาน 8x8 ย่อด้วยความสมมาตรเหลือ 10 แบบ)
//
//   fitness    เอายีนไปเล่นจนจบเกมจาก "กระดานมาตรฐาน" แล้ววัดผลต่างหมาก
//   select     คัดพ่อแม่แบบ tournament
//   crossover  ผสมยีนสองชุดแบบ uniform
//   mutate     สุ่มกลายพันธุ์ (จำกัดช่วง -200 ถึง 200)
//   elitism    ตัวที่ฟิตที่สุดรอดไปรุ่นถัดไปโดยไม่ถูกแก้
//
// สิ่งที่ต่างจาก GA ตำราเล่มแรก ๆ คือ "ตาที่เดินจริงใช้ยีนของแชมป์เท่านั้น"
// ผู้ท้าชิงที่วิวัฒนาการมาต้องประลองชนะแชมป์เดิมก่อน ถึงจะได้ขึ้นเป็นแชมป์คนใหม่
// ไม่งั้นการเรียนรู้จะไหลไปตาม noise ของ rollout แล้วเล่นแย่ลงกว่าเดิม
//
// แชมป์ถูกเก็บด้วย saveMemory() ทุกจบเกม เกมหน้าระบบโหลดกลับมาให้ทาง this.memory
// (กด "ฝึกซ้อม" ในแท็บผู้เล่นเพื่อให้ซ้อมเองหลายเกมรวด)

// 8x8 ย่อเหลือ 10 กลุ่มตามความสมมาตร เช่น มุมทั้งสี่คือกลุ่ม 0
const CLASSES = [
  [0, 1, 2, 3, 3, 2, 1, 0],
  [1, 4, 5, 6, 6, 5, 4, 1],
  [2, 5, 7, 8, 8, 7, 5, 2],
  [3, 6, 8, 9, 9, 8, 6, 3],
  [3, 6, 8, 9, 9, 8, 6, 3],
  [2, 5, 7, 8, 8, 7, 5, 2],
  [1, 4, 5, 6, 6, 5, 4, 1],
  [0, 1, 2, 3, 3, 2, 1, 0]
]

// ชุดน้ำหนักคลาสสิก ใช้เป็นแชมป์คนแรก
// ยีน 10 ตัวแรกคือน้ำหนักช่องแต่ละกลุ่ม ตัวที่ 11 คือน้ำหนักของ "จำนวนตาที่เดินได้"
const BASELINE = [120, -20, 20, 5, -40, -5, -5, 15, 3, 3, 10]

// ความลึกที่ใช้ค้นหาเวลาเดินจริง กับตอนประลอง (ประลองตื้นกว่าเพราะเล่นหลายเกมรวด)
const SEARCH_DEPTH = 3
const DUEL_DEPTH = 2
// ตอนวัดความฟิตใช้ชั้นเดียว จะได้ลองหลายรุ่นในเวลาที่มี
// แต่เป็นการประเมินทั้งกระดานเหมือนตอนเล่นจริง ไม่ใช่ดูแค่ช่องปลายทาง
const ROLLOUT_DEPTH = 1

const POPULATION = 12
const ELITES = 4
const ROLLOUTS = 2
const DUELS = 4
const MUTATION_RATE = 0.25
const MAX_BUDGET_MS = 300

class Agent extends OthelloAgent {
  name = 'พันธุกรรม (GA)'

  population = null
  champion = null
  benchmark = null
  // ฝั่งที่ถึงตาเดินบนกระดานมาตรฐาน (คือสีของเราเอง เพราะจำตอนถึงตาเราครั้งแรก)
  benchmarkTurn = null
  generation = 0
  promotions = 0

  chooseMove(state) {
    if (!this.champion) this.champion = this.loadChampion()
    if (!this.population) this.population = this.loadPopulation()
    if (!this.benchmark) {
      this.benchmark = this.clone(state.board)
      this.benchmarkTurn = state.player
    }

    // วิวัฒนาการผู้ท้าชิงต่อ ภายในงบเวลาที่ระบบให้มา
    this.evolve(Math.max(10, Math.min(state.timeBudget, MAX_BUDGET_MS)), state.player)

    // ตาจริงเดินด้วยยีนของแชมป์เสมอ
    return this.policyMove(state.board, state.player, this.champion, SEARCH_DEPTH)
  }

  // ---------- ความจำข้ามเกม ----------

  loadChampion() {
    const saved = this.memory && Array.isArray(this.memory.champion) ? this.memory.champion : null
    return saved && saved.length === BASELINE.length ? [...saved] : [...BASELINE]
  }

  loadPopulation() {
    const saved = this.memory && Array.isArray(this.memory.genes) ? this.memory.genes : null
    if (!saved || saved.length === 0) return this.firstGeneration()

    // ความจำที่บันทึกไว้ตอนยีนยังมีจำนวนไม่เท่านี้ ใช้ต่อไม่ได้ เริ่มรุ่นใหม่แทน
    const usable = saved.filter(
      (genes) => Array.isArray(genes) && genes.length === BASELINE.length
    )
    if (usable.length === 0) return this.firstGeneration()

    const people = usable.slice(0, POPULATION).map((genes) => ({ genes: [...genes], fitness: null }))
    while (people.length < POPULATION) {
      people.push({ genes: this.mutate(people[0].genes), fitness: null })
    }

    return people
  }

  firstGeneration() {
    const people = [{ genes: [...BASELINE], fitness: null }]

    while (people.length < POPULATION) {
      people.push({ genes: this.mutate(BASELINE), fitness: null })
    }

    return people
  }

  // จบเกมแล้วให้ผู้ท้าชิงที่ดีที่สุดประลองกับแชมป์ ชนะเท่านั้นถึงได้ขึ้นแทน
  onGameEnd(board, winner) {
    if (!this.population || !this.benchmark) return

    const challenger = this.population[0].genes

    // ต้องชนะทั้งแชมป์ปัจจุบันและชุดตั้งต้น
    // เพราะ "ชนะแชมป์คนล่าสุด" อย่างเดียวยังวนกลับไปแย่กว่าจุดเริ่มต้นได้
    // (วงจรเป่ายิ้งฉุบ: A ชนะ B, B ชนะ C แต่ C ชนะ A)
    const beatsChampion = this.duelMargin(challenger, this.champion) > 0
    const beatsBaseline = beatsChampion && this.duelMargin(challenger, BASELINE) > 0

    if (beatsChampion && beatsBaseline) {
      this.champion = [...challenger]
      this.promotions++
    }

    const past = this.memory || {}
    const games = (past.games || 0) + 1
    const generations = (past.generations || 0) + this.generation
    const promotions = (past.promotions || 0) + this.promotions
    const round = (gene) => Math.round(gene * 100) / 100

    this.saveMemory({
      label: 'ฝึกมา ' + games + ' เกม · เปลี่ยนแชมป์ ' + promotions + ' ครั้ง',
      games,
      generations,
      promotions,
      champion: this.champion.map(round),
      genes: this.population.map((person) => person.genes.map(round))
    })

    this.generation = 0
    this.promotions = 0
  }

  // ประลองตัวต่อตัวจากกระดานมาตรฐาน สลับกันเดินก่อน
  //
  // จุดสำคัญ: ด่านนี้ค้นหาลึกกว่าตอนวัดความฟิต (2 ชั้น เทียบกับ 1 ชั้น)
  // ผู้ท้าชิงจึงต้องเก่งจริง ไม่ใช่แค่เก่งกับเกณฑ์ที่ใช้ปั้นตัวเองมา
  duelMargin(challenger, champion) {
    let margin = 0

    for (let round = 0; round < DUELS; round++) {
      margin += this.duel(challenger, champion, BLACK)
      margin += this.duel(challenger, champion, WHITE)
    }

    return margin
  }

  // เล่นหนึ่งเกมเต็มด้วยวิธีเดินจริงทั้งสองฝั่ง คืนผลต่างหมากจากมุมของ challenger
  duel(challenger, champion, side) {
    let board = this.benchmark
    let turn = this.benchmarkTurn

    for (let step = 0; step < 64; step++) {
      const moves = this.validMoves(board, turn)

      if (moves.length === 0) {
        if (this.validMoves(board, this.rival(turn)).length === 0) break
        turn = this.rival(turn)
        continue
      }

      const genes = turn === side ? challenger : champion
      const move =
        Math.random() < 0.1
          ? moves[Math.floor(Math.random() * moves.length)]
          : this.policyMove(board, turn, genes, DUEL_DEPTH)

      board = this.simulate(board, move, turn)
      turn = this.rival(turn)
    }

    return this.score(board, side)
  }

  // ---------- วงจรวิวัฒนาการ ----------

  evolve(budget, player) {
    const deadline = Date.now() + budget

    while (Date.now() < deadline) {
      this.rank(player)

      // elitism: ตัวเก่งสุดรอดไปรุ่นหน้าแบบไม่ถูกแก้
      const next = this.population.slice(0, ELITES)

      while (next.length < POPULATION) {
        const father = this.select()
        const mother = this.select()
        next.push({ genes: this.mutate(this.crossover(father.genes, mother.genes)), fitness: null })
      }

      this.population = next
      this.generation++
    }

    this.rank(player)
  }

  rank(player) {
    for (const person of this.population) {
      if (person.fitness === null) person.fitness = this.fitness(person.genes, player)
    }

    this.population.sort((a, b) => b.fitness - a.fitness)
  }

  // ความฟิต = ผลต่างหมากเมื่อเล่นจากกระดานมาตรฐานจนจบ โดยมีแชมป์เป็นคู่ซ้อม
  // จงใจไม่วัดจากตำแหน่งปัจจุบัน เพราะตำแหน่งเปลี่ยนทุกตา ยีนจะวิ่งตามสถานการณ์
  // เฉพาะหน้า สิ่งที่เก็บลงความจำข้ามเกมจึงเพี้ยนสะสม
  fitness(genes, player) {
    let total = 0

    for (let round = 0; round < ROLLOUTS; round++) {
      total += this.rollout(this.benchmark, this.benchmarkTurn, player, genes, this.champion)
    }

    return total / ROLLOUTS
  }

  // เล่นจนจบกระดาน ฝั่ง me ใช้ยีนที่กำลังวัด อีกฝั่งใช้ยีนคู่ซ้อม
  // (เว้นบางตาที่สุ่ม เพื่อไม่ให้วิวัฒนาการไปจำทางเดินเส้นเดียว)
  rollout(board, turn, me, genes, sparring) {
    let current = board
    let side = turn

    for (let step = 0; step < 64; step++) {
      const moves = this.validMoves(current, side)

      if (moves.length === 0) {
        if (this.validMoves(current, this.rival(side)).length === 0) break
        side = this.rival(side)
        continue
      }

      let move

      if (Math.random() < 0.1) {
        move = moves[Math.floor(Math.random() * moves.length)]
      } else {
        move = this.policyMove(current, side, side === me ? genes : sparring, ROLLOUT_DEPTH)
      }

      current = this.simulate(current, move, side)
      side = this.rival(side)
    }

    return this.score(current, me)
  }

  // ---------- วิธีเดินจริง: ค้นหาแบบมีชั้น โดยใช้ยีนเป็นฟังก์ชันประเมิน ----------
  //
  // ยีนอย่างเดียวตัดสินได้แค่ "ช่องไหนน่าลง" ซึ่งสู้คู่ต่อสู้ที่มองล่วงหน้าไม่ได้เลย
  // จึงเอายีนไปเป็นฟังก์ชันประเมินของ alpha-beta แทน สิ่งที่วิวัฒนาการได้จึงมีน้ำหนักจริง
  policyMove(board, side, genes, depth) {
    const moves = this.validMoves(board, side)
    let best = moves[0]
    let bestScore = -Infinity

    for (const move of moves) {
      const after = this.simulate(board, move, side)
      const score = this.searchValue(after, this.rival(side), side, genes, depth - 1, -Infinity, Infinity)

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // alpha-beta คิดคะแนนจากมุมของ me เสมอ
  searchValue(board, turn, me, genes, depth, alpha, beta) {
    if (depth <= 0) return this.boardScore(board, me, genes)

    const moves = this.validMoves(board, turn)

    if (moves.length === 0) {
      if (this.validMoves(board, this.rival(turn)).length === 0) return this.boardScore(board, me, genes)
      return this.searchValue(board, this.rival(turn), me, genes, depth - 1, alpha, beta)
    }

    const maximizing = turn === me
    let best = maximizing ? -Infinity : Infinity

    for (const move of moves) {
      const after = this.simulate(board, move, turn)
      const score = this.searchValue(after, this.rival(turn), me, genes, depth - 1, alpha, beta)

      if (maximizing) {
        best = Math.max(best, score)
        alpha = Math.max(alpha, best)
      } else {
        best = Math.min(best, score)
        beta = Math.min(beta, best)
      }

      if (beta <= alpha) break
    }

    return best
  }

  // ประเมินกระดานด้วยยีน: ผลรวมน้ำหนักช่องของเราลบของคู่ต่อสู้
  // บวกความต่างของจำนวนตาที่เดินได้ คูณด้วยยีนตัวสุดท้าย
  boardScore(board, me, genes) {
    const foe = this.rival(me)
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const weight = genes[CLASSES[row][col]]
        if (board[row][col] === me) score += weight
        else if (board[row][col] === foe) score -= weight
      }
    }

    const mobility = this.validMoves(board, me).length - this.validMoves(board, foe).length
    return score + mobility * genes[10]
  }

  // ---------- ตัวดำเนินการทางพันธุกรรม ----------

  // tournament selection: สุ่มมาสองตัว เอาตัวที่ฟิตกว่า
  select() {
    const a = this.population[Math.floor(Math.random() * this.population.length)]
    const b = this.population[Math.floor(Math.random() * this.population.length)]
    return a.fitness >= b.fitness ? a : b
  }

  // uniform crossover: ยีนแต่ละตำแหน่งสุ่มว่าเอาของพ่อหรือแม่
  crossover(father, mother) {
    return father.map((gene, index) => (Math.random() < 0.5 ? gene : mother[index]))
  }

  // จำกัดช่วงยีนไว้ ไม่ให้ค่าหลุดไปไกลจนกลายเป็นน้ำหนักที่ไม่มีความหมาย
  mutate(genes) {
    return genes.map((gene) => {
      const next = Math.random() < MUTATION_RATE ? gene + this.noise(25) : gene
      return Math.max(-200, Math.min(200, next))
    })
  }

  noise(scale) {
    return (Math.random() * 2 - 1) * scale
  }
}`

const minimax = `// Minimax + alpha-beta pruning
const WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120]
]

const DEPTH = 4

class Agent extends OthelloAgent {
  name = 'มองล่วงหน้า 4 ตา'

  chooseMove(state) {
    const me = state.player
    let best = state.validMoves[0]
    let bestScore = -Infinity

    for (const move of this.ordered(state.validMoves)) {
      const next = this.simulate(state.board, move, me)
      const score = this.search(next, this.rival(me), me, DEPTH - 1, -Infinity, Infinity)

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // ค้นหาแบบ minimax โดย me คือฝ่ายที่เราคิดคะแนนให้เสมอ
  search(board, turn, me, depth, alpha, beta) {
    if (depth === 0) return this.evaluate(board, me)

    const moves = this.validMoves(board, turn)

    if (moves.length === 0) {
      const foeMoves = this.validMoves(board, this.rival(turn))
      if (foeMoves.length === 0) return this.finalScore(board, me)
      return this.search(board, this.rival(turn), me, depth - 1, alpha, beta)
    }

    const maximizing = turn === me
    let best = maximizing ? -Infinity : Infinity

    for (const move of this.ordered(moves)) {
      const next = this.simulate(board, move, turn)
      const score = this.search(next, this.rival(turn), me, depth - 1, alpha, beta)

      if (maximizing) {
        best = Math.max(best, score)
        alpha = Math.max(alpha, best)
      } else {
        best = Math.min(best, score)
        beta = Math.min(beta, best)
      }

      if (beta <= alpha) break
    }

    return best
  }

  // ประเมินกระดาน: น้ำหนักตำแหน่ง + จำนวนตาที่เดินได้
  evaluate(board, me) {
    const foe = this.rival(me)
    let score = 0

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === me) score += WEIGHTS[row][col]
        else if (board[row][col] === foe) score -= WEIGHTS[row][col]
      }
    }

    const mobility = this.validMoves(board, me).length - this.validMoves(board, foe).length
    return score + mobility * 10
  }

  finalScore(board, me) {
    const diff = this.score(board, me)
    return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0
  }

  // ลองตาที่พลิกได้เยอะก่อน ช่วยให้ตัดกิ่งได้ไวขึ้น
  ordered(moves) {
    return [...moves].sort((a, b) => b.flips.length - a.flips.length)
  }
}`

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'random',
    name: 'สุ่ม',
    description: 'เลือกตาแบบสุ่มจากตาที่ลงได้ — ใช้เป็นคู่ซ้อมเบา ๆ',
    code: random
  },
  {
    id: 'greedy',
    name: 'กินเยอะสุด',
    description: 'เลือกตาที่พลิกหมากได้มากที่สุดในตานั้น',
    code: greedy
  },
  {
    id: 'positional',
    name: 'ยึดมุม',
    description: 'ให้น้ำหนักตามตำแหน่ง เน้นยึดมุมและเลี่ยงช่องข้างมุม',
    code: positional
  },
  {
    id: 'bst',
    name: 'BST จัดอันดับตา',
    description: 'ใช้ binary search tree เก็บและจัดอันดับตา: insert / search / findMin / findMax / remove / inOrder',
    code: bst
  },
  {
    id: 'dfs',
    name: 'DFS ไล่ลึก',
    description: 'ไล่ลึกในต้นไม้เกมทีละกิ่งแล้วถอยกลับ ลึก 3 ตา ยังไม่ตัดกิ่ง (แกนเดียวกับ minimax)',
    code: dfs
  },
  {
    id: 'bfs',
    name: 'BFS ไล่ทีละชั้น',
    description: 'ขยายต้นไม้เกมทีละชั้นด้วยคิว คัดเหลือ 4 กิ่งต่อตาราก แล้วเลือกตาที่กรณีแย่สุดยังดีที่สุด',
    code: bfs
  },
  {
    id: 'trap',
    name: 'จอมกล (อ่านทางคู่ต่อสู้)',
    description: 'ทริคเอาชนะคู่ต่อสู้ที่เดินเหมือนเดิมทุกครั้ง — จดท่าของเขาไว้เป็นแบบจำลอง ทำให้ค้นหาได้ลึกกว่า แล้วจดเส้นที่ชนะไว้เดินซ้ำ (ต้องฝึกซ้อมก่อน)',
    code: trap
  },
  {
    id: 'genetic',
    name: 'พันธุกรรม (GA)',
    description: 'วิวัฒนาการชุดน้ำหนักกระดานระหว่างเล่น เก็บแชมป์ข้ามเกมด้วย saveMemory() — ผู้ท้าชิงต้องประลองชนะแชมป์เดิมก่อนถึงได้ใช้จริง',
    code: genetic
  },
  {
    id: 'minimax',
    name: 'มองล่วงหน้า 4 ตา',
    description: 'Minimax + alpha-beta pruning พร้อมฟังก์ชันประเมินกระดาน',
    code: minimax
  },
  {
    id: 'starter',
    name: 'เทมเพลตเปล่า',
    description: 'โครงพร้อมคำอธิบาย สำหรับเริ่มเขียนเอง',
    code: starter
  }
]

export const findTemplate = (id: string): AgentTemplate | undefined =>
  AGENT_TEMPLATES.find((template) => template.id === id)

export const DEFAULT_TEMPLATE_ID = 'positional'
