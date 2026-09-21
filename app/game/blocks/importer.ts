import { parse as parseJs } from 'acorn'
import type { BlockPack, BlockProgram } from './pack'
import { createBlock } from './program'
import { RAW_STATEMENT, RAW_VALUE, type BlockNode } from './types'

export type Node = Record<string, any>

export interface ParseContext {
  text: (node: Node) => string
  make: (
    kind: string,
    fields?: Record<string, string | number>,
    inputs?: Record<string, BlockNode | null>,
    bodies?: Record<string, BlockNode[]>
  ) => BlockNode
  value: (node: Node) => BlockNode
  body: (node: Node) => BlockNode[]
  call: (node: Node, name: string) => Node[] | null
  method: (node: Node, name: string) => { target: Node; args: Node[] } | null
  str: (node: Node) => string | null
  num: (node: Node) => number | null
  thisProp: (node: Node, ...path: string[]) => boolean
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
  raw: number
  message: string
}

const str = (node: Node): string | null =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null

const num = (node: Node): number | null =>
  node?.type === 'Literal' && typeof node.value === 'number' ? node.value : null

const returned = (node: Node): Node | null | undefined =>
  node?.type === 'ReturnStatement' ? (node.argument ?? null) : undefined

function thisProp(node: Node, ...path: string[]): boolean {
  let cursor = node

  for (const name of [...path].reverse()) {
    if (cursor?.type !== 'MemberExpression' || cursor.property?.name !== name) return false
    cursor = cursor.object
  }

  return cursor?.type === 'ThisExpression'
}

function thisCall(node: Node, name: string): Node[] | null {
  if (node?.type !== 'CallExpression') return null
  if (!thisProp(node.callee, name)) return null
  return node.arguments
}

function methodCall(node: Node, name: string): { target: Node; args: Node[] } | null {
  if (node?.type !== 'CallExpression') return null
  if (node.callee?.type !== 'MemberExpression' || node.callee.property?.name !== name) return null
  return { target: node.callee.object, args: node.arguments }
}

function mathCall(node: Node, name: string): Node[] | null {
  if (node?.type !== 'CallExpression') return null
  if (node.callee?.type !== 'MemberExpression') return null
  if (node.callee.object?.name !== 'Math' || node.callee.property?.name !== name) return null
  return node.arguments
}

const varName = (node: Node): string | null =>
  node?.type === 'MemberExpression' &&
  node.object?.type === 'MemberExpression' &&
  node.object.object?.type === 'ThisExpression' &&
  node.object.property?.name === 'vars'
    ? (node.property?.name ?? null)
    : null

function listName(node: Node): string | null {
  const args = thisCall(node, 'list')
  return args ? str(args[0]!) : null
}

function randomSpread(node: Node): number | null {
  const floor = mathCall(node, 'floor')
  if (!floor || floor[0]?.type !== 'BinaryExpression' || floor[0].operator !== '*') return null
  if (!mathCall(floor[0].left, 'random')) return null
  return num(floor[0].right)
}

function randomRange(node: Node): { min: number; max: number } | null {
  const plain = randomSpread(node)
  if (plain !== null) return { min: 0, max: Math.max(0, plain - 1) }

  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const span = randomSpread(node.left)
    // ค่าต่ำสุดติดลบถูกเขียนเป็น "+ -8" ซึ่ง parser อ่านเป็นเครื่องหมายลบนำหน้า ไม่ใช่ตัวเลขตรง ๆ
    const negative = node.right?.type === 'UnaryExpression' && node.right.operator === '-'
    const magnitude = num(negative ? node.right.argument : node.right)
    const min = magnitude === null ? null : negative ? -magnitude : magnitude
    if (span !== null && min !== null) return { min, max: min + span - 1 }
  }

  return null
}

function firstMatch(matchers: Matcher[] | undefined, node: Node, ctx: ParseContext): BlockNode | null {
  for (const matcher of matchers ?? []) {
    const found = matcher(node, ctx)
    if (found) return found
  }

  return null
}

const literalValue: Matcher = (node, ctx) => {
  if (node?.type !== 'Literal') return null
  if (typeof node.value === 'number') return ctx.make('number', { value: node.value })
  if (typeof node.value === 'boolean') return ctx.make('bool', { value: node.value ? 'true' : 'false' })
  if (typeof node.value === 'string') return ctx.make('text', { value: node.value })
  return null
}

const negativeValue: Matcher = (node, ctx) => {
  if (node?.type !== 'UnaryExpression' || node.operator !== '-') return null
  if (node.argument?.type !== 'Literal' || typeof node.argument.value !== 'number') return null
  return ctx.make('number', { value: -node.argument.value })
}

const joinValue: Matcher = (node, ctx) => {
  if (node?.type !== 'TemplateLiteral') return null
  if (node.expressions?.length !== 2 || node.quasis?.length !== 3) return null
  if (!node.quasis.every((part: Node) => part.value?.raw === '')) return null

  return ctx.make('join', {}, { left: ctx.value(node.expressions[0]), right: ctx.value(node.expressions[1]) })
}

const notValue: Matcher = (node, ctx) =>
  node?.type === 'UnaryExpression' && node.operator === '!'
    ? ctx.make('not', {}, { value: ctx.value(node.argument) })
    : null

const LOGIC: Record<string, string> = { '&&': 'and', '||': 'or' }

const logicValue: Matcher = (node, ctx) => {
  if (node?.type !== 'LogicalExpression') return null

  const kind = LOGIC[node.operator]
  return kind ? ctx.make(kind, {}, { left: ctx.value(node.left), right: ctx.value(node.right) }) : null
}

const randomValue: Matcher = (node, ctx) => {
  const dice = randomRange(node)
  return dice ? ctx.make('random', dice) : null
}

const COMPARE: Record<string, string> = {
  '<': 'lt',
  '<=': 'lte',
  '===': 'eq',
  '==': 'eq',
  '!==': 'ne',
  '!=': 'ne',
  '>=': 'gte',
  '>': 'gt'
}

const MATH: Record<string, string> = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }

const binaryValue: Matcher = (node, ctx) => {
  if (node?.type !== 'BinaryExpression') return null

  const compare = COMPARE[node.operator]
  const math = MATH[node.operator]
  const mod = node.operator === '%'
  if (!compare && !math && !mod) return null

  const sides = { left: ctx.value(node.left), right: ctx.value(node.right) }

  if (compare) return ctx.make('compare', { op: compare }, sides)
  if (math) return ctx.make('math', { op: math }, sides)
  return ctx.make('math-fn', { fn: 'mod' }, sides)
}

const MATH_ONE = ['abs', 'round', 'floor', 'ceil', 'sqrt']
const MATH_TWO = ['min', 'max', 'pow']

const mathOneValue: Matcher = (node, ctx) => {
  for (const name of MATH_ONE) {
    const args = mathCall(node, name)
    if (args) return ctx.make('math-one', { fn: name }, { value: ctx.value(args[0]!) })
  }

  return null
}

const mathTwoValue: Matcher = (node, ctx) => {
  for (const name of MATH_TWO) {
    const args = mathCall(node, name)
    if (args?.length === 2) {
      return ctx.make('math-fn', { fn: name }, { left: ctx.value(args[0]!), right: ctx.value(args[1]!) })
    }
  }

  return null
}

const varGetValue: Matcher = (node, ctx) => {
  const variable = varName(node)
  return variable ? ctx.make('var-get', { name: variable }) : null
}

const listLengthValue: Matcher = (node, ctx) => {
  if (node?.type !== 'MemberExpression' || node.property?.name !== 'length') return null

  const list = listName(node.object)
  return list ? ctx.make('list-length', { name: list }) : null
}

const listHasValue: Matcher = (node, ctx) => {
  const includes = methodCall(node, 'includes')
  if (!includes) return null

  const list = listName(includes.target)
  return list ? ctx.make('list-has', { name: list }, { value: ctx.value(includes.args[0]!) }) : null
}

const listItemValue: Matcher = (node, ctx) => {
  const at = thisCall(node, 'at')
  if (!at) return null

  const list = str(at[0]!)
  return list ? ctx.make('list-item', { name: list }, { index: ctx.value(at[1]!) }) : null
}

const recallValue: Matcher = (node, ctx) => {
  const args = thisCall(node, 'recall')
  if (!args) return null

  const slot = str(args[0]!)
  return slot ? ctx.make('recall', { slot }) : null
}

const CORE_VALUES: Matcher[] = [
  literalValue,
  negativeValue,
  joinValue,
  notValue,
  logicValue,
  randomValue,
  binaryValue,
  mathOneValue,
  mathTwoValue,
  varGetValue,
  listLengthValue,
  listHasValue,
  listItemValue,
  recallValue
]

const ifStatement: Matcher = (node, ctx) => {
  if (node.type !== 'IfStatement') return null

  const cond = ctx.value(node.test)

  if (node.alternate) {
    return ctx.make('if-else', {}, { cond }, { then: ctx.body(node.consequent), else: ctx.body(node.alternate) })
  }

  return ctx.make('if', {}, { cond }, { then: ctx.body(node.consequent) })
}

const whileStatement: Matcher = (node, ctx) => {
  if (node.type !== 'WhileStatement') return null

  if (node.test?.type === 'UnaryExpression' && node.test.operator === '!') {
    return ctx.make('repeat-until', {}, { cond: ctx.value(node.test.argument) }, { do: ctx.body(node.body) })
  }

  return ctx.make('while', {}, { cond: ctx.value(node.test) }, { do: ctx.body(node.body) })
}

const repeatStatement: Matcher = (node, ctx) => {
  if (node.type !== 'ForStatement') return null

  const times = num(node.test?.right)
  const counter = node.init?.declarations?.[0]?.id?.name
  if (times === null || !counter) return null
  if (node.test?.operator !== '<' || node.test?.left?.name !== counter) return null

  return ctx.make('repeat', { times }, {}, { do: ctx.body(node.body) })
}

const forEachStatement: Matcher = (node, ctx) => {
  if (node.type !== 'ForOfStatement') return null

  const item = varName(node.left)
  const list = listName(node.right)
  return item && list ? ctx.make('for-each', { list, item }, {}, { do: ctx.body(node.body) }) : null
}

const assignExpression: Matcher = (node, ctx) => {
  if (node?.type !== 'AssignmentExpression') return null

  const variable = varName(node.left)
  if (!variable) return null

  if (node.operator === '+=') return ctx.make('change-var', { name: variable }, { value: ctx.value(node.right) })
  if (node.operator !== '=') return null

  if (node.right?.type === 'ArrayExpression' && node.right.elements.length === 0) {
    return ctx.make('list-clear', { name: variable })
  }

  return ctx.make('set-var', { name: variable }, { value: ctx.value(node.right) })
}

const listPushExpression: Matcher = (node, ctx) => {
  const push = methodCall(node, 'push')
  if (!push) return null

  const list = listName(push.target)
  return list ? ctx.make('list-push', { name: list }, { value: ctx.value(push.args[0]!) }) : null
}

const listPutExpression: Matcher = (node, ctx) => {
  const put = thisCall(node, 'put')
  if (!put) return null

  const list = str(put[0]!)
  return list ? ctx.make('list-put', { name: list }, { index: ctx.value(put[1]!), value: ctx.value(put[2]!) }) : null
}

const logExpression: Matcher = (node, ctx) => {
  const printed = thisCall(node, 'print')
  return printed ? ctx.make('log', {}, { value: ctx.value(printed[0]!) }) : null
}

const rememberExpression: Matcher = (node, ctx) => {
  const args = thisCall(node, 'remember')
  if (!args) return null

  const slot = str(args[0]!)
  return slot ? ctx.make('remember', { slot }, { value: ctx.value(args[1]!) }) : null
}

const forgetExpression: Matcher = (node, ctx) => {
  const args = thisCall(node, 'saveMemory')
  if (!args || args[0]?.type !== 'ObjectExpression' || args[0].properties.length !== 0) return null
  return ctx.make('forget')
}

const CORE_EXPRESSIONS: Matcher[] = [
  assignExpression,
  listPushExpression,
  listPutExpression,
  logExpression,
  rememberExpression,
  forgetExpression
]

const expressionStatement: Matcher = (node, ctx) =>
  node.type === 'ExpressionStatement' ? firstMatch(CORE_EXPRESSIONS, node.expression, ctx) : null

const CORE_STATEMENTS: Matcher[] = [
  ifStatement,
  whileStatement,
  repeatStatement,
  forEachStatement,
  expressionStatement
]

interface Importer {
  ctx: ParseContext
  statements: (list: Node[]) => BlockNode[]
  raw: () => number
}

function createImporter(code: string, pack: BlockPack): Importer {
  let rawCount = 0

  const text: ParseContext['text'] = (node) => code.slice(node.range[0], node.range[1])

  const make: ParseContext['make'] = (kind, fields = {}, inputs = {}, bodies = {}) => {
    const block = createBlock(kind)
    Object.assign(block.fields, fields)
    Object.assign(block.inputs, inputs)
    Object.assign(block.bodies, bodies)
    return block
  }

  const raw = (kind: string, node: Node): BlockNode => {
    rawCount++
    return make(kind, { code: text(node) })
  }

  const value: ParseContext['value'] = (node) =>
    firstMatch(pack.parsers?.values, node, ctx) ?? firstMatch(CORE_VALUES, node, ctx) ?? raw(RAW_VALUE, node)

  const statement = (node: Node): BlockNode =>
    firstMatch(pack.parsers?.statements, node, ctx) ??
    firstMatch(CORE_STATEMENTS, node, ctx) ??
    raw(RAW_STATEMENT, node)

  const statements = (list: Node[]): BlockNode[] => list.map((item) => statement(item))

  const body: ParseContext['body'] = (node) => {
    if (!node) return []
    if (node.type === 'BlockStatement') return statements(node.body)
    return [statement(node)]
  }

  const ctx: ParseContext = {
    text,
    make,
    value,
    body,
    call: thisCall,
    method: methodCall,
    str,
    num,
    thisProp,
    returned
  }

  return { ctx, statements, raw: () => rawCount }
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

function findName(klass: Node): string | null {
  for (const member of klass.body?.body ?? []) {
    if (member.type !== 'PropertyDefinition' || member.key?.name !== 'name') continue
    if (member.value?.type === 'Literal' && typeof member.value.value === 'string') {
      return member.value.value
    }
  }

  return null
}

const findMethod = (members: Node[], name: string): Node | undefined =>
  members.find((item) => item.type === 'MethodDefinition' && item.key?.name === name)

const summarize = (raw: number): string =>
  raw > 0
    ? `แปลงเป็นบล็อกแล้ว — มี ${raw} ส่วนที่ยังไม่มีบล็อกรองรับ เก็บไว้เป็นบล็อก "โค้ดของฉัน"`
    : 'แปลงเป็นบล็อกได้ครบทุกบรรทัด'

export function importProgram(code: string, pack: BlockPack): ImportResult {
  let ast: Node

  try {
    ast = parseJs(code, { ecmaVersion: 'latest', locations: false, ranges: true }) as unknown as Node
  } catch (error) {
    return { ok: false, raw: 0, message: `โค้ดยังมีที่ผิดอยู่: ${(error as Error).message}` }
  }

  const klass = findClass(ast)
  if (!klass) return { ok: false, raw: 0, message: 'ไม่พบคลาส Agent ในโค้ด' }

  const members: Node[] = klass.body?.body ?? []

  if (!pack.target.methods.some((method) => findMethod(members, method.name))) {
    const names = pack.target.methods.map((method) => `${method.name}()`).join(' หรือ ')
    return { ok: false, raw: 0, message: `ไม่พบเมธอด ${names} ในคลาส Agent` }
  }

  const { ctx, statements, raw } = createImporter(code, pack)

  const scripts: Record<string, BlockNode[]> = {}

  for (const method of pack.target.methods) {
    const member = findMethod(members, method.name)
    scripts[method.hat.kind] = member ? statements(method.unwrap(member.value?.body?.body ?? [], ctx)) : []
  }

  const program: BlockProgram = { name: findName(klass) ?? 'โปรแกรมของฉัน', scripts }

  return { ok: true, program, raw: raw(), message: summarize(raw()) }
}
