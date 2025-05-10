// --- 중복 실행 방지 ---
if (typeof window.wpOverlayTimerLoaded === 'undefined') {
  window.wpOverlayTimerLoaded = true;
  console.log("CONTENT.JS: Watch Party Overlay Timer content.js INITIALIZING attempt...");

  if (typeof window.wpOverlayTimerHasInitialized === 'undefined') {
    window.wpOverlayTimerHasInitialized = true;
    console.log("CONTENT.JS: Initializing for the first time.");

    let fetchIntervalId = null;
    let currentIsFetchingActive = false;
    let currentIsOverlayVisible = false;
    let currentOverlayMode = 'normal';
    let currentOverlayTheme = 'light'; // 'light', 'dark', 'greenscreen-white-text', 'greenscreen-black-text'
    let currentTimeDisplayMode = 'current_duration';
    let currentOverlayPositionSide = 'right'; // NEW: Default position
    let currentVideoInfo = null;
    let isContextInvalidated = false;
    let lastVideoInfoString = '';

    // Define selectors for different sites
    const siteSelectors = {
      'laftel.net': {
        titleSelector: '#root > div.sc-4a02fa07-0.cSulJK > div > div.sc-ec16796a-2.hlVrXi > div > div > div.sc-46d49bb0-5.hFtDBz > div.sc-46d49bb0-7.krHzYQ', // Episode Title
        seriesSelector: '#root > div.sc-4a02fa07-0.cSulJK > div > div.sc-ec16796a-2.hlVrXi > div > a', // Series Title
        movieTitleSelector: '#root > div.sc-4a02fa07-0.cSulJK > div > div.sc-ec16796a-2.hlVrXi > div > div > div.sc-46d49bb0-5.hFtDBz > a', // New: For single titles like movies
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
        return null;
      }

      let episode = "N/A"; // Use 'episode' as the primary title key
      let series = "N/A";
      let currentSeconds = 0;
      let durationSeconds = 0;

      if (currentSiteConfig.siteName === 'LAFTEL') {
        // Laftel specific logic
        let mainTitleFound = false;
        // 1. Try standard episode title selector
        const standardEpisodeEl = document.querySelector(currentSiteConfig.titleSelector);
        if (standardEpisodeEl) {
            episode = standardEpisodeEl.innerText.trim();
            mainTitleFound = true;
            // If standard episode found, try to get series title
            if (currentSiteConfig.seriesSelector) {
                const seriesEl = document.querySelector(currentSiteConfig.seriesSelector);
                if (seriesEl) {
                    series = seriesEl.innerText.trim();
                } else {
                    series = ""; // Found episode, but no series found via selector
                }
            } else {
                 series = ""; // No series selector defined, but episode found
            }
        } else if (currentSiteConfig.movieTitleSelector) {
            // 2. Standard episode not found, try movie title selector
            const movieTitleEl = document.querySelector(currentSiteConfig.movieTitleSelector);
            if (movieTitleEl) {
                episode = movieTitleEl.innerText.trim();
                mainTitleFound = true;
                series = ""; // For movies, series is explicitly empty as requested
            }
        }
        
        // If neither standard nor movie title was found, they remain "N/A"

      } else {
        // Generic logic for other sites (current implementation)
        if (currentSiteConfig.titleSelector) {
            const titleEl = document.querySelector(currentSiteConfig.titleSelector);
            if (titleEl) episode = titleEl.innerText.trim();
        }
        if (currentSiteConfig.seriesSelector) {
            const seriesEl = document.querySelector(currentSiteConfig.seriesSelector);
            if (seriesEl) series = seriesEl.innerText.trim();
        } else if (currentSiteConfig.titleSelector && !currentSiteConfig.seriesSelector && episode !== "N/A") {
            // If there's a title but no series selector (e.g., chzzk VOD) and an episode title was found
            series = ""; // Series can be empty
        }
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
        episode: episode, 
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
        // 초기 클래스 설정 (모드 및 그린스크린 상태 반영)
        overlayContainer.classList.remove('normal-mode', 'compact-mode', 'compact-no-time', 'position-left', 'position-right', 'theme-light', 'theme-dark', 'theme-greenscreen-white-text', 'theme-greenscreen-black-text');
        if (currentOverlayMode === 'compact') {
          overlayContainer.classList.add('compact-mode');
        } else {
          overlayContainer.classList.add('normal-mode');
        }
        overlayContainer.classList.toggle('compact-no-time', currentOverlayMode === 'compact' && currentTimeDisplayMode === 'none');
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
        // Verify append and log initial display style
        if (targetParent.contains(overlayContainer)) {
            console.log("CONTENT.JS: createOverlayDOMIfNotExists - Overlay successfully appended to target parent:", targetParent);
            console.log("CONTENT.JS: createOverlayDOMIfNotExists - Overlay display style after append (should be empty or set by CSS initially, then by updateOverlayDOM):", window.getComputedStyle(overlayContainer).display);
        } else {
            console.error("CONTENT.JS: createOverlayDOMIfNotExists - Failed to append overlay to target parent or overlay not found in parent!");
        }
        updateOverlayDOM();
      } else {
        console.error("CONTENT.JS: createOverlayDOMIfNotExists - Suitable target parent not found.");
      }
    }
    
    function updateOverlayDOM() {
      if (checkAndHandleInvalidatedContext("updateOverlayDOM")) return;
      const currentOverlayElement = document.getElementById('wp-overlay-timer');

      // Log entry point with all relevant current states
      console.log(
        `CONTENT.JS: updateOverlayDOM CALLED. Current States Before Update: \n` + 
        `  Mode: ${currentOverlayMode}, Theme: ${currentOverlayTheme}, TimeDisplay: ${currentTimeDisplayMode}, \n` + 
        `  Position: ${currentOverlayPositionSide}, Visible: ${currentIsOverlayVisible}, Fetching: ${currentIsFetchingActive}, \n` + 
        `  Info: ${currentVideoInfo ? 'Exists' : 'null'}`
      );

      if (!currentOverlayElement) {
          if (currentIsOverlayVisible && !isContextInvalidated) {
             console.error("CONTENT.JS: updateOverlayDOM - Overlay element missing! Attempting to recreate.");
             createOverlayDOMIfNotExists(); 
             const newOverlayElement = document.getElementById('wp-overlay-timer');
             if(newOverlayElement) {
                overlayContainer = newOverlayElement;
             } else {
                console.warn("CONTENT.JS: updateOverlayDOM - Failed to recreate overlay, cannot update.");
                return;
             }
          } else {
            return; 
          }
      }
      if (overlayContainer !== currentOverlayElement) overlayContainer = currentOverlayElement;

      console.log(`CONTENT.JS: updateOverlayDOM START - Mode: ${currentOverlayMode}, Theme: ${currentOverlayTheme}, TimeDisplay: ${currentTimeDisplayMode}, Visible: ${currentIsOverlayVisible}, Fetching: ${currentIsFetchingActive}, Info: ${currentVideoInfo ? JSON.stringify(currentVideoInfo) : 'null'}`);

      overlayContainer.style.display = currentIsOverlayVisible ? 'flex' : 'none';
      if (!currentIsOverlayVisible) return;

      // Reset classes for mode, position, and compact-no-time first
      overlayContainer.classList.remove('normal-mode', 'compact-mode', 'compact-no-time', 'position-left', 'position-right');
      
      // Apply mode class
      if (currentOverlayMode === 'compact') {
        overlayContainer.classList.add('compact-mode');
        if (currentTimeDisplayMode === 'none') {
          overlayContainer.classList.add('compact-no-time');
        }
      } else { 
        overlayContainer.classList.add('normal-mode');
      }
      
      // Apply position class
      if (currentOverlayPositionSide === 'left') {
        overlayContainer.classList.add('position-left');
      } else {
        overlayContainer.classList.add('position-right'); 
      }

      // Apply theme class separately
      const themeClasses = ['theme-light', 'theme-dark', 'theme-greenscreen-white-text', 'theme-greenscreen-black-text'];
      themeClasses.forEach(cls => overlayContainer.classList.remove(cls)); // Remove all theme classes
      
      console.log(`CONTENT.JS: updateOverlayDOM - Applying theme. currentOverlayTheme from background = "${currentOverlayTheme}", type: ${typeof currentOverlayTheme}`);
      console.log(`CONTENT.JS: updateOverlayDOM - Defined themeClasses array for matching: [${themeClasses.join(', ')}]`);
      
      let themeApplied = false;
      // Construct the expected full CSS class name from the theme name received from background
      const expectedCssClass = "theme-" + currentOverlayTheme;
      console.log(`CONTENT.JS: updateOverlayDOM - Constructed expected CSS class: "${expectedCssClass}"`);

      for (let i = 0; i < themeClasses.length; i++) {
        const themeClassToCompareInArray = themeClasses[i];
        const comparisonResult = (themeClassToCompareInArray === expectedCssClass);
        console.log(`CONTENT.JS: updateOverlayDOM - Comparing constructed CSS class "${expectedCssClass}" with themeClasses[${i}] "${themeClassToCompareInArray}": ${comparisonResult}`);
        if (comparisonResult) {
          overlayContainer.classList.add(expectedCssClass); // Add the successfully matched CSS class
          console.log(`CONTENT.JS: updateOverlayDOM - Added theme class: "${expectedCssClass}"`);
          themeApplied = true;
          break; 
        }
      }

      if (!themeApplied) {
         overlayContainer.classList.add('theme-light'); // Fallback to light theme
         console.log(`CONTENT.JS: updateOverlayDOM - Added FALLBACK theme class: theme-light (currentOverlayTheme was: "${currentOverlayTheme}", constructed expectedCssClass was: "${expectedCssClass}")`);
      }

      // Force a reflow to help ensure styles are applied, especially for theme changes.
      if (overlayContainer) {
        void overlayContainer.offsetWidth;
      }

      const infoToDisplay = currentVideoInfo;
      const seriesEl = overlayContainer.querySelector('#wp-overlay-series-text');
      const episodeEl = overlayContainer.querySelector('#wp-overlay-episode-text');
      const timeContainerEl = overlayContainer.querySelector('#wp-overlay-time-text-container');
      const actualTimeSpanEl = overlayContainer.querySelector('#wp-overlay-actual-time');
      const hostnameSpanEl = overlayContainer.querySelector('#wp-overlay-hostname-display');
      const compactContainerEl = overlayContainer.querySelector('#wp-overlay-compact-text-container');
      const compactInfoSpanEl = overlayContainer.querySelector('#wp-overlay-compact-info');
      const compactTimeSpanEl = overlayContainer.querySelector('#wp-overlay-compact-time');

      let timeTextToDisplay = '';
      const isLoading = currentIsFetchingActive && !infoToDisplay;

      if (currentTimeDisplayMode !== 'none') {
        if (infoToDisplay && infoToDisplay.currentSeconds !== undefined && infoToDisplay.durationSeconds !== undefined) {
          const currentS = parseFloat(infoToDisplay.currentSeconds);
          const durationS = parseFloat(infoToDisplay.durationSeconds);
          if (currentTimeDisplayMode === 'current_duration') {
            timeTextToDisplay = `${formatTime(currentS)} / ${formatTime(durationS)}`;
          } else if (currentTimeDisplayMode === 'current_only') {
            timeTextToDisplay = formatTime(currentS);
          } else {
             console.warn("CONTENT.JS: Unexpected currentTimeDisplayMode in time text generation (info exists):", currentTimeDisplayMode);
             timeTextToDisplay = "ERR_MODE";
          }
        } else if (currentIsFetchingActive) {
          if (currentTimeDisplayMode === 'current_duration') {
            timeTextToDisplay = '--:-- / --:--';
          } else if (currentTimeDisplayMode === 'current_only') {
            timeTextToDisplay = '--:--';
          } else {
            console.warn("CONTENT.JS: Unexpected currentTimeDisplayMode in time text generation (loading):", currentTimeDisplayMode);
            timeTextToDisplay = "ERR_LOAD";
          }
        }
      }

      console.log(`CONTENT.JS: updateOverlayDOM - Generated timeTextToDisplay: '${timeTextToDisplay}' for mode: ${currentTimeDisplayMode}`);
      
      if (currentOverlayMode === 'compact') {
        if (seriesEl) seriesEl.style.display = 'none';
        if (episodeEl) episodeEl.style.display = 'none';
        if (timeContainerEl) timeContainerEl.style.display = 'none';
        if (compactContainerEl) compactContainerEl.style.display = 'flex';

        if (compactInfoSpanEl) compactInfoSpanEl.textContent = isLoading ? 'Loading...' : (infoToDisplay ? (infoToDisplay.episode || infoToDisplay.title || 'N/A') : 'N/A');
        if (compactTimeSpanEl) {
            compactTimeSpanEl.textContent = timeTextToDisplay;
            const newCompactTimeDisplay = currentTimeDisplayMode === 'none' ? 'none' : 'inline';
            compactTimeSpanEl.style.display = newCompactTimeDisplay;
            console.log(`CONTENT.JS: Compact Mode - Set compactTimeSpanEl.textContent to: '${timeTextToDisplay}', and display to: ${newCompactTimeDisplay}`);
        }
      } else { 
        if (seriesEl) seriesEl.style.display = 'block';
        if (episodeEl) episodeEl.style.display = 'block';
        
        const newNormalTimeContainerDisplay = currentTimeDisplayMode === 'none' ? 'none' : 'flex';
        if (timeContainerEl) {
            timeContainerEl.style.display = newNormalTimeContainerDisplay;
            console.log("CONTENT.JS: Normal Mode - Set timeContainerEl.style.display to:", newNormalTimeContainerDisplay);
        }
        if (actualTimeSpanEl) {
            actualTimeSpanEl.textContent = timeTextToDisplay;
            console.log(`CONTENT.JS: Normal Mode - Set actualTimeSpanEl.textContent to: '${timeTextToDisplay}'`);
        }

        if (compactContainerEl) compactContainerEl.style.display = 'none';

        if (seriesEl) seriesEl.textContent = isLoading ? 'Loading...' : (infoToDisplay ? (infoToDisplay.series || '') : '');
        if (episodeEl) episodeEl.textContent = isLoading ? 'Loading...' : (infoToDisplay ? (infoToDisplay.episode || infoToDisplay.title || 'N/A') : 'N/A');
        
        if (hostnameSpanEl) {
          if (isLoading || !infoToDisplay) {
            hostnameSpanEl.textContent = '';
            hostnameSpanEl.style.display = 'none';
          } else {
            const currentHostname = window.location.hostname;
            let displayHostname = '';
            if (currentHostname) {
                try {
                    displayHostname = currentHostname.toUpperCase().replace('WWW.', '').split('.')[0];
              } catch (e) { displayHostname = 'HOST_ERR'; }
            }
            hostnameSpanEl.textContent = displayHostname;
            hostnameSpanEl.style.display = 'inline';
          }
        }
      }
    }

    function fetchAndSendVideoInfo() {
      if (checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_PreFetch")) return;
      if (!currentIsFetchingActive || !currentSiteConfig) { // Also check for currentSiteConfig
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
      currentIsFetchingActive = true;
      fetchIntervalId = setInterval(fetchAndSendVideoInfo, 1000);
      fetchAndSendVideoInfo();
      console.log("CONTENT.JS: Started video info fetching. Interval ID:", fetchIntervalId);
    }

    function stopFetching() {
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      currentIsFetchingActive = false;
      fetchIntervalId = null;
      console.log("CONTENT.JS: Stopped video info fetching.");
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (checkAndHandleInvalidatedContext("onMessage_" + message.type)) {
        sendResponse({ success: false, error: "Context invalidated", from: "content.js" });
        return true;
      }
      
      // console.log("CONTENT.JS: Message received", message);

      let response = { success: true, from: "content.js" };

      switch (message.type) {
        case 'TOGGLE_FETCHING':
          if (message.action === 'start') {
            startFetching();
          } else {
            stopFetching();
          }
          response.isFetchingActive = currentIsFetchingActive;
          break;
        case 'TOGGLE_VISIBILITY':
          currentIsOverlayVisible = message.action === 'show';
          if (overlayContainer) {
            overlayContainer.style.display = currentIsOverlayVisible ? 'flex' : 'none';
          }
          response.isOverlayVisible = currentIsOverlayVisible;
          break;
        case 'TOGGLE_OVERLAY_MODE': // 'normal', 'compact' 모드 변경
          currentOverlayMode = message.mode;
          updateOverlayDOM();
          response.overlayMode = currentOverlayMode;
          break;
        case 'GET_CONTENT_STATUS':
          response.isFetchingActive = currentIsFetchingActive;
          response.isOverlayVisible = currentIsOverlayVisible;
          response.overlayMode = currentOverlayMode;
          response.timeDisplayMode = currentTimeDisplayMode;
          response.overlayPositionSide = currentOverlayPositionSide;
          response.overlayTheme = currentOverlayTheme;
          response.lastVideoInfo = currentVideoInfo;
          break;
        case 'BACKGROUND_STATE_UPDATE': // background로부터 전체 상태 업데이트 수신
          console.log("CONTENT.JS: Received BACKGROUND_STATE_UPDATE. Full data:", JSON.parse(JSON.stringify(message.data)));
          currentIsFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : currentIsFetchingActive;
          currentIsOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : currentIsOverlayVisible;
          currentOverlayMode = message.data.overlayMode || currentOverlayMode;
          currentTimeDisplayMode = message.data.timeDisplayMode || currentTimeDisplayMode;
          currentOverlayPositionSide = message.data.overlayPositionSide || currentOverlayPositionSide; 
          
          const oldTheme = currentOverlayTheme;
          console.log(`CONTENT.JS: BACKGROUND_STATE_UPDATE - Received raw overlayTheme from background: "${message.data.overlayTheme}", type: ${typeof message.data.overlayTheme}`);
          currentOverlayTheme = message.data.overlayTheme || currentOverlayTheme; 
          console.log(`CONTENT.JS: BACKGROUND_STATE_UPDATE - currentOverlayTheme was: "${oldTheme}", NOW: "${currentOverlayTheme}", type: ${typeof currentOverlayTheme}`);
          
          currentVideoInfo = message.data.lastVideoInfo !== undefined ? message.data.lastVideoInfo : currentVideoInfo; 
          
          if (currentIsOverlayVisible && !document.getElementById('wp-overlay-timer')) {
            console.log("CONTENT.JS: BACKGROUND_STATE_UPDATE - Overlay should be visible but DOM element not found. Creating it.");
            createOverlayDOMIfNotExists(); 
          } else {
            const existingOverlay = document.getElementById('wp-overlay-timer');
            if (existingOverlay) {
                console.log(`CONTENT.JS: BACKGROUND_STATE_UPDATE - Overlay DOM exists. Setting display to: ${currentIsOverlayVisible ? 'flex' : 'none'}`);
                existingOverlay.style.display = currentIsOverlayVisible ? 'flex' : 'none';
            }
          }
          console.log("CONTENT.JS: BACKGROUND_STATE_UPDATE - Calling updateOverlayDOM() due to state update.");
          updateOverlayDOM(); // Crucial call to refresh the overlay with all current states
          break;
        case 'SYNC_INITIAL_BG_STATE': // background로부터 초기 전체 상태 동기화 (신규 추가)
          console.log("CONTENT.JS: Received SYNC_INITIAL_BG_STATE", message.data);
          currentIsFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : currentIsFetchingActive;
          currentIsOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : currentIsOverlayVisible;
          currentOverlayMode = message.data.overlayMode || currentOverlayMode;
          console.log("CONTENT.JS: SYNC_INITIAL_BG_STATE - typeof message.data.timeDisplayMode:", typeof message.data.timeDisplayMode);
          console.log("CONTENT.JS: SYNC_INITIAL_BG_STATE - value of message.data.timeDisplayMode:", message.data.timeDisplayMode);
          currentTimeDisplayMode = message.data.timeDisplayMode || currentTimeDisplayMode;
          console.log("CONTENT.JS: SYNC_INITIAL_BG_STATE - currentTimeDisplayMode JUST SET TO:", currentTimeDisplayMode);
          currentOverlayPositionSide = message.data.overlayPositionSide || currentOverlayPositionSide;
          currentOverlayTheme = message.data.overlayTheme || currentOverlayTheme;
          if (message.data.lastVideoInfo !== undefined) { 
            currentVideoInfo = message.data.lastVideoInfo;
          }
          
          if (currentIsOverlayVisible && !document.getElementById('wp-overlay-timer')) {
            createOverlayDOMIfNotExists(); 
          } else {
            const existingOverlay = document.getElementById('wp-overlay-timer');
            if (existingOverlay) {
                existingOverlay.style.display = currentIsOverlayVisible ? 'flex' : 'none';
            }
          }
          updateOverlayDOM(); 
          response.received_sync = true; // 응답 내용 변경
          break;
        default:
          console.warn("CONTENT.JS: Unknown message type received:", message.type);
          response.success = false;
          response.error = "Unknown message type";
          break;
      }
      sendResponse(response);
      return true; // 비동기 응답을 위해 true 반환
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