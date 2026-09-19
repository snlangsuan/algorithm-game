/**
 * ตัวรันเทสต์ — ไม่มี test framework เพิ่มใน dependencies
 *
 * เทสต์เขียนเป็น TypeScript และ import ด้วย alias '~' เหมือนโค้ดในแอป
 * จึงต้อง bundle ผ่าน esbuild (ติดมากับ vite อยู่แล้ว) ก่อนส่งให้ node --test
 */
import { spawn } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(root, '.test-out')

const files = readdirSync(here)
  .filter((name) => name.endsWith('.test.ts'))
  .sort()

if (files.length === 0) {
  console.error('ไม่เจอไฟล์ *.test.ts ใน test/')
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })

const esbuild = join(root, 'node_modules', '.bin', 'esbuild')
const build = spawn(
  esbuild,
  [
    ...files.map((name) => join(here, name)),
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--target=node22',
    `--alias:~=${join(root, 'app')}`,
    `--inject:${join(here, 'nuxt-shim.ts')}`,
    `--outdir=${outDir}`,
    '--log-level=warning'
  ],
  { stdio: 'inherit' }
)

build.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1)

  const tests = readdirSync(outDir).map((name) => join(outDir, name))
  const run = spawn(process.execPath, ['--test', ...tests], { stdio: 'inherit', cwd: root })
  run.on('exit', (testCode) => process.exit(testCode ?? 1))
})
