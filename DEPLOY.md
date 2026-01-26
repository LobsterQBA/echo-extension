# Echo - Deployment Guide

To share this extension without exposing your API Key, you need to deploy a small "proxy" server. We use Cloudflare Workers because it's free, fast, and secure.

## Step 1: Deploy the Backend Proxy

1.  **Log in to Cloudflare**
    *   Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and sign up/log in.
2.  **Create a Worker**
    *   Go to **Workers & Pages** -> **Create Application** -> **Create Worker**.
    *   Name it something like `echo-proxy`.
    *   Click **Deploy** (don't worry about the code yet).
3.  **Add Your Code**
    *   Click **Edit Code**.
    *   Delete the existing code on the left.
    *   Copy **everything** from the file `server/worker.js` in this project folder.
    *   Paste it into the Cloudflare editor.
    *   Click **Deploy** (top right).
4.  **Add Your API Key** (Crucial Step!)
    *   Go back to the Worker's dashboard (click the back arrow or "Echo Proxy" in the breadcrumb).
    *   Go to **Settings** -> **Variables and Secrets**.
    *   Click **Add**.
    *   **Variable name**: `QWEN_API_KEY`
    *   **Value**: Paste your actual API Key (`sk-de20...`).
    *   Click **Deploy** and **Save**.

## Step 2: Connect the Extension

1.  **Copy your Worker URL**
    *   On the Worker dashboard, you'll see a URL like `https://echo-proxy.yourname.workers.dev`.
    *   Copy this URL.
2.  **Update `sidepanel.js`**
    *   Open `sidepanel.js` in your code editor.
    *   Find the line: `const QWEN_API_URL = ...`
    *   Replace it with your new Worker URL.
    *   **Delete** the line `const QWEN_API_KEY = ...` completely.

## Step 3: Distribute

Now you can zip up the folder (excluding the `server` folder if you want) and send it to your friends. They can install it and it will work immediately, using your proxy to talk to the AI!
