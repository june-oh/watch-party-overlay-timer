document.addEventListener('DOMContentLoaded', () => {
  console.log("POPUP.JS: DOMContentLoaded, script running.");

  // --- DOM Element References ---
  // Status and Site Info
  const statusTextEl = document.getElementById('statusText');
  const currentSiteHostEl = document.getElementById('currentSiteHost');

  // Main Toggles
  const toggleFetchingBtn = document.getElementById('toggleFetchingBtn');
  const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');

  // Mode Controls
  const setNormalModeBtn = document.getElementById('setNormalModeBtn');
  const setCompactModeBtn = document.getElementById('setCompactModeBtn');
  const currentOverlayModeLabel = document.getElementById('currentOverlayModeLabel');

  // Position Controls
  const setPositionLeftBtn = document.getElementById('setPositionLeftBtn');
  const setPositionRightBtn = document.getElementById('setPositionRightBtn');
  const currentOverlayPositionLabel = document.getElementById('currentOverlayPositionLabel');

  // Time Display Controls
  const selectTimeDisplay = document.getElementById('selectTimeDisplay');
  const currentTimeDisplayModeLabel = document.getElementById('currentTimeDisplayModeLabel');

  // Theme Controls
  const selectTheme = document.getElementById('selectTheme');
  const currentOverlayThemeLabel = document.getElementById('currentOverlayThemeLabel');

  // Video Info Display
  const videoTitleEl = document.getElementById('videoTitle');
  const videoSeriesEl = document.getElementById('videoSeries');
  const videoTimeEl = document.getElementById('videoTime');
  
  // Preview Elements (Optional - can be removed if preview is fully deprecated)
  // const previewContainerEl = document.getElementById('previewContainer');
  // const previewTitleEl = document.getElementById('previewTitle');
  // const previewSeriesEl = document.getElementById('previewSeries');
  // const previewTimeEl = document.getElementById('previewTime');

  // NEW: Title Display Controls
  const selectTitleDisplay = document.getElementById('selectTitleDisplay');
  const currentTitleDisplayModeLabel = document.getElementById('currentTitleDisplayModeLabel');

  // --- Helper Functions ---
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

  // --- UI Update Function ---
  function updatePopupUI(data) {
    console.log("POPUP.JS: updatePopupUI called with data:", JSON.parse(JSON.stringify(data)));
    // Log the specific troublesome state value
    console.log(`POPUP.JS: updatePopupUI - Received overlayPositionSide: ${data.overlayPositionSide}, overlayTheme: ${data.overlayTheme}, timeDisplayMode: ${data.timeDisplayMode}`);

    const {
      isFetchingActive,
      isOverlayVisible,
      overlayMode,
      timeDisplayMode,
      overlayPositionSide,
      overlayTheme,
      lastVideoInfo,
      isError,
      errorMessage,
      activeTabHostname
    } = data;

    // 1. Update Status Text (General Status)
    if (statusTextEl) {
      if (isError) {
        statusTextEl.textContent = `오류: ${errorMessage || '알 수 없는 오류'}`;
        statusTextEl.style.color = 'red';
      } else if (isFetchingActive) {
        statusTextEl.textContent = lastVideoInfo ? '정보 업데이트 중...' : '정보 수집 대기 중...';
        statusTextEl.style.color = 'green';
      } else {
        statusTextEl.textContent = '정보 수집 중지됨.';
        statusTextEl.style.color = 'grey';
      }
    }

    // 2. Update Current Site Host
    if (currentSiteHostEl) {
      currentSiteHostEl.textContent = activeTabHostname || 'N/A';
    }
    
    // 3. Update Video Info Section
    if (videoTitleEl) {
      videoTitleEl.textContent = lastVideoInfo && lastVideoInfo.episode ? lastVideoInfo.episode : 'N/A';
    }
    if (videoSeriesEl) {
      videoSeriesEl.textContent = lastVideoInfo && lastVideoInfo.series ? lastVideoInfo.series : 'N/A';
    }
    if (videoTimeEl) {
      if (lastVideoInfo && lastVideoInfo.currentSeconds !== undefined && lastVideoInfo.durationSeconds !== undefined) {
        const currentS = parseFloat(lastVideoInfo.currentSeconds);
        const durationS = parseFloat(lastVideoInfo.durationSeconds);
        if (timeDisplayMode === 'current_duration') {
          videoTimeEl.textContent = `${formatTime(currentS)} / ${formatTime(durationS)}`;
        } else if (timeDisplayMode === 'current_only') {
          videoTimeEl.textContent = formatTime(currentS);
        } else { // 'none'
          videoTimeEl.textContent = '숨김';
        }
      } else {
        videoTimeEl.textContent = 'N/A';
      }
    }

    // 4. Update Toggle Buttons (Fetching, Visibility)
    if (toggleFetchingBtn) {
      toggleFetchingBtn.textContent = isFetchingActive ? '정보 수집 중지' : '정보 수집 시작';
      toggleFetchingBtn.classList.toggle('active-button', isFetchingActive === true);
    }
    if (toggleVisibilityBtn) {
      toggleVisibilityBtn.textContent = isOverlayVisible ? '오버레이 숨기기' : '오버레이 보이기';
      toggleVisibilityBtn.classList.toggle('active-button', isOverlayVisible === true);
    }
    
    // 5. Update Mode Controls (Buttons & Label)
    if (setNormalModeBtn) {
      setNormalModeBtn.classList.toggle('active-button', overlayMode === 'normal');
    }
    if (setCompactModeBtn) {
      setCompactModeBtn.classList.toggle('active-button', overlayMode === 'compact');
    }
    if (currentOverlayModeLabel) {
      currentOverlayModeLabel.textContent = overlayMode === 'normal' ? '일반' : '컴팩트';
    }
    
    // 6. Update Position Controls (Buttons & Label)
    if (setPositionLeftBtn) {
      setPositionLeftBtn.classList.toggle('active-button', overlayPositionSide === 'left');
    }
    if (setPositionRightBtn) {
      setPositionRightBtn.classList.toggle('active-button', overlayPositionSide === 'right');
    }
    if (currentOverlayPositionLabel) {
      currentOverlayPositionLabel.textContent = overlayPositionSide === 'left' ? '왼쪽' : '오른쪽';
    }

    // 7. Update Time Display Controls (Dropdown & Label)
    if (selectTimeDisplay) {
      selectTimeDisplay.value = timeDisplayMode;
    }
    if (currentTimeDisplayModeLabel) {
      let timeDisplayModeText = '현재/전체'; // Default for current_duration
      if (timeDisplayMode === 'current_only') timeDisplayModeText = '현재 시간만';
      else if (timeDisplayMode === 'none') timeDisplayModeText = '숨김';
      currentTimeDisplayModeLabel.textContent = timeDisplayModeText;
    }

    // NEW: 8. Update Title Display Controls (Dropdown & Label)
    if (selectTitleDisplay) {
      selectTitleDisplay.value = titleDisplayMode || 'episode_series'; 
    }
    if (currentTitleDisplayModeLabel) {
      let titleDisplayModeText = '에피+시리즈'; // 기본값: episode_series
      if (titleDisplayMode === 'episode_only') titleDisplayModeText = '에피소드만';
      else if (titleDisplayMode === 'none') titleDisplayModeText = '숨김';
      currentTitleDisplayModeLabel.textContent = `(${titleDisplayModeText})`;
    }

    // 9. Update Theme Controls (Dropdown & Label)
    if (selectTheme) {
      selectTheme.value = overlayTheme || 'light'; // Null 체크 추가
    }
    if (currentOverlayThemeLabel) {
      let themeText = '라이트'; // Default for light
      if (overlayTheme === 'dark') themeText = '다크';
      else if (overlayTheme === 'greenscreen-white-text') themeText = '그린스크린 (흰 글씨)';
      else if (overlayTheme === 'greenscreen-black-text') themeText = '그린스크린 (검은 글씨)';
      currentOverlayThemeLabel.textContent = themeText;
    }
    
    // 10. Preview update logic (If preview elements exist and are intended to be used)
    // if(previewContainerEl && previewTitleEl && previewSeriesEl && previewTimeEl) {
    //   previewContainerEl.className = 'preview'; 
    //   if (overlayMode) previewContainerEl.classList.add(overlayMode);
    //   if (overlayTheme && overlayTheme.startsWith('greenscreen')) {
    //     previewContainerEl.classList.add('greenscreen-preview');
    //   }
    //   previewTitleEl.textContent = lastVideoInfo && lastVideoInfo.episode ? lastVideoInfo.episode : '에피소드 제목';
    //   previewSeriesEl.textContent = lastVideoInfo && lastVideoInfo.series ? lastVideoInfo.series : '';
    //   // ... (rest of preview time logic) ...
    // }
  }
  
  // --- Message Handling ---
  function handleResponse(response, type) {
    if (chrome.runtime.lastError) {
      console.error(`POPUP.JS: Error in ${type}:`, chrome.runtime.lastError.message);
      if (statusTextEl) {
        statusTextEl.textContent = `오류 (${type}): ${chrome.runtime.lastError.message}`;
        statusTextEl.style.color = 'red';
      }
      return;
    }
    if (response && !response.success && response.error) {
      console.warn(`POPUP.JS: Received non-success response for ${type}: ${response.error}`);
      if (statusTextEl) {
        statusTextEl.textContent = `경고 (${type}): ${response.error}`;
        statusTextEl.style.color = 'orange';
      }
    }
    // Background will send BACKGROUND_STATE_UPDATE, popup updates UI via that.
  }
  
  // --- Event Listeners ---
  if (toggleFetchingBtn) {
    toggleFetchingBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_FETCHING' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_FETCHING");
      });
    });
  }

  if (toggleVisibilityBtn) {
    toggleVisibilityBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_VISIBILITY");
      });
    });
  }
  
  if (setNormalModeBtn) {
    setNormalModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MODE', mode: 'normal' }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_MODE_NORMAL");
      });
    });
  }

  if (setCompactModeBtn) {
    setCompactModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MODE', mode: 'compact' }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_MODE_COMPACT");
      });
    });
  }
  
  if (setPositionLeftBtn) {
    setPositionLeftBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: 'left' }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_POSITION_LEFT");
      });
    });
  }

  if (setPositionRightBtn) {
    setPositionRightBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: 'right' }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_POSITION_RIGHT");
      });
    });
  }

  if (selectTimeDisplay) {
    selectTimeDisplay.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_TIME_DISPLAY_MODE', mode: event.target.value }, (response) => {
        handleResponse(response, "POPUP_SET_TIME_DISPLAY_MODE");
      });
    });
  }

  if (selectTitleDisplay) {
    selectTitleDisplay.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_TITLE_DISPLAY_MODE', mode: event.target.value }, (response) => {
        handleResponse(response, "POPUP_SET_TITLE_DISPLAY_MODE");
      });
    });
  }

  if (selectTheme) {
    selectTheme.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_THEME', theme: event.target.value }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_THEME");
      });
    });
  }
  
  // --- Listener for Updates from Background ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BACKGROUND_STATE_UPDATE') {
      console.log("POPUP.JS: Received BACKGROUND_STATE_UPDATE from background:", JSON.parse(JSON.stringify(message.data)));
      updatePopupUI(message.data);
    }
    sendResponse({ received: true }); 
    return true; 
  });
  
  // --- Request Initial State ---
  console.log("POPUP.JS: Requesting GET_POPUP_INITIAL_DATA from background.");
  chrome.runtime.sendMessage({ type: 'GET_POPUP_INITIAL_DATA' }, (response) => {
    const defaultInitialState = { 
      isFetchingActive: false, isOverlayVisible: false, overlayMode: 'normal', 
      timeDisplayMode: 'current_duration', overlayPositionSide: 'right', overlayTheme: 'light',
      lastVideoInfo: null, activeTabHostname: 'N/A',
      isError: false, errorMessage: '초기 데이터 로드 중...'
    };

    if (chrome.runtime.lastError) {
      console.error('POPUP.JS: Error getting initial data:', chrome.runtime.lastError.message);
      updatePopupUI({ 
        isFetchingActive: false, isOverlayVisible: false, overlayMode: 'normal', 
        timeDisplayMode: 'current_duration', overlayPositionSide: 'right', overlayTheme: 'light',
        lastVideoInfo: null, activeTabHostname: 'N/A',
        isError: true, errorMessage: chrome.runtime.lastError.message
      });
      return;
    }

    if (response && typeof response === 'object') {
      console.log("POPUP.JS: Received response for GET_POPUP_INITIAL_DATA:", JSON.parse(JSON.stringify(response)));
      updatePopupUI(response);
    } else {
      console.warn("POPUP.JS: No valid data object received for GET_POPUP_INITIAL_DATA. Response:", response);
      updatePopupUI({ 
        isFetchingActive: false, isOverlayVisible: false, overlayMode: 'normal', 
        timeDisplayMode: 'current_duration', overlayPositionSide: 'right', overlayTheme: 'light',
        lastVideoInfo: null, activeTabHostname: 'N/A',
        isError: true, errorMessage: '초기 데이터 수신 실패'
      });
    }
  });
}); 