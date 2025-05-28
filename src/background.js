// 전역 상태
let isFetchingActive = false; 
let isOverlayVisible = false; 
let overlayMode = 'normal'; 
let timeDisplayMode = 'current_duration'; 
let titleDisplayMode = 'episode_series'; // NEW: 'episode_series', 'episode_only', 'none'
let overlayPositionSide = 'left'; 
let overlayTheme = 'light'; 
let overlayOffset = 8; // NEW: 오버레이 전체 여백 값
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
  overlayOffset = 8; // NEW: 초기화 시 오프셋 값 설정
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
    overlayPositionSide, overlayTheme, overlayOffset, // NEW: 오프셋 값 포함
    lastVideoInfo, 
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
          const previousFetchingState = isFetchingActive;
          isFetchingActive = !isFetchingActive;
          isError = false; errorMessage = '';
          responsePayload.isFetchingActive = isFetchingActive;

          try {
            await ensureContentScriptAndSendMessage(currentTabId, { 
              type: 'TOGGLE_FETCHING', 
              action: isFetchingActive ? 'start' : 'stop',
              forceRestart: !previousFetchingState && isFetchingActive
            });
            
            if (!isFetchingActive) {
              lastVideoInfo = null; // 정보 가져오기 중지 시 정보 초기화
            }
          } catch (e) {
            responsePayload.success = false; 
            responsePayload.error = e.message;
            isError = true; 
            errorMessage = "콘텐츠 스크립트 통신 실패 (Fetching)";
            // 실패 시 상태 복원
            isFetchingActive = previousFetchingState;
          }
        } else {
          responsePayload.success = false; 
          responsePayload.error = "No active tab for fetching.";
          isFetchingActive = false; 
          isError = true; 
          errorMessage = "활성 탭 없음 (Fetching)";
        }
        break;

      case 'POPUP_TOGGLE_VISIBILITY':
        if (BGasActiveTabId) {
          currentTabId = BGasActiveTabId;
          const previousOverlayVisibleState = isOverlayVisible;
          isOverlayVisible = !isOverlayVisible;
          isError = false; errorMessage = '';
          responsePayload.isOverlayVisible = isOverlayVisible;

          try {
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_VISIBILITY', action: isOverlayVisible ? 'show' : 'hide' });
            
            // 오버레이를 켜는 경우, 지원되는 사이트이고 fetching이 꺼져있으면 자동으로 fetching 시작
            if (isOverlayVisible && !previousOverlayVisibleState) { // 막 켜진 경우
              const tab = await chrome.tabs.get(currentTabId);
              if (tab && tab.url) {
                const currentUrlObj = new URL(tab.url);
                if (currentUrlObj.hostname && (
                  currentUrlObj.hostname.includes('laftel.net') || 
                  currentUrlObj.hostname.includes('chzzk.naver.com') ||
                  currentUrlObj.hostname.includes('netflix.com') ||
                  currentUrlObj.hostname.includes('youtube.com')
                )) {
                  if (!isFetchingActive) {
                    console.log(`BG: Overlay turned ON for supported site (${currentUrlObj.hostname}). Starting fetching automatically.`);
                    isFetchingActive = true;
                    lastVideoInfo = null; // 새 정보 가져오기 위해 초기화
                    // responsePayload.isFetchingActive = isFetchingActive; // sendStateToAll에서 일괄 전송
                    // content.js에 fetching 시작/재시작 알림
                    await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: 'start', forceRestart: true });
                  } else {
                    // 이미 Fetching 중이라면, Video Info만 업데이트하도록 할 수도 있음 (선택적)
                    console.log(`BG: Overlay turned ON for supported site (${currentUrlObj.hostname}). Fetching already active. Ensuring info update.`);
                    lastVideoInfo = null; // 새 정보 가져오기 위해 초기화
                    await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: 'start', forceRestart: true }); //혹시 모르니 재시작
                  }
                }
              }
            }
            // sendStateToAll()은 스위치 문 바깥에서 호출되므로 여기서 isFetchingActive 변경사항도 함께 전파됨
          } catch (e) {
            responsePayload.success = false; responsePayload.error = e.message;
            isError = true; errorMessage = "콘텐츠 스크립트 통신 실패 (Visibility)";
            // 실패 시 상태 복원 고려
            if (isOverlayVisible !== previousOverlayVisibleState) isOverlayVisible = previousOverlayVisibleState; 
            if (isFetchingActive && message.type === 'POPUP_TOGGLE_VISIBILITY') { /* isFetchingActive 변경은 여기서 직접 안했으므로 복원 불필요 */}
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
          overlayOffset = message.offset;
          isError = false; errorMessage = '';
          responsePayload.overlayOffset = overlayOffset;
          // content.js에 직접 CSS 변수를 변경하도록 메시지를 보낼 수도 있지만,
          // sendStateToAll()을 통해 일관되게 BACKGROUND_STATE_UPDATE로 전달하는 것이 좋음
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for offset.";
          isError = true; errorMessage = "활성 탭 없음 (Offset)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid offset value.";
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
            titleDisplayMode, overlayPositionSide, overlayTheme, overlayOffset, // NEW: 오프셋 값 포함
            lastVideoInfo, 
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
                data: { isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, titleDisplayMode, overlayPositionSide, overlayTheme, overlayOffset, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage } // NEW: 오프셋 값 포함
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