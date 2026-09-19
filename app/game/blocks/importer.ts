import { parse as parseJs } from 'acorn'
import type { BlockPack, BlockProgram } from './pack'
import { createBlock } from './program'
import { RAW_STATEMENT, RAW_VALUE, type BlockNode } from './types'

/**
 * อ่านโค้ดกลับมาเป็นบล็อก
 *
 * รูปแบบที่ตัวแปลงบล็อกสร้างไว้จะถูกจับคู่กลับได้ครบ ส่วนโค้ดที่เขียนเองแล้วยังไม่มีบล็อกรองรับ
 * จะถูกห่อไว้ในบล็อก "โค้ดของฉัน" ทั้งก้อน ทำให้แปลงไปกลับได้เสมอโดยไม่มีอะไรหาย
 */

/** โหนดของ AST — ใช้แบบหลวม ๆ เพราะเราแตะแค่ไม่กี่ชนิด */
export type Node = Record<string, any>

export interface ParseContext {
  /** โค้ดต้นฉบับของโหนดนั้น */
  text: (node: Node) => string
  /** สร้างบล็อก */
  make: (
    kind: string,
    fields?: Record<string, string | number>,
    inputs?: Record<string, BlockNode | null>,
    bodies?: Record<string, BlockNode[]>
  ) => BlockNode
  /** แปลงนิพจน์เป็นบล็อกค่า (ถ้าไม่รู้จักจะได้บล็อกโค้ดดิบ) */
  value: (node: Node) => BlockNode
  /** แปลงลำดับคำสั่งเป็นบล็อก */
  body: (node: Node) => BlockNode[]
  /** ถ้าเป็นการเรียก this.<name>(...) คืนอาร์กิวเมนต์ ไม่ใช่ก็คืน null */
  call: (node: Node, name: string) => Node[] | null
  /** ถ้าเป็นการเรียก <object>.<name>(...) คืนอาร์กิวเมนต์ */
  method: (node: Node, name: string) => { target: Node; args: Node[] } | null
  /** ค่าคงที่ข้อความ / ตัวเลข */
  str: (node: Node) => string | null
  num: (node: Node) => number | null
  /** เป็น this.<name> ไหม */
  thisProp: (node: Node, ...path: string[]) => boolean
  /** คำสั่ง return คืนค่าอะไร (undefined ถ้าไม่ใช่ return) */
  returned: (node: Node) => Node | null | undefined
}

export type Matcher = (node: Node, ctx: ParseContext) => BlockNode | null

export interface PackParsers {
  statements: Matcher[]
  values: Matcher[]
}

export interface ImportResult {
  ok: boolean
  program?: BlockProgram
  /** จำนวนส่วนที่แปลงเป็นบล็อกตรง ๆ ไม่ได้ แล้วถูกห่อเป็นบล็อกโค้ด */
  raw: number
  message: string
}

const MATH_ONE = new Set(['abs', 'round', 'floor', 'ceil', 'sqrt'])

export function importProgram(code: string, pack: BlockPack): ImportResult {
  let ast: Node

  try {
    ast = parseJs(code, { ecmaVersion: 'latest', locations: false, ranges: true }) as unknown as Node
  } catch (error) {
    return { ok: false, raw: 0, message: `โค้ดยังมีที่ผิดอยู่: ${(error as Error).message}` }
  }

  let rawCount = 0

  const text = (node: Node): string => code.slice(node.range[0], node.range[1])

  const make: ParseContext['make'] = (kind, fields = {}, inputs = {}, bodies = {}) => {
    const node = createBlock(kind)
    Object.assign(node.fields, fields)
    Object.assign(node.inputs, inputs)
    Object.assign(node.bodies, bodies)
    return node
  }

  const str = (node: Node): string | null =>
    node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null

  const num = (node: Node): number | null =>
    node?.type === 'Literal' && typeof node.value === 'number' ? node.value : null

  const thisProp = (node: Node, ...path: string[]): boolean => {
    let cursor = node

    for (const name of [...path].reverse()) {
      if (cursor?.type !== 'MemberExpression' || cursor.property?.name !== name) return false
      cursor = cursor.object
    }

    return cursor?.type === 'ThisExpression'
  }

  const call = (node: Node, name: string): Node[] | null => {
    if (node?.type !== 'CallExpression') return null
    if (!thisProp(node.callee, name)) return null
    return node.arguments
  }

  const method = (node: Node, name: string): { target: Node; args: Node[] } | null => {
    if (node?.type !== 'CallExpression') return null
    if (node.callee?.type !== 'MemberExpression' || node.callee.property?.name !== name) return null
    return { target: node.callee.object, args: node.arguments }
  }

  const returned = (node: Node): Node | null | undefined =>
    node?.type === 'ReturnStatement' ? (node.argument ?? null) : undefined

  /** ชื่อตัวแปรจาก this.vars.X */
  const varName = (node: Node): string | null =>
    node?.type === 'MemberExpression' &&
    node.object?.type === 'MemberExpression' &&
    node.object.object?.type === 'ThisExpression' &&
    node.object.property?.name === 'vars'
      ? (node.property?.name ?? null)
      : null

  /** ชื่อลิสต์จาก this.list('a') */
  const listName = (node: Node): string | null => {
    const args = call(node, 'list')
    return args ? str(args[0]!) : null
  }

  const rawValue = (node: Node): BlockNode => {
    rawCount++
    return make(RAW_VALUE, { code: text(node) })
  }

  const rawStatement = (node: Node): BlockNode => {
    rawCount++
    return make(RAW_STATEMENT, { code: text(node) })
  }

  // ---------- นิพจน์ ----------

  function value(node: Node): BlockNode {
    const ctx = context

    for (const matcher of pack.parsers?.values ?? []) {
      const found = matcher(node, ctx)
      if (found) return found
    }

    const core = coreValue(node)
    return core ?? rawValue(node)
  }

  function coreValue(node: Node): BlockNode | null {
    if (!node) return null

    if (node.type === 'Literal') {
      if (typeof node.value === 'number') return make('number', { value: node.value })
      if (typeof node.value === 'boolean') return make('bool', { value: node.value ? 'true' : 'false' })
      if (typeof node.value === 'string') return make('text', { value: node.value })
    }

    // -5 ถูก parse เป็น UnaryExpression ไม่ใช่ Literal — บล็อก "ตัวเลข" ใส่ค่าติดลบได้ จึงต้องอ่านกลับได้ด้วย
    if (
      node.type === 'UnaryExpression' &&
      node.operator === '-' &&
      node.argument?.type === 'Literal' &&
      typeof node.argument.value === 'number'
    ) {
      return make('number', { value: -node.argument.value })
    }

    // `${a}${b}` -> บล็อก "ต่อข้อความ" (บล็อกนั้นเขียนออกมาเป็นรูปนี้เท่านั้น)
    if (
      node.type === 'TemplateLiteral' &&
      node.expressions?.length === 2 &&
      node.quasis?.length === 3 &&
      node.quasis.every((part: Node) => part.value?.raw === '')
    ) {
      return make('join', {}, { left: value(node.expressions[0]), right: value(node.expressions[1]) })
    }

    if (node.type === 'UnaryExpression' && node.operator === '!') {
      return make('not', {}, { value: value(node.argument) })
    }

    if (node.type === 'LogicalExpression') {
      const kind = node.operator === '&&' ? 'and' : node.operator === '||' ? 'or' : null
      if (kind) return make(kind, {}, { left: value(node.left), right: value(node.right) })
    }

    // ต้องเช็คก่อน BinaryExpression ข้างล่าง ไม่งั้น 'สุ่ม 1 ถึง 64' ที่ออกมาเป็น
    // Math.floor(Math.random() * 64) + 1 จะถูกจับเป็นบล็อกบวกก่อน แล้วแตกเป็นสามบล็อก
    const dice = randomRange(node)
    if (dice) return make('random', dice)

    if (node.type === 'BinaryExpression') {
      const compare: Record<string, string> = {
        '<': 'lt',
        '<=': 'lte',
        '===': 'eq',
        '==': 'eq',
        '!==': 'ne',
        '!=': 'ne',
        '>=': 'gte',
        '>': 'gt'
      }
      const math: Record<string, string> = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }

      if (compare[node.operator]) {
        return make('compare', { op: compare[node.operator]! }, { left: value(node.left), right: value(node.right) })
      }

      if (math[node.operator]) {
        return make('math', { op: math[node.operator]! }, { left: value(node.left), right: value(node.right) })
      }

      if (node.operator === '%') {
        return make('math-fn', { fn: 'mod' }, { left: value(node.left), right: value(node.right) })
      }
    }

    for (const name of MATH_ONE) {
      const args = mathCall(node, name)
      if (args) return make('math-one', { fn: name }, { value: value(args[0]!) })
    }

    for (const name of ['min', 'max', 'pow']) {
      const args = mathCall(node, name)
      if (args && args.length === 2) {
        return make('math-fn', { fn: name }, { left: value(args[0]!), right: value(args[1]!) })
      }
    }

    const variable = varName(node)
    if (variable) return make('var-get', { name: variable })

    // this.list('a').length / .includes(x) และ this.at('a', n)
    if (node.type === 'MemberExpression' && node.property?.name === 'length') {
      const list = listName(node.object)
      if (list) return make('list-length', { name: list })
    }

    const includes = method(node, 'includes')
    if (includes) {
      const list = listName(includes.target)
      if (list) return make('list-has', { name: list }, { value: value(includes.args[0]!) })
    }

    const at = call(node, 'at')
    if (at) {
      const list = str(at[0]!)
      if (list) return make('list-item', { name: list }, { index: value(at[1]!) })
    }

    const recall = call(node, 'recall')
    if (recall) {
      const slot = str(recall[0]!)
      if (slot) return make('recall', { slot })
    }

    return null
  }

  /** รูปแบบของบล็อกสุ่ม ทั้งแบบเริ่มที่ 0 และแบบบวกค่าเริ่มต้น */
  function randomRange(node: Node): { min: number; max: number } | null {
    const spread = (inner: Node): number | null => {
      const floor = mathCall(inner, 'floor')
      if (!floor || floor[0]?.type !== 'BinaryExpression' || floor[0].operator !== '*') return null
      if (!mathCall(floor[0].left, 'random')) return null
      return num(floor[0].right)
    }

    const plain = spread(node)
    if (plain !== null) return { min: 0, max: Math.max(0, plain - 1) }

    if (node?.type === 'BinaryExpression' && node.operator === '+') {
      const span = spread(node.left)
      const min = num(node.right)
      if (span !== null && min !== null) return { min, max: min + span - 1 }
    }

    return null
  }

  function mathCall(node: Node, name: string): Node[] | null {
    if (node?.type !== 'CallExpression') return null
    if (node.callee?.type !== 'MemberExpression') return null
    if (node.callee.object?.name !== 'Math' || node.callee.property?.name !== name) return null
    return node.arguments
  }

  // ---------- คำสั่ง ----------

  function statements(list: Node[]): BlockNode[] {
    return list.map((item) => statement(item))
  }

  function body(node: Node): BlockNode[] {
    if (!node) return []
    if (node.type === 'BlockStatement') return statements(node.body)
    return [statement(node)]
  }

  function statement(node: Node): BlockNode {
    const ctx = context

    for (const matcher of pack.parsers?.statements ?? []) {
      const found = matcher(node, ctx)
      if (found) return found
    }

    return coreStatement(node) ?? rawStatement(node)
  }

  function coreStatement(node: Node): BlockNode | null {
    if (node.type === 'IfStatement') {
      const cond = value(node.test)

      if (node.alternate) {
        return make(
          'if-else',
          {},
          { cond },
          { then: body(node.consequent), else: body(node.alternate) }
        )
      }

      return make('if', {}, { cond }, { then: body(node.consequent) })
    }

    if (node.type === 'WhileStatement') {
      if (node.test?.type === 'UnaryExpression' && node.test.operator === '!') {
        return make('repeat-until', {}, { cond: value(node.test.argument) }, { do: body(node.body) })
      }

      return make('while', {}, { cond: value(node.test) }, { do: body(node.body) })
    }

    // for (let i = 0; i < N; i++) -> ทำซ้ำ N ครั้ง
    if (node.type === 'ForStatement') {
      const times = num(node.test?.right)
      const counter = node.init?.declarations?.[0]?.id?.name

      if (times !== null && counter && node.test?.operator === '<' && node.test?.left?.name === counter) {
        return make('repeat', { times }, {}, { do: body(node.body) })
      }
    }

    // for (this.vars.b of this.list('a'))
    if (node.type === 'ForOfStatement') {
      const item = varName(node.left)
      const list = listName(node.right)
      if (item && list) return make('for-each', { list, item }, {}, { do: body(node.body) })
    }

    if (node.type === 'ExpressionStatement') {
      const expression = node.expression

      if (expression?.type === 'AssignmentExpression') {
        const variable = varName(expression.left)

        if (variable && expression.operator === '=') {
          if (expression.right?.type === 'ArrayExpression' && expression.right.elements.length === 0) {
            return make('list-clear', { name: variable })
          }
          return make('set-var', { name: variable }, { value: value(expression.right) })
        }

        if (variable && expression.operator === '+=') {
          return make('change-var', { name: variable }, { value: value(expression.right) })
        }
      }

      const push = method(expression, 'push')
      if (push) {
        const list = listName(push.target)
        if (list) return make('list-push', { name: list }, { value: value(push.args[0]!) })
      }

      const put = call(expression, 'put')
      if (put) {
        const list = str(put[0]!)
        if (list) {
          return make('list-put', { name: list }, { index: value(put[1]!), value: value(put[2]!) })
        }
      }

      const printed = call(expression, 'print')
      if (printed) return make('log', {}, { value: value(printed[0]!) })

      const remember = call(expression, 'remember')
      if (remember) {
        const slot = str(remember[0]!)
        if (slot) return make('remember', { slot }, { value: value(remember[1]!) })
      }

      const forget = call(expression, 'saveMemory')
      if (forget && forget[0]?.type === 'ObjectExpression' && forget[0].properties.length === 0) {
        return make('forget')
      }
    }

    return null
  }

  const context: ParseContext = { text, make, value, body, call, method, str, num, thisProp, returned }

  // ---------- หาเมธอดหลักของเกมนี้ ----------

  const klass = findClass(ast)
  if (!klass) return { ok: false, raw: 0, message: 'ไม่พบคลาส Agent ในโค้ด' }

  const members: Node[] = klass.body?.body ?? []

  // ต้องเจออย่างน้อยหนึ่งเมธอดที่ผูกกับหัวบล็อก ไม่งั้นแปลว่าโค้ดนี้ไม่ใช่ของเกมนี้
  const matched = pack.target.methods.some((method) =>
    members.some((member) => member.type === 'MethodDefinition' && member.key?.name === method.name)
  )

  if (!matched) {
    const names = pack.target.methods.map((method) => `${method.name}()`).join(' หรือ ')
    return { ok: false, raw: 0, message: `ไม่พบเมธอด ${names} ในคลาส Agent` }
  }

  // อ่านทุกเมธอดที่ผูกกับหัวบล็อก เมธอดไหนไม่มีในโค้ดก็ได้สคริปต์ว่าง
  const scripts: Record<string, BlockNode[]> = {}

  for (const method of pack.target.methods) {
    const member = members.find(
      (item) => item.type === 'MethodDefinition' && item.key?.name === method.name
    )

    scripts[method.hat.kind] = member
      ? statements(method.unwrap(member.value?.body?.body ?? [], context))
      : []
  }

  const program: BlockProgram = { name: findName(klass) ?? 'โปรแกรมของฉัน', scripts }

  return {
    ok: true,
    program,
    raw: rawCount,
    message:
      rawCount > 0
        ? `แปลงเป็นบล็อกแล้ว — มี ${rawCount} ส่วนที่ยังไม่มีบล็อกรองรับ เก็บไว้เป็นบล็อก "โค้ดของฉัน"`
        : 'แปลงเป็นบล็อกได้ครบทุกบรรทัด'
  }
}

function findClass(ast: Node): Node | null {
  for (const node of ast.body ?? []) {
    if (node.type === 'ClassDeclaration') return node
    if (node.type === 'VariableDeclaration') {
      for (const declaration of node.declarations) {
        if (declaration.init?.type === 'ClassExpression') return declaration.init
      }
    }
  }

  return null
}

/** ชื่อโปรแกรมจากฟิลด์ name = '...' */
function findName(klass: Node): string | null {
  for (const member of klass.body?.body ?? []) {
    if (member.type !== 'PropertyDefinition' || member.key?.name !== 'name') continue
    if (member.value?.type === 'Literal' && typeof member.value.value === 'string') {
      return member.value.value
    }
  }

  return null
}
