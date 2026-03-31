// Echo — Background Service Worker
// The silent coordinator

// Enable side panel on YouTube video pages only
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  
  const isYouTubeVideo = tab.url.includes('youtube.com/watch');
  
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: isYouTubeVideo
    });
  } catch (error) {
    // Tab might be closing, ignore
  }
});

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Store video info from content script
  if (message.type === 'VIDEO_INFO' && message.data) {
    chrome.storage.session.set({ 
      currentVideo: message.data 
    }).catch(() => {});
    return false;
  }
  
  // Open side panel request from content script
  if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {
        // Side panel might already be open
      });
    }
    return false;
  }
  
  // Get current video info for side panel
  if (message.type === 'GET_CURRENT_VIDEO') {
    chrome.storage.session.get(['currentVideo']).then((result) => {
      sendResponse(result.currentVideo || null);
    }).catch(() => {
      sendResponse(null);
    });
    return true; // Keep channel open for async response
  }
  
  return false;
});

// Also allow opening via extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url?.includes('youtube.com/watch')) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      // Ignore
    }
  }
});

// Listen for storage changes and notify side panel
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.currentVideo) {
    // Side panel will pick this up via its own listener
  }
});
