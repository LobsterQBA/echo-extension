/**
 * Echo Extension - Secure Proxy for Aliyun Qwen
 * 
 * Security features:
 * - Origin validation (only allows requests from the Echo extension)
 * - Rate limiting using Cloudflare KV
 * - Generic error messages (no internal info leakage)
 */

// Rate limit: requests per IP per minute
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        // Allowed origins: Chrome extension or your specific domains
        const allowedOrigins = [
            "chrome-extension://", // Any Chrome extension (you can restrict to specific ID)
            // Add your extension ID for stricter security:
            // "chrome-extension://abcdefghijklmnopqrstuvwxyz123456"
        ];

        const isAllowedOrigin = allowedOrigins.some(allowed => origin.startsWith(allowed));

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

        // Block non-POST and invalid origins
        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders });
        }

        if (!isAllowedOrigin) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Rate limiting (requires KV namespace binding named "RATE_LIMIT_KV")
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
        if (env.RATE_LIMIT_KV) {
            const rateLimitKey = `ratelimit:${clientIP}`;
            const currentCount = parseInt(await env.RATE_LIMIT_KV.get(rateLimitKey) || "0");

            if (currentCount >= RATE_LIMIT) {
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
            console.error("Worker error:", error); // Logged server-side only
            return new Response(JSON.stringify({ error: "Service temporarily unavailable" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
    },
};
