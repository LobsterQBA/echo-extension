/**
 * Echo Extension - Secure Proxy for Aliyun Qwen
 * 
 * This worker hides your API Key from the frontend.
 * Deploy this to Cloudflare Workers.
 */

export default {
    async fetch(request, env) {
        // Handle CORS (Cross-Origin Resource Sharing)
        // allowing the extension to talk to this worker
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*", // For higher security, replace '*' with: "chrome-extension://<YOUR_EXTENSION_ID>"
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const body = await request.json();

            // Call Aliyun Qwen API
            const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${env.QWEN_API_KEY}` // Key is injected from Secrets
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            return new Response(JSON.stringify(data), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
            });
        }
    },
};
