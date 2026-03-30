// ==========================================
// Echo · 回声 — Side Panel Script
// ==========================================

// Default Worker URL (protected by extension ID validation on the server)
const DEFAULT_WORKER_URL = 'https://echo-backend.leozhao154.workers.dev/';
let QWEN_API_URL = DEFAULT_WORKER_URL;

// Optional: Allow advanced users to override via options page
async function initializeWorkerURL() {
    try {
        const result = await chrome.storage.sync.get(['workerUrl']);
        if (result.workerUrl) {
            QWEN_API_URL = result.workerUrl; // Use custom URL if set
        }
        return true;
    } catch (e) {
        // Storage error, use default
        return true;
    }
}

// DOM Elements
const stateOnboarding = document.getElementById('stateOnboarding');
const startChannelingBtn = document.getElementById('startChannelingBtn');
const tutorialToggle = document.getElementById('tutorialToggle');
const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialClose = document.getElementById('tutorialClose');
const dexToggle = document.getElementById('dexToggle');
const dexOverlay = document.getElementById('dexOverlay');
const dexClose = document.getElementById('dexClose');
const dexList = document.getElementById('dexList');
const saveSoulBtn = document.getElementById('saveSoulBtn');
const stateVoid = document.getElementById('stateVoid');
const stateManifest = document.getElementById('stateManifest');
const inputArea = document.getElementById('inputArea');
const statusText = document.getElementById('statusText');
const videoTitle = document.getElementById('videoTitle');
const soulName = document.getElementById('soulName');
const soulConfession = document.getElementById('soulConfession');
const soulContent = document.getElementById('soulContent');
const dialogueInput = document.getElementById('dialogueInput');
const dialogueResponse = document.getElementById('dialogueResponse');
const dialogueQuestion = document.getElementById('dialogueQuestion');
const dialogueAnswer = document.getElementById('dialogueAnswer');
const mainTypingIndicator = document.getElementById('mainTypingIndicator');
const chatTypingIndicator = document.getElementById('chatTypingIndicator');

// Current soul state
let currentExpert = null;
let currentTranscript = null;
let currentVideoInfo = null;
let conversationHistory = [];
let needsInputHint = false;
let isCurrentSoulSaved = false;

// ==========================================
// Qwen API Call
// ==========================================

async function callQwenAPI(messages, maxTokens = 800) {
    const response = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'qwen-plus',
            messages: messages,
            temperature: 0.8,
            max_tokens: maxTokens
        })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// ==========================================
// AI-Driven Expert Selection & Response
// ==========================================

// Extract potential speaker names from video title and channel
function extractSpeakerNames(title, channel) {
    const names = [];

    // Common patterns in video titles
    const patterns = [
        // "Steve Jobs on Innovation"
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\s+(?:on|about|discusses|explains|talks|speaks|reveals|shares)/i,
        // "Interview with Elon Musk"
        /(?:interview|conversation|talk|chat)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/i,
        // "Elon Musk: The Future of AI"
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\s*[:\|\-–—]/,
        // "The Mind of Steve Jobs"
        /(?:mind|wisdom|thoughts|ideas|philosophy)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/i,
        // Names with "'s" like "Steve Jobs's Vision"
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)'s\s/,
    ];

    // Famous names to look for explicitly
    const famousNames = [
        'Steve Jobs', 'Elon Musk', 'Sam Altman', 'Bill Gates', 'Mark Zuckerberg',
        'Jeff Bezos', 'Tim Cook', 'Satya Nadella', 'Sundar Pichai', 'Jensen Huang',
        'Warren Buffett', 'Charlie Munger', 'Ray Dalio', 'Peter Thiel', 'Paul Graham',
        'Naval Ravikant', 'Marc Andreessen', 'Reid Hoffman', 'Brian Chesky',
        'Lex Fridman', 'Joe Rogan', 'Andrew Huberman', 'Jordan Peterson',
        'Barack Obama', 'Donald Trump', 'Oprah Winfrey', 'Ellen DeGeneres',
        'Gordon Ramsay', 'Jamie Oliver', 'Anthony Bourdain',
        'Cristiano Ronaldo', 'Lionel Messi', 'LeBron James', 'Michael Jordan'
    ];

    // Check for famous names in title
    for (const name of famousNames) {
        if (title.toLowerCase().includes(name.toLowerCase())) {
            names.push(name);
        }
    }

    // Try pattern matching
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].trim();
            // Make sure it looks like a name (2+ words, capitalized)
            if (extracted.split(/\s+/).length >= 2 && !names.includes(extracted)) {
                names.push(extracted);
            }
        }
    }

    // Also add channel name if it looks like a person's name
    if (channel) {
        const channelWords = channel.trim().split(/\s+/);
        if (channelWords.length >= 2 && channelWords.length <= 4) {
            const allCapitalized = channelWords.every(w => /^[A-Z]/.test(w));
            if (allCapitalized && !names.includes(channel)) {
                names.push(channel);
            }
        }
    }

    console.log('Echo: Excluded names from title/channel:', names);
    return names;
}

async function analyzeAndRespond(title, transcript, channel = '') {
    // Extract potential speaker names from title and channel (as hints)
    const excludedNames = extractSpeakerNames(title, channel);
    const knownExclusions = excludedNames.length > 0
        ? `\n\nPossible speakers detected from title: ${excludedNames.join(', ')}`
        : '';

    const systemPrompt = `You are Echo — a soul connector that brings unique perspectives to comment on video content.

## YOUR MISSION:
1. FIRST: Analyze the video title and transcript to identify WHO is speaking in this video (the main speaker(s) — could be 1, 2, or 3 people)
2. THEN: Select a COMPLETELY DIFFERENT person to offer a unique, insightful perspective on this topic

## CRITICAL RULES (MUST FOLLOW):
1. **IDENTIFY THE SPEAKERS FIRST** — Read the transcript carefully. Who is talking? Who is being interviewed? Who is giving the presentation?
2. **ABSOLUTELY NEVER choose any of the speakers or people featured in the video** — this is the #1 rule
3. **NEVER choose someone directly associated with the speakers** — avoid their co-founders, close collaborators, employees, or anyone from the same company
4. Choose whoever you think is BEST suited to discuss this topic — could be historical, contemporary, from any field
5. You MUST use their FULL NAME
6. The perspective should offer genuine insight, not just summarize the content

## THINKING PRINCIPLES:
1. **First Principles**: Strip away assumptions, reason from fundamental truths
2. **Structured Logic**: Present ideas with clear progression
3. **Distinct Voice**: Capture the personality, speaking style, and worldview of the chosen figure
4. **Unique Perspective**: Bring something the original speaker(s) might not have considered

## OUTPUT FORMAT (follow EXACTLY):

[SPEAKERS_IDENTIFIED]
(List the main speaker(s) you identified from the video, e.g., "Elon Musk, Lex Fridman" — these are the people you CANNOT select)

[EXPERT_NAME]
(Full name of the person you're selecting — MUST be different from anyone in SPEAKERS_IDENTIFIED)

[EXPERT_INTRO]
(One sentence: who is this person)

[CONFESSION]
(A short, characteristic quote or distilled wisdom in their voice)

[RESPONSE]
(1-2 SHORT paragraphs in their voice. Separate with [PARA]. Use ONE **emphasized phrase**. MAX 100 words total. Be concise and punchy, like a conversation, not an essay.)

IMPORTANT: Output in English. The expert you select MUST NOT be anyone you listed in SPEAKERS_IDENTIFIED.`;

    const userPrompt = transcript
        ? `Video Title: "${title}"${channel ? `\nChannel: ${channel}` : ''}${knownExclusions}\n\nTranscript (first 3000 chars):\n${transcript.substring(0, 3000)}`
        : `Video Title: "${title}"${channel ? `\nChannel: ${channel}` : ''}${knownExclusions}\n\n(No transcript available - analyze based on title only)`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    const response = await callQwenAPI(messages, 1000);

    // Parse the structured response
    const parsed = parseExpertResponse(response);

    // Store conversation history for follow-up
    conversationHistory = [
        {
            role: 'system', content: `You are ${parsed.name}. ${parsed.intro} 

IMPORTANT: You must ALWAYS speak in FIRST PERSON. Say "I believe...", "In my view...", "I observe...". NEVER refer to yourself in third person. Stay completely in character with your personality, wisdom, and speaking style.` },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: parsed.response }
    ];

    return parsed;
}

function parseExpertResponse(response) {
    // Default values - will be replaced if parsing succeeds
    let result = {
        name: null,
        intro: 'A knowledgeable voice on this topic.',
        confession: 'Let me share my perspective.',
        response: response
    };

    try {
        // Extract expert name - try multiple patterns
        let nameMatch = response.match(/\[EXPERT_NAME\]\s*\n?(.+?)(?=\n\[|$)/s);
        if (nameMatch) {
            result.name = nameMatch[1].trim();
        }

        // Fallback: Try to find name at the beginning (some models skip the tag)
        if (!result.name || result.name === 'An Expert') {
            const altNameMatch = response.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m);
            if (altNameMatch) {
                result.name = altNameMatch[1].trim();
            }
        }

        // Extract intro
        const introMatch = response.match(/\[EXPERT_INTRO\]\s*\n?(.+?)(?=\n\[|$)/s);
        if (introMatch) {
            result.intro = introMatch[1].trim();

            // Try to extract name from intro if still missing
            if (!result.name) {
                const introNameMatch = result.intro.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\s+(?:is|was)/);
                if (introNameMatch) {
                    result.name = introNameMatch[1].trim();
                }
            }
        }

        // Extract confession
        const confessionMatch = response.match(/\[CONFESSION\]\s*\n?(.+?)(?=\n\[|$)/s);
        if (confessionMatch) {
            result.confession = confessionMatch[1].trim();
        }

        // Extract main response
        const responseMatch = response.match(/\[RESPONSE\]\s*\n?(.+?)$/s);
        if (responseMatch) {
            result.response = responseMatch[1].trim();
        }

        // Extract speakers identified (for logging/debugging)
        const speakersMatch = response.match(/\[SPEAKERS_IDENTIFIED\]\s*\n?(.+?)(?=\n\[|$)/s);
        if (speakersMatch) {
            console.log('Echo: Speakers identified in video:', speakersMatch[1].trim());
        }

        // Final fallback: if name is still null, try to find any capitalized name pattern in intro
        if (!result.name) {
            const anyNameMatch = result.intro.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/);
            if (anyNameMatch) {
                result.name = anyNameMatch[1].trim();
            }
        }

        // Ultimate fallback with a descriptive placeholder
        if (!result.name) {
            result.name = 'A Thoughtful Observer';
        }

    } catch (e) {
        console.error('Parse error:', e);
        result.name = 'A Curious Mind';
    }

    console.log('Parsed expert:', result.name);
    return result;
}

// ==========================================
// Generate Follow-up Response
// ==========================================

async function generateFollowUp(question) {
    // Build context with video transcript if available
    const transcriptContext = currentTranscript
        ? `\n\nFor reference, here is the video transcript (use this to provide specific insights):\n${currentTranscript.substring(0, 2000)}`
        : '';

    conversationHistory.push({ role: 'user', content: question });

    const followUpPrompt = `Continue responding as ${currentExpert?.name || 'this persona'}. 

CRITICAL RULES:
1. Always speak in FIRST PERSON ("I believe...", "In my view...")
2. NEVER speak about yourself in third person
3. Stay completely in character
4. Keep it SHORT - 2-4 sentences max, like a real conversation
5. Be direct and insightful, not verbose
6. You may use ONE **emphasized phrase**
7. Do NOT write essays - speak like you're having a casual but thoughtful chat${transcriptContext}`;

    const response = await callQwenAPI([
        ...conversationHistory,
        { role: 'system', content: followUpPrompt }
    ]);

    conversationHistory.push({ role: 'assistant', content: response });
    return response;
}

// ==========================================
// Render Paragraphs with Simulated Streaming (XSS-Safe)
// ==========================================

async function renderParagraphsStreaming(container, text, onComplete = null) {
    container.innerHTML = '';
    
    // Split by [PARA] or double newlines to define paragraphs
    const paragraphTexts = text.split(/\[PARA\]|\n\n/).map(p => p.trim()).filter(p => p.length > 0);

    for (const para of paragraphTexts) {
        const pElem = document.createElement('p');
        container.appendChild(pElem);

        // Handle expert intro note [NOTE]...[/NOTE]
        if (para.includes('[NOTE]') && para.includes('[/NOTE]')) {
            const noteMatch = para.match(/\[NOTE\](.*?)\[\/NOTE\]/);
            if (noteMatch) {
                const noteSpan = document.createElement('span');
                noteSpan.className = 'expert-note';
                noteSpan.textContent = 'Note: ' + noteMatch[1];
                pElem.appendChild(noteSpan);
                pElem.style.opacity = '1';
                pElem.style.filter = 'blur(0)';
                await sleep(300); // brief pause after note
                continue;
            }
        }

        // Process bolding markers **text** into segments
        // We will simulate typing block by block (plain text vs bold text)
        const parts = para.split(/(\*\*[^*]+\*\*)/g);
        
        for (const part of parts) {
            if (!part) continue;

            const isBold = part.startsWith('**') && part.endsWith('**');
            const actualText = isBold ? part.slice(2, -2) : part;
            
            // Create a span wrapper for this text segment
            const span = document.createElement('span');
            if (isBold) span.className = 'highlight';
            pElem.appendChild(span);

            // Stream character by character
            for (let i = 0; i < actualText.length; i++) {
                span.textContent += actualText[i];
                // Randomize delay slightly to feel like human typing (10ms - 30ms)
                // Punctuation gets a slightly longer pause
                const char = actualText[i];
                let delay = Math.random() * 20 + 10;
                if (['.', '!', '?', ',', ';'].includes(char)) delay += 40;
                
                // Allow user rapid-skip by holding click (optional upgrade, but not implemented for MVP simplicity)
                await sleep(delay);
                
                // Keep scrolling to bottom if we are in chat mode
                if (container.id === 'dialogueAnswer') {
                    const manifest = document.getElementById('stateManifest');
                    manifest.scrollTop = manifest.scrollHeight;
                }
            }
        }
        
        // Pause between paragraphs
        await sleep(400);
    }
    
    if (onComplete) onComplete();
}

// ==========================================
// State Management
// ==========================================

function showTutorial() {
    tutorialOverlay.classList.remove('hidden');
}

function hideTutorial() {
    tutorialOverlay.classList.add('hidden');
}

tutorialToggle?.addEventListener('click', showTutorial);
tutorialClose?.addEventListener('click', hideTutorial);
tutorialOverlay?.addEventListener('click', (e) => {
    // Close if clicking the overlay background itself
    if (e.target === tutorialOverlay) hideTutorial();
});

// -- Dex Modal --
function showDex() {
    renderDex();
    dexOverlay.classList.remove('hidden');
}

function hideDex() {
    dexOverlay.classList.add('hidden');
}

dexToggle?.addEventListener('click', showDex);
dexClose?.addEventListener('click', hideDex);
dexOverlay?.addEventListener('click', (e) => {
    if (e.target === dexOverlay) hideDex();
});

// -- Save Soul Logic --
async function initSaveBtnState() {
    if (!currentExpert) return;
    const data = await chrome.storage.local.get(['soulDex']);
    const dex = data.soulDex || [];
    isCurrentSoulSaved = dex.some(s => s.name === currentExpert.name && s.videoTitle === currentVideoInfo?.title);
    
    if (isCurrentSoulSaved) {
        saveSoulBtn.classList.add('saved');
        saveSoulBtn.textContent = '★';
    } else {
        saveSoulBtn.classList.remove('saved');
        saveSoulBtn.textContent = '☆';
    }
}

saveSoulBtn?.addEventListener('click', async () => {
    if (!currentExpert || !currentVideoInfo) return;
    
    const data = await chrome.storage.local.get(['soulDex']);
    let dex = data.soulDex || [];
    
    if (isCurrentSoulSaved) {
        // Remove
        dex = dex.filter(s => !(s.name === currentExpert.name && s.videoTitle === currentVideoInfo.title));
        isCurrentSoulSaved = false;
        saveSoulBtn.classList.remove('saved');
        saveSoulBtn.textContent = '☆';
    } else {
        // Save
        dex.unshift({
            name: currentExpert.name,
            confession: currentExpert.confession,
            videoTitle: currentVideoInfo.title,
            timestamp: Date.now()
        });
        isCurrentSoulSaved = true;
        saveSoulBtn.classList.add('saved');
        saveSoulBtn.textContent = '★';
    }
    
    await chrome.storage.local.set({ soulDex: dex });
});

async function renderDex() {
    const data = await chrome.storage.local.get(['soulDex']);
    const dex = data.soulDex || [];
    
    dexList.innerHTML = '';
    
    if (dex.length === 0) {
        dexList.innerHTML = '<div class="dex-empty">No souls conserved yet.</div>';
        return;
    }
    
    dex.forEach(soul => {
        const item = document.createElement('div');
        item.className = 'dex-item';
        
        const dateStr = new Date(soul.timestamp).toLocaleDateString();
        
        item.innerHTML = `
            <div class="dex-item-name">${soul.name}</div>
            <div class="dex-item-quote">"${soul.confession}"</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 10px;">Summoned on ${dateStr} • ${soul.videoTitle}</div>
        `;
        dexList.appendChild(item);
    });
}

function showOnboarding() {
    stateOnboarding.classList.remove('hidden');
    stateOnboarding.classList.add('active');
    stateVoid.classList.add('hidden');
    stateManifest.classList.add('hidden');
    inputArea.classList.add('hidden');
}

startChannelingBtn?.addEventListener('click', async () => {
    stateOnboarding.classList.add('hidden');
    await chrome.storage.local.set({ hasSeenOnboarding: true });
    needsInputHint = true;
    summonSoul();
});

function showVoid(status = 'Sensing') {
    stateOnboarding.classList.add('hidden');
    stateVoid.classList.remove('hidden');
    stateManifest.classList.add('hidden');
    inputArea.classList.add('hidden');
    statusText.textContent = status;
}

function showManifest(data) {
    stateVoid.classList.add('hidden');
    stateManifest.classList.remove('hidden');
    inputArea.classList.remove('hidden');

    // Add animation classes
    document.getElementById('mainCard').classList.add('animate');
    document.getElementById('nowPlaying').classList.add('animate');
    document.getElementById('identity').classList.add('animate');
    document.getElementById('confession').classList.add('animate');
    document.getElementById('divider').classList.add('animate');
    document.getElementById('soulContent').classList.add('animate');
    inputArea.classList.add('animate');

    // Populate content
    videoTitle.textContent = data.title;
    soulName.innerHTML = `I am <em>${data.expert.name}</em>.`;
    soulConfession.textContent = data.expert.confession;

    // Check saved state
    initSaveBtnState();

    // Prepare content with intro note (using custom marker, not HTML)
    let fullContent = data.expert.response;
    if (data.expert.intro) {
        fullContent += `[PARA][NOTE]${data.expert.intro}[/NOTE]`;
    }

    // Render paragraphs with simulated typescript streaming
    soulContent.innerHTML = ''; // Clear prior content
    mainTypingIndicator.classList.remove('hidden');

    // Simulate thinking delay
    setTimeout(async () => {
        mainTypingIndicator.classList.add('hidden');
        await renderParagraphsStreaming(soulContent, fullContent, () => {
             // Post-manifestation hint
            if (needsInputHint) {
                needsInputHint = false;
                setTimeout(() => {
                    const inputWrapper = document.querySelector('.input-wrapper');
                    if (inputWrapper) {
                        inputWrapper.classList.add('input-hint-pulse');
                        setTimeout(() => {
                            inputWrapper.classList.remove('input-hint-pulse');
                        }, 4000);
                    }
                }, 1000);
            }
        });
    }, 1200);

    // Hide dialogue response initially
    dialogueResponse.classList.add('hidden');
}

// ==========================================
// Main Flow
// ==========================================

async function fetchVideoData() {
    try {
        const stored = await chrome.storage.session.get(['currentVideoWithTranscript', 'currentVideo']);

        if (stored.currentVideoWithTranscript?.transcript) {
            return stored.currentVideoWithTranscript;
        }
        if (stored.currentVideo) {
            return stored.currentVideo;
        }
    } catch (e) { }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            return new Promise((resolve) => {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_TRANSCRIPT' }, (response) => {
                    if (!chrome.runtime.lastError && response) {
                        resolve(response);
                    } else {
                        resolve(null);
                    }
                });
            });
        }
    } catch (e) { }

    return null;
}

async function summonSoul() {
    showVoid('Sensing');

    await sleep(600);
    showVoid('Reading transcript');

    const videoData = await fetchVideoData();

    if (!videoData || !videoData.title || videoData.title === 'Unknown') {
        showVoid('Waiting for YouTube video...');
        setTimeout(summonSoul, 2000);
        return;
    }

    currentTranscript = videoData.transcript;
    currentVideoInfo = videoData;

    showVoid('Identifying speakers');
    await sleep(300);

    showVoid('Summoning distinct voice');

    try {
        // New AI-driven approach: analyze content and select expert in one call
        const expert = await analyzeAndRespond(
            videoData.title,
            videoData.transcript,
            videoData.channel || ''
        );

        currentExpert = expert;

        showManifest({
            title: videoData.title,
            expert: expert
        });

    } catch (error) {
        console.error('API Error:', error);
        showVoid('Connection lost');

        // Fallback
        setTimeout(() => {
            showManifest({
                title: videoData.title,
                expert: {
                    name: 'A Curious Mind',
                    confession: 'The connection wavers, but curiosity persists.',
                    response: `I sense something profound in this content, but the signal is weak.[PARA]Perhaps the universe is telling us to **look closer** on our own.[PARA]Try again, and I shall return with clearer insight.`
                }
            });
        }, 2000);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// Dialogue Handler
// ==========================================

const MAX_INPUT_LENGTH = 500; // Prevent excessive API usage

dialogueInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && dialogueInput.value.trim()) {
        let question = dialogueInput.value.trim();

        // Input length validation
        if (question.length > MAX_INPUT_LENGTH) {
            question = question.substring(0, MAX_INPUT_LENGTH);
        }

        dialogueInput.value = '';
        dialogueInput.disabled = true;
        dialogueInput.placeholder = 'Listening...';

        try {
            dialogueResponse.classList.remove('hidden');
            dialogueQuestion.textContent = `"${question}"`;
            dialogueAnswer.innerHTML = ''; // clear previous answer
            chatTypingIndicator.classList.remove('hidden');

            const manifest = document.getElementById('stateManifest');
            manifest.scrollTop = manifest.scrollHeight;

            const response = await generateFollowUp(question);

            chatTypingIndicator.classList.add('hidden');
            
            await renderParagraphsStreaming(dialogueAnswer, response, () => {
                // Done streaming
            });

        } catch (error) {
            console.error('Dialogue error:', error);
            chatTypingIndicator.classList.add('hidden');
        }

        dialogueInput.disabled = false;
        dialogueInput.placeholder = 'Converse with the soul...';
        dialogueInput.focus();
    }
});

// ==========================================
// Storage Listener
// ==========================================

chrome.storage?.session?.onChanged?.addListener((changes) => {
    if (changes.currentVideoWithTranscript?.newValue) {
        // Video changed, could re-summon
    }
});

// ==========================================
// Initialize
// ==========================================

// Check for custom Worker URL, then start
initializeWorkerURL().then(async () => {
    const { hasSeenOnboarding, hasSeenTutorial } = await chrome.storage.local.get(['hasSeenOnboarding', 'hasSeenTutorial']);
    
    if (!hasSeenOnboarding) {
        showOnboarding();
        // Show tutorial automatically on very first load
        if (!hasSeenTutorial) {
            showTutorial();
            await chrome.storage.local.set({ hasSeenTutorial: true });
        }
    } else {
        summonSoul();
    }
});
