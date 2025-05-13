document.addEventListener('DOMContentLoaded', () => {
  console.log("POPUP.JS: DOMContentLoaded, script running.");

  // --- DOM Element References ---
  const statusTextEl = document.getElementById('statusText');
  const currentSiteHostEl = document.getElementById('currentSiteHost');
  const toggleFetchingBtn = document.getElementById('toggleFetchingBtn');
  const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');

  const setNormalModeBtn = document.getElementById('setNormalModeBtn');
  const setCompactModeBtn = document.getElementById('setCompactModeBtn');
  const currentOverlayModeLabel = document.getElementById('currentOverlayModeLabel');

  const setPositionLeftBtn = document.getElementById('setPositionLeftBtn');
  const setPositionRightBtn = document.getElementById('setPositionRightBtn');
  const currentOverlayPositionLabel = document.getElementById('currentOverlayPositionLabel');

  const selectTimeDisplay = document.getElementById('selectTimeDisplay');
  const currentTimeDisplayModeLabel = document.getElementById('currentTimeDisplayModeLabel');

  const selectTitleDisplay = document.getElementById('selectTitleDisplay');
  const currentTitleDisplayModeLabel = document.getElementById('currentTitleDisplayModeLabel');

  const selectTheme = document.getElementById('selectTheme');
  const currentOverlayThemeLabel = document.getElementById('currentOverlayThemeLabel');

  const videoTitleEl = document.getElementById('videoTitle');
  const videoSeriesEl = document.getElementById('videoSeries');
  const videoTimeEl = document.getElementById('videoTime');

  // --- Helper Functions ---
  function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    let timeString = '';
    if (hours > 0) {
      timeString += `${String(hours).padStart(2, '0')}:`;
      timeString += `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return timeString;
  }

  // --- UI Update Function ---
  function updatePopupUI(data) {
    const safeData = data || {}; 
    // console.log("POPUP.JS: updatePopupUI called with raw data:", JSON.parse(JSON.stringify(safeData)));

    const {
      isFetchingActive,
      isOverlayVisible,
      overlayMode,
      timeDisplayMode,
      titleDisplayMode, // Ensure this is destructured
      overlayPositionSide,
      overlayTheme,
      lastVideoInfo,
      isError,
      errorMessage,
      activeTabHostname
    } = safeData;

    console.log(
        `POPUP.JS: updatePopupUI - Destructured states: \n` +
        `  Fetching=${isFetchingActive}, Visible=${isOverlayVisible}, Mode=${overlayMode}, \n` +
        `  TimeDisplay=${timeDisplayMode}, TitleDisplay=${titleDisplayMode}, \n` +
        `  Position=${overlayPositionSide}, Theme=${overlayTheme}, Host=${activeTabHostname}\n` +
        `  IsError=${isError}, ErrorMsg=${errorMessage}`
    );

    // 1. Update Status Text
    if (statusTextEl) {
      if (isError && errorMessage && errorMessage !== "활성 탭 없음" && !errorMessage.startsWith("콘텐츠 스크립트 통신 실패")) {
        statusTextEl.textContent = `상태: ${errorMessage}`;
        statusTextEl.style.color = 'orange';
      } else if (isFetchingActive) {
        statusTextEl.textContent = lastVideoInfo ? '비디오 정보 업데이트 중...' : '비디오 정보 가져오기 활성 (대기 중)';
        statusTextEl.style.color = 'green';
      } else {
        statusTextEl.textContent = '비디오 정보 가져오기 중지됨.'; // 문구 수정됨
        statusTextEl.style.color = 'grey';
      }
    }

    // 2. Update Current Site Host
    if (currentSiteHostEl) {
      currentSiteHostEl.textContent = activeTabHostname || 'N/A';
    }
    
    // 3. Update Video Info Section
    if (videoSeriesEl) {
      videoSeriesEl.textContent = (lastVideoInfo?.series && lastVideoInfo.series !== "") ? lastVideoInfo.series : 'N/A';
    }
    if (videoTitleEl) {
      videoTitleEl.textContent = (lastVideoInfo?.episode && lastVideoInfo.episode !== "N/A" && lastVideoInfo.episode !== "에피소드 정보 없음" && lastVideoInfo.episode !== "제목 정보 없음") ? lastVideoInfo.episode : 'N/A';
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
        videoTimeEl.textContent = isFetchingActive ? '시간 정보 수신 중...' : 'N/A';
      }
    }

    // 4. Update Toggle Buttons (Fetching, Visibility)
    if (toggleFetchingBtn) {
      toggleFetchingBtn.textContent = isFetchingActive ? '비디오 정보 가져오기 중지' : '비디오 정보 가져오기 시작'; // 문구 수정됨
      toggleFetchingBtn.classList.toggle('active-button', isFetchingActive === true);
    }
    if (toggleVisibilityBtn) {
      toggleVisibilityBtn.textContent = isOverlayVisible ? '오버레이 숨기기' : '오버레이 보이기';
      toggleVisibilityBtn.classList.toggle('active-button', isOverlayVisible === true);
    }
    
    // 5. Update Mode Controls
    if (setNormalModeBtn) setNormalModeBtn.classList.toggle('active-button', overlayMode === 'normal');
    if (setCompactModeBtn) setCompactModeBtn.classList.toggle('active-button', overlayMode === 'compact');
    if (currentOverlayModeLabel) currentOverlayModeLabel.textContent = overlayMode === 'normal' ? '(일반)' : '(컴팩트)';
    
    // 6. Update Position Controls
    if (setPositionLeftBtn) setPositionLeftBtn.classList.toggle('active-button', overlayPositionSide === 'left');
    if (setPositionRightBtn) setPositionRightBtn.classList.toggle('active-button', overlayPositionSide === 'right');
    if (currentOverlayPositionLabel) currentOverlayPositionLabel.textContent = overlayPositionSide === 'left' ? '(왼쪽)' : '(오른쪽)';

    // 7. Update Time Display Controls
    if (selectTimeDisplay) selectTimeDisplay.value = timeDisplayMode || 'current_duration';
    if (currentTimeDisplayModeLabel) {
      let text = '현재/전체';
      if (timeDisplayMode === 'current_only') text = '현재 시간만';
      else if (timeDisplayMode === 'none') text = '숨김';
      currentTimeDisplayModeLabel.textContent = `(${text})`;
    }

    // 8. Update Title Display Controls
    if (selectTitleDisplay) selectTitleDisplay.value = titleDisplayMode || 'episode_series';
    if (currentTitleDisplayModeLabel) {
      let text = '에피+시리즈';
      if (titleDisplayMode === 'episode_only') text = '에피소드만';
      else if (titleDisplayMode === 'none') text = '숨김';
      currentTitleDisplayModeLabel.textContent = `(${text})`;
    }

    // 9. Update Theme Controls
    if (selectTheme) selectTheme.value = overlayTheme || 'light';
    if (currentOverlayThemeLabel) {
      let text = '라이트';
      if (overlayTheme === 'dark') text = '다크';
      else if (overlayTheme === 'greenscreen-white-text') text = '그린 (흰 글씨)';
      else if (overlayTheme === 'greenscreen-black-text') text = '그린 (검은 글씨)';
      currentOverlayThemeLabel.textContent = `(${text})`;
    }
  }
  
  function handleResponse(response, type) {
    if (chrome.runtime.lastError) {
      console.error(`POPUP.JS: Error in ${type}:`, chrome.runtime.lastError.message);
      return;
    }
    if (response && !response.success && response.error) {
      console.warn(`POPUP.JS: Received non-success response for ${type}: ${response.error}`);
    }
  }
  
  if (toggleFetchingBtn) {
    toggleFetchingBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_FETCHING' }, (response) => handleResponse(response, "POPUP_TOGGLE_FETCHING"));
    });
  }

  if (toggleVisibilityBtn) {
    toggleVisibilityBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY' }, (response) => handleResponse(response, "POPUP_TOGGLE_VISIBILITY"));
    });
  }
  
  if (setNormalModeBtn) {
    setNormalModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MODE', mode: 'normal' }, (response) => handleResponse(response, "POPUP_SET_OVERLAY_MODE_NORMAL"));
    });
  }

  if (setCompactModeBtn) {
    setCompactModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MODE', mode: 'compact' }, (response) => handleResponse(response, "POPUP_SET_OVERLAY_MODE_COMPACT"));
    });
  }
  
  if (setPositionLeftBtn) {
    setPositionLeftBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: 'left' }, (response) => handleResponse(response, "POPUP_SET_OVERLAY_POSITION_LEFT"));
    });
  }

  if (setPositionRightBtn) {
    setPositionRightBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: 'right' }, (response) => handleResponse(response, "POPUP_SET_OVERLAY_POSITION_RIGHT"));
    });
  }

  if (selectTimeDisplay) {
    selectTimeDisplay.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_TIME_DISPLAY_MODE', mode: event.target.value }, (response) => handleResponse(response, "POPUP_SET_TIME_DISPLAY_MODE"));
    });
  }

  if (selectTitleDisplay) {
    selectTitleDisplay.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_TITLE_DISPLAY_MODE', mode: event.target.value }, (response) => handleResponse(response, "POPUP_SET_TITLE_DISPLAY_MODE"));
    });
  }

  if (selectTheme) {
    selectTheme.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_THEME', theme: event.target.value }, (response) => handleResponse(response, "POPUP_SET_OVERLAY_THEME"));
    });
  }
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BACKGROUND_STATE_UPDATE') {
      console.log("POPUP.JS: Received BACKGROUND_STATE_UPDATE from background:", JSON.parse(JSON.stringify(message.data)));
      updatePopupUI(message.data);
    }
    sendResponse({ received: true }); 
    return true; 
  });
  
  function requestInitialState() {
    console.log("POPUP.JS: Requesting GET_POPUP_INITIAL_DATA from background.");
    chrome.runtime.sendMessage({ type: 'GET_POPUP_INITIAL_DATA' }, (response) => {
      const defaultInitialState = { 
        isFetchingActive: false, isOverlayVisible: false, overlayMode: 'normal', 
        timeDisplayMode: 'current_duration', titleDisplayMode: 'episode_series', 
        overlayPositionSide: 'right', overlayTheme: 'light',
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
        if (response.success === false && response.error) {
          updatePopupUI({ ...defaultInitialState, ...response, isError: true, errorMessage: response.error });
        } else {
          const initialState = { ...defaultInitialState, ...response };
          updatePopupUI(initialState);
        }
      } else {
        console.warn("POPUP.JS: No valid data object received for GET_POPUP_INITIAL_DATA. Response:", response);
        updatePopupUI({ ...defaultInitialState, isError: true, errorMessage: '초기 데이터 객체 수신 실패' });
      }
    });
  }
  
  requestInitialState();
}); 