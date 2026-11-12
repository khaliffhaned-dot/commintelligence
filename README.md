<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Communications Intelligence Platform
# Communications Intelligence Platform

A Vite/TypeScript SPA on **Cloudflare Pages** with one Pages Function, `functions/api/ai.js` (`POST /api/ai`), that holds the Tencent Hunyuan API key server-side and proxies every AI request. The browser never sees the key.

## Setup

1. Create a Hunyuan API key in the Tencent Cloud [TokenHub](https://www.tencentcloud.com/act/pro/tokenhub) console.
2. In Cloudflare: Pages project → Settings → Variables and Secrets → add a **secret** named `HUNYUAN_API_KEY` (production and preview).
3. Build command `npm run build`, output directory `dist`. Pushes to `main` deploy automatically.

## Run Locally

```
npm install
echo HUNYUAN_API_KEY=your-key > .dev.vars     # git-ignored local secret
npx wrangler pages dev dist --port 8788       # serves /api/ai (run `npm run build` first)
npm run dev                                   # Vite on :5173, proxies /api to :8788
```
