const siteSelectors = {
  'laftel.net': {
    videoPlayerAreaHint: 'div[class*="player"] video, div[class*="video"] video, #root video',
    infoContainerHint_asSiblingToVideoPlayerAreaParent: [
      'div[class*="sc-ac310b3-0"][class*="iVLgoc"]',
      'div[class*="sc-ac310b3-5"][class*="htdaEN"]',
      'div:has(> a[href^="/item/"]):has(div[class*="sc-ac310b3-7"])',
      'div:has(> a[href^="/item/"]):has(div:has(> div))',
      '#root > div:nth-child(2) > div > div:nth-child(2) > div > div > div:first-child',
      'div[class*="sc-"][class*="htdaEN"], div[class*="sc-"][class*="fALpfe"]',
      'div[class*="sc-ec16796a-2"]',
      'div[class*="sc-822cc31f-2"]',
      'div[class*="sc-ac310b3"]'
    ],
    seriesSubSelector: [
      'a[href^="/item/"]',
      'a[class*="sc-ac310b3-6"]',
      'a[class*="fEcIUw"]',
      '> a[href^="/item/"]',
      'div > a[href^="/item/"]'
    ],
    titleSubSelector: [
      'div[class*="sc-ac310b3-7"][class*="fALpfe"]',
      'div[class*="sc-ac310b3-7"]',
      'div:has-text("화")',
      'div[class*="sc-ac310b3-5"] > div:first-child',
      'div[class*="htdaEN"] > div:first-child',
      'div:contains("화 Lv")',
      'div[class*="sc-"] div[class*="title"]',
      'div[class*="sc-"] h1, div[class*="sc-"] h2, div[class*="sc-"] h3',
      'div[class*="sc-bae7327-0"] div[class*="sc-bae7327-7"]',
      'div[class*="fALpfe"] div:last-child'
    ],
    movieSubSelector: [
      'div[class*="sc-"] a[href^="/item/"]:only-child',
      'div[class*="sc-bae7327-0"] div[class*="haCwMH"] > a[href^="/item/"]'
    ],
    siteName: 'LAFTEL'
  },
  'chzzk.naver.com': {
    playerLayoutId: '#player_layout',
    titleSubSelector: 'div[class^="vod_details"] h2[class^="video_information_title__"]',
    fullscreenTitleSubSelector: 'div[class*="player_header"] p[class^="vod_player_header_title__"]',
    seriesSubSelector: null,
    siteName: 'CHZZK'
  },
  'youtube.com': {
    videoPlayerAreaHint: '#movie_player',
    titleSubSelector: '#title > h1 > yt-formatted-string',
    seriesSubSelector: null,
    siteName: 'YouTube'
  },
  'netflix.com': {
    infoContainerSelector: '.watch-video--bottom-controls-container, .ltr-1bt0omd, .medium.ltr-m1ta4i',
    titleSubSelector: 'h4',
    seriesSubSelector: 'span',
    siteName: 'Netflix'
  },
  // 향후 YouTube, Netflix 등 다른 사이트 설정을 이곳에 추가합니다.
  // 예시:
  // 'youtube.com': {
  //   videoPlayerAreaHint: '#movie_player',
  //   titleSubSelector: '.title .ytd-video-primary-info-renderer',
  //   siteName: 'YouTube'
  // },
  // 'netflix.com': {
  //   videoPlayerAreaHint: '.watch-video',
  //   titleSubSelector: '.video-title > h4',
  //   seriesSubSelector: '.video-title > span', // 예시 선택자입니다.
  //   siteName: 'Netflix'
  // }
};

// --- 중복 실행 방지 ---
if (typeof window.wpOverlayTimerLoaded === 'undefined') {
  window.wpOverlayTimerLoaded = true;
  // console.log("CONTENT.JS: Watch Party Overlay Timer content.js INITIALIZING attempt...");

  if (typeof window.wpOverlayTimerHasInitialized === 'undefined') {
    window.wpOverlayTimerHasInitialized = true;
    // console.log("CONTENT.JS: Initializing for the first time.");

    let fetchIntervalId = null;
    let overlayCheckIntervalId = null; // NEW: 오버레이 존재 체크용 인터벌
    let currentIsFetchingActive = false;
    let currentIsOverlayVisible = false;
    let currentOverlayMode = 'normal';
    let currentOverlayTheme = 'light';
    let currentTimeDisplayMode = 'current_duration';
    let currentTitleDisplayMode = 'episode_series'; // NEW
    let currentOverlayPositionSide = 'right';
    let currentOverlayOffsetX = 8; // NEW: 가로 여백
    let currentOverlayOffsetY = 8; // NEW: 세로 여백
    let currentSeriesFontSize = 10; // NEW: 시리즈 폰트 크기
    let currentEpisodeFontSize = 14; // NEW: 에피소드 폰트 크기
    let currentTimeFontSize = 14; // NEW: 시간 폰트 크기
    let currentCurrentTimeFontSize = 14; // NEW: 현재시간 폰트 크기
    let currentDurationFontSize = 14; // NEW: 전체시간 폰트 크기
    let currentFontScale = 1.0; // NEW: 전체 폰트 배율 (0.5~2.0)
    let currentOverlayMinWidth = 150; // NEW: 오버레이 최소 너비
    let currentOverlayLineSpacing = 2; // NEW: 오버레이 줄간격
    let currentOverlayPadding = 8; // NEW: 오버레이 내부 여백
    let currentShowHostname = true; // NEW: 사이트 이름 표시 여부
    let currentVideoInfo = null;
    let isContextInvalidated = false;
    let lastVideoInfoString = ''; // Fixed: 변수 선언 복원

    let currentSiteConfig = null;

    function checkAndHandleInvalidatedContext(operationName = "Operation") {
      if (isContextInvalidated) return true;
      try {
        if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.id === "undefined") {
          console.warn(`CONTENT.JS: Context invalidated (${operationName}). Halting.`);
          isContextInvalidated = true;
          if (fetchIntervalId) clearInterval(fetchIntervalId);
          fetchIntervalId = null;
          if (overlayCheckIntervalId) clearInterval(overlayCheckIntervalId);
          overlayCheckIntervalId = null;
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
         if (overlayCheckIntervalId) clearInterval(overlayCheckIntervalId);
         overlayCheckIntervalId = null;
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

    // Helper function to query with multiple selectors
    function queryWithSelectors(container, selectors) {
      if (!container || !selectors) return null;
      
      // If selectors is a string, use it directly
      if (typeof selectors === 'string') {
        return container.querySelector(selectors);
      }
      
      // If selectors is an array, try each one until we find a match
      if (Array.isArray(selectors)) {
        for (const selector of selectors) {
          const element = container.querySelector(selector);
          if (element) return element;
        }
      }
      
      return null;
    }

    function getVideoInfo() {
      if (checkAndHandleInvalidatedContext("getVideoInfo")) return null;
      if (!currentSiteConfig) {
        console.warn("CONTENT.JS: getVideoInfo - currentSiteConfig is null or undefined.");
        return null;
      }
      console.debug("CONTENT.JS: getVideoInfo - currentSiteConfig:", currentSiteConfig ? JSON.parse(JSON.stringify(currentSiteConfig)) : "undefined", "Hostname:", window.location.hostname);

      let episode = "N/A";
      let series = "N/A";
      let currentSeconds = 0;
      let durationSeconds = 0;
      const siteName = currentSiteConfig.siteName || window.location.hostname;
      const videoEl = document.querySelector('video');
      console.debug("CONTENT.JS: getVideoInfo - videoEl:", videoEl);

      if (videoEl) {
        currentSeconds = videoEl.currentTime;
        durationSeconds = videoEl.duration;
        if (isNaN(durationSeconds) || !isFinite(durationSeconds)) durationSeconds = 0;
        console.debug("CONTENT.JS: getVideoInfo - Time: Current=", currentSeconds, "Duration=", durationSeconds);
      } else {
        console.warn("CONTENT.JS: getVideoInfo - videoEl not found.");
      }

      if (siteName === 'LAFTEL') {
        const previousEpisode = currentVideoInfo?.episode;
        const previousSeries = currentVideoInfo?.series;
        if (!videoEl) {
            episode = previousEpisode || "N/A";
            series = previousSeries || "";
            return { series, episode, currentSeconds, durationSeconds, siteName };
        }
        
        // Find info container using multiple selectors
        let infoContainer = null;
        
        // First try to find info container using array of selectors
        if (Array.isArray(currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent)) {
          for (const selector of currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent) {
            infoContainer = document.querySelector(selector);
            if (infoContainer) {
              console.debug("CONTENT.JS: Found infoContainer with selector:", selector);
              break;
            }
          }
        } else {
          // Fallback to old logic if not array
          const videoPlayerArea = videoEl.closest(currentSiteConfig.videoPlayerAreaHint);
          if (videoPlayerArea?.parentElement) {
              infoContainer = videoPlayerArea.parentElement.querySelector(currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent);
          }
          if (!infoContainer) infoContainer = document.querySelector(currentSiteConfig.infoContainerHint_asSiblingToVideoPlayerAreaParent);
        }
        
        // Special logic for Laftel: If no info container found, try to find by pattern
        if (!infoContainer) {
          // Try to find any element that contains a link to /item/ (series) and a div with "화" (episode)
          const allContainers = document.querySelectorAll('div');
          for (const container of allContainers) {
            const hasSeriesLink = container.querySelector('a[href^="/item/"]');
            const hasEpisodeDiv = Array.from(container.querySelectorAll('div')).some(div => /^\d+화/.test(div.innerText?.trim() || ''));
            if (hasSeriesLink && hasEpisodeDiv) {
              infoContainer = container;
              console.debug("CONTENT.JS: Found infoContainer by pattern matching");
              break;
            }
          }
        }

        if (infoContainer) {
          let tempEpisode = null, tempSeries = null;
          
          // Try movie selector first
          let movieTitleElement = queryWithSelectors(infoContainer, currentSiteConfig.movieSubSelector);
          if (movieTitleElement?.innerText?.trim()) {
            tempEpisode = movieTitleElement.innerText.trim();
            tempSeries = "";
          } else {
            // Try series and title selectors
            const seriesElement = queryWithSelectors(infoContainer, currentSiteConfig.seriesSubSelector);
            const titleElement = queryWithSelectors(infoContainer, currentSiteConfig.titleSubSelector);
            
            // If title element not found by selector, try to find by pattern
            if (!titleElement && infoContainer) {
              const allDivs = infoContainer.querySelectorAll('div');
              for (const div of allDivs) {
                const text = div.innerText?.trim() || '';
                // Check if text matches episode pattern (starts with number followed by "화")
                if (/^\d+화/.test(text)) {
                  tempEpisode = text;
                  console.debug("CONTENT.JS: Found episode by pattern:", text);
                  break;
                }
              }
            } else {
              tempEpisode = titleElement?.innerText?.trim() || null;
            }
            
            tempSeries = seriesElement?.innerText?.trim() || null;
            if (tempSeries && !tempEpisode) tempEpisode = "에피소드 정보 없음";
          }
          episode = (tempEpisode && tempEpisode !== "N/A" && tempEpisode !== "제목 정보 없음" && tempEpisode !== "에피소드 정보 없음") ? tempEpisode : (previousEpisode || "N/A");
          series = (tempEpisode && tempSeries === "") ? "" : (tempSeries || previousSeries || "");
        } else {
          console.warn("CONTENT.JS: getVideoInfo - LAFTEL - infoContainer not found, using previous info");
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
      } else if (siteName === 'Netflix') {
        console.debug("CONTENT.JS: getVideoInfo - Netflix block entered.");
        const previousEpisode = currentVideoInfo?.episode;
        const previousSeries = currentVideoInfo?.series;

        if (!videoEl) { // 비디오 요소가 없으면 이전 정보 사용
            console.warn("CONTENT.JS: getVideoInfo - Netflix - videoEl not found, using previous info.");
            episode = previousEpisode || "N/A";
            series = previousSeries || "";
            return { series, episode, currentSeconds, durationSeconds, siteName };
        }

        let identifiedSeries = null;
        let identifiedEpisode = null;

        // 직접 video-title 요소를 찾기
        const titleElement = document.querySelector('[data-uia="video-title"]');
        console.debug("CONTENT.JS: getVideoInfo - Netflix - titleElement:", titleElement);
        
        if (titleElement) {
          const seriesH4 = titleElement.querySelector('h4'); 
          console.debug("CONTENT.JS: getVideoInfo - Netflix - seriesH4:", seriesH4);

          if (seriesH4) { // 시리즈물로 판단
            console.debug("CONTENT.JS: getVideoInfo - Netflix - Detected SERIES (h4 found).");
            identifiedSeries = seriesH4.innerText?.trim() || null;
            
            const episodeSpans = titleElement.querySelectorAll('span');
            if (episodeSpans && episodeSpans.length > 0) {
              const episodeParts = [];
              episodeSpans.forEach(span => {
                const text = span?.innerText?.trim();
                if (text) episodeParts.push(text);
              });
              identifiedEpisode = episodeParts.length > 0 ? episodeParts.join(' - ') : "N/A";
            } else {
              identifiedEpisode = "N/A";
            }
          } else { // 단일 영화로 판단
            console.debug("CONTENT.JS: getVideoInfo - Netflix - Detected MOVIE (no h4 found).");
            const clonedTitleElement = titleElement.cloneNode(true);
            clonedTitleElement.querySelectorAll('h4, span').forEach(el => el.remove());
            const movieTitleText = clonedTitleElement.innerText?.trim();

            if (movieTitleText) {
              identifiedEpisode = movieTitleText;
              identifiedSeries = "";
            } else {
               identifiedEpisode = "N/A";
               identifiedSeries = ""; 
            }
          }
        } else {
          console.warn("CONTENT.JS: getVideoInfo - Netflix - video-title element not found.");
        }
        
        console.debug("CONTENT.JS: getVideoInfo - Netflix - Identified Series:", identifiedSeries, "Identified Episode:", identifiedEpisode);

        // 최종적으로 series와 episode 변수 업데이트
        if (identifiedSeries !== null) {
          series = identifiedSeries;
          episode = (identifiedEpisode !== null) ? identifiedEpisode : "N/A";
        } else {
          series = previousSeries || "";
          episode = previousEpisode || "N/A";
        }
      } else if (siteName === 'YouTube') {
        // YouTube는 대부분 단일 비디오이므로 시리즈 없이 제목만 표시
        const titleElement = currentSiteConfig.titleSubSelector ? document.querySelector(currentSiteConfig.titleSubSelector) : null;
        episode = titleElement?.innerText?.trim() || "N/A";
        series = ""; // YouTube는 시리즈 없음
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
      console.log("CONTENT.JS: createOverlayDOMIfNotExists called. Retry count:", retryCount);
      // Check if overlay already exists
      if (document.getElementById('wp-overlay-timer')) {
        overlayContainer = document.getElementById('wp-overlay-timer');
        console.log("CONTENT.JS: createOverlayDOMIfNotExists - Overlay already exists.", overlayContainer.isConnected ? "And is connected." : "BUT NOT CONNECTED.");
        // Ensure it's in the DOM (might have been removed by site script)
        if (!overlayContainer.isConnected) {
          console.warn("CONTENT.JS: Overlay exists but not connected. Re-appending.");
          // Try re-appending, might need a target parent again?
          // Simplest is often just appending to body if disconnected.
          document.body.appendChild(overlayContainer);
        }
        // 기존 오버레이에 호버 이벤트 리스너 추가
        addHoverEventListeners();
        // updateOverlayDOM(); // Don't call update here, let the caller handle it.
        return; // Already exists or re-connected
      }
      
      // If it doesn't exist, create it
      // console.log("CONTENT.JS: Creating overlay DOM element.");
      overlayContainer = document.createElement('div');
      console.log("CONTENT.JS: createOverlayDOMIfNotExists - Created new overlayContainer element.");
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
      
      // 호버 이벤트 리스너 추가
      addHoverEventListeners();
      
      const videoElement = document.querySelector('video');
      if (!videoElement) {
        if (retryCount < 5) {
          console.log("CONTENT.JS: createOverlayDOMIfNotExists - videoElement not found, will retry (", retryCount + 1, ").");
          setTimeout(() => createOverlayDOMIfNotExists(retryCount + 1), 100);
        }
        return;
      }
      console.log("CONTENT.JS: createOverlayDOMIfNotExists - videoElement found:", videoElement);

      const targetParent = findTargetParent(videoElement);
      console.log("CONTENT.JS: createOverlayDOMIfNotExists - targetParent for overlay:", targetParent);
      if (targetParent) {
        const computedStyle = window.getComputedStyle(targetParent);
        if (computedStyle.position === 'static') {
          console.log("CONTENT.JS: createOverlayDOMIfNotExists - targetParent position is static, changing to relative.");
          targetParent.style.position = 'relative';
        }
        targetParent.appendChild(overlayContainer);
        console.log("CONTENT.JS: Overlay appended to target parent:", targetParent);
        updateOverlayDOM();
      } else {
        // Fallback: Append to body if no suitable parent found
        console.warn("CONTENT.JS: Suitable target parent not found. Appending overlay to document.body as fallback.");
        document.body.appendChild(overlayContainer);
        console.log("CONTENT.JS: Overlay appended to document.body as fallback.");
        updateOverlayDOM();
      }
    }

    function addHoverEventListeners() {
      if (!overlayContainer) return;
      
      let hoverTimeout = null;
      let lastHoverTime = 0;
      const HOVER_THROTTLE_MS = 2000; // 2초마다 한 번만 실행
      
      // 마우스 호버 시 정보 갱신 (throttled)
      overlayContainer.addEventListener('mouseenter', () => {
        const now = Date.now();
        if (now - lastHoverTime < HOVER_THROTTLE_MS) return; // throttling
        
        if (currentIsOverlayVisible && currentSiteConfig) {
          console.log("CONTENT.JS: Overlay hovered, refreshing video info.");
          lastHoverTime = now;
          // 정보가 없거나 오래된 경우 즉시 갱신
          if (!currentVideoInfo || currentVideoInfo.episode === "N/A" || currentVideoInfo.episode === undefined) {
            fetchAndSendVideoInfo();
          }
        }
      });
      
      // 더블클릭 시 강제 갱신
      overlayContainer.addEventListener('dblclick', () => {
        if (currentIsOverlayVisible && currentSiteConfig) {
          console.log("CONTENT.JS: Overlay double-clicked, forcing video info refresh.");
          currentVideoInfo = null; // 강제로 정보 초기화
          fetchAndSendVideoInfo();
        }
      });
    }

    function updateOverlayDOM() {
      if (checkAndHandleInvalidatedContext("updateOverlayDOM")) return;
      if (!overlayContainer) { // overlayContainer가 없으면 생성 시도
        createOverlayDOMIfNotExists();
        if (!overlayContainer) { // 그래도 없으면 반환
            return;
        }
      }

      const shouldDisplay = currentIsOverlayVisible;
      overlayContainer.style.display = shouldDisplay ? 'flex' : 'none';
      if (!shouldDisplay) return;
      
      overlayContainer.classList.remove('normal-mode', 'compact-mode', 'compact-no-time', 'compact-no-title-info', 'position-left', 'position-right', 'normal-no-title-info');
      overlayContainer.classList.remove('theme-light', 'theme-dark', 'theme-greenscreen-white-text', 'theme-greenscreen-black-text');
      
      overlayContainer.classList.toggle('theme-light', currentOverlayTheme === 'light');
      overlayContainer.classList.toggle('theme-dark', currentOverlayTheme === 'dark');
      overlayContainer.classList.toggle('theme-greenscreen-white-text', currentOverlayTheme === 'greenscreen-white-text');
      overlayContainer.classList.toggle('theme-greenscreen-black-text', currentOverlayTheme === 'greenscreen-black-text');
      
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
      
      // NEW: CSS 변수를 통해 가로/세로 여백 적용
      overlayContainer.style.setProperty('--wp-overlay-offset-x', `${currentOverlayOffsetX}px`);
      overlayContainer.style.setProperty('--wp-overlay-offset-y', `${currentOverlayOffsetY}px`);
      
      // NEW: CSS 변수를 통해 폰트 크기 적용 (배율 포함)
      overlayContainer.style.setProperty('--wp-series-font-size', `${currentSeriesFontSize * currentFontScale}px`);
      overlayContainer.style.setProperty('--wp-episode-font-size', `${currentEpisodeFontSize * currentFontScale}px`);
      overlayContainer.style.setProperty('--wp-time-font-size', `${currentTimeFontSize * currentFontScale}px`);
      overlayContainer.style.setProperty('--wp-current-time-font-size', `${currentCurrentTimeFontSize * currentFontScale}px`);
      overlayContainer.style.setProperty('--wp-duration-font-size', `${currentDurationFontSize * currentFontScale}px`);
      overlayContainer.style.setProperty('--wp-font-scale', currentFontScale);
      
      // NEW: CSS 변수를 통해 오버레이 크기 적용
      overlayContainer.style.setProperty('--wp-overlay-min-width', `${currentOverlayMinWidth}px`);
      overlayContainer.style.setProperty('--wp-overlay-line-spacing', `${currentOverlayLineSpacing}px`);
      overlayContainer.style.setProperty('--wp-overlay-padding', `${currentOverlayPadding}px`);
      
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
            textForNormalModeTimeSpan = `<span class="current-time">${formattedCurrentS}</span><span class="duration-separator"> / </span><span class="duration-time">${formattedDurationS}</span>`;
          } else if (currentTimeDisplayMode === 'current_only') {
            textForNormalModeTimeSpan = formattedCurrentS;
          }
        } else if (currentIsFetchingActive) {
          // Loading placeholders
          normalModeCurrentPartHasNoHours = true; // "00:00" at start
          compactModeHasNoHours = true;         // "00:00"

          textForCompactModeTimeSpan = '00:00';
          if (currentTimeDisplayMode === 'current_duration') {
            textForNormalModeTimeSpan = '<span class="current-time">00:00</span><span class="duration-separator"> / </span><span class="duration-time">00:00</span>';
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
        actualTimeSpanEl.innerHTML = textForNormalModeTimeSpan;
      }

      if (currentOverlayMode === 'compact') {
        if (seriesEl) seriesEl.style.display = 'none';
        if (episodeEl) episodeEl.style.display = 'none';
        if (timeContainerEl) timeContainerEl.style.display = 'none';
        if (compactContainerEl) compactContainerEl.style.display = 'flex';

        if (compactInfoSpanEl) {
          let textForCompactModeInfoSpan = '';
          if (currentTitleDisplayMode !== 'none') {
            const episodeText = infoToDisplay?.episode || infoToDisplay?.title || '정보 없음';
            let compactModeMaxChars = 20; 
            if (currentTimeDisplayMode === 'none') { 
                compactModeMaxChars = 40;
            }
            textForCompactModeInfoSpan = isLoading ? 'Loading...' : (episodeText === '정보 없음' ? episodeText : truncateText(episodeText, compactModeMaxChars));
          }
          compactInfoSpanEl.classList.remove('min-width-shorter-time', 'min-width-longer-time', 'needs-start-padding'); // longer should not be needed here but for safety
          if (currentTitleDisplayMode !== 'none' && textForCompactModeInfoSpan) {
            compactInfoSpanEl.style.display = 'inline';
            compactInfoSpanEl.textContent = textForCompactModeInfoSpan;
            compactInfoSpanEl.style.fontSize = `${currentEpisodeFontSize * currentFontScale}px`; // 에피소드 폰트 크기 적용
            
            // 스타일 속성 복원
            if (currentTimeDisplayMode === 'none') {
              compactInfoSpanEl.style.maxWidth = '100%';
            } else {
              compactInfoSpanEl.style.maxWidth = 'calc(100% - 50px)';
            }
            compactInfoSpanEl.style.overflow = 'hidden';
            compactInfoSpanEl.style.textOverflow = 'ellipsis';
            compactInfoSpanEl.style.whiteSpace = 'nowrap';
            compactInfoSpanEl.style.verticalAlign = 'baseline';
          } else {
            compactInfoSpanEl.style.display = 'none';
            compactInfoSpanEl.textContent = '';
          }
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
            compactTimeSpanEl.style.fontSize = `${currentCurrentTimeFontSize * currentFontScale}px`; // 현재시간 폰트 크기 적용
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
        if (actualTimeSpanEl) {
          if (currentTimeDisplayMode === 'current_duration') {
            actualTimeSpanEl.innerHTML = textForNormalModeTimeSpan;
          } else {
            actualTimeSpanEl.textContent = textForNormalModeTimeSpan;
          }
        }
        if (compactContainerEl) compactContainerEl.style.display = 'none';
        
        if (hostnameSpanEl) {
          if (isLoading || !infoToDisplay) {
            hostnameSpanEl.textContent = '';
            hostnameSpanEl.style.display = 'none';
          } else {
            if (currentTitleDisplayMode === 'none' || !currentShowHostname) {
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
      console.debug("CONTENT.JS: fetchAndSendVideoInfo called. isFetchingActive:", currentIsFetchingActive, "currentSiteConfig:", currentSiteConfig ? JSON.parse(JSON.stringify(currentSiteConfig)) : "undefined");
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
            console.log("CONTENT.JS: Sending VIDEO_INFO_UPDATE to background:", JSON.stringify(currentVideoInfo));
            try {
              chrome.runtime.sendMessage({ type: 'VIDEO_INFO_UPDATE', data: currentVideoInfo }, (response) => {
                  if (chrome.runtime.lastError) {
                      if (!isContextInvalidated) {
                          console.warn(`CONTENT.JS: Error sending VIDEO_INFO_UPDATE: ${chrome.runtime.lastError.message}`);
                          if (chrome.runtime.lastError.message?.includes("Extension context invalidated")) {
                              checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_ResponseError");
                          }
                      }
                  } else {
                      console.log("CONTENT.JS: VIDEO_INFO_UPDATE sent successfully, response:", response);
                  }
              });
            } catch (e) {
               if (!isContextInvalidated) {
                   console.warn("CONTENT.JS: Exception during sendMessage for VIDEO_INFO_UPDATE", e.message);
                   checkAndHandleInvalidatedContext("fetchAndSendVideoInfo_SendException");
               }
            }
          } else {
            console.log("CONTENT.JS: Video info unchanged, not sending update.");
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
          // 오버레이를 켤 때 정보가 있으면 즉시 표시하고, 없으면 강제로 가져오기
          if (currentIsOverlayVisible) {
            createOverlayDOMIfNotExists();
            startOverlayCheck(); // NEW: 오버레이 체크 시작
            // 정보가 없거나 오래된 경우 즉시 갱신
            if (!currentVideoInfo || currentVideoInfo.episode === "N/A" || currentVideoInfo.episode === undefined) {
              console.log("CONTENT.JS: Overlay turned ON but no valid info. Forcing immediate fetch.");
              fetchAndSendVideoInfo();
            }
          } else {
            stopOverlayCheck(); // NEW: 오버레이 체크 중지
          }
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
          
          const wasOverlayVisible = currentIsOverlayVisible;
          
          currentIsFetchingActive = message.data.isFetchingActive !== undefined ? message.data.isFetchingActive : currentIsFetchingActive;
          currentIsOverlayVisible = message.data.isOverlayVisible !== undefined ? message.data.isOverlayVisible : currentIsOverlayVisible;
          currentOverlayMode = message.data.overlayMode || currentOverlayMode;
          currentTimeDisplayMode = message.data.timeDisplayMode || currentTimeDisplayMode;
          currentOverlayPositionSide = message.data.overlayPositionSide || currentOverlayPositionSide; 
          // Add theme update
          currentOverlayTheme = message.data.overlayTheme || currentOverlayTheme;
          currentTitleDisplayMode = message.data.titleDisplayMode || currentTitleDisplayMode; 
          // NEW: 가로/세로 여백 업데이트
          currentOverlayOffsetX = message.data.overlayOffsetX !== undefined ? message.data.overlayOffsetX : currentOverlayOffsetX;
          currentOverlayOffsetY = message.data.overlayOffsetY !== undefined ? message.data.overlayOffsetY : currentOverlayOffsetY;
          // NEW: 폰트 크기 업데이트
          currentSeriesFontSize = message.data.seriesFontSize !== undefined ? message.data.seriesFontSize : currentSeriesFontSize;
          currentEpisodeFontSize = message.data.episodeFontSize !== undefined ? message.data.episodeFontSize : currentEpisodeFontSize;
          currentTimeFontSize = message.data.timeFontSize !== undefined ? message.data.timeFontSize : currentTimeFontSize;
          currentCurrentTimeFontSize = message.data.currentTimeFontSize !== undefined ? message.data.currentTimeFontSize : currentCurrentTimeFontSize;
          currentDurationFontSize = message.data.durationFontSize !== undefined ? message.data.durationFontSize : currentDurationFontSize;
          currentFontScale = message.data.fontScale !== undefined ? message.data.fontScale : currentFontScale;
          // NEW: 오버레이 크기 업데이트
          currentOverlayMinWidth = message.data.overlayMinWidth !== undefined ? message.data.overlayMinWidth : currentOverlayMinWidth;
          currentOverlayLineSpacing = message.data.overlayLineSpacing !== undefined ? message.data.overlayLineSpacing : currentOverlayLineSpacing;
          currentOverlayPadding = message.data.overlayPadding !== undefined ? message.data.overlayPadding : currentOverlayPadding;
          // NEW: 사이트 표시 상태 업데이트
          currentShowHostname = message.data.showHostname !== undefined ? message.data.showHostname : currentShowHostname;
          // Don't overwrite currentVideoInfo if it's null coming from background, unless explicitly intended
          // If background forces null (due to navigation), reset but trigger fetch immediately
          if (message.data.lastVideoInfo === null) {
            currentVideoInfo = null; // Reset local info
            // console.log("CONTENT.JS: BG forced null lastVideoInfo. Triggering immediate fetch.");
            fetchAndSendVideoInfo(); // Trigger fetch for new info
          } else if (message.data.lastVideoInfo !== undefined) {
            currentVideoInfo = message.data.lastVideoInfo; // Update with non-null info
          }
          
          // 오버레이가 새로 켜진 경우 정보 갱신
          if (currentIsOverlayVisible && !wasOverlayVisible) {
            console.log("CONTENT.JS: Overlay turned ON via BACKGROUND_STATE_UPDATE. Checking info validity.");
            startOverlayCheck(); // NEW: 오버레이 체크 시작
            if (!currentVideoInfo || currentVideoInfo.episode === "N/A" || currentVideoInfo.episode === undefined) {
              console.log("CONTENT.JS: No valid info available. Forcing immediate fetch.");
              fetchAndSendVideoInfo();
            }
          } else if (!currentIsOverlayVisible && wasOverlayVisible) {
            // 오버레이가 꺼진 경우
            stopOverlayCheck(); // NEW: 오버레이 체크 중지
          }

          // Log updated internal state
          console.log(`CONTENT.JS: Internal state updated. isFetching=${currentIsFetchingActive}, isVisible=${currentIsOverlayVisible}, mode=${currentOverlayMode}, timeMode=${currentTimeDisplayMode}, pos=${currentOverlayPositionSide}, theme=${currentOverlayTheme}, titleMode=${currentTitleDisplayMode}, offsetX=${currentOverlayOffsetX}, offsetY=${currentOverlayOffsetY}`);

          // Ensure DOM exists BEFORE updating if overlay should be visible
          if (currentIsOverlayVisible) createOverlayDOMIfNotExists();
          updateOverlayDOM();
          
          // NEW: 초기 상태에서 오버레이가 켜져있으면 체크 시작
          if (currentIsOverlayVisible) {
            startOverlayCheck();
          }
          
          response.received_sync = true;
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
          // NEW: 가로/세로 여백 업데이트
          currentOverlayOffsetX = message.data.overlayOffsetX !== undefined ? message.data.overlayOffsetX : currentOverlayOffsetX;
          currentOverlayOffsetY = message.data.overlayOffsetY !== undefined ? message.data.overlayOffsetY : currentOverlayOffsetY;
          // NEW: 폰트 크기 업데이트
          currentSeriesFontSize = message.data.seriesFontSize !== undefined ? message.data.seriesFontSize : currentSeriesFontSize;
          currentEpisodeFontSize = message.data.episodeFontSize !== undefined ? message.data.episodeFontSize : currentEpisodeFontSize;
          currentTimeFontSize = message.data.timeFontSize !== undefined ? message.data.timeFontSize : currentTimeFontSize;
          currentCurrentTimeFontSize = message.data.currentTimeFontSize !== undefined ? message.data.currentTimeFontSize : currentCurrentTimeFontSize;
          currentDurationFontSize = message.data.durationFontSize !== undefined ? message.data.durationFontSize : currentDurationFontSize;
          currentFontScale = message.data.fontScale !== undefined ? message.data.fontScale : currentFontScale;
          // NEW: 오버레이 크기 업데이트
          currentOverlayMinWidth = message.data.overlayMinWidth !== undefined ? message.data.overlayMinWidth : currentOverlayMinWidth;
          currentOverlayLineSpacing = message.data.overlayLineSpacing !== undefined ? message.data.overlayLineSpacing : currentOverlayLineSpacing;
          currentOverlayPadding = message.data.overlayPadding !== undefined ? message.data.overlayPadding : currentOverlayPadding;
          if (message.data.lastVideoInfo !== undefined) currentVideoInfo = message.data.lastVideoInfo;
          
          // Log updated internal state after sync
           console.log(`CONTENT.JS: Internal state synced. isFetching=${currentIsFetchingActive}, isVisible=${currentIsOverlayVisible}, mode=${currentOverlayMode}, timeMode=${currentTimeDisplayMode}, pos=${currentOverlayPositionSide}, theme=${currentOverlayTheme}, titleMode=${currentTitleDisplayMode}, offsetX=${currentOverlayOffsetX}, offsetY=${currentOverlayOffsetY}`);

          // Ensure DOM exists BEFORE updating if overlay should be visible
          if (currentIsOverlayVisible) createOverlayDOMIfNotExists();
          updateOverlayDOM(); 
          
          // NEW: 초기 상태에서 오버레이가 켜져있으면 체크 시작
          if (currentIsOverlayVisible) {
            startOverlayCheck();
          }
          
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
      console.log("CONTENT.JS: mainInitialization - currentSiteConfig:", currentSiteConfig ? JSON.parse(JSON.stringify(currentSiteConfig)) : "undefined");

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

    // NEW: 오버레이 존재 체크 및 복구 함수
    function checkOverlayExistence() {
      if (checkAndHandleInvalidatedContext("checkOverlayExistence")) return;
      
      // 오버레이가 켜져있는 상태에서만 체크
      if (!currentIsOverlayVisible) return;
      
      const existingOverlay = document.getElementById('wp-overlay-timer');
      
      // DOM에 연결되어 있지 않거나 아예 없는 경우
      if (!existingOverlay || !existingOverlay.isConnected) {
        console.log("CONTENT.JS: Overlay should be visible but wp-container is missing. Recreating...");
        
        // 기존 오버레이가 있지만 연결되지 않은 경우 제거
        if (existingOverlay && !existingOverlay.isConnected) {
          try {
            existingOverlay.remove();
          } catch (e) {
            console.warn("CONTENT.JS: Error removing disconnected overlay:", e.message);
          }
        }
        
        // overlayContainer 참조 초기화
        overlayContainer = null;
        
        // 오버레이 다시 생성
        createOverlayDOMIfNotExists();
        
        // 정보가 있으면 즉시 업데이트
        if (currentVideoInfo) {
          updateOverlayDOM();
        }
        
        console.log("CONTENT.JS: Overlay recreated successfully.");
      }
    }

    // NEW: 오버레이 체크 인터벌 시작
    function startOverlayCheck() {
      if (overlayCheckIntervalId) clearInterval(overlayCheckIntervalId);
      overlayCheckIntervalId = setInterval(checkOverlayExistence, 2000); // 2초마다 체크
      console.log("CONTENT.JS: Started overlay existence check. Interval ID:", overlayCheckIntervalId);
    }

    // NEW: 오버레이 체크 인터벌 중지
    function stopOverlayCheck() {
      if (overlayCheckIntervalId) clearInterval(overlayCheckIntervalId);
      overlayCheckIntervalId = null;
      console.log("CONTENT.JS: Stopped overlay existence check.");
    }

    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      if (overlayCheckIntervalId) clearInterval(overlayCheckIntervalId); // NEW: 오버레이 체크 인터벌 정리
    });
  } else {
    // console.log("CONTENT.JS: Script (wpOverlayTimerHasInitialized) already initialized, skipping full re-initialization.");
  }
} else {
  // console.log("CONTENT.JS: Script (wpOverlayTimerLoaded) already loaded, skipping initialization.");
} 