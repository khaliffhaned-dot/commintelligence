<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Communications Intelligence Platform

A full-stack app on Tencent CloudBase (TCB):

- **Frontend:** a Vite/TypeScript SPA, deployed to CloudBase Static Website Hosting.
- **Backend:** a single CloudBase cloud function, `hunyuanProxy` (in `cloudfunctions/hunyuanProxy`), which holds the Tencent Hunyuan API key server-side and proxies every AI request. The browser never sees the Hunyuan key — only the public CloudBase environment ID, which is not a secret.

## One-time CloudBase setup

**Prerequisites:** Node.js, a [Tencent CloudBase](https://tcb.cloud.tencent.com/) environment, and the CloudBase CLI (`npm install -g @cloudbase/cli`).

1. Log in and note your environment ID:
   ```
   tcb login
   tcb env:list
   ```
2. Create a Hunyuan API key in the Tencent Cloud [TokenHub](https://www.tencentcloud.com/act/pro/tokenhub) console.
3. Set the two environment variables `cloudbaserc.json` references (either export them in your shell before running `tcb` commands, or substitute them directly in `cloudbaserc.json`):
   - `TCB_ENV_ID` — your CloudBase environment ID (public, safe to embed in the frontend build).
   - `HUNYUAN_API_KEY` — the Hunyuan key (secret; only ever goes into the cloud function's server-side config, never into the frontend build).
4. Deploy the cloud function (uploads the code in `cloudfunctions/hunyuanProxy` and sets `HUNYUAN_API_KEY` as its environment variable):
   ```
   tcb fn deploy hunyuanProxy
   ```
5. In the CloudBase console, enable **Anonymous Login** under Authentication — the frontend signs in anonymously before calling the function, since anonymous CloudBase calls otherwise get rejected.

## Run Locally

1. Install dependencies:
   `npm install`
2. Set `TCB_ENV_ID` in `.env.local` to your CloudBase environment ID.
3. Run the app:
   `npm run dev`

Note: local dev calls the *deployed* `hunyuanProxy` cloud function (step 4 above), not Hunyuan directly — there's no API key to set on the frontend anymore.

## Deploy

```
npm run build
tcb hosting:deploy dist -e <your-env-id>
```

(`cloudbaserc.json` is provided for declarative deploys via `tcb deploy` or the CloudBase VS Code extension — check it against your installed CLI version's config schema, since the CLI's config format has changed across versions.)
