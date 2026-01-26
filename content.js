// Echo · 回声 — Content Script
// "让它长在标题与信息流的缝隙里"

(function () {
  'use strict';

  let omegaButton = null;
  let lastUrl = location.href;
  let injectionAttempts = 0;
  const MAX_ATTEMPTS = 15; // Reduced from 30 for better performance

  // ==========================================
  // Visibility Helpers
  // ==========================================

  function isVisible(el) {
    return el && el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  function getVisibleElement(selector) {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).find(isVisible) || null;
  }

  // ==========================================
  // Video Info Extraction
  // ==========================================

  function getVideoInfo() {
    const title =
      document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent ||
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent ||
      document.querySelector('#title h1 yt-formatted-string')?.textContent ||
      document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent ||
      document.title.replace(' - YouTube', '');

    const channel =
      document.querySelector('#owner ytd-channel-name yt-formatted-string a')?.textContent ||
      document.querySelector('#channel-name a')?.textContent ||
      document.querySelector('ytd-channel-name a')?.textContent ||
      '';

    const videoId = new URLSearchParams(window.location.search).get('v');

    return {
      title: title?.trim() || 'Unknown',
      channel: channel?.trim() || '',
      videoId,
      url: window.location.href
    };
  }

  // ==========================================
  // Transcript Fetching
  // ==========================================

  async function getTranscript(videoId) {
    try {
      // Method 1: Try to get from YouTube's player response
      const playerResponse = await fetchPlayerResponse(videoId);
      if (playerResponse) {
        const transcript = await extractTranscriptFromPlayer(playerResponse);
        if (transcript) return transcript;
      }

      // Method 2: Try to get from the caption tracks in page
      const captionTrack = await getCaptionTrackFromPage();
      if (captionTrack) {
        return await fetchCaptionTrack(captionTrack);
      }

      return null;
    } catch (error) {
      console.log('Echo: Could not fetch transcript', error);
      return null;
    }
  }

  async function fetchPlayerResponse(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        credentials: 'include'
      });
      const html = await response.text();

      // Extract ytInitialPlayerResponse
      const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (match) {
        return JSON.parse(match[1]);
      }
    } catch (e) { }

    // Try from window object
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }

    return null;
  }

  async function extractTranscriptFromPlayer(playerResponse) {
    try {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) return null;

      // Prefer English or auto-generated
      let track = captions.find(t => t.languageCode === 'en') ||
        captions.find(t => t.languageCode?.startsWith('en')) ||
        captions[0];

      if (!track?.baseUrl) return null;

      const response = await fetch(track.baseUrl);
      const xml = await response.text();

      return parseTranscriptXml(xml);
    } catch (e) {
      return null;
    }
  }

  function getCaptionTrackFromPage() {
    // Try to find caption track URL from the page's player data
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text.includes('captionTracks')) {
        const match = text.match(/"captionTracks":\s*(\[.+?\])/);
        if (match) {
          try {
            const tracks = JSON.parse(match[1]);
            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
            return track?.baseUrl;
          } catch (e) { }
        }
      }
    }
    return null;
  }

  async function fetchCaptionTrack(url) {
    try {
      const response = await fetch(url);
      const xml = await response.text();
      return parseTranscriptXml(xml);
    } catch (e) {
      return null;
    }
  }

  function parseTranscriptXml(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const textElements = doc.querySelectorAll('text');

    const segments = [];
    textElements.forEach(el => {
      const text = el.textContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\n/g, ' ')
        .trim();

      if (text) {
        segments.push({
          text,
          start: parseFloat(el.getAttribute('start') || 0),
          duration: parseFloat(el.getAttribute('dur') || 0)
        });
      }
    });

    // Combine into full transcript
    const fullText = segments.map(s => s.text).join(' ');

    return {
      segments,
      fullText,
      language: 'en'
    };
  }

  // ==========================================
  // Store and Send Data
  // ==========================================

  function storeVideoInfo() {
    const info = getVideoInfo();
    if (info.videoId) {
      chrome.storage.session.set({ currentVideo: info }).catch(() => { });
      chrome.runtime.sendMessage({ type: 'VIDEO_INFO', data: info }).catch(() => { });
    }
  }

  async function storeTranscript() {
    const info = getVideoInfo();
    if (!info.videoId) return null;

    const transcript = await getTranscript(info.videoId);
    if (transcript) {
      const data = {
        ...info,
        transcript: transcript.fullText,
        transcriptSegments: transcript.segments
      };
      chrome.storage.session.set({ currentVideoWithTranscript: data }).catch(() => { });
      chrome.runtime.sendMessage({ type: 'VIDEO_WITH_TRANSCRIPT', data }).catch(() => { });
      return data;
    }
    return null;
  }

  // ==========================================
  // Omega Button Creation
  // ==========================================

  function createOmegaButton() {
    if (omegaButton && document.contains(omegaButton)) {
      return omegaButton;
    }

    const button = document.createElement('button');
    button.id = 'echo-omega-trigger';
    button.className = 'idle';
    button.setAttribute('aria-label', 'Echo · 召唤灵魂');

    // 添加内联样式确保可见性
    button.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 36px !important;
      height: 36px !important;
      margin-left: 8px !important;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      opacity: 0.35 !important;
      transition: all 0.4s ease !important;
      font-family: Georgia, serif !important;
      font-size: 18px !important;
      color: #888 !important;
      vertical-align: middle !important;
    `;

    button.textContent = 'Ω';

    button.addEventListener('click', handleOmegaClick);

    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.color = '#D4A017';
      button.style.textShadow = '0 0 20px rgba(212, 160, 23, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('summoning')) {
        button.style.opacity = '0.35';
        button.style.color = '#888';
        button.style.textShadow = 'none';
      }
    });

    omegaButton = button;
    return button;
  }

  // ==========================================
  // Click Handler
  // ==========================================

  async function handleOmegaClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const button = e.currentTarget;
    button.classList.add('summoning');
    button.style.opacity = '1';
    button.style.color = '#D4A017';

    // Store video info first
    storeVideoInfo();

    // Start fetching transcript in background
    storeTranscript();

    // Open side panel
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    } catch (error) {
      console.log('Echo: Opening side panel');
    }

    // Reset button state
    setTimeout(() => {
      button.classList.remove('summoning');
      button.style.opacity = '0.35';
      button.style.color = '#888';
      button.style.textShadow = 'none';
    }, 3000);
  }

  // ==========================================
  // Injection Points - 2024/2025 YouTube DOM
  // ==========================================

  function findInjectionPoint() {
    // YouTube 2024/2025+ structure - use visibility checks for duplicate IDs

    // Strategy 1: Visible #owner within watch metadata (most reliable)
    const owner = getVisibleElement('ytd-watch-metadata #owner') || getVisibleElement('#owner');
    if (owner) {
      const subscribeBtn = owner.querySelector('ytd-subscribe-button-renderer') ||
        owner.querySelector('#subscribe-button');
      if (subscribeBtn && isVisible(subscribeBtn)) {
        return { element: subscribeBtn, position: 'afterend' };
      }
      return { element: owner, position: 'beforeend' };
    }

    // Strategy 2: Visible #top-row
    const topRow = getVisibleElement('#top-row');
    if (topRow) {
      return { element: topRow, position: 'beforeend' };
    }

    // Strategy 3: #actions (like/share buttons)
    const actions = getVisibleElement('#actions');
    if (actions) {
      const flexContainer = actions.querySelector('ytd-menu-renderer') ||
        actions.querySelector('#flexible-item-buttons');
      if (flexContainer && isVisible(flexContainer)) {
        return { element: flexContainer, position: 'beforeend' };
      }
      return { element: actions, position: 'beforeend' };
    }

    // Strategy 4-6: Fallbacks with visibility checks
    const fallbacks = [
      'ytd-watch-metadata',
      '#above-the-fold',
      'ytd-video-primary-info-renderer'
    ];

    for (const selector of fallbacks) {
      const el = getVisibleElement(selector);
      if (el) return { element: el, position: 'beforeend' };
    }

    return null;
  }

  // ==========================================
  // Injection Logic
  // ==========================================

  function injectOmegaButton() {
    // Check if on video page
    if (!location.href.includes('youtube.com/watch')) {
      document.body.removeAttribute('data-echo-video-page');
      removeOmegaButton();
      return false;
    }

    document.body.setAttribute('data-echo-video-page', 'true');

    // Check if already injected AND visible
    const existing = document.getElementById('echo-omega-trigger');
    if (existing && isVisible(existing)) {
      return true;
    } else if (existing) {
      // Remove hidden instance
      existing.remove();
      omegaButton = null;
    }

    // Find visible injection point
    const injection = findInjectionPoint();
    if (!injection) {
      console.log('Echo: No visible injection point found, retrying...');
      return false;
    }

    // Create and inject button
    const button = createOmegaButton();

    try {
      injection.element.insertAdjacentElement(injection.position, button);
      console.log('Echo: Ω button injected into', injection.element.tagName, injection.element.id || '');

      // Store video info after successful injection
      setTimeout(storeVideoInfo, 500);

      return true;
    } catch (e) {
      console.log('Echo: Injection failed', e);
      return false;
    }
  }

  function removeOmegaButton() {
    const btn = document.getElementById('echo-omega-trigger');
    if (btn) {
      btn.remove();
      omegaButton = null;
    }
  }

  // ==========================================
  // Retry Logic with Backoff
  // ==========================================

  function attemptInjection() {
    if (injectionAttempts >= MAX_ATTEMPTS) {
      console.log('Echo: Max injection attempts reached');
      return;
    }

    if (!injectOmegaButton()) {
      injectionAttempts++;
      const delay = Math.min(300 * Math.pow(1.3, injectionAttempts), 5000);
      setTimeout(attemptInjection, delay);
    } else {
      injectionAttempts = 0;
    }
  }

  // ==========================================
  // Navigation Handling (YouTube SPA)
  // ==========================================

  function handleNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      injectionAttempts = 0;
      removeOmegaButton();

      if (location.href.includes('youtube.com/watch')) {
        setTimeout(attemptInjection, 800);
      }
    }
  }

  // ==========================================
  // Message Listener
  // ==========================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_VIDEO_INFO') {
      sendResponse(getVideoInfo());
      return true;
    }

    if (message.type === 'GET_TRANSCRIPT') {
      const info = getVideoInfo();
      getTranscript(info.videoId).then(transcript => {
        sendResponse({ ...info, transcript: transcript?.fullText || null });
      });
      return true; // Keep channel open for async
    }

    return false;
  });

  // ==========================================
  // Initialize
  // ==========================================

  function init() {
    console.log('Echo: Content script initializing...');

    // 初始注入
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(attemptInjection, 1000);
      });
    } else {
      setTimeout(attemptInjection, 1000);
    }

    // 监听 YouTube SPA 导航 with debounce
    let mutationTimeout = null;
    const observer = new MutationObserver(() => {
      // Debounce: wait 300ms after last mutation before executing
      if (mutationTimeout) clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        handleNavigation();

        // 如果按钮被 YouTube 移除了，重新注入
        if (location.href.includes('youtube.com/watch') &&
          !document.getElementById('echo-omega-trigger')) {
          attemptInjection();
        }
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听 popstate
    window.addEventListener('popstate', () => {
      setTimeout(handleNavigation, 300);
    });

    // 监听 yt-navigate-finish (YouTube 自己的导航事件)
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(() => {
        injectionAttempts = 0;
        attemptInjection();
      }, 500);
    });
  }

  init();
})();
