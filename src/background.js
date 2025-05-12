// 전역 상태
let isFetchingActive = false; // 정보 가져오기 활성화 상태 (초기값 false)
let isOverlayVisible = false;  // 오버레이 화면 표시 상태 (초기값 false)
let overlayMode = 'normal'; // 'normal', 'compact'
let timeDisplayMode = 'current_duration'; // 'current_duration', 'current_only', 'none'
let titleDisplayMode = 'episode_series'; // NEW: 'episode_series', 'episode_only', 'none'
let overlayPositionSide = 'right'; // 'left', 'right'
let overlayTheme = 'light'; // 'light', 'dark', 'greenscreen-white-text', 'greenscreen-black-text'
let lastVideoInfo = null;
let currentTabId = null;
let isError = false; // This global error should reflect persistent/serious issues

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
    titleDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo,
    activeTabHostname: currentHostname,
    isError: isError
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

async function ensureContentScriptAndSendMessage(tabId, message) {
  try {
    // console.log(`BG: ensureCS - Calling sendMessageToContentScript for tab ${tabId} with message:`, JSON.stringify(message));
    return await sendMessageToContentScript(tabId, message);
  } catch (error) {
    // console.warn(`BG: ensureCS - First attempt failed for tab ${tabId}. Error: ${error.message}`);
    if (error.message?.includes("Receiving end does not exist") || error.message?.includes("Could not establish connection")) {
      console.log(`BG: ensureCS - Content script not ready in tab ${tabId}. Injecting...`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['src/content.js']
        });
        console.log(`BG: ensureCS - Content script injected in tab ${tabId}. Retrying message...`);
        const retryResponse = await sendMessageToContentScript(tabId, message);
        // console.log(`BG: ensureCS - Successfully sent message after injection to tab ${tabId}. Response:`, retryResponse);
        // Successfully reconnected, if there was a global error specifically due to this tab, consider clearing it.
        // However, be cautious not to clear errors from other sources prematurely.
        // For now, success here means this particular operation succeeded.
        return retryResponse;
      } catch (injectionError) {
        const injErrMsg = injectionError.message || "Failed to inject CS or send message after injection";
        console.error(`BG: ensureCS - Failed to inject CS or send message after injection to tab ${tabId}: ${injErrMsg}`, "Original message:", JSON.stringify(message));
        isError = true; // Injection failure is a more significant error
        updateActionIcon();
        sendStateToPopup(tabId); 
        throw new Error(injErrMsg); // Propagate a new Error object
      }
    } else {
      // Non-injection related error, could be content script error or other issue.
      // Do not set global isError here lightly, as it might be a transient issue or specific to this call.
      console.warn(`BG: ensureCS - Non-injection related error sending message to tab ${tabId}: ${error.message}`, "Original message:", JSON.stringify(message));
      throw error; // Re-throw the original error (which should now be a proper Error object)
    }
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
    // 중요: currentTabId가 설정되어 있는지 확인하고, 없으면 활성 탭에서 가져오려는 시도
    if (!currentTabId && sender && sender.tab && sender.tab.id) {
        currentTabId = sender.tab.id;
        console.log(`BG: currentTabId was not set, updated from sender to: ${currentTabId}`);
    } else if (!currentTabId) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].id) {
                currentTabId = tabs[0].id;
                console.log(`BG: currentTabId was not set, updated from query to: ${currentTabId}`);
            }
        } catch (e) {
            console.warn("BG: Failed to query active tab to set currentTabId", e.message);
        }
    }

    switch (message.type) {
      case 'POPUP_TOGGLE_FETCHING':
        isFetchingActive = !isFetchingActive; // 현재 상태를 반전
        if (currentTabId) {
          try {
            // content.js에 전달하는 action은 변경된 isFetchingActive 상태에 따름
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: isFetchingActive ? 'start' : 'stop' });
            isError = false; 
            responsePayload.isFetchingActive = isFetchingActive;
          } catch (e) { 
            responsePayload.success = false;
            responsePayload.error = e.message || "Failed to toggle fetching in content script";
            isFetchingActive = !isFetchingActive; // 실패 시 상태 원복
          }
        } else {
          responsePayload.success = false;
          responsePayload.error = "No active tab to toggle fetching on";
          isFetchingActive = !isFetchingActive; // 실패 시 상태 원복
        }
        break;

      case 'POPUP_TOGGLE_VISIBILITY':
        isOverlayVisible = !isOverlayVisible; // 현재 상태를 반전
        if (currentTabId) {
          try {
            // content.js에 전달하는 action은 변경된 isOverlayVisible 상태에 따름
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_VISIBILITY', action: isOverlayVisible ? 'show' : 'hide' });
            responsePayload.isOverlayVisible = isOverlayVisible;
          } catch (e) { 
            responsePayload.success = false;
            responsePayload.error = e.message || "Failed to toggle visibility in content script";
            isOverlayVisible = !isOverlayVisible; // 실패 시 상태 원복
          }
        } else {
          responsePayload.success = false;
          responsePayload.error = "No active tab to toggle visibility on";
          isOverlayVisible = !isOverlayVisible; // 실패 시 상태 원복
        }
        break;

      case 'POPUP_SET_OVERLAY_MODE': // 변경된 메시지 타입
        if (['normal', 'compact'].includes(message.mode)) {
          overlayMode = message.mode;
          if (currentTabId) {
            try {
              await ensureContentScriptAndSendMessage(currentTabId, { type: 'SET_OVERLAY_MODE', mode: overlayMode });
              responsePayload.overlayMode = overlayMode;
            } catch (e) { 
              responsePayload.success = false;
              responsePayload.error = e.message || "Failed to set mode in content script";
              // 참고: 이전 overlayMode로 상태 원복 로직은 복잡성을 야기할 수 있어 일단 생략
            }
          } else {
            responsePayload.success = false;
            responsePayload.error = "No active tab to set mode on";
          }
        } else {
          responsePayload.success = false;
          responsePayload.error = "Invalid overlay mode requested: " + message.mode;
        }
        break;

      case 'POPUP_SET_TIME_DISPLAY_MODE': // Renamed from POPUP_CYCLE_TIME_DISPLAY_MODE
        if (['current_duration', 'current_only', 'none'].includes(message.mode)) {
          timeDisplayMode = message.mode; // Directly set the mode
          responsePayload.timeDisplayMode = timeDisplayMode;
          // No direct message to content.js here; sendStateToAllConnectedScriptsAndPopup will handle it.
        } else {
          responsePayload.success = false;
          responsePayload.error = "Invalid time display mode requested: " + message.mode;
        }
        break;

      case 'POPUP_SET_OVERLAY_POSITION': // Renamed from POPUP_TOGGLE_OVERLAY_POSITION
        if (['left', 'right'].includes(message.position)) {
          overlayPositionSide = message.position; // Directly set the position
          responsePayload.overlayPositionSide = overlayPositionSide;
          // No direct message to content.js here; sendStateToAllConnectedScriptsAndPopup will handle it.
        } else {
          responsePayload.success = false;
          responsePayload.error = "Invalid overlay position requested: " + message.position;
        }
        break;

      case 'POPUP_SET_OVERLAY_THEME': // Renamed from POPUP_CYCLE_OVERLAY_THEME
        if (['light', 'dark', 'greenscreen-white-text', 'greenscreen-black-text'].includes(message.theme)) {
          overlayTheme = message.theme; // Directly set the theme
          responsePayload.overlayTheme = overlayTheme;
          // No direct message to content.js here; sendStateToAllConnectedScriptsAndPopup will handle it.
        } else {
          responsePayload.success = false;
          responsePayload.error = "Invalid overlay theme requested: " + message.theme;
        }
        break;
      
      case 'POPUP_SET_TITLE_DISPLAY_MODE': // NEW HANDLER
        if (BGasActiveTabId && ['episode_series', 'episode_only', 'none'].includes(message.mode)) {
          currentTabId = BGasActiveTabId;
          titleDisplayMode = message.mode;
          isError = false; errorMessage = '';
          console.log(`BG: Title display mode set to ${titleDisplayMode} for tab ${currentTabId}`);
          responsePayload.titleDisplayMode = titleDisplayMode;
        } else if (!BGasActiveTabId) {
          responsePayload.success = false; responsePayload.error = "No active tab for title display mode.";
          isError = true; errorMessage = "활성 탭 없음 (TitleDisplay)";
        } else {
          responsePayload.success = false; responsePayload.error = "Invalid title display mode.";
        }
        break;
      
      case 'GET_POPUP_INITIAL_DATA':
        // ... (기존 GET_POPUP_INITIAL_DATA 로직 유지,但 hostname 가져오는 부분은 sendStateToAllConnectedScriptsAndPopup 이전으로 이동) ...
        // 이 핸들러는 마지막에 sendResponse(initialData)를 직접 호출하므로 아래 로직을 타지 않음
        // 따라서 아래 sendStateToAllConnectedScriptsAndPopup는 호출되지 않도록 주의.
        // 기존 로직:
        let contentStatus = {};
        let csResponse;
        let didInitialContentScriptCommunicationFail = false;
        let activeTabHostname = 'N/A'; // 먼저 초기화

        if (currentTabId) {
            try {
                const tab = await chrome.tabs.get(currentTabId);
                if (tab && tab.url) activeTabHostname = new URL(tab.url).hostname;
            } catch (e) { console.warn("BG: Error getting hostname for currentTabId", e.message); }
            try {
                csResponse = await ensureContentScriptAndSendMessage(currentTabId, { type: 'GET_CONTENT_STATUS' });
                if (csResponse && typeof csResponse === 'object') contentStatus = csResponse;
                else didInitialContentScriptCommunicationFail = true;
            } catch (error) {
                didInitialContentScriptCommunicationFail = true;
            }
        } else {
            currentTabId = null; currentHostname = null;
            isFetchingActive = false; lastVideoInfo = null; // 활성 탭 없으면 정보 가져오기 불가
        }
        responsePayload = { 
          success: true, isFetchingActive, isOverlayVisible, overlayMode, 
          timeDisplayMode, titleDisplayMode, // NEW: titleDisplayMode 포함
          overlayPositionSide, overlayTheme, lastVideoInfo, 
          activeTabHostname: currentHostname, isError, errorMessage 
        };
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
                data: { 
                    isFetchingActive, isOverlayVisible, overlayMode, timeDisplayMode, 
                    titleDisplayMode, // NEW: titleDisplayMode 포함
                    overlayPositionSide, overlayTheme, lastVideoInfo, 
                    activeTabHostname: currentHostname, isError, errorMessage 
                } 
            });
        } else {
            console.warn("BG: CONTENT_SCRIPT_READY received without sender.tab.id");
        }
        break;

      case 'VIDEO_INFO_UPDATE':
        if (message.data) {
          lastVideoInfo = message.data;
          isError = false; 
        } else if (message.error) {
          isError = true; 
          lastVideoInfo = null;
          responsePayload.success = false;
          responsePayload.error = message.error;
        } else {
          responsePayload.success = false;
          responsePayload.error = "Malformed VIDEO_INFO_UPDATE";
        }
        break;

      case 'CONTENT_SCRIPT_READY':
        const tabIdForReady = sender.tab.id;
        if(tabIdForReady) currentTabId = tabIdForReady;
        // SYNC_INITIAL_BG_STATE를 content.js에 보내는 것은 sendStateToAllConnectedScriptsAndPopup에서 처리.
        // isError = false; // 성공적인 통신 후 오류 상태 해제
        break; // 아래 공통 로직으로 넘어감

      default:
        console.warn("BG: Received unknown message type:", message.type);
        responsePayload.success = false;
        responsePayload.error = "Unknown message type in background";
        sendResponse(responsePayload);
        return; // 여기서 처리 종료
    }

    updateActionIcon();
    // 모든 상태 변경 후에는 연결된 모든 content script와 popup에 상태 전파
    await sendStateToAllConnectedScriptsAndPopup();
    sendResponse(responsePayload); // 최종 응답 전송

  })();
  return true; 
});

// 상태를 모든 활성 content script와 popup에 전파하는 함수
async function sendStateToAllConnectedScriptsAndPopup() {
  let currentActiveTabHostname = 'N/A';
  if (currentTabId) {
      try {
          const tab = await chrome.tabs.get(currentTabId);
          if (tab && tab.url) currentActiveTabHostname = new URL(tab.url).hostname;
      } catch (e) { console.warn("BG: Error getting hostname for currentTabId in sendStateToAll", e.message); }
  }

  const stateForUpdate = {
    isFetchingActive,
    isOverlayVisible,
    overlayMode,
    timeDisplayMode,
    titleDisplayMode,
    overlayPositionSide,
    overlayTheme,
    lastVideoInfo,
    activeTabHostname: currentActiveTabHostname, // 현재 활성 _탭_의 호스트네임
    isError
  };

  // 1. 현재 활성 탭의 content script에 상태 전송 (가장 중요)
  if (currentTabId) {
    try {
      // console.log(`BG: Sending BACKGROUND_STATE_UPDATE to currentTabId ${currentTabId}`);
      await ensureContentScriptAndSendMessage(currentTabId, { type: 'BACKGROUND_STATE_UPDATE', data: stateForUpdate });
    } catch (e) {
      console.warn(`BG: Failed to send state to active content script (tab ${currentTabId}): ${e.message}`);
    }
  }

  // 2. Popup으로 상태 전송 (Popup이 열려있을 경우)
  try {
    // console.log("BG: Sending BACKGROUND_STATE_UPDATE to popup.");
    chrome.runtime.sendMessage({ type: 'BACKGROUND_STATE_UPDATE', data: stateForUpdate });
  } catch(e) {
    // 팝업이 열려있지 않으면 오류 발생, 무시
    // console.log("BG: Popup not open or error sending state to popup.", e.message);
  }

  // 3. (선택적) 다른 활성 탭들의 content script에도 상태 전송 (만약 필요하다면)
  // chrome.tabs.query({ active: false, status: 'complete' }, (tabs) => {
  //   tabs.forEach((tab) => {
  //     if (tab.id !== currentTabId && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https://'))) {
  //       ensureContentScriptAndSendMessage(tab.id, { type: 'BACKGROUND_STATE_UPDATE', data: { ...stateForUpdate, activeTabHostname: new URL(tab.url).hostname } })
  //         .catch(e => console.warn(`BG: Failed to send state to inactive tab ${tab.id}: ${e.message}`));
  //     }
  //   });
  // });
}

function initializeExtensionState() {
  isFetchingActive = false;
  isOverlayVisible = false;
  overlayMode = 'normal';
  timeDisplayMode = 'current_duration';
  titleDisplayMode = 'episode_series';
  overlayPositionSide = 'right';
  overlayTheme = 'light';
  lastVideoInfo = null;
  // currentTabId = null; // Best not to reset currentTabId on generic init, only on startup/install
  isError = false;
  updateActionIcon();
  // console.log('BG: Extension state part-initialized (global vars).');
}

chrome.runtime.onStartup.addListener(() => {
  // console.log("BG: Extension started up.");
  currentTabId = null; // Clear tab ID on startup
  initializeExtensionState();
});

chrome.runtime.onInstalled.addListener((details) => {
  // console.log("BG: Extension installed or updated.", details.reason);
  currentTabId = null; // Clear tab ID on install/update
  initializeExtensionState();
  // No automatic content script injection here for now, rely on user navigation or popup interaction
});

initializeExtensionState();
// console.log("Background Script Loaded and Initialized."); 

// Global state
let currentHostname = "N/A"; // Added for hostname tracking

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
  currentTabId = activeInfo.tabId;
  // console.log(`BG: Tab activated: ${currentTabId}. Updating states.`);
  await sendStateToAllConnectedScriptsAndPopup(); // 활성 탭 변경 시 모든 곳에 상태 전파
  updateActionIcon(); // 아이콘도 업데이트
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTabId && (changeInfo.status === 'complete' || changeInfo.url)) {
    // console.log(`BG: Tab updated: ${tabId}, Status: ${changeInfo.status}, URL changed: ${!!changeInfo.url}. Updating states.`);
    await sendStateToAllConnectedScriptsAndPopup(); // 현재 탭 업데이트 시 모든 곳에 상태 전파
    updateActionIcon();
  }
}); 