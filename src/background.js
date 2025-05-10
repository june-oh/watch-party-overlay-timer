// 전역 상태
let isFetchingActive = false; // 정보 가져오기 활성화 상태 (초기값 false)
let isOverlayVisible = false;  // 오버레이 화면 표시 상태 (초기값 false)
let overlayMode = 'normal'; // 'normal', 'compact' (greenscreen은 별도 상태로 분리)
let isGreenscreenActive = false; // 그린스크린 활성화 상태
let currentTimeDisplayMode = 'current_duration'; // 'current_duration', 'current_only', 'none'
let overlayPositionSide = 'right'; // Added: 'left' or 'right'
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

function sendStateToPopup() {
  chrome.runtime.sendMessage({
    type: 'BACKGROUND_STATE_UPDATE',
    data: {
      isFetchingActive: isFetchingActive,
      isOverlayVisible: isOverlayVisible,
      overlayMode: overlayMode, // 'normal', 'compact'
      isGreenscreenActive: isGreenscreenActive, // 그린스크린 상태 추가
      timeDisplayMode: currentTimeDisplayMode,
      overlayPositionSide: overlayPositionSide, // Added
      lastVideoInfo: lastVideoInfo,
      isError: isError
    }
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
        sendStateToPopup(); 
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
    let responsePayload = { success: false, error: null, type: message.type + "_RESPONSE" };

    if (message.type === 'POPUP_TOGGLE_FETCHING') {
      const newFetchingState = message.action === 'start';
      // console.log(`BG: POPUP_TOGGLE_FETCHING - Requested action: ${message.action}. New state will be: ${newFetchingState}`);
      if (currentTabId) {
        try {
          await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_FETCHING', action: message.action });
          isFetchingActive = newFetchingState;
          isError = false; // Successful toggle implies no current operational error for fetching
          responsePayload.success = true;
          responsePayload.isFetchingActive = isFetchingActive;
        } catch (e) { 
          responsePayload.error = e.message || "Failed to toggle fetching in content script";
          console.error("BG: Error during POPUP_TOGGLE_FETCHING -> ensureContentScriptAndSendMessage:", responsePayload.error);
          // isError might be set by ensureContentScriptAndSendMessage if injection failed.
          // If it was just a send error, don't set global isError here.
        }
      } else {
        responsePayload.error = "No active tab to toggle fetching on";
        console.warn("BG: POPUP_TOGGLE_FETCHING - currentTabId is not set.");
        // isError = true; // Or perhaps not, if no tab is not a global error state
      }
      updateActionIcon();
      sendStateToPopup(); 
      sendResponse(responsePayload);

    } else if (message.type === 'POPUP_TOGGLE_VISIBILITY') {
      const newVisibilityState = message.action === 'show';
      // console.log(`BG: POPUP_TOGGLE_VISIBILITY - Requested action: ${message.action}. New state will be: ${newVisibilityState}`);
      if (currentTabId) {
        try {
          await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_VISIBILITY', action: message.action });
          isOverlayVisible = newVisibilityState;
          // isError state should not be affected by visibility toggle alone unless communication fails badly
          responsePayload.success = true;
          responsePayload.isOverlayVisible = isOverlayVisible;
        } catch (e) { 
          responsePayload.error = e.message || "Failed to toggle visibility in content script";
          console.error("BG: Error during POPUP_TOGGLE_VISIBILITY -> ensureContentScriptAndSendMessage:", responsePayload.error);
        }
      } else {
        responsePayload.error = "No active tab to toggle visibility on";
        console.warn("BG: POPUP_TOGGLE_VISIBILITY - currentTabId is not set.");
      }
      updateActionIcon(); // Icon might change if visibility is part of its state logic (e.g. active vs inactive)
      sendStateToPopup();
      sendResponse(responsePayload);

    } else if (message.type === 'POPUP_TOGGLE_MODE') {
      const newMode = message.mode;
      // 유효한 모드는 'normal', 'compact' 만 해당. greenscreen은 별도 처리.
      if (newMode === 'normal' || newMode === 'compact') {
        if (currentTabId) {
          try {
            await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_OVERLAY_MODE', mode: newMode });
            overlayMode = newMode; // isGreenscreenActive 상태는 변경하지 않음
            responsePayload.success = true;
            responsePayload.overlayMode = overlayMode;
          } catch (e) { 
              responsePayload.error = e.message || "Failed to toggle mode in content script";
              console.error("BG: Error during POPUP_TOGGLE_MODE -> ensureContentScriptAndSendMessage:", responsePayload.error);
          }
        } else {
          responsePayload.error = "No active tab to toggle mode on";
          console.warn("BG: POPUP_TOGGLE_MODE - currentTabId is not set.");
        }
      } else {
        responsePayload.error = "Invalid overlay mode requested: " + newMode;
        console.warn("BG: POPUP_TOGGLE_MODE - Invalid mode: ", newMode);
      }
      sendStateToPopup();
      sendResponse(responsePayload);

    } else if (message.type === 'POPUP_TOGGLE_GREENSCREEN') { // 새 메시지 타입 핸들러
      isGreenscreenActive = message.isActive;
      if (currentTabId) {
        try {
          await ensureContentScriptAndSendMessage(currentTabId, { type: 'TOGGLE_GREENSCREEN_MODE', isActive: isGreenscreenActive });
          responsePayload.success = true;
        } catch (e) {
          responsePayload.error = e.message || "Failed to toggle greenscreen in content script";
          console.error("BG: Error during POPUP_TOGGLE_GREENSCREEN -> ensureContentScriptAndSendMessage:", responsePayload.error);
        }
      } else {
        responsePayload.error = "No active tab to toggle greenscreen on";
        console.warn("BG: POPUP_TOGGLE_GREENSCREEN - currentTabId is not set.");
      }
      // 아이콘 상태 변경은 그린스크린과 직접적인 관련이 없을 수 있으므로 updateActionIcon() 호출은 생략 가능
      sendStateToPopup();
      sendResponse(responsePayload);

    } else if (message.type === 'POPUP_CYCLE_TIME_DISPLAY_MODE') {
      // Cycle through a predefined order
      if (currentTimeDisplayMode === 'current_duration') {
        currentTimeDisplayMode = 'current_only';
      } else if (currentTimeDisplayMode === 'current_only') {
        currentTimeDisplayMode = 'none';
      } else { // 'none'
        currentTimeDisplayMode = 'current_duration';
      }
      responsePayload.success = true;
      responsePayload.timeDisplayMode = currentTimeDisplayMode;

      if (currentTabId) {
        const globalStateForContent = {
          isFetchingActive,
          isOverlayVisible,
          overlayMode,
          isGreenscreenActive,
          timeDisplayMode: currentTimeDisplayMode, // 변경된 값 및 키 이름 수정
          // overlayPositionSide, // content.js는 이 값을 직접 사용하지 않음
          lastVideoInfo, // content.js는 이 값을 BACKGROUND_STATE_UPDATE에서 사용함
          isError // content.js는 이 값을 직접 사용하지 않지만, 일관성을 위해 포함 가능
        };
        ensureContentScriptAndSendMessage(currentTabId, { type: 'BACKGROUND_STATE_UPDATE', data: globalStateForContent })
          .catch(e => console.warn(`BG: Error sending BACKGROUND_STATE_UPDATE to content script for time cycle: ${e.message}`));
      }
      sendStateToPopup(); 
      sendResponse(responsePayload);

    } else if (message.type === 'GET_POPUP_INITIAL_DATA') {
      let contentStatus = {};
      let csResponse;
      let didInitialContentScriptCommunicationFail = false;

      if (currentTabId) {
        try {
          csResponse = await ensureContentScriptAndSendMessage(currentTabId, { type: 'GET_CONTENT_STATUS' });
          if (csResponse && typeof csResponse === 'object') contentStatus = csResponse; // Assuming csResponse is the direct status object
          else didInitialContentScriptCommunicationFail = true;
        } catch (error) {
          console.warn(`BG: GET_POPUP_INITIAL_DATA - Error getting CS status from currentTabId ${currentTabId}: ${error.message}`);
          didInitialContentScriptCommunicationFail = true;
        }
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
          currentTabId = tabs[0].id;
          try {
            csResponse = await ensureContentScriptAndSendMessage(currentTabId, { type: 'GET_CONTENT_STATUS' });
            if (csResponse && typeof csResponse === 'object') contentStatus = csResponse;
            else didInitialContentScriptCommunicationFail = true;
          } catch (e) {
            console.warn(`BG: GET_POPUP_INITIAL_DATA - Error getting CS status from new tabId ${currentTabId}: ${e.message}`);
            didInitialContentScriptCommunicationFail = true;
          }
        } else {
          console.warn("BG: GET_POPUP_INITIAL_DATA - No active tab found.");
          didInitialContentScriptCommunicationFail = true; // No tab to query is a form of communication failure for this purpose
        }
      }

      // Fetch active tab hostname regardless of content script communication success
      let activeTabHostname = 'N/A';
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].url) {
          activeTabHostname = new URL(tabs[0].url).hostname;
        } else if (tabs && tabs.length > 0 && tabs[0] && !tabs[0].url) {
            activeTabHostname = 'URL not available'; // E.g. chrome://extensions page
        } else {
            activeTabHostname = 'No active tab found';
        }
      } catch (e) {
        console.warn("BG: GET_POPUP_INITIAL_DATA - Error parsing URL for hostname", e);
        activeTabHostname = 'Error fetching host';
      }

      if (Object.keys(contentStatus).length > 0 && !didInitialContentScriptCommunicationFail) {
        isFetchingActive = contentStatus.isFetching !== undefined ? contentStatus.isFetching : isFetchingActive;
        isOverlayVisible = contentStatus.isVisible !== undefined ? contentStatus.isVisible : isOverlayVisible;
        overlayMode = contentStatus.mode || overlayMode;
        lastVideoInfo = contentStatus.videoInfo || lastVideoInfo;
        // Only clear global isError if content script confirms it is NOT in an error state AND we successfully got info
        // For now, let VIDEO_INFO_UPDATE be the main clearer of global isError.
      } else {
        // console.log("BG: GET_POPUP_INITIAL_DATA - No definitive CS status. Using current BG state for popup.");
      }

      const initialData = {
        isFetchingActive: isFetchingActive,
        isOverlayVisible: isOverlayVisible,
        overlayMode: overlayMode,
        isGreenscreenActive: isGreenscreenActive, // 그린스크린 상태 추가
        timeDisplayMode: currentTimeDisplayMode,
        overlayPositionSide: overlayPositionSide, // Added
        lastVideoInfo: lastVideoInfo || (contentStatus ? contentStatus.lastVideoInfo : null),
        isError: didInitialContentScriptCommunicationFail, // Popup specific error for this attempt
        activeTabHostname: activeTabHostname // Add hostname to the initial data
      };
      sendResponse(initialData);

    } else if (message.type === 'VIDEO_INFO_UPDATE') {
      if (message.data) {
        lastVideoInfo = message.data;
        isError = false; // Successful info update means we are not in an error state from content script
        updateActionIcon();
        sendStateToPopup();
        responsePayload.success = true;
      } else if (message.error) {
        console.warn("BG: VIDEO_INFO_UPDATE received an error state from content script: ", message.error);
        isError = true; // Content script explicitly reported an error
        lastVideoInfo = null;
        updateActionIcon();
        sendStateToPopup();
        responsePayload.success = false; // Indicate failure due to content script error
        responsePayload.error = message.error;
      } else {
        // This case should ideally not happen if content.js always sends data or error
        console.warn("BG: VIDEO_INFO_UPDATE received without data or error field.");
        responsePayload.success = false;
        responsePayload.error = "Malformed VIDEO_INFO_UPDATE from content script";
      }
      sendResponse(responsePayload); 

    } else if (message.type === 'CONTENT_SCRIPT_READY') {
      const tabId = sender.tab.id;
      if(tabId) currentTabId = tabId;
      else console.warn("BG: CONTENT_SCRIPT_READY - sender.tab.id is undefined!");
      
      // console.log(`BG: CONTENT_SCRIPT_READY from tab: ${tabId}. Syncing initial state.`);
      try {
        if(tabId){
            // Send current background state to the newly ready content script
            // No need to await these if content script doesn't send a meaningful response for them.
            ensureContentScriptAndSendMessage(tabId, { 
                type: 'SYNC_INITIAL_BG_STATE', 
                data: {
                    isFetchingActive: isFetchingActive, 
                    isOverlayVisible: isOverlayVisible, 
                    overlayMode: overlayMode, 
                    isGreenscreenActive: isGreenscreenActive,
                    timeDisplayMode: currentTimeDisplayMode, 
                    overlayPositionSide: overlayPositionSide,
                    lastVideoInfo: lastVideoInfo
                } 
            });
            isError = false; // Content script is ready and we sent sync, assume good for now
            responsePayload.success = true; 
        } else {
            responsePayload.error = "No valid tabId for CONTENT_SCRIPT_READY sync";
        }
      } catch (e) { 
        responsePayload.error = e.message || "Failed to sync state to content script after ready signal";
        console.error(`BG: CONTENT_SCRIPT_READY - Error syncing state to tab ${tabId}:`, responsePayload.error);
        // Potentially set isError = true here if sync is critical and fails
      }
      updateActionIcon();
      sendStateToPopup();
      // Content script doesn't typically need a response for CONTENT_SCRIPT_READY itself.
      // If sendResponse is called here, ensure content.js isn't also trying to send one for this message.
      // sendResponse(responsePayload); 

    } else if (message.type === 'POPUP_CYCLE_OVERLAY_POSITION') { // New Handler
      overlayPositionSide = overlayPositionSide === 'right' ? 'left' : 'right';
      responsePayload.success = true;
      responsePayload.newOverlayPositionSide = overlayPositionSide;

      if (currentTabId) {
        ensureContentScriptAndSendMessage(currentTabId, { 
          type: 'SET_OVERLAY_POSITION_SIDE', 
          positionSide: overlayPositionSide 
        }).catch(e => console.warn("BG: Failed to send SET_OVERLAY_POSITION_SIDE to CS", e.message));
      }
      sendStateToPopup(); // Update popup with new position side
      sendResponse(responsePayload);
    } else {
      console.warn("BG: Received unknown message type:", message.type);
      responsePayload.success = false;
      responsePayload.error = "Unknown message type in background";
      sendResponse(responsePayload);
    }
  })();
  return true; 
});

function initializeExtensionState() {
  isFetchingActive = false;
  isOverlayVisible = false;
  overlayMode = 'normal';
  isGreenscreenActive = false; // 초기 상태 추가
  currentTimeDisplayMode = 'current_duration';
  overlayPositionSide = 'right'; // 제거 예정
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