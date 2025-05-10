// --- 중복 실행 방지 ---
if (typeof window.wpOverlayTimerLoaded === 'undefined') {
  window.wpOverlayTimerLoaded = true;
  console.log("CONTENT.JS: Watch Party Overlay Timer content.js INITIALIZING attempt...");

  if (typeof window.wpOverlayTimerHasInitialized === 'undefined') {
    window.wpOverlayTimerHasInitialized = true;
    console.log("CONTENT.JS: Initializing for the first time.");

    let fetchIntervalId = null;
    let isFetchingActive = false;
    let isOverlayVisible = false;
    let overlayContainer = null;
    let overlayMode = 'normal';
    let currentVideoInfo = null;
    let isContextInvalidated = false;
    let currentTimeDisplayMode = 'current_duration';
    let currentOverlayPositionSide = 'right';

    // Define selectors for different sites
    const siteSelectors = {
      'laftel.net': {
        titleSelector: '#root > div.sc-4a02fa07-0.cSulJK > div > div.sc-ec16796a-2.hlVrXi > div > div > div.sc-46d49bb0-5.hFtDBz > div.sc-46d49bb0-7.krHzYQ', // Episode Title
        seriesSelector: '#root > div.sc-4a02fa07-0.cSulJK > div > div.sc-ec16796a-2.hlVrXi > div > a', // Series Title
        // For Laftel, we'll rely on the video element for time, so these can be null or omitted
        currentTimeSelector: null, 
        durationSelector: null,
        siteName: 'LAFTEL'
      },
      'chzzk.naver.com': {
        titleSelector: 'h2.video_information_title__jrLfG',
        seriesSelector: null, // No specific series selector for now
        currentTimeSelector: '#player_layout > div > div.pzp-pc__bottom > div.pzp-pc__bottom-buttons > div.pzp-pc__bottom-buttons-left > div.pzp-vod-time.pzp-pc-vod-time.pzp-pc__vod-time > span.pzp-ui-text.pzp-vod-time__current-time',
        durationSelector: '#player_layout > div > div.pzp-pc__bottom > div.pzp-pc__bottom-buttons > div.pzp-pc__bottom-buttons-left > div.pzp-vod-time.pzp-pc-vod-time.pzp-pc__vod-time > span.pzp-ui-text.pzp-vod-time__duration',
        siteName: 'CHZZK'
      }
      // Add other sites here, e.g., 'www.youtube.com': { ... }
    };

    let currentSiteConfig = null;
    // --- End of Site-specific Selectors ---

    function checkAndHandleInvalidatedContext(operationName = "Operation") {
      if (isContextInvalidated) return true;
      try {
        // Defensive check for chrome.runtime and chrome.runtime.id
        if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.id === "undefined") {
          console.warn(`CONTENT.JS: Context invalidated (${operationName}). Halting further operations.`);
          isContextInvalidated = true;
          if (fetchIntervalId) clearInterval(fetchIntervalId);
          fetchIntervalId = null;
          const existingOverlay = document.getElementById('wp-overlay-timer');
          if (existingOverlay) {
            // Ensure quotes are correctly handled for innerHTML
            existingOverlay.innerHTML = '<div style="color:red; font-weight:bold; text-align:center;">스트리머 도구<br/>오류 발생!<br/>페이지를 새로고침 하세요.</div>';
            existingOverlay.style.display = 'block';
            existingOverlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
            existingOverlay.style.color = 'white';
          }
          return true;
        }
      } catch (e) {
         console.warn(`CONTENT.JS: Error accessing chrome.runtime (${operationName}), assuming context invalidated. Error: ${e.message}`);
         isContextInvalidated = true;
         // Clear interval here too, as the try block might have been partway through
         if (fetchIntervalId) clearInterval(fetchIntervalId);
         fetchIntervalId = null;
         return true;
      }
      return false;
    }

    // 시간을 HH:MM:SS로 변환
    function formatTime(totalSeconds) {
      if (isNaN(totalSeconds) || totalSeconds < 0) return '--:--';
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      let timeString = '';
      if (hours > 0) {
        timeString += `${String(hours).padStart(2, '0')}:`;
      }
      timeString += `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return timeString;
    }

    // 요소에서 텍스트를 추출하는 헬퍼 함수
    function getElementText(selector) {
      if (checkAndHandleInvalidatedContext(`getElementText_For_${selector}`)) return null;
      const element = document.querySelector(selector);
      if (!element) return null;
      let text = element.innerText?.trim(); // Optional chaining kept here as it's highly useful
      if (!text && typeof element.textContent === 'string') text = element.textContent.trim();
      if (!text && typeof element.title === 'string' && element.title.trim()) text = element.title.trim();
      return text || null;
    }

    // Get Video Info (generalized)
    function getVideoInfo() {
      if (checkAndHandleInvalidatedContext("getVideoInfo")) return null;
      if (!currentSiteConfig) {
        // console.warn("CONTENT.JS: No site config loaded, cannot get video info.");
        return null;
      }

      let title = "N/A", series = "N/A", currentSeconds = 0, durationSeconds = 0;

      // Attempt to get info using selectors first
      if (currentSiteConfig.titleSelector) {
        const titleEl = document.querySelector(currentSiteConfig.titleSelector);
        if (titleEl) title = titleEl.innerText.trim();
      }

      if (currentSiteConfig.seriesSelector) {
        const seriesEl = document.querySelector(currentSiteConfig.seriesSelector);
        if (seriesEl) series = seriesEl.innerText.trim();
      } else if (currentSiteConfig.titleSelector && !currentSiteConfig.seriesSelector) {
        // If no series selector, but there is a title selector, assume title is the main content.
        // For sites like CHZZK that might only have one primary title for VODs.
        series = ""; // Or keep as "N/A" or some other default
      }

      // For current time and duration, prioritize selectors if available
      let currentTimeFromSelector = false;
      let durationFromSelector = false;

      if (currentSiteConfig.currentTimeSelector) {
        const currentTimeEl = document.querySelector(currentSiteConfig.currentTimeSelector);
        if (currentTimeEl) {
          currentSeconds = parseTimeToSeconds(currentTimeEl.innerText.trim());
          currentTimeFromSelector = true;
        }
      }

      if (currentSiteConfig.durationSelector) {
        const durationEl = document.querySelector(currentSiteConfig.durationSelector);
        if (durationEl) {
          durationSeconds = parseTimeToSeconds(durationEl.innerText.trim());
          durationFromSelector = true;
        }
      }

      // Fallback to video element if selectors didn't provide the time info
      const videoElement = document.querySelector('video');
      if (videoElement) {
        if (!currentTimeFromSelector && !isNaN(videoElement.currentTime)) {
          currentSeconds = videoElement.currentTime;
        }
        if (!durationFromSelector && !isNaN(videoElement.duration)) {
          durationSeconds = videoElement.duration;
        }
      } else if (!currentTimeFromSelector || !durationFromSelector) {
        // console.warn("CONTENT.JS: Video element not found, and time info not fully available from selectors.");
        // Retain whatever was found from selectors, or default to 0 if nothing.
      }
      
      // console.log(`CONTENT.JS: getVideoInfo Raw - Title: ${title}, Series: ${series}, Current: ${currentSeconds}, Duration: ${durationSeconds}`);

      return {
        episode: title, // Keep 'episode' as the key for title for consistency
        series: series,
        currentSeconds: currentSeconds,
        durationSeconds: durationSeconds,
        siteName: currentSiteConfig.siteName // Include siteName
      };
    }

    // Helper function to parse time strings like "HH:MM:SS" or "MM:SS" to seconds
    function parseTimeToSeconds(timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) { // SS (less common for duration/current time strings but handle)
        seconds = parts[0];
      }
      return isNaN(seconds) ? 0 : seconds;
    }

    function findTargetParent(videoEl) {
      if (checkAndHandleInvalidatedContext("findTargetParent")) return document.body; // Fallback
      let potentialParent = videoEl.closest('div[class*="player"], div[class*="video_container"], div[id*="player"], div[id*="video_wrap"]');
      if (potentialParent) return potentialParent;
      if (videoEl.parentElement) {
        if (videoEl.parentElement.tagName !== 'BODY' && videoEl.parentElement.tagName !== 'HTML') {
            return videoEl.parentElement;
        }
        if (videoEl.parentElement.parentElement && videoEl.parentElement.parentElement.tagName !== 'BODY' && videoEl.parentElement.parentElement.tagName !== 'HTML') {
            return videoEl.parentElement.parentElement;
        }
      }
      const rootEl = document.getElementById('root');
      if (rootEl) return rootEl;
      return document.body;
    }

    function createOverlayDOMIfNotExists(retryCount = 0) {
      if (checkAndHandleInvalidatedContext("createOverlayDOMIfNotExists")) return;
      if (document.getElementById('wp-overlay-timer')) {
        overlayContainer = document.getElementById('wp-overlay-timer');
        updateOverlayDOM(); 
        return;
      }
      
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'wp-overlay-container';
      overlayContainer.id = 'wp-overlay-timer';

      const seriesDisplayEl = document.createElement('div');
      seriesDisplayEl.className = 'wp-overlay-series-text';
      seriesDisplayEl.id = 'wp-overlay-series-text';
      overlayContainer.appendChild(seriesDisplayEl);

      const episodeDisplayEl = document.createElement('div');
      episodeDisplayEl.className = 'wp-overlay-episode-text';
      episodeDisplayEl.id = 'wp-overlay-episode-text';
      overlayContainer.appendChild(episodeDisplayEl);

      const timeDisplayContainerEl = document.createElement('div'); // New container for time and hostname
      timeDisplayContainerEl.className = 'wp-overlay-time-text'; // Use existing class for base styling
      timeDisplayContainerEl.id = 'wp-overlay-time-text-container'; // New ID for the container
      
      const actualTimeEl = document.createElement('span');
      actualTimeEl.id = 'wp-overlay-actual-time';
      actualTimeEl.textContent = '--:-- / --:--';
      timeDisplayContainerEl.appendChild(actualTimeEl);

      const hostnameDisplayEl = document.createElement('span');
      hostnameDisplayEl.id = 'wp-overlay-hostname-display';
      timeDisplayContainerEl.appendChild(hostnameDisplayEl);
      
      overlayContainer.appendChild(timeDisplayContainerEl);

      // New elements for Compact Mode
      const compactTextContainerEl = document.createElement('div');
      compactTextContainerEl.className = 'wp-overlay-compact-text-container';
      compactTextContainerEl.id = 'wp-overlay-compact-text-container';
      compactTextContainerEl.style.display = 'none'; // Initially hidden

      const compactInfoEl = document.createElement('span');
      compactInfoEl.className = 'wp-overlay-compact-info';
      compactInfoEl.id = 'wp-overlay-compact-info';
      compactTextContainerEl.appendChild(compactInfoEl);

      const compactTimeEl = document.createElement('span');
      compactTimeEl.className = 'wp-overlay-compact-time';
      compactTimeEl.id = 'wp-overlay-compact-time';
      compactTextContainerEl.appendChild(compactTimeEl);
      
      overlayContainer.appendChild(compactTextContainerEl);
      
      const videoElement = document.querySelector('video');
      if (!videoElement) {
        console.error("CONTENT.JS: createOverlayDOMIfNotExists - Video element not found! Cannot append overlay.");
        if (retryCount < 5) {
          setTimeout(() => createOverlayDOMIfNotExists(retryCount + 1), 100);
        }
        return;
      }

      targetParent = findTargetParent(videoElement);
      if (targetParent) {
        const computedStyle = window.getComputedStyle(targetParent);
        if (computedStyle.position === 'static') {
          targetParent.style.position = 'relative';
        }
        targetParent.appendChild(overlayContainer);
        updateOverlayDOM();
      } else {
        console.error("CONTENT.JS: createOverlayDOMIfNotExists - Suitable target parent not found.");
      }
    }
    
    function updateOverlayDOM() {
      if (checkAndHandleInvalidatedContext("updateOverlayDOM")) return;
      const currentOverlayElement = document.getElementById('wp-overlay-timer');

      if (!currentOverlayElement) {
          if (isOverlayVisible && !isContextInvalidated) { // Only try to recreate if supposed to be visible and context is OK
             console.error("CONTENT.JS: updateOverlayDOM - Overlay element missing! Attempting to recreate.");
             createOverlayDOMIfNotExists(); 
             // After recreation, overlayContainer might be updated, re-query
             const newOverlayElement = document.getElementById('wp-overlay-timer');
             if(newOverlayElement) {
                overlayContainer = newOverlayElement;
                newOverlayElement.style.display = 'block';
                // (rest of info population logic as before)
                const infoToDisplay = currentVideoInfo; 
                if (infoToDisplay) {
                    const seriesEl = newOverlayElement.querySelector('#wp-overlay-series-text');
                    const episodeEl = newOverlayElement.querySelector('#wp-overlay-episode-text');
                    const timeContainerEl = newOverlayElement.querySelector('#wp-overlay-time-text-container');
                    const actualTimeSpanEl = newOverlayElement.querySelector('#wp-overlay-actual-time');
                    const hostnameSpanEl = newOverlayElement.querySelector('#wp-overlay-hostname-display');
                    if(seriesEl) seriesEl.textContent = infoToDisplay.series || '';
                    if(episodeEl) episodeEl.textContent = infoToDisplay.episode || infoToDisplay.title || 'N/A';
                    if(timeContainerEl) {
                        const currentS = parseFloat(infoToDisplay.currentSeconds);
                        const durationS = parseFloat(infoToDisplay.durationSeconds);
                        actualTimeSpanEl.textContent = `${formatTime(currentS)} / ${formatTime(durationS)}`;
                    }
                    if (overlayMode === 'normal' && hostnameSpanEl) {
                        const currentHostname = window.location.hostname;
                        let displayHostname = 'N/A';
                        if (currentHostname) {
                            try {
                                displayHostname = currentHostname.toUpperCase().replace('WWW.', '').split('.')[0];
                            } catch (e) {
                                console.warn("CONTENT.JS: Error formatting hostname", e);
                                displayHostname = 'HOST_ERR';
                            }
                        }
                        hostnameSpanEl.textContent = displayHostname;
                        hostnameSpanEl.style.display = 'inline';
                    } else if (hostnameSpanEl) {
                        hostnameSpanEl.textContent = '';
                        hostnameSpanEl.style.display = 'none';
                    }
                }
             } else {
                console.warn("CONTENT.JS: updateOverlayDOM - Failed to recreate overlay.");
             }
          }
          return;
      }
      if (overlayContainer !== currentOverlayElement) overlayContainer = currentOverlayElement;

      const expectedDisplay = isOverlayVisible ? 'block' : 'none';
      currentOverlayElement.style.display = expectedDisplay;

      // Restore default position based on CSS (or set explicitly if needed later)
      currentOverlayElement.style.top = 'var(--wp-overlay-top)';
      currentOverlayElement.style.right = 'var(--wp-overlay-right)';
      currentOverlayElement.style.bottom = 'auto';
      currentOverlayElement.style.left = 'auto';

      // Restore default padding based on CSS
      currentOverlayElement.style.padding = 'var(--wp-overlay-padding)';

      let baseClassName = 'wp-overlay-container';
      if (overlayMode === 'greenscreen') baseClassName += ' greenscreen';
      else if (overlayMode === 'minimal') baseClassName += ' minimal';
      else if (overlayMode === 'compact') baseClassName += ' compact';
      else if (overlayMode === 'vertical') baseClassName += ' vertical';
      if (currentOverlayPositionSide === 'left') {
        baseClassName += ' position-left';
      }
      if (currentOverlayElement.className !== baseClassName) currentOverlayElement.className = baseClassName;

      const infoToDisplay = currentVideoInfo;
      if (infoToDisplay) {
        const seriesEl = currentOverlayElement.querySelector('#wp-overlay-series-text');
        const episodeEl = currentOverlayElement.querySelector('#wp-overlay-episode-text');
        const timeContainerEl = currentOverlayElement.querySelector('#wp-overlay-time-text-container');
        const actualTimeSpanEl = currentOverlayElement.querySelector('#wp-overlay-actual-time');
        const hostnameSpanEl = currentOverlayElement.querySelector('#wp-overlay-hostname-display');
        const compactContainerEl = currentOverlayElement.querySelector('#wp-overlay-compact-text-container');
        const compactInfoSpanEl = currentOverlayElement.querySelector('#wp-overlay-compact-info');
        const compactTimeSpanEl = currentOverlayElement.querySelector('#wp-overlay-compact-time');

        // Time display logic based on currentTimeDisplayMode
        let timeTextToDisplay = '';
        const currentS = parseFloat(infoToDisplay.currentSeconds);
        const durationS = parseFloat(infoToDisplay.durationSeconds);

        if (currentTimeDisplayMode === 'current_duration') {
          timeTextToDisplay = `${formatTime(currentS)} / ${formatTime(durationS)}`;
        } else if (currentTimeDisplayMode === 'current_only') {
          timeTextToDisplay = formatTime(currentS);
        } else if (currentTimeDisplayMode === 'none') {
          timeTextToDisplay = ''; // Or hide the time element entirely
        }

        if (overlayMode === 'compact') {
          if (seriesEl) seriesEl.style.display = 'none';
          if (episodeEl) episodeEl.style.display = 'none';
          if (timeContainerEl) timeContainerEl.style.display = 'none';
          if (compactContainerEl) compactContainerEl.style.display = 'flex';

          if (infoToDisplay && compactInfoSpanEl && compactTimeSpanEl) {
            const episodeText = infoToDisplay.episode || infoToDisplay.title || 'N/A';
            compactInfoSpanEl.textContent = episodeText;
            compactTimeSpanEl.textContent = timeTextToDisplay;
          } else if (isFetchingActive && compactInfoSpanEl && compactTimeSpanEl) {
            compactInfoSpanEl.textContent = 'Loading...';
            compactTimeSpanEl.textContent = currentTimeDisplayMode === 'none' ? '' : '--:--';
          } else if (compactInfoSpanEl && compactTimeSpanEl) {
            compactInfoSpanEl.textContent = 'N/A';
            compactTimeSpanEl.textContent = currentTimeDisplayMode === 'none' ? '' : '--:--';
          }
        } else { // Normal, Greenscreen, Minimal modes
          if (seriesEl) seriesEl.style.display = 'block';
          if (episodeEl) episodeEl.style.display = 'block';
          if (timeContainerEl) timeContainerEl.style.display = 'flex';
          if (compactContainerEl) compactContainerEl.style.display = 'none';

          // Display hostname in normal mode
          if (overlayMode === 'normal' && hostnameSpanEl) {
            const currentHostname = window.location.hostname;
            let displayHostname = 'N/A';
            if (currentHostname) {
                try {
                    displayHostname = currentHostname.toUpperCase().replace('WWW.', '').split('.')[0];
                } catch (e) {
                    console.warn("CONTENT.JS: Error formatting hostname", e);
                    displayHostname = 'HOST_ERR';
                }
            }
            hostnameSpanEl.textContent = displayHostname;
            hostnameSpanEl.style.display = 'inline';
          } else if (hostnameSpanEl) {
            hostnameSpanEl.textContent = '';
            hostnameSpanEl.style.display = 'none';
          }

          if (infoToDisplay) {
            if (seriesEl) seriesEl.textContent = infoToDisplay.series || '';
            if (episodeEl) episodeEl.textContent = infoToDisplay.episode || infoToDisplay.title || 'N/A';
            if (actualTimeSpanEl) {
                actualTimeSpanEl.textContent = timeTextToDisplay;
                // Hide/show container based on whether time is displayed
                if (timeContainerEl) timeContainerEl.style.display = currentTimeDisplayMode === 'none' ? 'none' : 'flex';
            }
          } else if (isFetchingActive) {
            if (seriesEl) seriesEl.textContent = '';
            if (episodeEl) episodeEl.textContent = 'Loading...';
            if (actualTimeSpanEl) actualTimeSpanEl.textContent = currentTimeDisplayMode === 'none' ? '' : '--:-- / --:--';
            if (timeContainerEl) timeContainerEl.style.display = currentTimeDisplayMode === 'none' ? 'none' : (isFetchingActive ? 'flex' : 'none');
          } else { // Not fetching, no info, clear all text fields for these modes
            if (seriesEl) seriesEl.textContent = '';
            if (episodeEl) episodeEl.textContent = 'N/A';
            if (actualTimeSpanEl) actualTimeSpanEl.textContent = currentTimeDisplayMode === 'none' ? '' : '--:-- / --:--';
            if (timeContainerEl) timeContainerEl.style.display = currentTimeDisplayMode === 'none' ? 'none' : 'flex';
          }
        }
      } else if (isFetchingActive) {
        const seriesEl = currentOverlayElement.querySelector('#wp-overlay-series-text');
        const episodeEl = currentOverlayElement.querySelector('#wp-overlay-episode-text');
        const timeContainerEl = currentOverlayElement.querySelector('#wp-overlay-time-text-container');
        const actualTimeSpanEl = currentOverlayElement.querySelector('#wp-overlay-actual-time');
        const hostnameSpanEl = currentOverlayElement.querySelector('#wp-overlay-hostname-display');

        if (seriesEl) seriesEl.textContent = '';
        if (episodeEl) episodeEl.textContent = 'Loading...';
        if (timeContainerEl) timeContainerEl.style.display = 'none';
        if (actualTimeSpanEl) actualTimeSpanEl.textContent = '--:-- / --:--';
        
        // Clear hostname if fetching and not in normal mode or no info yet
        if (hostnameSpanEl && overlayMode !== 'normal') {
            hostnameSpanEl.textContent = '';
            hostnameSpanEl.style.display = 'none';
        }
        // Handle time container display when fetching and no info yet
        if (timeContainerEl) timeContainerEl.style.display = currentTimeDisplayMode === 'none' ? 'none' : 'flex'; 
      }
    }

    function fetchAndSendVideoInfo() {
      if (checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_PreFetch")) return;
      if (!isFetchingActive || !currentSiteConfig) { // Also check for currentSiteConfig
        // console.log("CONTENT.JS: Fetching not active or no site config.");
        return;
      }

      const rawVideoInfo = getVideoInfo(); // Changed from getVideoInfoForLaftel
      currentVideoInfo = rawVideoInfo;

      if (checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_PreSend")) return;

      if (chrome.runtime && chrome.runtime.sendMessage) {
          try {
            chrome.runtime.sendMessage({ type: 'VIDEO_INFO_UPDATE', data: currentVideoInfo }, (response) => {
                if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || "Unknown error";
                    console.warn(`CONTENT.JS: Error sending VIDEO_INFO_UPDATE: ${errorMessage}`);
                    if (errorMessage.includes("Extension context invalidated") || errorMessage.includes("Receiving end does not exist")) {
                        checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_ResponseError");
                    }
                } else if (response && !response.success) {
                    // console.warn("CONTENT.JS: VIDEO_INFO_UPDATE non-success response from BG:", response.error);
                }
            });
          } catch (e) {
             console.warn("CONTENT.JS: Exception during sendMessage for VIDEO_INFO_UPDATE", e.message);
             checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_SendException");
          }
      } else {
          checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_NoRuntime");
      }
      updateOverlayDOM();
    }

    function startFetching() {
      if (checkAndHandleInvalidatedContext("startFetching")) return;
      if (fetchIntervalId) clearInterval(fetchIntervalId); // Clear existing before starting new
      isFetchingActive = true;
      fetchIntervalId = setInterval(fetchAndSendVideoInfo, 1000);
      fetchAndSendVideoInfo();
      console.log("CONTENT.JS: Started video info fetching. Interval ID:", fetchIntervalId);
    }

    function stopFetching() {
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      isFetchingActive = false;
      fetchIntervalId = null;
      console.log("CONTENT.JS: Stopped video info fetching.");
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      let responseData = { success: true, type: message.type + "_RESPONSE" }; 
      let sentResponse = false;

      // Initial check for context before any processing
      if (checkAndHandleInvalidatedContext(`onMessage_Entry_Type_${message.type}`)) {
        try {
          sendResponse({ success: false, error: "Extension context invalidated in content script at entry.", contextInvalidated: true });
          sentResponse = true;
        } catch (e) { /* If sendResponse itself fails due to bad context, ignore further */ }
        return true; // Indicate async if sendResponse might be called, or to stop further processing in Chrome.
      }

      try {
        if (message.type === 'TOGGLE_FETCHING') {
          if (message.action === 'start') {
            if (!isFetchingActive) startFetching();
            responseData.status = "fetching_started";
          } else if (message.action === 'stop') {
            if (isFetchingActive) stopFetching();
            responseData.status = "fetching_stopped";
          }
        } else if (message.type === 'TOGGLE_VISIBILITY') {
          isOverlayVisible = message.action === 'show';
          updateOverlayDOM();
          responseData.status = isOverlayVisible ? "overlay_shown" : "overlay_hidden";
          responseData.isOverlayVisible = isOverlayVisible;
        } else if (message.type === 'TOGGLE_OVERLAY_MODE') {
          console.log(`CONTENT.JS: Received TOGGLE_OVERLAY_MODE. New mode: ${message.mode}`);
          overlayMode = message.mode;
          updateOverlayDOM(); // Ensure DOM updates on mode change
          responseData.status = "mode_toggled";
          responseData.mode = overlayMode;
        } else if (message.type === 'GET_CONTENT_STATUS') {
          responseData = { 
            isFetching: isFetchingActive,
            isVisible: isOverlayVisible,
            mode: overlayMode,
            videoInfo: currentVideoInfo,
            success: true
          };
        } else if (message.type === 'GET_OVERLAY_TEXT') {
          let textToCopy = "N/A";
          const seriesText = currentVideoInfo?.series || "";
          const episodeText = currentVideoInfo?.episode || currentVideoInfo?.title || "N/A";
          const currentTimeFormatted = formatTime(currentVideoInfo?.currentSeconds);
          const durationTimeFormatted = formatTime(currentVideoInfo?.durationSeconds);

          if (overlayMode === 'normal' || overlayMode === 'greenscreen') {
            if (seriesText && seriesText !== "N/A") {
              textToCopy = `${seriesText} - ${episodeText} - ${currentTimeFormatted}/${durationTimeFormatted}`;
            } else {
              textToCopy = `${episodeText} - ${currentTimeFormatted}/${durationTimeFormatted}`;
            }
          } else if (overlayMode === 'compact' || overlayMode === 'vertical') {
            // For vertical mode, copy the readable horizontal version
            textToCopy = `${episodeText} - ${currentTimeFormatted}`;
          } else { // Minimal or other modes, default to episode and current time
            textToCopy = `${episodeText} - ${currentTimeFormatted}`;
          }
          responseData.text = textToCopy;
          responseData.success = true;
        } else if (message.type === 'SYNC_INITIAL_BG_STATE') {
          // --- DETAILED LOGGING ADDED ---
          console.log('CONTENT.JS: Received SYNC_INITIAL_BG_STATE. Full message object:', JSON.stringify(message));
          console.log('CONTENT.JS: Keys in received message:', message ? Object.keys(message) : 'message is null/undefined');
          console.log('CONTENT.JS: Value of message.data:', message ? JSON.stringify(message.data) : 'message is null/undefined');
          console.log('CONTENT.JS: Value of message.states (old key, for debug):', message ? JSON.stringify(message.states) : 'message is null/undefined');
          // --- END OF DETAILED LOGGING ---

          if (message && message.data) { // Check if message.data exists and is an object
            isFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : false;
            isOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : false;
            overlayMode = message.data.overlayMode || 'normal';
            currentTimeDisplayMode = message.data.timeDisplayMode || 'current_duration'; // Sync time display mode
            currentOverlayPositionSide = message.data.overlayPositionSide || 'right'; // Sync position side
            currentVideoInfo = message.data.lastVideoInfo || null; // Sync last known video info
            console.log('CONTENT.JS: SYNC_INITIAL_BG_STATE applied using message.data.');
          } else if (message && message.states && typeof message.states === 'object') { // Fallback for old structure, for debugging
            console.warn("CONTENT.JS: SYNC_INITIAL_BG_STATE received with 'states' key instead of 'data'. Using 'states'. THIS IS UNEXPECTED.");
            isFetchingActive = message.states.isFetchingActive !== undefined ? message.states.isFetchingActive : false;
            isOverlayVisible = message.states.isOverlayVisible !== undefined ? message.states.isOverlayVisible : false;
            overlayMode = message.states.overlayMode || 'normal';
            currentTimeDisplayMode = message.states.timeDisplayMode || 'current_duration'; // Sync time display mode (fallback)
            currentOverlayPositionSide = message.states.overlayPositionSide || 'right'; // Sync position side (fallback)
            currentVideoInfo = message.states.lastVideoInfo || null;
          } else {
            console.error("CONTENT.JS: SYNC_INITIAL_BG_STATE received but message.data is missing or not an object. Defaulting states. Message:", JSON.stringify(message));
            isFetchingActive = false; 
            isOverlayVisible = false; 
            overlayMode = 'normal'; 
            currentTimeDisplayMode = 'current_duration'; // Default time display mode
            currentOverlayPositionSide = 'right'; // Default position side
            currentVideoInfo = null; 
          }
          
          createOverlayDOMIfNotExists(); // Ensure DOM is there
          updateOverlayDOM(currentVideoInfo, isOverlayVisible, overlayMode);

          if (isFetchingActive && !fetchIntervalId && currentSiteConfig) {
            fetchIntervalId = setInterval(fetchAndSendVideoInfo, 1000);
            console.log('CONTENT.JS: SYNC: Restarted fetching interval due to background state.');
          } else if (!isFetchingActive && fetchIntervalId) {
            clearInterval(fetchIntervalId);
            fetchIntervalId = null;
            console.log('CONTENT.JS: SYNC: Cleared fetching interval due to background state.');
          }
          responseData.success = true;
          responseData.mode = overlayMode;
        } else if (message.type === 'SET_OVERLAY_PADDING') {
          if (typeof message.padding === 'number') {
            updateOverlayDOM();
            responseData.success = true;
            responseData.padding = message.padding;
            console.log("CONTENT.JS: Overlay padding set to", message.padding);
          } else {
            responseData.success = false;
            responseData.error = "Invalid padding value";
          }
        } else if (message.type === 'SET_OVERLAY_POSITION') {
          if (message.position) {
            updateOverlayDOM();
            responseData.success = true;
            responseData.position = message.position;
            console.log("CONTENT.JS: Overlay position set to", message.position);
          } else {
            responseData.success = false;
            responseData.error = "Invalid position value";
          }
        } else if (message.type === 'SET_TIME_DISPLAY_MODE') {
          if (message.mode) {
            currentTimeDisplayMode = message.mode;
            updateOverlayDOM();
            responseData.success = true;
            responseData.mode = currentTimeDisplayMode;
            console.log("CONTENT.JS: Time display mode set to", currentTimeDisplayMode);
          } else {
            responseData.success = false;
            responseData.error = "No time display mode provided";
          }
        } else if (message.type === 'SET_OVERLAY_POSITION_SIDE') {
          if (message.positionSide === 'left' || message.positionSide === 'right') {
            currentOverlayPositionSide = message.positionSide;
            updateOverlayDOM();
            responseData.success = true;
            responseData.positionSide = currentOverlayPositionSide;
            console.log("CONTENT.JS: Overlay position side set to", currentOverlayPositionSide);
          } else {
            responseData.success = false;
            responseData.error = "Invalid positionSide value provided";
          }
        } else {
          responseData.success = false;
          responseData.error = "Unknown message type in content script";
        }
      } catch (e) {
        console.error(`CONTENT.JS: Error processing message ${message.type}:`, e.message, e.stack);
        responseData.success = false;
        responseData.error = e.message || `Error in content script handling ${message.type}`;
      } finally {
        if (!sentResponse) {
          // Re-check context just before sending response, as it might have changed during processing.
          if (checkAndHandleInvalidatedContext(`onMessage_FinalSend_Type_${message.type}`)) {
            try {
              sendResponse({ success: false, error: "Extension context became invalidated during message processing.", contextInvalidated: true });
              sentResponse = true;
            } catch (e_sf) { /* ignore */ }
          }
          if (!sentResponse) {
            try {
              sendResponse(responseData);
              sentResponse = true;
            } catch (e_sr_final) {
              console.warn(`CONTENT.JS: Error calling sendResponse for ${message.type} in finally: ${e_sr_final.message}.`);
              // Don't call checkAndHandleInvalidatedContext again here to avoid loops if sendResponse itself is the problem source with context.
            }
          }
        }
      }
      // All current paths call sendResponse synchronously. Return false.
      // If any path were to become truly asynchronous (e.g. await before sendResponse),
      // then this addListener should return true. For now, it's okay as false.
      return false; 
    });

    function mainInitialization() {
      if (checkAndHandleInvalidatedContext("mainInitialization_Start")) return;

      const currentHostname = window.location.hostname;
      console.log("CONTENT.JS: Current Hostname:", currentHostname);
      
      // Normalize hostname (remove www. if present)
      const normalizedHostname = currentHostname.replace(/^www\./, '');
      console.log("CONTENT.JS: Normalized Hostname for lookup:", normalizedHostname);
      
      currentSiteConfig = siteSelectors[normalizedHostname];

      if (!currentSiteConfig) {
        console.warn(`CONTENT.JS: No configuration found for host: ${currentHostname}. Overlay will not function.`);
        // Optionally, inform the user via the overlay or console, or disable UI elements.
        // For now, it just won't fetch info.
        return; // Stop initialization if site is not supported.
      }
      console.log("CONTENT.JS: Loaded config for host:", currentHostname, JSON.stringify(currentSiteConfig));

      createOverlayDOMIfNotExists(); 
      if (checkAndHandleInvalidatedContext("mainInitialization_PreReadySend")) return;

      try {
        chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' })
          .then(response => {
            if (checkAndHandleInvalidatedContext("mainInitialization_ReadyResponse")) return;
            if (response && !response.success) {
              console.warn("CONTENT.JS: CONTENT_SCRIPT_READY was not successfully acknowledged or error from BG:", response?.error);
            }
          })
          .catch(error => {
            if (checkAndHandleInvalidatedContext("mainInitialization_ReadyError")) return;
            const errMsg = (error && error.message) ? error.message : "Unknown error sending CONTENT_SCRIPT_READY";
            // Filter out common, usually benign errors for this specific message.
            if (!errMsg.includes("Could not establish connection. Receiving end does not exist.") && 
                !errMsg.includes("A listener indicated an asynchronous response by returning true, but the message channel closed") &&
                !errMsg.includes("Extension context invalidated")) {
              console.error("CONTENT.JS: Error sending CONTENT_SCRIPT_READY:", errMsg);
            }
          });
      } catch (e) {
        console.warn("CONTENT.JS: Exception during sendMessage for CONTENT_SCRIPT_READY", e.message);
        checkAndHandleInvalidatedContext("mainInitialization_SendException");
      }
    }

    mainInitialization();
    console.log("CONTENT.JS: Script execution in initial block finished.");

  } else {
    console.log("CONTENT.JS: Script (wpOverlayTimerHasInitialized) already initialized, skipping full re-initialization.");
  }
} else {
  console.log("CONTENT.JS: Script (wpOverlayTimerLoaded) already loaded, skipping initialization.");
} 