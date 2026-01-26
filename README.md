# Echo · 回声 🌊

> "并不是摘要，而是回声。"
> "Not a summary, but an echo."

**Echo** is a Chrome Extension that brings a "soul" to YouTube videos. Instead of dry AI summaries, it summons a specific persona (based on the video content) to offer profound, first-person insights and engage in a dialogue with you.

![Echo Demo](https://via.placeholder.com/800x450?text=Echo+Extension+Demo)

## ✨ Features

- **Ω Button**: A subtle, breathing Omega button appears next to the video title.
- **Soul Channeling**: Automatically analyzes the video content and summons the most suitable expert or thinker (e.g., Socrates, Steve Jobs, Feynman) to comment.
- **Identity Awareness**: Intelligently identifies speakers and ensures the commentator is a *different* perspective, not just an echo of the speaker.
- **Deep Dialogue**: Chat with the summoned persona. They will respond in character, using first-person perspective ("I believe..."), and can reference specific parts of the video transcript.
- **Aesthetic UI**: A premium, dark-themed design with cinematic animations and golden amber accents.

## 📥 Installation

Since Echo is currently in **Beta** and not yet on the Chrome Web Store, you can install it manually:

1.  **Download Code**: Click the green **Code** button above and select **Download ZIP**, then unzip it.
2.  **Open Extensions**: Go to `chrome://extensions/` in Chrome.
3.  **Developer Mode**: Toggle on **Developer mode** in the top right corner.
4.  **Load Unpacked**: Click **Load unpacked** (top left) and select the `echo-v2` folder.
5.  **Enjoy**: Open any YouTube video, look for the **Ω** button near the title, and click it!

## 🛠 For Developers

The backend of Echo uses a **Cloudflare Worker** to securely proxy requests to the AI model (Aliyun Qwen).

### Directory Structure
- `manifest.json`: Extension configuration (MV3).
- `content.js`: Injects the Ω button and handles transcript extraction.
- `sidepanel.html/js`: The main UI and AI logic.
- `background.js`: Service worker for side panel management.
- `server/worker.js`: Cloudflare Worker code for the secure proxy.

### Deploy Your Own Backend (Optional)
If you want to modify the backend or use your own API Key:
1.  See `DEPLOY.md` for instructions on setting up the Cloudflare Worker.
2.  Update `sidepanel.js` with your new Worker URL.

## 🤝 Contributing

Comments and PRs are welcome! Let's make this the most poetic AI extension.

## 📜 License

MIT
