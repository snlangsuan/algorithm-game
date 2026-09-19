import tailwindcss from '@tailwindcss/vite'

/**
 * ที่อยู่ฐานของเว็บ — '/' ตอน dev, '/ชื่อ-repo/' ตอนขึ้น GitHub Pages ใต้ชื่อโปรเจกต์
 * (ดู .github/workflows/deploy.yml ที่ส่ง NUXT_APP_BASE_URL มาให้ตอน build)
 *
 * ลิงก์ใน app.head ไม่ถูกเติมที่อยู่ฐานให้เหมือน NuxtLink หรือไฟล์ใน _nuxt จึงต้องเติมเอง
 * ไม่งั้นไอคอนจะ 404 ทันทีที่เว็บไม่ได้อยู่ที่ราก
 */
const base = process.env.NUXT_APP_BASE_URL || '/'
const fromPublic = (name: string) => `${base.replace(/\/+$/, '')}/${name}`

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // เกมทั้งหมดทำงานฝั่งเบราว์เซอร์ (แคนวาส, Web Worker, localStorage)
  // เรนเดอร์ฝั่งเซิร์ฟเวอร์จึงไม่ช่วยอะไร ปิดไปเลยให้เหลือ SPA ล้วน
  ssr: false,

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    // โค้ดของผู้เล่นรันใน Web Worker แบบ ES module
    worker: { format: 'es' }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'th', class: 'light' },
      title: 'Algorithm Game',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'เกมฝึกคิดเชิงอัลกอริทึม' },
        { name: 'color-scheme', content: 'light' },
        { name: 'theme-color', content: '#7c3aed' }
      ],
      link: [
        // SVG ให้เบราว์เซอร์รุ่นใหม่ (คมทุกขนาด) ส่วน .ico เป็นตัวสำรอง
        { rel: 'icon', type: 'image/svg+xml', href: fromPublic('favicon.svg') },
        { rel: 'icon', type: 'image/x-icon', href: fromPublic('favicon.ico'), sizes: '16x16 32x32 48x48 64x64' },
        { rel: 'apple-touch-icon', href: fromPublic('apple-touch-icon.png') }
      ]
    },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    pageTransition: { name: 'page', mode: 'out-in' }
  },

  typescript: {
    typeCheck: false,
    strict: true
  }
})
