// 전역 상태
let isFetchingActive = false; // 정보 가져오기 활성화 상태 (초기값 false)
let isOverlayVisible = false;  // 오버레이 화면 표시 상태 (초기값 false)
let overlayMode = 'normal'; // 'normal', 'compact'
let timeDisplayMode = 'current_duration'; // 'current_duration', 'current_only', 'none'
let overlayPositionSide = 'right'; // 'left', 'right'
let overlayTheme = 'light'; // 'light', 'dark', 'greenscreen-white-text', 'greenscreen-black-text'
let lastVideoInfo = null;
let currentTabId = null;
let isError = false; // This global error should reflect persistent/serious issues
let currentHostname = null;
let errorMessage = '';
let currentUrlByTabId = {}; // NEW: To store current URL for each tab

const ICONS = {
  active: { "16": "icons/icon-active-16.png", "48": "icons/icon-active-48.png", "128": "icons/icon-active-128.png" },
  inactive: { "16": "icons/icon-inactive-16.png", "48": "icons/icon-inactive-48.png", "128": "icons/icon-inactive-128.png" },
  fetching: { "16": "icons/icon-fetching-16.png", "48": "icons/icon-fetching-48.png", "128": "icons/icon-fetching-128.png" },
  error: { "16": "icons/icon-error-16.png", "48": "icons/icon-error-48.png", "128": "icons/icon-error-128.png" }
};

// 아이콘 업데이트 (isFetchingActive 기준으로 변경, fetching 상태 추가)
function updateActionIcon() {
  let iconPathsObj;
  if (isError) {
    iconPathsObj = ICONS.error;
  } else if (isFetchingActive) {
    iconPathsObj = ICONS.fetching;
  } else {
    iconPathsObj = ICONS.inactive;
  }

  // chrome.runtime.getURL을 사용하여 각 크기별 아이콘의 전체 URL을 가져옴
  const iconDetails = {};
  if (iconPathsObj["16"]) iconDetails["16"] = chrome.runtime.getURL(iconPathsObj["16"]);
  if (iconPathsObj["48"]) iconDetails["48"] = chrome.runtime.getURL(iconPathsObj["48"]);
  if (iconPathsObj["128"]) iconDetails["128"] = chrome.runtime.getURL(iconPathsObj["128"]);

  if (Object.keys(iconDetails).length > 0) {
    chrome.action.setIcon({ path: iconDetails }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error setting icon:", chrome.runtime.lastError.message, "Details:", iconDetails);
      }
    });
  } else {
    console.error("No valid icon paths found for setIcon.");
  }
}

function sendStateToPopup(tabId) {
  const stateForPopup = {
    isFetchingActive,
    isOverlayVisible,
    overlayMode,
    timeDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo,
    activeTabHostname: currentHostname,
    isError: isError,
    errorMessage: errorMessage
  };
  chrome.runtime.sendMessage({
    type: 'BACKGROUND_STATE_UPDATE',
    data: stateForPopup
  }).catch(e => { /* 팝업이 열려있지 않으면 무시 */ });
}

function sendMessageToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    console.log(`BG: Attempting to send message to tab ${tabId}:`, JSON.stringify(message));
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || "Unknown error sending message to content script";
        console.warn(`BG: Error sending message to CS (tab ${tabId}): ${errorMessage}`, "Original message:", JSON.stringify(message));
        reject(new Error(errorMessage)); // Reject with a proper Error object
      } else {
        console.log(`BG: Successfully sent message to CS (tab ${tabId}) and received response:`, response, "Original message:", JSON.stringify(message));
        resolve(response);
      }
    });
  });
}

async function ensureContentScriptAndSendMessage(tabId, message, retryCount = 0) {
  if (!tabId) {
    console.warn("BG: ensureContentScriptAndSendMessage - No tabId provided.");
    return Promise.reject(new Error("No tabId provided"));
  }
  try {
    const response = await sendMessageToContentScript(tabId, message);
    if (response && response.success) {
      return response;
    } else {
      console.warn(`BG: Message to CS (tab ${tabId}) not successful or no response.success. Response:`, response, "Original message:", message);
      return response; // 응답 자체는 반환
    }
  } catch (error) {
    const errMsg = error.message || "Unknown error";
    console.warn(`BG: Error sending message to CS (tab ${tabId}): ${errMsg}. Original message:`, message);

    if (errMsg.includes("Could not establish connection. Receiving end does not exist.")) {
      if (retryCount < 1) { // 재시도 횟수 제한 (최대 1회)
        console.log(`BG: ensureCS - Content script not ready in tab ${tabId}. Injecting and retrying...`);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['src/content.js']
          });
          console.log(`BG: ensureCS - Content script injected in tab ${tabId}. Retrying message...`);
          return ensureContentScriptAndSendMessage(tabId, message, retryCount + 1); // 재시도
        } catch (injectionError) {
          console.error(`BG: ensureCS - Failed to inject content script in tab ${tabId}: ${injectionError.message}`);
          return Promise.reject(injectionError);
        }
      } else {
        console.warn(`BG: ensureCS - Max retries reached for tab ${tabId}. Could not send message.`);
        return Promise.reject(new Error(`Max retries reached for tab ${tabId}. Content script not responding.`));
      }
    } else if (errMsg.includes("Extension context invalidated.")) {
        console.error("BG: Extension context invalidated. Cannot send message.");
        initializeExtensionState(); // 컨텍스트 무효화 시 상태 초기화
        return Promise.reject(error);
    }
    return Promise.reject(error); // 그 외 다른 에러
  }
}

// Load saved styles on startup - REMOVED
// chrome.storage.local.get('overlayStyles', (result) => {
//   if (result.overlayStyles) {
//     savedOverlayStyles = result.overlayStyles;
//     console.log("BG: Loaded saved overlay styles from storage:", savedOverlayStyles);
//   } else {
//     console.log("BG: No saved overlay styles found, using defaults.");
//   }
// });

// --- Message Handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    let responsePayload = { success: true, error: null, type: message.type + "_RESPONSE" };
    let BGasActiveTabId = null; // 이 변수를 사용하여 현재 로직 내에서의 activeTabId를 명확히 함.
    if (sender.tab && sender.tab.id) {
        BGasActiveTabId = sender.tab.id;
    } else if (currentTabId) {
        BGasActiveTabId = currentTabId;
    } else {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab && activeTab.id) BGasActiveTabId = activeTab.id;
        } catch(e) {/* */}
    }
    // currentTabId를 업데이트 해야하는 경우는 명시적으로 함 (예: CONTENT_SCRIPT_READY, GET_POPUP_INITIAL_DATA)

    switch (message.type) {
      case 'POPUP_TOGGLE_FETCHING':
        if (BGasActiveTabId) {
          currentTabId = BGasActiveTabId; // 이 시점에서 currentTabId 확정
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
      
      case 'GET_POPUP_INITIAL_DATA':
        const [activeTabForPopup] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabForPopup && activeTabForPopup.id) {
            currentTabId = activeTabForPopup.id;
            currentHostname = activeTabForPopup.url ? new URL(activeTabForPopup.url).hostname.replace(/^www\./, '') : null;
            if (activeTabForPopup.url) currentUrlByTabId[currentTabId] = activeTabForPopup.url; // 초기 URL 저장
        } else {
            currentTabId = null; currentHostname = null;
            isFetchingActive = false; lastVideoInfo = null; // 활성 탭 없으면 정보 가져오기 불가
        }
        responsePayload = { success: true, isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, overlayPositionSide, overlayTheme, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage };
        break;
      
      case 'CONTENT_SCRIPT_READY':
        if (sender.tab && sender.tab.id) {
            currentTabId = sender.tab.id;
            currentHostname = sender.tab.url ? new URL(sender.tab.url).hostname.replace(/^www\./, '') : null;
            if (sender.tab.url) currentUrlByTabId[currentTabId] = sender.tab.url; // URL 저장
            // isFetchingActive = false; // 탭이 준비되면 fetching은 false로 시작 (선택적)
            // lastVideoInfo = null;
            // isError = false; errorMessage = '';
            console.log(`BG: CONTENT_SCRIPT_READY from tab ${currentTabId} (${currentHostname}). Sending SYNC_INITIAL_BG_STATE.`);
            await ensureContentScriptAndSendMessage(currentTabId, { 
                type: 'SYNC_INITIAL_BG_STATE', 
                data: { isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, overlayPositionSide, overlayTheme, lastVideoInfo, activeTabHostname: currentHostname, isError, errorMessage } 
            });
        } else {
            console.warn("BG: CONTENT_SCRIPT_READY received without sender.tab.id");
        }
        break;

      case 'VIDEO_INFO_UPDATE': 
        if (sender.tab && sender.tab.id === currentTabId) { // 현재 활성 탭에서 온 정보만 수신
          lastVideoInfo = message.data;
          isError = false; errorMessage = ''; 
        } else {
          // console.warn(`BG: VIDEO_INFO_UPDATE received from non-current tab ${sender.tab?.id}. Ignoring.`);
        }
        break;
      
      case 'CONTENT_SCRIPT_ERROR': 
        if (sender.tab && sender.tab.id === currentTabId) { // 현재 활성 탭에서 온 오류만 반영
          console.error("BG: Received CONTENT_SCRIPT_ERROR:", message.error, "from tab:", currentTabId);
          isError = true;
          errorMessage = message.error || "콘텐츠 스크립트 오류";
          // isFetchingActive = false; 
          // lastVideoInfo = null;
        }
        break;

      default:
        responsePayload.success = false; responsePayload.error = "Unknown message type";
        break;
    }

    if (message.type !== 'GET_POPUP_INITIAL_DATA' && message.type !== 'VIDEO_INFO_UPDATE') {
        sendStateToAll(); // 상태 변경이 있었을 가능성이 높은 메시지들에 대해 전파
    }
    updateActionIcon(); // 모든 메시지 처리 후 아이콘 업데이트
    sendResponse(responsePayload);

  })(); 
  return true; 
});

// 상태를 모든 활성 content script와 popup에 전파하는 함수
async function sendStateToAll() { // excludeTabId 파라미터 제거 또는 필요시 다른 방식으로 활용
  let currentActiveTabHostnameForPopup = 'N/A';
  if (currentTabId) {
      try {
          const tab = await chrome.tabs.get(currentTabId);
          if (tab && tab.url) currentActiveTabHostnameForPopup = new URL(tab.url).hostname.replace(/^www\./, '');
          else if (tab && !tab.url && currentHostname) currentActiveTabHostnameForPopup = currentHostname; // URL 없을때 이전 호스트네임 사용
      } catch (e) { 
          // console.warn("BG: Error getting hostname for currentTabId in sendStateToAll", e.message);
          // currentTabId에 해당하는 탭이 더 이상 존재하지 않을 수 있음 (예: 닫힌 직후)
          // 이 경우 currentHostname을 사용하거나 N/A 유지
          if(currentHostname) currentActiveTabHostnameForPopup = currentHostname;
      }
  }

  const state = {
    isFetchingActive,
    isOverlayVisible,
    overlayMode,
    timeDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo,
    activeTabHostname: currentActiveTabHostnameForPopup, 
    isError,
    errorMessage
  };

  chrome.runtime.sendMessage({ type: 'BACKGROUND_STATE_UPDATE', data: state }).catch(e => {/* ... */});

  if (currentTabId) { // 현재 유효한 탭 ID가 있을때만 content script로 전송
    ensureContentScriptAndSendMessage(currentTabId, { type: 'BACKGROUND_STATE_UPDATE', data: state })
      .catch(e => { /* console.warn(\`BG: Error sending BACKGROUND_STATE_UPDATE to CS (tab ${currentTabId}): ${e.message}\`); */ });
  }
}

function initializeExtensionState() {
  isFetchingActive = false;
  isOverlayVisible = false;
  overlayMode = 'normal';
  timeDisplayMode = 'current_duration';
  overlayPositionSide = 'right';
  overlayTheme = 'light';
  lastVideoInfo = null;
  currentTabId = null;
  currentHostname = null;
  isError = false;
  errorMessage = '';
  // currentUrlByTabId는 탭 이벤트에서 관리되므로 여기서 전체 초기화는 하지 않음
  // (또는 필요시 특정 로직 추가)
  console.log("BACKGROUND.JS: Extension state initialized/reset.");
  updateActionIcon(); 
}

chrome.runtime.onStartup.addListener(() => {
  initializeExtensionState();
});

chrome.runtime.onInstalled.addListener((details) => {
  initializeExtensionState();
  // No automatic content script injection here for now, rely on user navigation or popup interaction
});

// Global state
// let currentHostname = "N/A"; // REMOVED: Already declared at the top

function sendStateToAllTabs(additionalData = {}) {
  const state = {
    isFetchingActive,
    isOverlayVisible,
    overlayMode,
    timeDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo,
    activeTabHostname: currentHostname
  };
  state.isFetchingActive = state.isFetchingActive !== undefined ? state.isFetchingActive : isFetchingActive;
  state.isOverlayVisible = state.isOverlayVisible !== undefined ? state.isOverlayVisible : isOverlayVisible;
  state.overlayMode = state.overlayMode !== undefined ? state.overlayMode : overlayMode;
  state.timeDisplayMode = state.timeDisplayMode !== undefined ? state.timeDisplayMode : timeDisplayMode;
  state.overlayPositionSide = state.overlayPositionSide !== undefined ? state.overlayPositionSide : overlayPositionSide;
  state.overlayTheme = state.overlayTheme !== undefined ? state.overlayTheme : overlayTheme;
  state.lastVideoInfo = state.lastVideoInfo !== undefined ? state.lastVideoInfo : lastVideoInfo;
  state.activeTabHostname = state.activeTabHostname !== undefined ? state.activeTabHostname : currentHostname;

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id !== currentTabId) {
        sendStateToPopup(tab.id);
      }
    });
  });
}

function saveStateToStorage() {
  chrome.storage.local.set({
    isFetchingActive,
    isOverlayVisible,
    overlayMode,
    timeDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo
  });
}

function updateGlobalState(newState) {
  isFetchingActive = newState.isFetchingActive !== undefined ? newState.isFetchingActive : isFetchingActive;
  isOverlayVisible = newState.isOverlayVisible !== undefined ? newState.isOverlayVisible : isOverlayVisible;
  overlayMode = newState.overlayMode !== undefined ? newState.overlayMode : overlayMode;
  timeDisplayMode = newState.timeDisplayMode !== undefined ? newState.timeDisplayMode : timeDisplayMode;
  overlayPositionSide = newState.overlayPositionSide !== undefined ? newState.overlayPositionSide : overlayPositionSide;
  overlayTheme = newState.overlayTheme !== undefined ? newState.overlayTheme : overlayTheme;
  lastVideoInfo = newState.lastVideoInfo !== undefined ? newState.lastVideoInfo : lastVideoInfo;

  sendStateToAllTabs();
  saveStateToStorage();
}

// Ensure currentHostname is updated when tabs change or update
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const previousTabId = currentTabId;
  currentTabId = activeInfo.tabId;
  console.log(`BG: Tab activated: ${currentTabId}. Previous tabId: ${previousTabId}`);
  
  try {
    const tab = await chrome.tabs.get(currentTabId);
    if (tab && tab.url) {
        if (currentUrlByTabId[currentTabId] !== tab.url) {
            // console.log(`BG: Updating stored URL for activated tab ${currentTabId} from ${currentUrlByTabId[currentTabId]} to ${tab.url}`);
            currentUrlByTabId[currentTabId] = tab.url; 
        }
        currentHostname = new URL(tab.url).hostname.replace(/^www\./, '');
    } else if (tab && !tab.url) {
        currentHostname = null; 
        currentUrlByTabId[currentTabId] = null; 
    }
  } catch (e) { 
    // console.warn("BG: Error getting activated tab info or URL:", e.message);
    currentHostname = null;
    if(currentTabId) currentUrlByTabId[currentTabId] = null;
  }
  
  // 탭 전환 시 isFetchingActive를 유지할지 여부는 onUpdated에서 URL 변경 기준으로 판단.
  // 여기서 isFetchingActive를 false로 만들면, 탭을 잠깐 바꿨다 돌아와도 다시 켜야 함.
  // isError, errorMessage는 탭 전환 시 초기화하는 것이 좋을 수 있음.
  isError = false; errorMessage = '';
  sendStateToAll();
  updateActionIcon();
});

// --- 탭 상태 변경 감지 로직 ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (currentTabId === tabId && changeInfo.url) {
    const previousUrl = currentUrlByTabId[tabId]; 
    const newUrl = changeInfo.url;
    // currentUrlByTabId[tabId] = newUrl; // URL 업데이트는 모든 로직이 끝난 후 또는 새 URL이 유효할때만 하는게 더 안전할 수 있음

    let shouldStopFetching = true; 
    // console.log(`BG: Tab ${tabId} updated. Prev URL stored: "${previousUrl}", New URL from changeInfo: "${newUrl}", Tab URL at event time: "${tab.url}"`);

    if (previousUrl && newUrl && previousUrl !== newUrl) { // 실제 URL 변경이 있을 때만 상세 분석
      try {
        const prevUrlObj = new URL(previousUrl);
        const newUrlObj = new URL(newUrl);
        // console.log(`BG: Parsed URLs - Prev: ${prevUrlObj.href}, New: ${newUrlObj.href}`);
        let isSameContentGroup = false;

        if (prevUrlObj.hostname !== newUrlObj.hostname) {
          // console.log(`BG: Hostname changed from ${prevUrlObj.hostname} to ${newUrlObj.hostname}. Will stop fetching.`);
          isSameContentGroup = false;
        } else {
          // console.log(`BG: Hostname is the same: ${newUrlObj.hostname}`);
          if (newUrlObj.hostname.includes('laftel.net')) {
            // console.log("BG: Processing Laftel URL update.");
            const prevPathParts = prevUrlObj.pathname.split('/').filter(p => p);
            const newPathParts = newUrlObj.pathname.split('/').filter(p => p);
            // console.log(`BG: Laftel - Prev path parts: [${prevPathParts.join(', ')}], New path parts: [${newPathParts.join(', ')}]`);
            if (prevPathParts[0] === 'player' && newPathParts[0] === 'player' && prevPathParts[1] && newPathParts[1] && prevPathParts[1] === newPathParts[1]) {
              // console.log(`BG: Laftel - Same series detected (${prevPathParts[1]}). Fetching state will be maintained.`);
              isSameContentGroup = true;
            } else {
              // console.log(`BG: Laftel - Different series or path structure. Will stop fetching.`);
            }
          } else if (newUrlObj.hostname.includes('chzzk.naver.com')) {
            console.log("BG: Processing Chzzk URL update (maintaining fetch state within chzzk video/vod).");
            const prevPathParts = prevUrlObj.pathname.split('/').filter(p => p);
            const newPathParts = newUrlObj.pathname.split('/').filter(p => p);
            console.log(`BG: Chzzk - Prev path parts: [${prevPathParts.join(', ')}], New path parts: [${newPathParts.join(', ')}]`);
            // 호스트네임이 같고, 첫 번째 경로 세그먼트가 'video' 또는 'vod'로 동일하면 유지
            // (즉, 비디오 ID가 바뀌어도 같은 chzzk 비디오/VOD 섹션 내에 있다고 간주)
            if ((prevPathParts[0] === 'video' || prevPathParts[0] === 'vod') && 
                (newPathParts[0] === 'video' || newPathParts[0] === 'vod') && 
                prevPathParts.length > 0 && newPathParts.length > 0) { // 경로에 ID로 추정되는 부분이 있는지 기본적인 확인
              console.log(`BG: Chzzk - Navigating within video/vod section. Fetching state will be maintained.`);
              isSameContentGroup = true;
            } else {
              console.log(`BG: Chzzk - Navigating out of video/vod section or different path structure. Will stop fetching.`);
            }
          } else {
            // console.log(`BG: Hostname ${newUrlObj.hostname} is not specifically handled for maintaining fetch state. Will stop fetching.`);
          }
        }
        
        shouldStopFetching = !isSameContentGroup; // 같은 그룹이면 중지 안함, 다르면 중지
        // if (shouldStopFetching) {
            // console.log(`BG: Decision: Stop fetching for tab ${tabId}.`);
        // } else {
            // console.log(`BG: Decision: Maintain fetching for tab ${tabId}.`);
        // }

      } catch (e) {
        // console.warn("BG: Error parsing URLs in onUpdated listener:", e.message, "PrevURL:", previousUrl, "NewUrl:", newUrl);
        shouldStopFetching = true; // 오류 발생 시 안전하게 중지
      }
    } else if (previousUrl === newUrl) {
        // console.log(`BG: Tab ${tabId} URL did not change effectively ('${newUrl}'). No change to fetching state based on URL itself.`);
        shouldStopFetching = false; // URL이 변경되지 않았으므로 현재 상태 유지
    } else { 
        // console.log(`BG: Tab ${tabId} - previousUrl or newUrl is missing. Forcing stop if fetching was active.`);
        shouldStopFetching = true; 
    }

    if (shouldStopFetching) {
      if (isFetchingActive || lastVideoInfo) { 
        // console.log(`BG: Tab ${tabId} - Executing stop fetching logic.`);
        isFetchingActive = false;
        lastVideoInfo = null;
        isError = false;
        errorMessage = '';
        sendStateToAll(); 
        updateActionIcon(); 
      }
    } else {
        currentUrlByTabId[tabId] = newUrl; // 상태 유지 시에만 새 URL로 업데이트
    }
  } else if (currentTabId === tabId && changeInfo.status === 'loading'){
    // console.log(`BG: Tab ${tabId} is reloading (status: loading, URL not in changeInfo). Fetching state (${isFetchingActive}) will be maintained.`);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (currentUrlByTabId[tabId]) {
    delete currentUrlByTabId[tabId];
    // console.log(`BG: Removed URL history for closed tab ${tabId}`);
  }
  if (currentTabId === tabId) {
    // console.log(`BG: Tab ${tabId} removed. Initializing state.`);
    initializeExtensionState(); 
    sendStateToAll();
  }
});

console.log("BACKGROUND.JS: Service worker started and listeners attached."); 