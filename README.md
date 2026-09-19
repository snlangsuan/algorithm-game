# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## ปล่อยขึ้น GitHub Pages

`.github/workflows/deploy.yml` รันเทสต์แล้ว build เป็นไฟล์สแตติกให้ทุกครั้งที่ push เข้า `main`

ต้องตั้งค่าเองครั้งเดียว: **Settings → Pages → Source** เลือก **GitHub Actions**
(ถ้ายังเป็น "Deploy from a branch" เวิร์กโฟลว์จะล้มตรงขั้น deploy)

อยาก build แบบเดียวกับที่ Actions ทำ เพื่อดูในเครื่องก่อน:

```bash
NITRO_PRESET=github-pages NUXT_APP_BASE_URL=/ชื่อ-repo/ npx nuxt generate
npx serve .output/public
```

`NUXT_APP_BASE_URL` จำเป็นเมื่อเว็บอยู่ใต้ชื่อโปรเจกต์ (`user.github.io/ชื่อ-repo/`)
ในเวิร์กโฟลว์ค่านี้มาจาก `actions/configure-pages` จึงไม่ต้องแก้มือ
