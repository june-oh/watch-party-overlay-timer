// 전역 상태
let isFetchingActive = false; 
let isOverlayVisible = false; 
let overlayMode = 'normal'; 
let timeDisplayMode = 'current_duration'; 
let titleDisplayMode = 'episode_series'; // NEW: 'episode_series', 'episode_only', 'none'
let overlayPositionSide = 'left'; 
let overlayTheme = 'light'; 
let lastVideoInfo = null;
let currentTabId = null; 
let isError = false; 
let currentHostname = null;
let errorMessage = '';
let currentUrlByTabId = {}; // NEW: To store current URL for each tab

const ICONS = {
  active: { "16": "icons/icon-active-16.png", "48": "icons/icon-active-48.png", "128": "icons/icon-active-128.png" },
  inactive: { "16": "icons/icon-inactive-16.png", "48": "icons/icon-inactive-48.png", "128": "icons/icon-inactive-128.png" },
  fetching: { "16": "icons/icon-fetching-16.png", "48": "icons/icon-fetching-48.png", "128": "icons/icon-fetching-128.png" },
  error: { "16": "icons/icon-error-16.png", "48": "icons/icon-error-48.png", "128": "icons/icon-error-128.png" }
};

function updateActionIcon() {
  let iconPathsObj;
  if (isError) iconPathsObj = ICONS.error;
  else if (isFetchingActive) iconPathsObj = ICONS.fetching;
  else iconPathsObj = ICONS.inactive;
  
  const iconDetails = {};
  if (iconPathsObj["16"]) iconDetails["16"] = chrome.runtime.getURL(iconPathsObj["16"]);
  if (iconPathsObj["48"]) iconDetails["48"] = chrome.runtime.getURL(iconPathsObj["48"]);
  if (iconPathsObj["128"]) iconDetails["128"] = chrome.runtime.getURL(iconPathsObj["128"]);

  if (Object.keys(iconDetails).length > 0) {
    chrome.action.setIcon({ path: iconDetails }).catch(e => console.warn("Error setting icon:", e.message));
  } else {
    // console.error("No valid icon paths found for setIcon.");
  }
}

function initializeExtensionState() {
  isFetchingActive = false;
  isOverlayVisible = false; 
  overlayMode = 'normal';
  timeDisplayMode = 'current_duration';
  titleDisplayMode = 'episode_series'; 
  overlayPositionSide = 'left';
  overlayTheme = 'light';
  lastVideoInfo = null;
  currentTabId = null; 
  currentHostname = null;
  isError = false;
  errorMessage = '';
  console.log("BACKGROUND.JS: Extension state initialized/reset.");
  updateActionIcon(); 
}

chrome.runtime.onInstalled.addListener(() => {
  initializeExtensionState();
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtensionState();
});

async function sendMessageToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    // console.log(`BG: Attempting to send message to tab ${tabId}:`, JSON.stringify(message));
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || "Unknown error sending message to content script";
        // console.warn(`BG: Error sending message to CS (tab ${tabId}): ${errMsg}`, "Original message:", JSON.stringify(message));
        reject(new Error(errMsg));
      } else {
        // console.log(`BG: Successfully sent message to CS (tab ${tabId}) and received response:`, response, "Original message:", JSON.stringify(message));
        resolve(response);
      }
    });
  });
}

async function ensureContentScriptAndSendMessage(tabId, message, retryCount = 0) {
  if (!tabId) return Promise.reject(new Error("No tabId provided"));
  try {
    const response = await sendMessageToContentScript(tabId, message);
    if (response?.success) return response;
    // console.warn(`BG: Message to CS (tab ${tabId}) not successful or no response.success. Response:`, response, "Original message:", message);
    return response; 
  } catch (error) {
    const errMsg = error.message || "Unknown error";
    if (errMsg.includes("Could not establish connection. Receiving end does not exist.")) {
      if (retryCount < 1) { 
        // console.log(`BG: ensureCS - Content script not ready in tab ${tabId}. Injecting and retrying...`);
        try {
          await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['src/content.js'] });
          // console.log(`BG: ensureCS - Content script injected in tab ${tabId}. Retrying message...`);
          return ensureContentScriptAndSendMessage(tabId, message, retryCount + 1);
        } catch (injectionError) {
          // console.error(`BG: ensureCS - Failed to inject content script in tab ${tabId}: ${injectionError.message}`);
          return Promise.reject(injectionError);
        }
      } else {
        // console.warn(`BG: ensureCS - Max retries reached for tab ${tabId}. Could not send message.`);
        return Promise.reject(new Error(`Max retries reached for tab ${tabId}. Content script not responding.`));
      }
    } else if (errMsg.includes("Extension context invalidated.")) {
        console.error("BG: Extension context invalidated. Cannot send message.");
        initializeExtensionState();
        return Promise.reject(error);
    }
    return Promise.reject(error);
  }
}

async function sendStateToAll() {
  let currentActiveTabHostnameForPopup = 'N/A';
  if (currentTabId) {
      try {
          const tab = await chrome.tabs.get(currentTabId);
          if (tab && tab.url) currentActiveTabHostnameForPopup = new URL(tab.url).hostname.replace(/^www\./, '');
          else if (tab && !tab.url && currentHostname) currentActiveTabHostnameForPopup = currentHostname;
      } catch (e) { 
          if(currentHostname) currentActiveTabHostnameForPopup = currentHostname;
      }
  }

  const state = {
    isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, titleDisplayMode,
    overlayPositionSide, overlayTheme, lastVideoInfo, 
    activeTabHostname: currentActiveTabHostnameForPopup, isError, errorMessage
  };

  chrome.runtime.sendMessage({ type: 'BACKGROUND_STATE_UPDATE', data: state }).catch(e => {});
  if (currentTabId) {
    ensureContentScriptAndSendMessage(currentTabId, { type: 'BACKGROUND_STATE_UPDATE', data: state }).catch(e => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => { 
    let responsePayload = { success: true, error: null, type: message.type + "_RESPONSE" };
    let BGasActiveTabId = null;
    if (sender.tab?.id) BGasActiveTabId = sender.tab.id;
    else if (currentTabId) BGasActiveTabId = currentTabId;
    else {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) BGasActiveTabId = activeTab.id;
        } catch(e) {/* */}
    }
    
    switch (message.type) {
      case 'POPUP_TOGGLE_FETCHING':
        if (BGasActiveTabId) {
          currentTabId = BGasActiveTabId;
          isFetchingActive = !isFetchingActive;
          lastVideoInfo = null; 
          isError = false; errorMessage = '';
          try {
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: isFetchingActive ? 'start' : 'stop' });
            responsePayload.isFetchingActive = isFetchingActive;
          } catch (e) {
            responsePayload.success = false; responsePayload.error = e.message;
            isFetchingActive = false; 
            isError = true; errorMessage = "콘텐츠 스크립트 통신 실패 (Fetching)";
          }
        } else {
          responsePayload.success = false; responsePayload.error = "No active tab for fetching.";
          isFetchingActive = false; isError = true; errorMessage = "활성 탭 없음 (Fetching)";
        }
        break;

      case 'POPUP_TOGGLE_VISIBILITY':
        if (BGasActiveTabId) {
          currentTabId = BGasActiveTabId;
          isOverlayVisible = !isOverlayVisible;
          isError = false; errorMessage = '';
          try {
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_VISIBILITY', action: isOverlayVisible ? 'show' : 'hide' });
            responsePayload.isOverlayVisible = isOverlayVisible;
          } catch (e) {
            responsePayload.success = false; responsePayload.error = e.message;
            isError = true; errorMessage = "콘텐츠 스크립트 통신 실패 (Visibility)";
          }
        } else {
          responsePayload.success = false; responsePayload.error = "No active tab for visibility.";
          isOverlayVisible = false; isError = true; errorMessage = "활성 탭 없음 (Visibility)";
        }
        break;

      case 'POPUP_SET_OVERLAY_MODE':
        if (BGasActiveTabId && ['normal', 'compact'].includes(message.mode)) {
          currentTabId = BGasActiveTabId;
          overlayMode = message.mode;
          isError = false; errorMessage = '';
          try {
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_OVERLAY_MODE', mode: overlayMode });
            responsePayload.overlayMode = overlayMode;
          } catch (e) {
            responsePayload.success = false; responsePayload.error = e.message;
            isError = true; errorMessage = "콘텐츠 스크립트 통신 실패 (Mode)";
          }
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for mode.";
          isError = true; errorMessage = "활성 탭 없음 (Mode)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid mode.";
        }
        break;

      case 'POPUP_SET_OVERLAY_POSITION':
        if (BGasActiveTabId && ['left', 'right'].includes(message.position)) {
          currentTabId = BGasActiveTabId;
          overlayPositionSide = message.position;
          isError = false; errorMessage = '';
          responsePayload.overlayPositionSide = overlayPositionSide;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for position.";
          isError = true; errorMessage = "활성 탭 없음 (Position)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid position.";
        }
        break;

      case 'POPUP_SET_TIME_DISPLAY_MODE':
        if (BGasActiveTabId && ['current_duration', 'current_only', 'none'].includes(message.mode)) {
          currentTabId = BGasActiveTabId;
          timeDisplayMode = message.mode;
          isError = false; errorMessage = '';
          responsePayload.timeDisplayMode = timeDisplayMode;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for time display.";
          isError = true; errorMessage = "활성 탭 없음 (TimeDisplay)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid time display mode.";
        }
        break;
      
      case 'POPUP_SET_OVERLAY_THEME':
        if (BGasActiveTabId && ['light', 'dark', 'greenscreen-white-text', 'greenscreen-black-text'].includes(message.theme)) {
          currentTabId = BGasActiveTabId;
          overlayTheme = message.theme;
          isError = false; errorMessage = '';
          responsePayload.overlayTheme = overlayTheme;
        } else if (!BGasActiveTabId) {
            responsePayload.success = false; responsePayload.error = "No active tab for theme.";
            isError = true; errorMessage = "활성 탭 없음 (Theme)";
        } else {
            responsePayload.success = false; responsePayload.error = 'Invalid theme.';
        }
        break;

      case 'POPUP_SET_TITLE_DISPLAY_MODE':
        if (BGasActiveTabId && ['episode_series', 'episode_only', 'none'].includes(message.mode)) {
          currentTabId = BGasActiveTabId;
          titleDisplayMode = message.mode;
          isError = false; errorMessage = '';
          responsePayload.titleDisplayMode = titleDisplayMode;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for title display mode.";
          isError = true; errorMessage = "활성 탭 없음 (TitleDisplay)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid title display mode.";
        }
        break;
      
      case 'GET_POPUP_INITIAL_DATA':
        const [activeTabForPopup] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabForPopup?.id) {
            currentTabId = activeTabForPopup.id;
            currentHostname = activeTabForPopup.url ? new URL(activeTabForPopup.url).hostname.replace(/^www\./, '') : null;
            if (activeTabForPopup.url) currentUrlByTabId[currentTabId] = activeTabForPopup.url;
        } else {
            currentTabId = null; currentHostname = null;
            isFetchingActive = false; lastVideoInfo = null;
        }
        responsePayload = { 
            success: true, isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, 
            titleDisplayMode, overlayPositionSide, overlayTheme, lastVideoInfo, 
            activeTabHostname: currentHostname, isError, errorMessage 
        };
        break;
      
      case 'CONTENT_SCRIPT_READY':
        if (sender.tab?.id) {
            currentTabId = sender.tab.id;
            currentHostname = sender.tab.url ? new URL(sender.tab.url).hostname.replace(/^www\./, '') : null;
            if (sender.tab.url) currentUrlByTabId[currentTabId] = sender.tab.url;
            // console.log(`BG: CONTENT_SCRIPT_READY from tab ${currentTabId} (${currentHostname}). Sending SYNC_INITIAL_BG_STATE.`);
            await ensureContentScriptAndSendMessage(currentTabId, { 
                type: 'SYNC_INITIAL_BG_STATE', 
                data: { isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, titleDisplayMode, overlayPositionSide, overlayTheme, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage } 
            });
        } else {
            // console.warn("BG: CONTENT_SCRIPT_READY received without sender.tab.id");
        }
        break;

      case 'VIDEO_INFO_UPDATE': 
        if (sender.tab?.id === currentTabId) {
          lastVideoInfo = message.data;
          isError = false; errorMessage = ''; 
        }
        break;
      
      case 'CONTENT_SCRIPT_ERROR': 
        if (sender.tab?.id === currentTabId) {
          // console.error("BG: Received CONTENT_SCRIPT_ERROR:", message.error, "from tab:", currentTabId);
          isError = true;
          errorMessage = message.error || "콘텐츠 스크립트 오류";
        }
        break;

      default:
        responsePayload.success = false; responsePayload.error = "Unknown message type";
        break;
    }

    if (message.type !== 'GET_POPUP_INITIAL_DATA' && message.type !== 'VIDEO_INFO_UPDATE' && message.type !== 'CONTENT_SCRIPT_READY') {
        sendStateToAll();
    }
    updateActionIcon();
    sendResponse(responsePayload);

  })(); 
  return true; 
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (currentTabId === tabId && changeInfo.url) {
    const previousUrl = currentUrlByTabId[tabId]; 
    const newUrl = changeInfo.url;
    let shouldStopFetching = true; 
    let forceUpdateVideoInfo = false; // NEW: 비디오 정보 강제 업데이트 플래그

    // console.log(`BG: Tab ${tabId} updated. Prev URL stored: "${previousUrl}", New URL from changeInfo: "${newUrl}", Tab URL at event time: "${tab.url}"`);

    if (previousUrl && newUrl && previousUrl !== newUrl) {
      try {
        const prevUrlObj = new URL(previousUrl);
        const newUrlObj = new URL(newUrl);
        let isSameContentGroup = false;

        if (prevUrlObj.hostname !== newUrlObj.hostname) {
          isSameContentGroup = false;
        } else {
          if (newUrlObj.hostname.includes('laftel.net')) {
            const prevPathParts = prevUrlObj.pathname.split('/').filter(p => p);
            const newPathParts = newUrlObj.pathname.split('/').filter(p => p);
            if (prevPathParts[0] === 'player' && newPathParts[0] === 'player' && prevPathParts[1] && newPathParts[1]) {
              if (prevPathParts[1] === newPathParts[1]) { // 같은 시리즈 ID
                isSameContentGroup = true;
                if (prevPathParts[2] !== newPathParts[2]) { // 에피소드 ID 변경 시
                    forceUpdateVideoInfo = true;
                    console.log(`BG: Laftel - Same series, different episode. Maintaining fetch, forcing video info update.`);
                }
              }
            }
          } else if (newUrlObj.hostname.includes('chzzk.naver.com')) {
            const prevPathParts = prevUrlObj.pathname.split('/').filter(p => p);
            const newPathParts = newUrlObj.pathname.split('/').filter(p => p);
            if ((prevPathParts[0] === 'video' || prevPathParts[0] === 'vod') && 
                (newPathParts[0] === 'video' || newPathParts[0] === 'vod') && 
                 prevPathParts.length > 0 && newPathParts.length > 0 ) {
              isSameContentGroup = true; // Chzzk 내 video/vod 섹션 이동 시 일단 상태 유지
              if (prevPathParts[1] !== newPathParts[1]) { // 실제 비디오 ID가 변경된 경우
                forceUpdateVideoInfo = true;
                console.log(`BG: Chzzk - Navigating to different video ID (${prevPathParts[1]} -> ${newPathParts[1]}). Maintaining fetch, forcing video info update.`);
              }
            }
          }
        }
        shouldStopFetching = !isSameContentGroup;
      } catch (e) {
        shouldStopFetching = true;
      }
    } else if (previousUrl === newUrl) {
        shouldStopFetching = false; 
    } else { 
        shouldStopFetching = true; 
    }

    currentUrlByTabId[tabId] = newUrl; // URL은 항상 업데이트

    if (shouldStopFetching) {
      if (isFetchingActive || lastVideoInfo) { 
        isFetchingActive = false;
        lastVideoInfo = null;
        isError = false;
        errorMessage = '';
        sendStateToAll(); 
        updateActionIcon(); 
      }
    } else if (forceUpdateVideoInfo) {
        console.log(`BG: Tab ${tabId} - Maintaining fetching, but forcing lastVideoInfo to null for update.`);
        lastVideoInfo = null; // 새 비디오 정보를 가져오도록 강제
        isError = false; errorMessage = ''; // 이전 오류 상태 초기화
        sendStateToAll(); // lastVideoInfo가 null이 되었음을 알림
        // updateActionIcon(); // isFetchingActive는 true이므로 아이콘 변경은 필요 없을 수 있음
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (currentUrlByTabId[tabId]) {
    delete currentUrlByTabId[tabId];
  }
  if (currentTabId === tabId) {
    initializeExtensionState(); 
    sendStateToAll();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const previousTabId = currentTabId;
  currentTabId = activeInfo.tabId;
  try {
    const tab = await chrome.tabs.get(currentTabId);
    if (tab && tab.url) {
        currentUrlByTabId[currentTabId] = tab.url;
        currentHostname = new URL(tab.url).hostname.replace(/^www\./, '');
    } else if (tab && !tab.url) {
        currentHostname = null; 
        currentUrlByTabId[currentTabId] = null; 
    }
  } catch (e) { 
    currentHostname = null;
    if(currentTabId) currentUrlByTabId[currentTabId] = null;
  }
  isError = false; errorMessage = '';
  sendStateToAll();
  updateActionIcon();
});

console.log("BACKGROUND.JS: Service worker started and listeners attached."); 