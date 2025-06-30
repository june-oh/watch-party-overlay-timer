// 전역 상태
let isFetchingActive = false; 
let isOverlayVisible = false; 
let overlayMode = 'normal'; 
let timeDisplayMode = 'current_duration'; 
let titleDisplayMode = 'episode_series'; // NEW: 'episode_series', 'episode_only', 'none'
let overlayPositionSide = 'left'; 
let overlayTheme = 'light'; 
let overlayOffsetX = 8; // NEW: 가로 여백
let overlayOffsetY = 8; // NEW: 세로 여백
let seriesFontSize = 10; // NEW: 시리즈 폰트 크기
let episodeFontSize = 14; // NEW: 에피소드 폰트 크기
let currentTimeFontSize = 14; // NEW: 현재시간 폰트 크기
let durationFontSize = 14; // NEW: 전체시간 폰트 크기
let fontScale = 1.0; // NEW: 전체 폰트 배율 (0.5~2.0)
let overlayMinWidth = 150; // NEW: 오버레이 최소 너비
let overlayLineSpacing = 2; // NEW: 오버레이 줄간격
let overlayPadding = 8; // NEW: 오버레이 내부 여백
let showHostname = true; // NEW: 사이트 이름 표시 여부
let lastVideoInfo = null;
let currentTabId = null; 
let isError = false; 
let currentHostname = null;
let errorMessage = '';
let currentUrlByTabId = {}; // NEW: To store current URL for each tab
let streamingDisplayTabId = null; // NEW: To track streaming display tab
let streamingDisplayWindowId = null; // NEW: To track streaming display window

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
  overlayOffsetX = 8; // NEW: 초기화 시 오프셋 값 설정
  overlayOffsetY = 8; // NEW: 초기화 시 오프셋 값 설정
  seriesFontSize = 10; // NEW: 시리즈 폰트 크기
  episodeFontSize = 14; // NEW: 에피소드 폰트 크기
  currentTimeFontSize = 14; // NEW: 현재시간 폰트 크기
  durationFontSize = 14; // NEW: 전체시간 폰트 크기
  fontScale = 1.0; // NEW: 전체 폰트 배율 (0.5~2.0)
  overlayMinWidth = 150; // NEW: 오버레이 최소 너비
  overlayLineSpacing = 2; // NEW: 오버레이 줄간격
  overlayPadding = 8; // NEW: 오버레이 내부 여백
  showHostname = true; // NEW: 사이트 이름 표시 여부
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
        console.error(`BG: Extension context invalidated for tab ${tabId} during message: ${JSON.stringify(message)}. Re-initializing state.`, error);
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
    overlayPositionSide, overlayTheme, overlayOffsetX, overlayOffsetY, // NEW: 오프셋 값 포함
    seriesFontSize, episodeFontSize, currentTimeFontSize, durationFontSize, fontScale, overlayMinWidth, overlayLineSpacing, overlayPadding,
    showHostname, lastVideoInfo, 
    activeTabHostname: currentActiveTabHostnameForPopup, isError, errorMessage
  };

  chrome.runtime.sendMessage({ type: 'BACKGROUND_STATE_UPDATE', data: state }).catch(e => {});
  if (currentTabId) {
    await ensureContentScriptAndSendMessage(currentTabId, { 
        type: 'BACKGROUND_STATE_UPDATE', 
        data: { isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, titleDisplayMode, overlayPositionSide, overlayTheme, overlayOffsetX, overlayOffsetY, seriesFontSize, episodeFontSize, currentTimeFontSize, durationFontSize, fontScale, overlayMinWidth, overlayLineSpacing, overlayPadding, showHostname, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage } // NEW: 오프셋 값 포함
    });
  }
  
  // Send state to streaming display tab if it exists
  if (streamingDisplayTabId) {
    try {
      await chrome.tabs.sendMessage(streamingDisplayTabId, {
        type: 'BACKGROUND_STATE_UPDATE',
        data: { overlayMode, timeDisplayMode, overlayPositionSide, lastVideoInfo, activeTabHostname: currentHostname }
      });
    } catch (e) {
      console.warn('BG: Failed to send state to streaming display tab:', e.message);
      // Reset streaming display tab ID if tab no longer exists
      if (e.message.includes('Could not establish connection')) {
        streamingDisplayTabId = null;
      }
    }
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
          isError = false; errorMessage = '';
          responsePayload.isFetchingActive = isFetchingActive;

          try {
            if (isFetchingActive) {
              console.log(`BG: Starting fetching for tab ${currentTabId}`);
              lastVideoInfo = null; // 새 정보 가져오기 위해 초기화
              await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: 'start', forceRestart: true });
            } else {
              console.log(`BG: Stopping fetching for tab ${currentTabId}`);
              lastVideoInfo = null; // 정보 초기화
              await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: 'stop' });
            }
          } catch (e) {
            responsePayload.success = false; responsePayload.error = e.message;
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
          responsePayload.isOverlayVisible = isOverlayVisible;

          // 오버레이를 켤 때 정보 가져오기도 자동으로 켜기
          if (isOverlayVisible && !isFetchingActive) {
            isFetchingActive = true;
            responsePayload.isFetchingActive = true;
            try {
              await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: 'start' });
            } catch (e) {
              console.warn('BG: Failed to start fetching when showing overlay:', e.message);
            }
          }

          try {
            console.log(`BG: ${isOverlayVisible ? 'Showing' : 'Hiding'} overlay for tab ${currentTabId}`);
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_VISIBILITY', action: isOverlayVisible ? 'show' : 'hide' });
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
      
      case 'POPUP_SET_OVERLAY_OFFSET': // NEW CASE
        if (BGasActiveTabId && typeof message.offset === 'number' && message.offset >= 0 && message.offset <= 20) {
          currentTabId = BGasActiveTabId;
          overlayOffsetX = message.offset;
          overlayOffsetY = message.offset;
          isError = false; errorMessage = '';
          responsePayload.overlayOffsetX = overlayOffsetX;
          responsePayload.overlayOffsetY = overlayOffsetY;
          // content.js에 직접 CSS 변수를 변경하도록 메시지를 보낼 수도 있지만,
          // sendStateToAll()을 통해 일관되게 BACKGROUND_STATE_UPDATE로 전달하는 것이 좋음
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for offset.";
          isError = true; errorMessage = "활성 탭 없음 (Offset)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid offset value.";
        }
        break;

      case 'POPUP_SET_OVERLAY_OFFSET_X': // NEW CASE for horizontal offset
        if (BGasActiveTabId && typeof message.offsetX === 'number' && message.offsetX >= 0 && message.offsetX <= 100) {
          currentTabId = BGasActiveTabId;
          overlayOffsetX = message.offsetX;
          isError = false; errorMessage = '';
          responsePayload.overlayOffsetX = overlayOffsetX;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for offset X.";
          isError = true; errorMessage = "활성 탭 없음 (Offset X)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid offset X value.";
        }
        break;

      case 'POPUP_SET_OVERLAY_OFFSET_Y': // NEW CASE for vertical offset
        if (BGasActiveTabId && typeof message.offsetY === 'number' && message.offsetY >= 0 && message.offsetY <= 100) {
          currentTabId = BGasActiveTabId;
          overlayOffsetY = message.offsetY;
          isError = false; errorMessage = '';
          responsePayload.overlayOffsetY = overlayOffsetY;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for offset Y.";
          isError = true; errorMessage = "활성 탭 없음 (Offset Y)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid offset Y value.";
        }
        break;

      case 'POPUP_SET_SERIES_FONT_SIZE': // NEW CASE for series font size
        if (BGasActiveTabId && typeof message.seriesFontSize === 'number' && message.seriesFontSize >= 0 && message.seriesFontSize <= 50) {
          currentTabId = BGasActiveTabId;
          seriesFontSize = message.seriesFontSize;
          isError = false; errorMessage = '';
          responsePayload.seriesFontSize = seriesFontSize;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for series font size.";
          isError = true; errorMessage = "활성 탭 없음 (Series Font)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid series font size value.";
        }
        break;

      case 'POPUP_SET_EPISODE_FONT_SIZE': // NEW CASE for episode font size
        if (BGasActiveTabId && typeof message.episodeFontSize === 'number' && message.episodeFontSize >= 0 && message.episodeFontSize <= 50) {
          currentTabId = BGasActiveTabId;
          episodeFontSize = message.episodeFontSize;
          isError = false; errorMessage = '';
          responsePayload.episodeFontSize = episodeFontSize;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for episode font size.";
          isError = true; errorMessage = "활성 탭 없음 (Episode Font)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid episode font size value.";
        }
        break;

      case 'POPUP_SET_CURRENT_TIME_FONT_SIZE': // NEW CASE for current time font size
        if (BGasActiveTabId && typeof message.currentTimeFontSize === 'number' && message.currentTimeFontSize >= 0 && message.currentTimeFontSize <= 50) {
          currentTabId = BGasActiveTabId;
          currentTimeFontSize = message.currentTimeFontSize;
          isError = false; errorMessage = '';
          responsePayload.currentTimeFontSize = currentTimeFontSize;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for current time font size.";
          isError = true; errorMessage = "활성 탭 없음 (Current Time Font)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid current time font size value.";
        }
        break;

      case 'POPUP_SET_DURATION_FONT_SIZE': // NEW CASE for duration font size
        if (BGasActiveTabId && typeof message.durationFontSize === 'number' && message.durationFontSize >= 0 && message.durationFontSize <= 50) {
          currentTabId = BGasActiveTabId;
          durationFontSize = message.durationFontSize;
          isError = false; errorMessage = '';
          responsePayload.durationFontSize = durationFontSize;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for duration font size.";
          isError = true; errorMessage = "활성 탭 없음 (Duration Font)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid duration font size value.";
        }
        break;

      case 'POPUP_SET_FONT_SCALE': // NEW CASE for font scale
        if (BGasActiveTabId && typeof message.fontScale === 'number' && message.fontScale >= 0.5 && message.fontScale <= 2.0) {
          currentTabId = BGasActiveTabId;
          fontScale = message.fontScale;
          isError = false; errorMessage = '';
          responsePayload.fontScale = fontScale;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for font scale.";
          isError = true; errorMessage = "활성 탭 없음 (Font Scale)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid font scale value.";
        }
        break;

      case 'POPUP_SET_SHOW_HOSTNAME': // NEW CASE for show hostname toggle
        if (BGasActiveTabId && typeof message.showHostname === 'boolean') {
          currentTabId = BGasActiveTabId;
          showHostname = message.showHostname;
          isError = false; errorMessage = '';
          responsePayload.showHostname = showHostname;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for show hostname.";
          isError = true; errorMessage = "활성 탭 없음 (Show Hostname)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid show hostname value.";
        }
        break;

      case 'POPUP_SET_OVERLAY_MIN_WIDTH': // NEW CASE for overlay min width
        if (BGasActiveTabId && typeof message.overlayMinWidth === 'number' && message.overlayMinWidth >= 50 && message.overlayMinWidth <= 800) {
          currentTabId = BGasActiveTabId;
          overlayMinWidth = message.overlayMinWidth;
          isError = false; errorMessage = '';
          responsePayload.overlayMinWidth = overlayMinWidth;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for overlay min width.";
          isError = true; errorMessage = "활성 탭 없음 (Min Width)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid overlay min width value.";
        }
        break;

      case 'POPUP_SET_OVERLAY_LINE_SPACING': // NEW CASE for overlay line spacing
        if (BGasActiveTabId && typeof message.overlayLineSpacing === 'number' && message.overlayLineSpacing >= -5 && message.overlayLineSpacing <= 10) {
          currentTabId = BGasActiveTabId;
          overlayLineSpacing = message.overlayLineSpacing;
          isError = false; errorMessage = '';
          responsePayload.overlayLineSpacing = overlayLineSpacing;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for overlay line spacing.";
          isError = true; errorMessage = "활성 탭 없음 (Line Spacing)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid overlay line spacing value.";
        }
        break;

      case 'POPUP_SET_OVERLAY_PADDING': // NEW CASE for overlay padding
        if (BGasActiveTabId && typeof message.overlayPadding === 'number' && message.overlayPadding >= 2 && message.overlayPadding <= 20) {
          currentTabId = BGasActiveTabId;
          overlayPadding = message.overlayPadding;
          isError = false; errorMessage = '';
          responsePayload.overlayPadding = overlayPadding;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for overlay padding.";
          isError = true; errorMessage = "활성 탭 없음 (Padding)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid overlay padding value.";
        }
        break;

      case 'GET_POPUP_INITIAL_DATA':
        const [activeTabForPopup] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabForPopup?.id) {
            // 스트리밍 디스플레이 탭이 활성 탭인 경우 상태를 변경하지 않음
            if (activeTabForPopup.id !== streamingDisplayTabId) {
                currentTabId = activeTabForPopup.id;
                currentHostname = activeTabForPopup.url ? new URL(activeTabForPopup.url).hostname.replace(/^www\./, '') : null;
                if (activeTabForPopup.url) currentUrlByTabId[currentTabId] = activeTabForPopup.url;
                console.log(`BG: GET_POPUP_INITIAL_DATA - Updated currentTabId to ${currentTabId} (${currentHostname})`);
            } else {
                console.log(`BG: GET_POPUP_INITIAL_DATA - Active tab is streaming display tab, maintaining current state`);
            }
        } else {
            // 활성 탭이 없는 경우에만 상태 초기화
            if (!streamingDisplayTabId) {
                currentTabId = null; currentHostname = null;
                isFetchingActive = false; lastVideoInfo = null;
                console.log(`BG: GET_POPUP_INITIAL_DATA - No active tab found, reset state`);
            } else {
                console.log(`BG: GET_POPUP_INITIAL_DATA - No active tab but streaming display exists, maintaining state`);
            }
        }
        responsePayload = { 
            success: true, isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, 
            titleDisplayMode, overlayPositionSide, overlayTheme, overlayOffsetX, overlayOffsetY, // NEW: 오프셋 값 포함
            seriesFontSize, episodeFontSize, currentTimeFontSize, durationFontSize, fontScale, overlayMinWidth, overlayLineSpacing, overlayPadding,
            showHostname, lastVideoInfo, 
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
                data: { isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, titleDisplayMode, overlayPositionSide, overlayTheme, overlayOffsetX, overlayOffsetY, seriesFontSize, episodeFontSize, currentTimeFontSize, durationFontSize, fontScale, overlayMinWidth, overlayLineSpacing, overlayPadding, showHostname, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage } // NEW: 오프셋 값 포함
            });
        } else {
            // console.warn("BG: CONTENT_SCRIPT_READY received without sender.tab.id");
        }
        break;

      case 'VIDEO_INFO_UPDATE': 
        console.log('BG: Received VIDEO_INFO_UPDATE from tab:', sender.tab?.id, 'currentTabId:', currentTabId, 'data:', JSON.stringify(message.data));
        if (sender.tab?.id === currentTabId) {
          lastVideoInfo = message.data;
          isError = false; errorMessage = ''; 
          console.log('BG: Updated lastVideoInfo, streamingDisplayTabId:', streamingDisplayTabId);
          
          // Send video info to streaming display tab if it exists
          if (streamingDisplayTabId) {
            console.log('BG: Sending VIDEO_INFO_UPDATE to streaming display tab:', streamingDisplayTabId);
            try {
              chrome.tabs.sendMessage(streamingDisplayTabId, {
                type: 'VIDEO_INFO_UPDATE',
                data: lastVideoInfo
              }).catch(e => {
                console.warn('BG: Failed to send video info to streaming display tab:', e.message);
                if (e.message.includes('Could not establish connection')) {
                  console.log('BG: Resetting streamingDisplayTabId due to connection error');
                  streamingDisplayTabId = null;
                }
              });
            } catch (e) {
              // Handle sync error
              console.warn('BG: Error sending video info to streaming display tab:', e.message);
            }
          } else {
            console.log('BG: No streaming display tab to send video info to');
          }
        } else {
          console.log('BG: VIDEO_INFO_UPDATE ignored - not from current tab');
        }
        break;
      
      case 'CONTENT_SCRIPT_ERROR': 
        if (sender.tab?.id === currentTabId) {
          // console.error("BG: Received CONTENT_SCRIPT_ERROR:", message.error, "from tab:", currentTabId);
          isError = true;
          errorMessage = message.error || "콘텐츠 스크립트 오류";
        }
        break;

      case 'GET_ALL_SETTINGS': // NEW: 모든 설정 가져오기
        responsePayload.settings = {
          isFetchingActive,
          isOverlayVisible,
          overlayMode,
          timeDisplayMode,
          titleDisplayMode,
          overlayPositionSide,
          overlayTheme,
          overlayOffsetX,
          overlayOffsetY,
          seriesFontSize,
          episodeFontSize,
          currentTimeFontSize,
          durationFontSize,
          fontScale,
          overlayMinWidth,
          overlayLineSpacing,
          overlayPadding,
          showHostname
        };
        break;

      case 'RESET_ALL_SETTINGS': // NEW: 모든 설정 초기화
        // 기본값으로 초기화
        isFetchingActive = false;
        isOverlayVisible = false;
        overlayMode = 'normal';
        timeDisplayMode = 'current_duration';
        titleDisplayMode = 'episode_series';
        overlayPositionSide = 'right';
        overlayTheme = 'light';
        overlayOffsetX = 8;
        overlayOffsetY = 8;
        seriesFontSize = 10;
        episodeFontSize = 14;
        currentTimeFontSize = 14;
        durationFontSize = 14;
        fontScale = 1.0;
        overlayMinWidth = 150;
        overlayLineSpacing = 2;
        overlayPadding = 8;
        showHostname = true;
        lastVideoInfo = null;
        isError = false;
        errorMessage = '';
        
        // 모든 탭에 상태 업데이트 전송
        sendStateToAll();
        break;

      case 'LOAD_SETTINGS': // NEW: 설정 불러오기
        if (message.settings) {
          const settings = message.settings;
          
          // 안전하게 설정 적용 (유효성 검사 포함)
          if (typeof settings.isFetchingActive === 'boolean') isFetchingActive = settings.isFetchingActive;
          if (typeof settings.isOverlayVisible === 'boolean') isOverlayVisible = settings.isOverlayVisible;
          if (typeof settings.overlayMode === 'string') overlayMode = settings.overlayMode;
          if (typeof settings.timeDisplayMode === 'string') timeDisplayMode = settings.timeDisplayMode;
          if (typeof settings.titleDisplayMode === 'string') titleDisplayMode = settings.titleDisplayMode;
          if (typeof settings.overlayPositionSide === 'string') overlayPositionSide = settings.overlayPositionSide;
          if (typeof settings.overlayTheme === 'string') overlayTheme = settings.overlayTheme;
          if (typeof settings.overlayOffsetX === 'number' && settings.overlayOffsetX >= 0 && settings.overlayOffsetX <= 100) overlayOffsetX = settings.overlayOffsetX;
          if (typeof settings.overlayOffsetY === 'number' && settings.overlayOffsetY >= 0 && settings.overlayOffsetY <= 100) overlayOffsetY = settings.overlayOffsetY;
          if (typeof settings.seriesFontSize === 'number' && settings.seriesFontSize >= 0 && settings.seriesFontSize <= 50) seriesFontSize = settings.seriesFontSize;
          if (typeof settings.episodeFontSize === 'number' && settings.episodeFontSize >= 0 && settings.episodeFontSize <= 50) episodeFontSize = settings.episodeFontSize;
          if (typeof settings.currentTimeFontSize === 'number' && settings.currentTimeFontSize >= 0 && settings.currentTimeFontSize <= 50) currentTimeFontSize = settings.currentTimeFontSize;
          if (typeof settings.durationFontSize === 'number' && settings.durationFontSize >= 0 && settings.durationFontSize <= 50) durationFontSize = settings.durationFontSize;
          if (typeof settings.fontScale === 'number' && settings.fontScale >= 0.5 && settings.fontScale <= 2.0) fontScale = settings.fontScale;
          if (typeof settings.overlayMinWidth === 'number' && settings.overlayMinWidth >= 50 && settings.overlayMinWidth <= 800) overlayMinWidth = settings.overlayMinWidth;
          if (typeof settings.overlayLineSpacing === 'number' && settings.overlayLineSpacing >= -5 && settings.overlayLineSpacing <= 10) overlayLineSpacing = settings.overlayLineSpacing;
          if (typeof settings.overlayPadding === 'number' && settings.overlayPadding >= 2 && settings.overlayPadding <= 20) overlayPadding = settings.overlayPadding;
          if (typeof settings.showHostname === 'boolean') showHostname = settings.showHostname;
          
          isError = false;
          errorMessage = '';
          
          // 모든 탭에 상태 업데이트 전송
          sendStateToAll();
        } else {
          responsePayload.success = false;
          responsePayload.error = "Invalid settings data.";
        }
        break;

      // Streaming Display cases
      case 'REGISTER_STREAMING_DISPLAY_TAB':
        streamingDisplayTabId = message.tabId;
        console.log(`BG: Registered streaming display tab: ${streamingDisplayTabId}`);
        
        // Send initial state to streaming display tab
        if (streamingDisplayTabId) {
          try {
            await chrome.tabs.sendMessage(streamingDisplayTabId, {
              type: 'VIDEO_INFO_UPDATE',
              data: lastVideoInfo
            });
            await chrome.tabs.sendMessage(streamingDisplayTabId, {
              type: 'BACKGROUND_STATE_UPDATE',
              data: {
                overlayMode, timeDisplayMode, overlayPositionSide,
                lastVideoInfo, activeTabHostname: currentHostname
              }
            });
          } catch (e) {
            console.warn('BG: Failed to send initial state to streaming display tab:', e.message);
          }
        }
        break;

      case 'OVERLAY_DISPLAY_CONNECT':
        console.log('BG: Overlay display connected from window, sender.tab?.id:', sender.tab?.id);
        const overlayDisplayTabId = sender.tab?.id || null;
        
        // streamingDisplayTabId만 설정하고 currentTabId는 변경하지 않음
        streamingDisplayTabId = overlayDisplayTabId;
        console.log('BG: Set streamingDisplayTabId to:', streamingDisplayTabId, 'currentTabId remains:', currentTabId);
        
        responsePayload.success = true;
        responsePayload.streamingDisplayConnected = true;
        
        // Send initial state directly in response (extension pages can't receive tab messages)
        responsePayload.initialState = {
          isFetchingActive, isOverlayVisible, 
          overlayMode, timeDisplayMode, overlayPositionSide,
          lastVideoInfo, activeTabHostname: currentHostname,
          // 고급 설정 값들도 추가
          overlayTheme, overlayOffsetX, overlayOffsetY,
          seriesFontSize, episodeFontSize, currentTimeFontSize, durationFontSize,
          fontScale, overlayMinWidth, overlayLineSpacing, overlayPadding,
          showHostname
        };
        console.log('BG: Sending initial state to overlay display:', JSON.stringify(responsePayload.initialState));
        
        // 스트리밍 디스플레이가 연결되면 정보 가져오기만 자동 시작
        if (!isFetchingActive && currentTabId) {
          isFetchingActive = true;
          console.log('BG: Auto-started fetching when streaming display connected');
          sendStateToAll();
        }
        
        // Content script에 재시작 신호 보내기
        if (currentTabId) {
          ensureContentScriptAndSendMessage(currentTabId, { 
            type: 'TOGGLE_FETCHING', 
            action: 'start', 
            forceRestart: true 
          }).catch(e => console.warn('Error restarting fetching after overlay display connect:', e.message));
        }
        break;

      case 'REQUEST_OVERLAY_STATE':
        console.log('BG: Overlay state requested');
        responsePayload.success = true;
        responsePayload.data = {
          isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode,
          overlayPositionSide, overlayTheme, lastVideoInfo,
          activeTabHostname: currentHostname
        };
        break;

      case 'UPDATE_OVERLAY_SETTINGS':
        if (message.settings) {
          const { timeDisplayMode: newTimeMode } = message.settings;
          
          if (newTimeMode && ['current_duration', 'current_only', 'none'].includes(newTimeMode)) {
            timeDisplayMode = newTimeMode;
          }
          
          console.log('BG: Updated overlay settings from streaming display');
          
          // Broadcast updated settings to all tabs
          sendStateToAll();
        }
        break;

      case 'OPEN_STREAMING_DISPLAY_WINDOW':
        try {
          // Check if streaming display window already exists
          if (streamingDisplayWindowId) {
            try {
              const existingWindow = await chrome.windows.get(streamingDisplayWindowId);
              if (existingWindow) {
                // Focus existing window
                await chrome.windows.update(streamingDisplayWindowId, { focused: true });
                responsePayload.success = true;
                responsePayload.windowId = streamingDisplayWindowId;
                responsePayload.url = chrome.runtime.getURL('public/overlay-display.html');
                responsePayload.message = 'Existing window focused';
                break;
              }
            } catch (e) {
              // Window no longer exists, reset the ID
              streamingDisplayWindowId = null;
            }
          }
          
          // 정보 가져오기를 먼저 시작
          if (!isFetchingActive && currentTabId) {
            isFetchingActive = true;
            console.log('BG: Starting fetching before opening streaming display');
            
            // Content script에 정보 가져오기 시작 알림
            await ensureContentScriptAndSendMessage(currentTabId, { 
              type: 'TOGGLE_FETCHING', 
              action: 'start' 
            }).catch(e => console.warn('Failed to start fetching:', e.message));
            
            // 모든 탭에 상태 업데이트
            sendStateToAll();
          }
          
          // 1초 대기하여 정보를 받을 시간을 줌
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Create new window
          const displayUrl = chrome.runtime.getURL('public/overlay-display.html');
          const newWindow = await chrome.windows.create({
            url: displayUrl,
            type: 'popup',
            width: 600,
            height: 140, // 화살표 공간 포함 (110px 컨텐츠 + 30px 타이틀바)
            focused: true
          });
          
          streamingDisplayWindowId = newWindow.id;
          // Get the tab ID from the new window
          const tabs = await chrome.tabs.query({ windowId: newWindow.id });
          if (tabs.length > 0) {
            streamingDisplayTabId = tabs[0].id;
          }
          console.log('BG: Created streaming display window:', streamingDisplayWindowId, 'tab:', streamingDisplayTabId);
          
          responsePayload.success = true;
          responsePayload.windowId = newWindow.id;
          responsePayload.url = displayUrl;
          responsePayload.message = 'New window created';
          responsePayload.isFetchingActive = isFetchingActive;
          
        } catch (error) {
          console.error('BG: Failed to create streaming display window:', error);
          responsePayload.success = false;
          responsePayload.error = error.message;
        }
        break;

      case 'RESIZE_STREAMING_DISPLAY_WINDOW':
        if (streamingDisplayWindowId) {
          try {
            await chrome.windows.update(streamingDisplayWindowId, {
              width: message.width || 450,
              height: message.height || 110
            });
            console.log(`BG: Window resized to ${message.width}x${message.height}`);
            responsePayload.success = true;
          } catch (error) {
            console.error('BG: Failed to resize window:', error);
            responsePayload.success = false;
            responsePayload.error = error.message;
          }
        } else {
          console.warn('BG: No streaming display window to resize');
          responsePayload.success = false;
          responsePayload.error = 'No window found';
        }
        break;

      default:
        responsePayload.success = false; responsePayload.error = "Unknown message type";
        break;
    }

    if (message.type !== 'GET_POPUP_INITIAL_DATA' && message.type !== 'VIDEO_INFO_UPDATE' && message.type !== 'CONTENT_SCRIPT_READY' && message.type !== 'OPEN_STREAMING_DISPLAY_WINDOW' && message.type !== 'RESIZE_STREAMING_DISPLAY_WINDOW') {
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

            // 경로의 첫 부분이 'video' 또는 'vod'이고, 양쪽 모두 비디오 ID로 추정되는 두 번째 부분이 존재하는지 확인
            if ((prevPathParts[0] === 'video' || prevPathParts[0] === 'vod') &&
                (newPathParts[0] === 'video' || newPathParts[0] === 'vod') &&
                 prevPathParts.length > 1 && newPathParts.length > 1 ) { // [0]은 'video'/'vod', [1]은 ID. 따라서 길이가 2 이상이어야 함
              isSameContentGroup = true; // Chzzk 내 video/vod 섹션 이동 시 일단 상태 유지
              
              // 실제 비디오 ID가 변경된 경우
              if (prevPathParts[1] !== newPathParts[1]) { 
                forceUpdateVideoInfo = true;
                console.log(`BG: Chzzk - Navigating to different video ID (${prevPathParts[1]} -> ${newPathParts[1]}). Maintaining fetch, forcing video info update.`);
              }
            } else if ((prevPathParts[0] === 'video' || prevPathParts[0] === 'vod') &&
                       (newPathParts[0] === 'video' || newPathParts[0] === 'vod') &&
                       (prevPathParts.length <= 1 || newPathParts.length <= 1)) {
              // 한쪽 또는 양쪽 URL에 비디오 ID가 없는 경우 (예: /vod/ 에서 /vod/12345 로 가거나 그 반대)
              // 또는 /vod/12345 에서 /vod/ 로 가는 경우
              // 이 경우는 새로운 컨텐츠 그룹으로 간주하거나, ID가 생기거나 없어지는 것이므로,
              // 일단 fetch를 중단하고 새로 시작하게 하거나, 혹은 ID가 있는 쪽으로 업데이트를 강제할 수 있음.
              // 현재 로직에서는 isSameContentGroup이 false로 남아 shouldStopFetching = true가 될 것임.
              // 만약 /vod/ -> /vod/12345 이동 시 fetch를 유지하고 싶다면 추가 로직 필요.
              // 여기서는 기존 로직대로 isSameContentGroup = false로 두어, shouldStopFetching이 true가 되도록 함.
              // 필요하다면, 여기서 forceUpdateVideoInfo = true 등을 설정하여 다른 행동을 유도할 수 있음.
              console.log(`BG: Chzzk - Navigating to/from a page without a video ID. Prev path: ${prevPathParts.join('/')}, New path: ${newPathParts.join('/')}`);
            }
          }
        }
        shouldStopFetching = !isSameContentGroup;

        // NEW: 오버레이가 켜져있고 지원 사이트라면, 자동으로 Fetching 시작/유지
        if (isOverlayVisible && newUrlObj.hostname && (
          newUrlObj.hostname.includes('laftel.net') || 
          newUrlObj.hostname.includes('chzzk.naver.com') ||
          newUrlObj.hostname.includes('netflix.com') ||
          newUrlObj.hostname.includes('youtube.com')
        )) {
          if (!isFetchingActive) { // 꺼져 있었다면 강제로 켬
            console.log(`BG: Overlay is visible on a supported site (${newUrlObj.hostname}). Forcing fetching to active.`);
            isFetchingActive = true;
          }
          // isFetchingActive가 이미 true였거나 방금 true로 설정됨.
          // 정보 가져오기를 유지하고, 새 정보를 가져오도록 강제.
          shouldStopFetching = false; 
          forceUpdateVideoInfo = true; 
          console.log(`BG: Overlay visible on supported site. Ensured fetching is active and will update/restart. shouldStopFetching=${shouldStopFetching}, forceUpdateVideoInfo=${forceUpdateVideoInfo}`);
        }

      } catch (e) {
        // URL 파싱 등에 실패하면 안전하게 중단하도록 함.
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
        // Fetching이 중단되었으므로 content script에도 명시적으로 알릴 수 있습니다.
        ensureContentScriptAndSendMessage(tabId, { type: 'TOGGLE_FETCHING', action: 'stop' }).catch(e => console.warn("Error sending stop fetching on URL change:", e.message));
      }
    } else if (forceUpdateVideoInfo) {
        console.log(`BG: Tab ${tabId} - Maintaining fetching, but forcing lastVideoInfo to null for update and explicitly restarting fetch in content script.`);
        lastVideoInfo = null; // 새 비디오 정보를 가져오도록 강제
        isError = false; errorMessage = ''; // 이전 오류 상태 초기화
        // isFetchingActive는 true로 유지됩니다.
        sendStateToAll(); // lastVideoInfo가 null이 되었음을 알림 (UI 즉시 반영용)
        
        // content.js에 정보 가져오기를 "재시작"하도록 명시적으로 알립니다.
        // isFetchingActive가 true이므로, content.js는 이 메시지를 받으면 즉시 정보 가져오기를 시작/재시작해야 합니다.
        ensureContentScriptAndSendMessage(tabId, { type: 'TOGGLE_FETCHING', action: 'start', forceRestart: true }) 
          .catch(e => console.warn(`Error sending restart fetching to content script for tab ${tabId}:`, e.message));
        // 아이콘은 이미 fetching 상태이므로 변경 필요 없을 가능성 높음
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
  // Clean up streaming display tab reference
  if (streamingDisplayTabId === tabId) {
    streamingDisplayTabId = null;
  }
});

// Handle window closing for streaming display window
chrome.windows.onRemoved.addListener((windowId) => {
  if (streamingDisplayWindowId === windowId) {
    streamingDisplayWindowId = null;
    streamingDisplayTabId = null;
    console.log('BG: Streaming display window closed');
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const previousTabId = currentTabId;
  const activatedTabId = activeInfo.tabId;
  
  // 스트리밍 디스플레이 탭이 활성화되어도 currentTabId를 변경하지 않음
  if (activatedTabId === streamingDisplayTabId) {
    console.log('BG: Streaming display tab activated, maintaining currentTabId:', currentTabId);
    return;
  }
  
  currentTabId = activatedTabId;
  console.log('BG: Tab activated, updated currentTabId from', previousTabId, 'to', currentTabId);
  
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