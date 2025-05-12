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
    } = data || {}; // data가 null일 경우 대비

    // 1. Update Status Text
    if (statusTextEl) {
      if (isError && errorMessage && errorMessage !== "활성 탭 없음" && errorMessage !== "콘텐츠 스크립트와 통신 실패") {
        // 심각한 오류나 사용자가 알아야 할 정보만 표시 (예: 지원하지 않는 사이트)
        statusTextEl.textContent = `상태: ${errorMessage}`;
        statusTextEl.style.color = 'orange';
      } else if (isFetchingActive) {
        statusTextEl.textContent = lastVideoInfo ? '비디오 정보 업데이트 중...' : '비디오 정보 가져오기 활성 (대기 중)';
        statusTextEl.style.color = 'green';
      } else {
        statusTextEl.textContent = '비디오 정보 가져오기 중지됨.';
        statusTextEl.style.color = 'grey';
      }
    }

    // 2. Update Current Site Host
    if (currentSiteHostEl) {
      currentSiteHostEl.textContent = activeTabHostname || 'N/A';
    }
    
    // 3. Update Video Info Section
    if (videoTitleEl) {
      videoTitleEl.textContent = lastVideoInfo?.episode || 'N/A';
    }
    if (videoSeriesEl) {
      videoSeriesEl.textContent = lastVideoInfo?.series || 'N/A'; 
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
          videoTimeEl.textContent = '시간 숨김';
        }
      } else {
        videoTimeEl.textContent = 'N/A';
      }
    }

    // 4. Update Toggle Buttons (Fetching, Visibility)
    if (toggleFetchingBtn) {
      toggleFetchingBtn.textContent = isFetchingActive ? '비디오 정보 가져오기 중지' : '비디오 정보 가져오기 시작';
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
      currentOverlayModeLabel.textContent = overlayMode === 'normal' ? '(일반)' : '(컴팩트)';
    }
    
    // 6. Update Position Controls (Buttons & Label)
    if (setPositionLeftBtn) {
      setPositionLeftBtn.classList.toggle('active-button', overlayPositionSide === 'left');
    }
    if (setPositionRightBtn) {
      setPositionRightBtn.classList.toggle('active-button', overlayPositionSide === 'right');
    }
    if (currentOverlayPositionLabel) {
      currentOverlayPositionLabel.textContent = overlayPositionSide === 'left' ? '(왼쪽)' : '(오른쪽)';
    }

    // 7. Update Time Display Controls (Dropdown & Label)
    if (selectTimeDisplay) {
      selectTimeDisplay.value = timeDisplayMode || 'current_duration'; // Null 체크 추가
    }
    if (currentTimeDisplayModeLabel) {
      let timeDisplayModeText = '현재/전체'; 
      if (timeDisplayMode === 'current_only') timeDisplayModeText = '현재 시간만';
      else if (timeDisplayMode === 'none') timeDisplayModeText = '숨김';
      currentTimeDisplayModeLabel.textContent = `(${timeDisplayModeText})`;
    }

    // 8. Update Theme Controls (Dropdown & Label)
    if (selectTheme) {
      selectTheme.value = overlayTheme || 'light'; // Null 체크 추가
    }
    if (currentOverlayThemeLabel) {
      let themeText = '라이트'; 
      if (overlayTheme === 'dark') themeText = '다크';
      else if (overlayTheme === 'greenscreen-white-text') themeText = '그린 (흰 글씨)';
      else if (overlayTheme === 'greenscreen-black-text') themeText = '그린 (검은 글씨)';
      currentOverlayThemeLabel.textContent = `(${themeText})`;
    }
    
    // 9. Preview update logic (If preview elements exist and are intended to be used)
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
      // Status text 직접 업데이트 제거 - BACKGROUND_STATE_UPDATE로 일원화
      return;
    }
    if (response && !response.success && response.error) {
      console.warn(`POPUP.JS: Received non-success response for ${type}: ${response.error}`);
      // Status text 직접 업데이트 제거
    }
    // UI는 BACKGROUND_STATE_UPDATE 메시지를 통해 업데이트됨
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
    // sendResponse({ received: true }); // 응답을 보내야 하는 경우 명시적으로 처리
    return true; // 비동기적 응답을 할 수 있음을 알림
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
      updatePopupUI({ ...defaultInitialState, isError: true, errorMessage: `초기 데이터 수신 오류: ${chrome.runtime.lastError.message}` });
      return;
    }

    if (response && typeof response === 'object') {
      console.log("POPUP.JS: Received response for GET_POPUP_INITIAL_DATA:", JSON.parse(JSON.stringify(response)));
      // background.js에서 success 플래그를 포함하여 응답을 주는지 확인 (현재는 가정)
      if (response.success === false && response.error) { // background.js가 오류를 명시적으로 보낸 경우
        updatePopupUI({ ...defaultInitialState, isError: true, errorMessage: response.error });
      } else {
        updatePopupUI(response); // 성공적인 응답 또는 success 플래그가 없는 경우 (기존 로직 호환)
      }
    } else {
      console.warn("POPUP.JS: No valid data object received for GET_POPUP_INITIAL_DATA. Response:", response);
      updatePopupUI({ ...defaultInitialState, isError: true, errorMessage: '초기 데이터 객체 수신 실패' });
    }
  });
}); 