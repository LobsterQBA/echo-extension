/**
 * Echo Extension - Secure Proxy for Aliyun Qwen
 * 
 * Security features:
 * - Strict extension ID validation (only your extension can call this API)
 * - Rate limiting using Cloudflare KV (optional but recommended)
 * - Generic error messages (no internal info leakage)
 * 
 * IMPORTANT: Replace YOUR_EXTENSION_ID_HERE with your actual extension ID!
 * Find it at chrome://extensions/ with Developer mode enabled.
 */

// ⚠️ CONFIGURE THESE VALUES
const ALLOWED_EXTENSION_IDS = [
    // Replace with your actual extension ID(s)
    // Example: "abcdefghijklmnopqrstuvwxyz123456"
    "YOUR_EXTENSION_ID_HERE"
];

// Rate limit: requests per IP per minute
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        // Strict extension ID validation
        const isAllowedOrigin = ALLOWED_EXTENSION_IDS.some(id =>
            origin === `chrome-extension://${id}`
        );

        // CORS headers - only allow valid origins
        const corsHeaders = {
            "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Handle preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Block non-POST requests
        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders });
        }

        // Block unauthorized origins
        if (!isAllowedOrigin) {
            console.log(`🚫 Blocked request from unauthorized origin: ${origin}`);
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Rate limiting
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

        if (!env.RATE_LIMIT_KV) {
            console.warn("⚠️ RATE_LIMIT_KV not configured - rate limiting is DISABLED!");
            console.warn("To enable rate limiting, bind a KV namespace named 'RATE_LIMIT_KV' in Worker settings.");
        } else {
            const rateLimitKey = `ratelimit:${clientIP}`;
            const currentCount = parseInt(await env.RATE_LIMIT_KV.get(rateLimitKey) || "0");

            if (currentCount >= RATE_LIMIT) {
                console.log(`🚫 Rate limit exceeded for IP: ${clientIP}`);
                return new Response(JSON.stringify({ error: "Too many requests. Please wait." }), {
                    status: 429,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            await env.RATE_LIMIT_KV.put(rateLimitKey, String(currentCount + 1), {
                expirationTtl: RATE_WINDOW_SECONDS
            });
        }

        try {
            const body = await request.json();

            // Call Aliyun Qwen API
            const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${env.QWEN_API_KEY}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });

        } catch (error) {
            // Generic error - don't leak internal details
            console.error("❌ Worker error:", error.message);
            return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};
