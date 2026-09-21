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

/**
 * โดเมนของเว็บที่ขึ้นจริง — ภาพพรีวิวตอนแชร์ลิงก์ต้องเป็นที่อยู่เต็ม ที่อยู่แบบสัมพัทธ์ใช้ไม่ได้
 * เพราะบอทของ Facebook/LINE/X อ่านแค่แท็กใน HTML ไม่ได้รู้ว่าหน้านั้นอยู่ที่ไหน
 */
const origin = process.env.NUXT_SITE_ORIGIN || 'https://snlangsuan.github.io'
const shareImage = `${origin}${fromPublic('og-image.png')}`

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
        { name: 'theme-color', content: '#7c3aed' },
        // ภาพและข้อความตอนแชร์ลิงก์ลงโซเชียล (ต้นฉบับภาพสร้างจาก HTML ขนาด 1200×630)
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Algorithm Game' },
        { property: 'og:title', content: 'Algorithm Game — ต่อบล็อกให้บอทเล่นเกมเอง' },
        { property: 'og:description', content: 'ลากบล็อกมาต่อเป็นวิธีคิดของบอท แล้วกดรันดูมันเล่นเขาวงกต Othello ไล่จับ และอีกหลายเกม' },
        { property: 'og:image', content: shareImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'เขียนโปรแกรมให้บอทด้วยการต่อบล็อก' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: shareImage }
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
