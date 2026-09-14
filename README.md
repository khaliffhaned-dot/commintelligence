<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Communications Intelligence Platform

This contains everything you need to run your app locally.

The app uses Tencent Hunyuan (via its OpenAI-compatible API) for all AI-generated analysis and reports.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `HUNYUAN_API_KEY` in `.env.local` to an API key created in the Tencent Cloud [TokenHub](https://www.tencentcloud.com/act/pro/tokenhub) console
3. Run the app:
   `npm run dev`

**Security note:** this API key is currently embedded into the client-side bundle at build time (see `vite.config.ts`), meaning anyone who visits the deployed site can extract it from the JS bundle and use it against your Hunyuan quota/billing. This is fine for local development, but before deploying publicly you should route AI calls through a small backend/serverless proxy that holds the key server-side instead.
