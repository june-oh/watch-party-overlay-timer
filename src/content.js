// --- 중복 실행 방지 ---
if (typeof window.wpOverlayTimerLoaded === 'undefined') {
  window.wpOverlayTimerLoaded = true;
  // console.log("CONTENT.JS: Watch Party Overlay Timer content.js INITIALIZING attempt...");

  if (typeof window.wpOverlayTimerHasInitialized === 'undefined') {
    window.wpOverlayTimerHasInitialized = true;
    // console.log("CONTENT.JS: Initializing for the first time.");

    let fetchIntervalId = null;
    let currentIsFetchingActive = false;
    let currentIsOverlayVisible = false;
    let currentOverlayMode = 'normal';
    let currentOverlayTheme = 'light';
    let currentTimeDisplayMode = 'current_duration';
    let currentTitleDisplayMode = 'episode_series'; // NEW
    let currentOverlayPositionSide = 'right';
    let currentVideoInfo = null;
    let isContextInvalidated = false;
    // let lastVideoInfoString = ''; // 이 변수는 현재 사용되지 않는 것으로 보이므로 주석 처리 또는 삭제 고려

    const siteSelectors = {
      'laftel.net': {
        videoPlayerAreaHint: 'div[class*="sc-ec16796a-1"]',
        infoContainerHint_asSiblingToVideoPlayerAreaParent: 'div[class*="sc-ec16796a-2"]',
        seriesSubSelector: 'div[class*="sc-bae7327-0"] > a[href^="/item/"]',
        titleSubSelector: 'div[class*="sc-bae7327-0"] div[class*="sc-bae7327-7"]',
        movieSubSelector: 'div[class*="sc-bae7327-0"] div[class*="haCwMH"] > a[href^="/item/"]',
        siteName: 'LAFTEL'
      },
      'chzzk.naver.com': {
        playerLayoutId: '#player_layout',
        titleSubSelector: 'div[class^="vod_details"] h2[class^="video_information_title__"]',
        fullscreenTitleSubSelector: 'div[class*="player_header"] p[class^="vod_player_header_title__"]',
        seriesSubSelector: null,
        siteName: 'CHZZK'
      }
    };
    let currentSiteConfig = null;

    function checkAndHandleInvalidatedContext(operationName = "Operation") {
      if (isContextInvalidated) return true;
      try {
        if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.id === "undefined") {
          console.warn(`CONTENT.JS: Context invalidated (${operationName}). Halting.`);
          isContextInvalidated = true;
          if (fetchIntervalId) clearInterval(fetchIntervalId);
          fetchIntervalId = null;
          const existingOverlay = document.getElementById('wp-overlay-timer');
          if (existingOverlay) {
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
         if (fetchIntervalId) clearInterval(fetchIntervalId);
         fetchIntervalId = null;
         return true;
      }
      return false;
    }

    function formatTime(totalSeconds) {
      if (isNaN(totalSeconds) || totalSeconds < 0) {
        return '00:00'; // 오류 시 MM:SS 형식으로 표시
      }
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      
      if (hours > 0) { 
        // 시간이 1시간 이상일 경우 H:MM:SS 형식, H는 패딩 없음
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else {
        // 1시간 미만일 경우 MM:SS 형식
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }

    function truncateText(str, maxLen) {
      if (!str) return '';
      return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
    }

    function getVideoInfo() {
      if (checkAndHandleInvalidatedContext("getVideoInfo")) return null;
      if (!currentSiteConfig) return null;

      let episode = "N/A";
      let series = "N/A";
      let currentSeconds = 0;
      let durationSeconds = 0;
      const siteName = currentSiteConfig.siteName || window.location.hostname;
      const videoEl = document.querySelector('video');

      if (videoEl) {
        currentSeconds = videoEl.currentTime;
        durationSeconds = videoEl.duration;
        if (isNaN(durationSeconds) || !isFinite(durationSeconds)) durationSeconds = 0;
      }

      if (siteName === 'LAFTEL') {
        const previousEpisode = currentVideoInfo?.episode;
        const previousSeries = currentVideoInfo?.series;
        if (!videoEl) {
            episode = previousEpisode || "N/A";
            series = previousSeries || "";
            return { series, episode, currentSeconds, durationSeconds, siteName };
        }
        const videoPlayerArea = videoEl.closest(currentSiteConfig.videoPlayerAreaHint);
        let infoContainer = null;
        if (videoPlayerArea?.parentElement) {
            infoContainer = videoPlayerArea.parentElement.querySelector(currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent);
        }
        if (!infoContainer) infoContainer = document.querySelector(currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent);

        if (infoContainer) {
          let tempEpisode = null, tempSeries = null;
          let movieTitleElement = currentSiteConfig.movieSubSelector ? infoContainer.querySelector(currentSiteConfig.movieSubSelector) : null;
          if (movieTitleElement?.innerText?.trim()) {
            tempEpisode = movieTitleElement.innerText.trim();
            tempSeries = "";
          } else {
            const seriesElement = currentSiteConfig.seriesSubSelector ? infoContainer.querySelector(currentSiteConfig.seriesSubSelector) : null;
            const titleElement = currentSiteConfig.titleSubSelector ? infoContainer.querySelector(currentSiteConfig.titleSubSelector) : null;
            tempSeries = seriesElement?.innerText?.trim() || null;
            tempEpisode = titleElement?.innerText?.trim() || null;
            if (tempSeries && !tempEpisode) tempEpisode = "에피소드 정보 없음";
          }
          episode = (tempEpisode && tempEpisode !== "N/A" && tempEpisode !== "제목 정보 없음" && tempEpisode !== "에피소드 정보 없음") ? tempEpisode : (previousEpisode || "N/A");
          series = (tempEpisode && tempSeries === "") ? "" : (tempSeries || previousSeries || "");
        } else {
          episode = previousEpisode || "N/A";
          series = previousSeries || "";
        }
      } else if (siteName === 'CHZZK') {
        let titleText = null, titleElement = null;
        if (currentSiteConfig.titleSubSelector) {
            titleElement = document.querySelector(currentSiteConfig.titleSubSelector);
            titleText = titleElement?.innerText?.trim();
            // console.log(`CHZZK Normal: ${!!titleElement}, Text: '${titleText}'`);
        }
        if (!titleText && currentSiteConfig.playerLayoutId && currentSiteConfig.fullscreenTitleSubSelector) {
            const playerLayout = document.querySelector(currentSiteConfig.playerLayoutId);
            if (playerLayout) {
                titleElement = playerLayout.querySelector(currentSiteConfig.fullscreenTitleSubSelector);
                titleText = titleElement?.innerText?.trim();
                // console.log(`CHZZK Fullscreen: ${!!titleElement}, Text: '${titleText}'`);
            }
        }
        episode = titleText || "N/A";
        series = "";
      } else {
        const titleElement = currentSiteConfig.titleSelector ? document.querySelector(currentSiteConfig.titleSelector) : null;
        const seriesElement = currentSiteConfig.seriesSelector ? document.querySelector(currentSiteConfig.seriesSelector) : null;
        episode = titleElement?.innerText?.trim() || "N/A";
        series = seriesElement?.innerText?.trim() || (episode !== "N/A" && episode !== "" ? "" : "N/A");
      }
      return { series, episode, currentSeconds, durationSeconds, siteName };
    }

    function findTargetParent(videoEl) {
      if (checkAndHandleInvalidatedContext("findTargetParent")) return document.body;
      let potentialParent = videoEl.closest('div[class*="player"], div[class*="video_container"], div[id*="player"], div[id*="video_wrap"]');
      if (potentialParent) return potentialParent;
      if (videoEl.parentElement && videoEl.parentElement.tagName !== 'BODY' && videoEl.parentElement.tagName !== 'HTML') {
          if (videoEl.parentElement.parentElement && videoEl.parentElement.parentElement.tagName !== 'BODY' && videoEl.parentElement.parentElement.tagName !== 'HTML') {
              return videoEl.parentElement.parentElement;
          }
          return videoEl.parentElement;
      }
      return document.getElementById('root') || document.body;
    }
    let overlayContainer = null; // overlayContainer를 스크립트 전역으로 이동

    function createOverlayDOMIfNotExists(retryCount = 0) {
      if (checkAndHandleInvalidatedContext("createOverlayDOMIfNotExists")) return;
      // Check if overlay already exists
      if (document.getElementById('wp-overlay-timer')) {
        overlayContainer = document.getElementById('wp-overlay-timer');
        // Ensure it's in the DOM (might have been removed by site script)
        if (!overlayContainer.isConnected) {
          console.warn("CONTENT.JS: Overlay exists but not connected. Re-appending.");
          // Try re-appending, might need a target parent again?
          // Simplest is often just appending to body if disconnected.
          document.body.appendChild(overlayContainer);
        }
        // updateOverlayDOM(); // Don't call update here, let the caller handle it.
        return; // Already exists or re-connected
      }
      
      // If it doesn't exist, create it
      // console.log("CONTENT.JS: Creating overlay DOM element.");
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

      const timeDisplayContainerEl = document.createElement('div');
      timeDisplayContainerEl.className = 'wp-overlay-time-text';
      timeDisplayContainerEl.id = 'wp-overlay-time-text-container'; 
      
      const actualTimeEl = document.createElement('span');
      actualTimeEl.id = 'wp-overlay-actual-time';
      timeDisplayContainerEl.appendChild(actualTimeEl);

      const hostnameDisplayEl = document.createElement('span');
      hostnameDisplayEl.id = 'wp-overlay-hostname-display';
      timeDisplayContainerEl.appendChild(hostnameDisplayEl);
      overlayContainer.appendChild(timeDisplayContainerEl);

      const compactTextContainerEl = document.createElement('div');
      compactTextContainerEl.className = 'wp-overlay-compact-text-container';
      compactTextContainerEl.id = 'wp-overlay-compact-text-container';

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
        if (retryCount < 5) {
          setTimeout(() => createOverlayDOMIfNotExists(retryCount + 1), 100);
        }
        return;
      }

      const targetParent = findTargetParent(videoElement);
      if (targetParent) {
        const computedStyle = window.getComputedStyle(targetParent);
        if (computedStyle.position === 'static') targetParent.style.position = 'relative';
        targetParent.appendChild(overlayContainer);
        // console.log("CONTENT.JS: Overlay appended to target parent:", targetParent);
        updateOverlayDOM();
      } else {
        // Fallback: Append to body if no suitable parent found
        console.warn("CONTENT.JS: Suitable target parent not found. Appending overlay to document.body as fallback.");
        document.body.appendChild(overlayContainer);
        updateOverlayDOM();
      }
    }
    
    function updateOverlayDOM() {
      if (checkAndHandleInvalidatedContext("updateOverlayDOM")) return;
      // Add log at the start of the function
      console.log("CONTENT.JS: updateOverlayDOM() called."); 
      if (!overlayContainer) { // overlayContainer가 없으면 생성 시도
        // console.log("CONTENT.JS: updateOverlayDOM - overlayContainer is null, attempting to create.");
        createOverlayDOMIfNotExists();
        if (!overlayContainer) { // 그래도 없으면 반환
            // console.warn("CONTENT.JS: updateOverlayDOM - Failed to create/find overlayContainer after attempt.");
            return;
        }
      }

      const shouldDisplay = currentIsOverlayVisible;
      overlayContainer.style.display = shouldDisplay ? 'flex' : 'none';
      if (!shouldDisplay) return;
      
      // Add log just before applying classes, showing the state being used
      console.log(`CONTENT.JS: updateOverlayDOM - Applying state: isVisible=${currentIsOverlayVisible}, mode=${currentOverlayMode}, timeMode=${currentTimeDisplayMode}, titleMode=${currentTitleDisplayMode}, pos=${currentOverlayPositionSide}, theme=${currentOverlayTheme}`);
      
      overlayContainer.classList.remove('normal-mode', 'compact-mode', 'compact-no-time', 'compact-no-title-info', 'position-left', 'position-right', 'normal-no-title-info');
      const themeClasses = ['theme-light', 'theme-dark', 'theme-greenscreen-white-text', 'theme-greenscreen-black-text'];
      themeClasses.forEach(cls => overlayContainer.classList.remove(cls));
      
      if (currentOverlayMode === 'compact') {
        overlayContainer.classList.add('compact-mode');
        overlayContainer.classList.toggle('compact-no-time', currentTimeDisplayMode === 'none');
        overlayContainer.classList.toggle('compact-no-title-info', currentTitleDisplayMode === 'none');
      } else {
        overlayContainer.classList.add('normal-mode');
        overlayContainer.classList.remove('compact-no-time', 'compact-no-title-info');
        overlayContainer.classList.toggle('normal-no-title-info', currentTitleDisplayMode === 'none');
      }
      if (currentOverlayPositionSide === 'left') overlayContainer.classList.add('position-left');
      else overlayContainer.classList.add('position-right');
      
      const expectedCssClass = "theme-" + currentOverlayTheme;
      if (currentOverlayTheme && themeClasses.includes(expectedCssClass)) {
        overlayContainer.classList.add(expectedCssClass);
      } else {
         // Fallback if theme is invalid or null
         console.warn(`CONTENT.JS: updateOverlayDOM - Invalid or null theme ('${currentOverlayTheme}'), falling back to 'theme-light'.`);
         overlayContainer.classList.add('theme-light'); 
      }
      if (overlayContainer) void overlayContainer.offsetWidth; // Force reflow after class changes

      const infoToDisplay = currentVideoInfo;
      // Determine loading state more precisely
      const isLoading = currentIsFetchingActive && (!infoToDisplay || infoToDisplay.episode === undefined);

      const seriesEl = overlayContainer.querySelector('#wp-overlay-series-text');
      const episodeEl = overlayContainer.querySelector('#wp-overlay-episode-text');
      const timeContainerEl = overlayContainer.querySelector('#wp-overlay-time-text-container');
      const actualTimeSpanEl = overlayContainer.querySelector('#wp-overlay-actual-time');
      const hostnameSpanEl = overlayContainer.querySelector('#wp-overlay-hostname-display');
      const compactContainerEl = overlayContainer.querySelector('#wp-overlay-compact-text-container');
      const compactInfoSpanEl = overlayContainer.querySelector('#wp-overlay-compact-info');
      const compactTimeSpanEl = overlayContainer.querySelector('#wp-overlay-compact-time');

      let textForNormalModeTimeSpan = '';
      let textForCompactModeTimeSpan = '';

      let normalModeCurrentPartHasNoHours = false;
      let compactModeHasNoHours = false; // True if compact time is MM:SS

      if (currentTimeDisplayMode !== 'none') {
        if (infoToDisplay && infoToDisplay.currentSeconds !== undefined && infoToDisplay.durationSeconds !== undefined) {
          const currentS = parseFloat(infoToDisplay.currentSeconds);
          const durationS = parseFloat(infoToDisplay.durationSeconds);
          
          const formattedCurrentS = formatTime(currentS);
          const formattedDurationS = formatTime(durationS);

          // Determine if current parts have no hours (i.e., are MM:SS)
          normalModeCurrentPartHasNoHours = formattedCurrentS.split(':').length <= 2;
          compactModeHasNoHours = formattedCurrentS.split(':').length <= 2; // Compact time is always current time

          // Set text for compact mode (always current time)
          textForCompactModeTimeSpan = formattedCurrentS;

          // Set text for normal mode
          if (currentTimeDisplayMode === 'current_duration') {
            textForNormalModeTimeSpan = `${formattedCurrentS} / ${formattedDurationS}`;
          } else if (currentTimeDisplayMode === 'current_only') {
            textForNormalModeTimeSpan = formattedCurrentS;
          }
        } else if (currentIsFetchingActive) {
          // Loading placeholders
          normalModeCurrentPartHasNoHours = true; // "00:00" at start
          compactModeHasNoHours = true;         // "00:00"

          textForCompactModeTimeSpan = '00:00';
          if (currentTimeDisplayMode === 'current_duration') {
            textForNormalModeTimeSpan = '00:00 / 00:00';
          } else if (currentTimeDisplayMode === 'current_only') {
            textForNormalModeTimeSpan = '00:00';
          }
        }
      }
      
      // Apply classes and text to normal mode time display (#wp-overlay-actual-time)
      if (actualTimeSpanEl) {
        actualTimeSpanEl.classList.remove('min-width-shorter-time', 'min-width-longer-time', 'needs-start-padding');
        if (currentTimeDisplayMode !== 'none' && textForNormalModeTimeSpan) {
          if (currentTimeDisplayMode === 'current_duration') {
            actualTimeSpanEl.classList.add('min-width-longer-time');
          } else { // current_only or none (though none won't have text)
            actualTimeSpanEl.classList.add('min-width-shorter-time');
          }
          if (normalModeCurrentPartHasNoHours) {
             actualTimeSpanEl.classList.add('needs-start-padding');
          }
        }
        actualTimeSpanEl.textContent = textForNormalModeTimeSpan;
      }

      if (currentOverlayMode === 'compact') {
        if (seriesEl) seriesEl.style.display = 'none';
        if (episodeEl) episodeEl.style.display = 'none';
        if (timeContainerEl) timeContainerEl.style.display = 'none';
        if (compactContainerEl) compactContainerEl.style.display = 'flex';

        if (compactInfoSpanEl) {
          let compactText = '';
          if (currentTitleDisplayMode !== 'none') {
            const episodeText = infoToDisplay?.episode || infoToDisplay?.title || '정보 없음';
            let compactModeMaxChars = 20; 
            if (currentTimeDisplayMode === 'none') { 
                compactModeMaxChars = 40;
            }
            compactText = isLoading ? 'Loading...' : (episodeText === '정보 없음' ? episodeText : truncateText(episodeText, compactModeMaxChars));
          }
          compactInfoSpanEl.textContent = compactText;
          compactInfoSpanEl.style.display = compactText ? 'inline' : 'none';
          if (currentTimeDisplayMode === 'none') {
            compactInfoSpanEl.style.maxWidth = '100%';
          } else {
            compactInfoSpanEl.style.maxWidth = 'calc(100% - 50px)';
          }
          compactInfoSpanEl.style.overflow = 'hidden';
          compactInfoSpanEl.style.textOverflow = 'ellipsis';
          compactInfoSpanEl.style.whiteSpace = 'nowrap';
          compactInfoSpanEl.style.verticalAlign = 'baseline';
        }
        if (compactTimeSpanEl) {
            compactTimeSpanEl.classList.remove('min-width-shorter-time', 'min-width-longer-time', 'needs-start-padding'); // longer should not be needed here but for safety
            if (currentTimeDisplayMode !== 'none' && textForCompactModeTimeSpan) {
              compactTimeSpanEl.classList.add('min-width-shorter-time'); // Compact always uses shorter width
              if (compactModeHasNoHours) {
                compactTimeSpanEl.classList.add('needs-start-padding');
              }
            }
            compactTimeSpanEl.textContent = textForCompactModeTimeSpan;
            if (currentTitleDisplayMode === 'none' || (compactInfoSpanEl && compactInfoSpanEl.style.display === 'none')) {
                compactTimeSpanEl.style.marginLeft = '0px';
            } else {
                compactTimeSpanEl.style.marginLeft = '8px';
            }
        }
      } else { // Normal Mode
        let displaySeries = false, displayEpisode = false;
        if (currentTitleDisplayMode === 'episode_series') { displaySeries = true; displayEpisode = true; }
        else if (currentTitleDisplayMode === 'episode_only') { displayEpisode = true; }

        if (seriesEl) {
            seriesEl.style.display = displaySeries ? 'block' : 'none';
            if (displaySeries) {
              const seriesText = infoToDisplay?.series || '';
              // Don't truncate empty string or placeholder implicitly if needed
              seriesEl.textContent = isLoading ? 'Loading...' : truncateText(seriesText, 20);
            }
        }
        if (episodeEl) {
            episodeEl.style.display = displayEpisode ? 'block' : 'none';
            if (displayEpisode) {
              const episodeText = infoToDisplay?.episode || infoToDisplay?.title || '정보 없음';
              const normalModeMaxChars = 35; // Increased from 20
              episodeEl.textContent = isLoading ? 'Loading...' : (episodeText === '정보 없음' ? episodeText : truncateText(episodeText, normalModeMaxChars));
            }
        }
        
        if (timeContainerEl) timeContainerEl.style.display = currentTimeDisplayMode === 'none' ? 'none' : 'flex';
        if (actualTimeSpanEl) actualTimeSpanEl.textContent = textForNormalModeTimeSpan;
        if (compactContainerEl) compactContainerEl.style.display = 'none';
        
        if (hostnameSpanEl) {
          if (isLoading || !infoToDisplay) {
            hostnameSpanEl.textContent = '';
            hostnameSpanEl.style.display = 'none';
          } else {
            if (currentTitleDisplayMode === 'none') {
              hostnameSpanEl.textContent = '';
              hostnameSpanEl.style.display = 'none';
            } else {
              const currentHostnameValue = window.location.hostname;
              let displayHostname = '';
              if (currentHostnameValue) {
                  try { displayHostname = currentHostnameValue.toUpperCase().replace('WWW.', '').split('.')[0]; }
                  catch (e) { displayHostname = 'HOST_ERR'; }
              }
              hostnameSpanEl.textContent = displayHostname;
              hostnameSpanEl.style.display = 'inline';
            }
          }
        }
      }
      // Ensure overlay is always visible if toggled on, even if info is missing
      overlayContainer.style.display = shouldDisplay ? 'flex' : 'none';
      if (shouldDisplay && !infoToDisplay && !isLoading) {
        // Show a minimal pill with placeholder (ensure placeholder isn't truncated)
        if (currentOverlayMode === 'compact') {
          if (compactInfoSpanEl) {
            compactInfoSpanEl.textContent = '정보 없음';
            compactInfoSpanEl.style.display = 'inline';
          }
        } else {
          if (seriesEl) seriesEl.textContent = ''; // Keep series empty
          if (episodeEl) episodeEl.textContent = '정보 없음';
        }
      }
    }

    function fetchAndSendVideoInfo() {
      if (checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_PreFetch")) return;
      if (!currentIsFetchingActive || !currentSiteConfig) return;

      const rawVideoInfo = getVideoInfo();
      const newVideoInfoString = JSON.stringify(rawVideoInfo);

      // 정보가 실제로 변경되었거나, 이전 정보가 없을 때만 업데이트 및 전송
      // 단, currentSeconds는 항상 변하므로, 제목과 시리즈, 전체 시간 기준으로 변경 여부 판단
      let essentialInfoChanged = false;
      if (!currentVideoInfo || 
          currentVideoInfo.series !== rawVideoInfo.series || 
          currentVideoInfo.episode !== rawVideoInfo.episode || 
          currentVideoInfo.durationSeconds !== rawVideoInfo.durationSeconds) {
          essentialInfoChanged = true;
      }
      currentVideoInfo = rawVideoInfo; // 현재 정보는 항상 최신으로 업데이트

      if (checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_PreSend")) return;

      if (chrome.runtime?.sendMessage) {
          // 필수 정보가 변경되었거나, 또는 매번 시간 정보를 보내고 싶다면 조건 수정
          // 여기서는 필수 정보 변경 시 또는 lastVideoInfoString과 다를 때 전송 (시간 업데이트 포함)
          if (essentialInfoChanged || lastVideoInfoString !== newVideoInfoString) {
            lastVideoInfoString = newVideoInfoString; // 전송 전에 업데이트
            try {
              chrome.runtime.sendMessage({ type: 'VIDEO_INFO_UPDATE', data: currentVideoInfo }, (response) => {
                  if (chrome.runtime.lastError) {
                      if (!isContextInvalidated) {
                          console.warn(`CONTENT.JS: Error sending VIDEO_INFO_UPDATE: ${chrome.runtime.lastError.message}`);
                          if (chrome.runtime.lastError.message?.includes("Extension context invalidated")) {
                              checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_ResponseError");
                          }
                      }
                  }
              });
            } catch (e) {
               if (!isContextInvalidated) {
                   console.warn("CONTENT.JS: Exception during sendMessage for VIDEO_INFO_UPDATE", e.message);
                   checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_SendException");
               }
            }
          } else {
            // console.log("CONTENT.JS: Video info unchanged, not sending update.");
          }
      } else if (!isContextInvalidated) {
          checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_NoRuntime");
      }
      updateOverlayDOM(); // 정보 가져온 후 항상 DOM 업데이트
    }

    function startFetching() {
      if (checkAndHandleInvalidatedContext("startFetching")) return;
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      currentIsFetchingActive = true;
      fetchIntervalId = setInterval(fetchAndSendVideoInfo, 1000);
      fetchAndSendVideoInfo(); 
      // console.log("CONTENT.JS: Started video info fetching. Interval ID:", fetchIntervalId);
      updateOverlayDOM(); // 시작 시에도 DOM 상태 반영
    }

    function stopFetching() {
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      currentIsFetchingActive = false;
      fetchIntervalId = null;
      // console.log("CONTENT.JS: Stopped video info fetching.");
      updateOverlayDOM(); // 중지 시에도 DOM 상태 반영 (예: 로딩 텍스트 제거)
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (checkAndHandleInvalidatedContext("onMessage_" + message.type)) {
        try { sendResponse({ success: false, error: "Context invalidated", from: "content.js" }); } catch(e) {}
        return true;
      }
      
      let response = { success: true, from: "content.js" };

      switch (message.type) {
        case 'TOGGLE_FETCHING':
          if (message.action === 'start') startFetching(); else stopFetching();
          response.isFetchingActive = currentIsFetchingActive;
          break;
        case 'TOGGLE_VISIBILITY':
          currentIsOverlayVisible = message.action === 'show';
          updateOverlayDOM(); // 직접 DOM 업데이트 호출
          response.isOverlayVisible = currentIsOverlayVisible;
          break;
        case 'TOGGLE_OVERLAY_MODE': 
          currentOverlayMode = message.mode;
          updateOverlayDOM();
          response.overlayMode = currentOverlayMode;
          break;
        case 'GET_CONTENT_STATUS':
          response = { 
            ...response, 
            isFetchingActive: currentIsFetchingActive, isOverlayVisible: currentIsOverlayVisible, 
            overlayMode: currentOverlayMode, timeDisplayMode: currentTimeDisplayMode, 
            titleDisplayMode: currentTitleDisplayMode, overlayPositionSide: currentOverlayPositionSide, 
            overlayTheme: currentOverlayTheme, lastVideoInfo: currentVideoInfo 
          };
          break;
        case 'BACKGROUND_STATE_UPDATE': 
          // Log received data
          console.log(`CONTENT.JS: Received BACKGROUND_STATE_UPDATE. Data:`, JSON.parse(JSON.stringify(message.data))); 
          
          currentIsFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : currentIsFetchingActive;
          currentIsOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : currentIsOverlayVisible;
          currentOverlayMode = message.data.overlayMode || currentOverlayMode;
          currentTimeDisplayMode = message.data.timeDisplayMode || currentTimeDisplayMode;
          currentOverlayPositionSide = message.data.overlayPositionSide || currentOverlayPositionSide; 
          // Add theme update
          currentOverlayTheme = message.data.overlayTheme || currentOverlayTheme;
          currentTitleDisplayMode = message.data.titleDisplayMode || currentTitleDisplayMode; 
          // Don't overwrite currentVideoInfo if it's null coming from background, unless explicitly intended
          // If background forces null (due to navigation), reset but trigger fetch immediately
          if (message.data.lastVideoInfo === null) {
            currentVideoInfo = null; // Reset local info
            // console.log("CONTENT.JS: BG forced null lastVideoInfo. Triggering immediate fetch.");
            fetchAndSendVideoInfo(); // Trigger fetch for new info
          } else if (message.data.lastVideoInfo !== undefined) {
            currentVideoInfo = message.data.lastVideoInfo; // Update with non-null info
          }

          // Log updated internal state
          console.log(`CONTENT.JS: Internal state updated. isFetching=${currentIsFetchingActive}, isVisible=${currentIsOverlayVisible}, mode=${currentOverlayMode}, timeMode=${currentTimeDisplayMode}, pos=${currentOverlayPositionSide}, theme=${currentOverlayTheme}, titleMode=${currentTitleDisplayMode}`);

          // Ensure DOM exists BEFORE updating if overlay should be visible
          if (currentIsOverlayVisible) createOverlayDOMIfNotExists();
          updateOverlayDOM();
          break;
        case 'SYNC_INITIAL_BG_STATE': 
          // Log received data
          console.log(`CONTENT.JS: Received SYNC_INITIAL_BG_STATE. Data:`, JSON.parse(JSON.stringify(message.data)));

          currentIsFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : currentIsFetchingActive;
          currentIsOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : currentIsOverlayVisible;
          currentOverlayMode = message.data.overlayMode || currentOverlayMode;
          currentTimeDisplayMode = message.data.timeDisplayMode || currentTimeDisplayMode;
          currentOverlayPositionSide = message.data.overlayPositionSide || currentOverlayPositionSide;
          currentOverlayTheme = message.data.overlayTheme || currentOverlayTheme;
          currentTitleDisplayMode = message.data.titleDisplayMode || currentTitleDisplayMode;
          if (message.data.lastVideoInfo !== undefined) currentVideoInfo = message.data.lastVideoInfo;
          
          // Log updated internal state after sync
           console.log(`CONTENT.JS: Internal state synced. isFetching=${currentIsFetchingActive}, isVisible=${currentIsOverlayVisible}, mode=${currentOverlayMode}, timeMode=${currentTimeDisplayMode}, pos=${currentOverlayPositionSide}, theme=${currentOverlayTheme}, titleMode=${currentTitleDisplayMode}`);

          // Ensure DOM exists BEFORE updating if overlay should be visible
          if (currentIsOverlayVisible) createOverlayDOMIfNotExists();
          updateOverlayDOM(); 
          response.received_sync = true;
          break;
        default:
          response.success = false; response.error = "Unknown message type";
          break;
      }
      try { sendResponse(response); } catch(e) { console.warn("CONTENT.JS: Error sending response for", message.type, e.message); }
      return true; 
    });

    function mainInitialization() {
      if (checkAndHandleInvalidatedContext("mainInitialization_Start")) return;
      const currentHostname = window.location.hostname.replace(/^www\./, '');
      currentSiteConfig = siteSelectors[currentHostname];

      // Don't immediately return if no site config, try creating overlay anyway
      // if (!currentSiteConfig) return;

      // Attempt to create overlay regardless of site config initially
      // It might attach to body if video/target isn't found immediately
      createOverlayDOMIfNotExists(); 
      if (checkAndHandleInvalidatedContext("mainInitialization_PreReadySend")) return;

      try {
        chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' })
          .catch(error => {
            if (checkAndHandleInvalidatedContext("mainInitialization_ReadyError")) return;
            const errMsg = (error && error.message) ? error.message : "Unknown error sending CONTENT_SCRIPT_READY";
            if (!errMsg.includes("Could not establish connection. Receiving end does not exist.") && 
                !errMsg.includes("A listener indicated an asynchronous response by returning true, but the message channel closed") &&
                !errMsg.includes("Extension context invalidated")) {
              // console.error("CONTENT.JS: Error sending CONTENT_SCRIPT_READY:", errMsg);
            }
          });
      } catch (e) {
        if (!isContextInvalidated) {
            // console.warn("CONTENT.JS: Exception during sendMessage for CONTENT_SCRIPT_READY", e.message);
            checkAndHandleInvalidatedContext("mainInitialization_SendException");
        }
      }
    }
    mainInitialization();
  } else {
    // console.log("CONTENT.JS: Script (wpOverlayTimerHasInitialized) already initialized, skipping full re-initialization.");
  }
} else {
  // console.log("CONTENT.JS: Script (wpOverlayTimerLoaded) already loaded, skipping initialization.");
} 