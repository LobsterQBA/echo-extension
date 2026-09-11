# Echo — Deploying your own backend

The extension calls a small Cloudflare Worker that holds the model API key. Deploying your own lets you use your own key and quota.

## 1. Deploy the Worker

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. **Workers & Pages → Create Application → Create Worker.** Name it, e.g. `echo-proxy`, and deploy the placeholder.
3. **Edit Code.** Replace the contents with `server/worker.js` from this repo and deploy.
4. **Settings → Variables and Secrets → Add.** Name: `QWEN_API_KEY`. Value: your API key. Save and redeploy.

## 2. Point the extension at it

1. Copy the Worker URL, e.g. `https://echo-proxy.<your-subdomain>.workers.dev/`.
2. Open the extension's options page (right-click the Echo icon → **Options**) and paste the URL into **Worker URL**.

No code changes are needed; the default URL in `sidepanel.js` is only used when no custom URL is set.
