document.addEventListener('DOMContentLoaded', () => {
  console.log("POPUP.JS: DOMContentLoaded, script running."); // 스크립트 시작 확인
  // DOM 요소
  const generalStatusEl = document.getElementById('generalStatus');
  const episodeTitleEl = document.getElementById('videoTitle');
  const seriesTitleEl = document.getElementById('videoSeries');
  const timeInfoEl = document.getElementById('videoTime');
  const toggleFetchingBtn = document.getElementById('toggleFetchingBtn');
  const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
  const setNormalModeBtn = document.getElementById('setNormalModeBtn');
  const setCompactModeBtn = document.getElementById('setCompactModeBtn');
  const toggleGreenscreenModeBtn = document.getElementById('toggleGreenscreenModeBtn');
  const toggleFlowModeBtn = document.getElementById('toggleFlowModeBtn');
  const currentSiteHostEl = document.getElementById('currentSiteHost'); // Added for current site host
  
  // 프리뷰 요소
  const previewContainerEl = document.getElementById('previewContainer');
  const previewTitleEl = document.getElementById('previewTitle');
  const previewSeriesEl = document.getElementById('previewSeries');
  const previewTimeEl = document.getElementById('previewTime');
  
  // 상태 변수
  let currentIsFetchingActive = false;
  let currentIsOverlayVisible = false;
  let currentOverlayMode = 'normal';
  let currentIsError = false;
  let currentVideoInfo = null;
  let currentActiveTabHostname = 'N/A'; // Added to store hostname

  // UI 업데이트 함수
  function updatePopupUI(data) {
    console.log("POPUP.JS: updatePopupUI called with data:", data); // UI 업데이트 함수 호출 및 데이터 확인
    currentIsFetchingActive = data.isFetchingActive;
    currentIsOverlayVisible = data.isOverlayVisible;
    currentOverlayMode = data.overlayMode;
    currentIsError = data.isError || false;
    currentVideoInfo = data.lastVideoInfo;
    currentActiveTabHostname = data.activeTabHostname || currentActiveTabHostname; // Update hostname, keep if not provided
    
    if (currentSiteHostEl) {
      currentSiteHostEl.textContent = currentActiveTabHostname;
    }

    if (currentIsError) {
      generalStatusEl.textContent = '오류! (새로고침 또는 탭 확인)';
      generalStatusEl.className = 'status error';
      toggleFetchingBtn.textContent = currentIsFetchingActive ? '정보 가져오기 중지 (오류)' : '정보 가져오기 시작 (오류)';
      toggleFetchingBtn.className = currentIsFetchingActive ? 'stop error' : 'start error';
    } else {
      generalStatusEl.textContent = currentIsFetchingActive ? '정보 업데이트 중...' : '정보 가져오기 중지됨';
      generalStatusEl.className = 'status';
      toggleFetchingBtn.textContent = currentIsFetchingActive ? '정보 가져오기 중지' : '정보 가져오기 시작';
      toggleFetchingBtn.className = currentIsFetchingActive ? 'stop' : 'start';
    }
    
    toggleVisibilityBtn.textContent = currentIsOverlayVisible ? '오버레이 숨기기' : '오버레이 보이기';
    toggleVisibilityBtn.className = currentIsOverlayVisible ? 'stop' : 'start';
    
    // Reset all mode button styles
    const modeButtons = [setNormalModeBtn, setCompactModeBtn, toggleGreenscreenModeBtn, toggleFlowModeBtn];
    modeButtons.forEach(btn => {
      if (btn) {
        btn.style.backgroundColor = ''; // Reset to CSS default or a specific inactive color
        btn.classList.remove('active-mode');
      }
    });

    // Highlight the active mode button
    if (currentOverlayMode === 'normal' && setNormalModeBtn) {
      setNormalModeBtn.style.backgroundColor = '#4CAF50'; // Green for active
      setNormalModeBtn.classList.add('active-mode');
    } else if (currentOverlayMode === 'compact' && setCompactModeBtn) {
      setCompactModeBtn.style.backgroundColor = '#4CAF50';
      setCompactModeBtn.classList.add('active-mode');
    } else if (currentOverlayMode === 'greenscreen' && toggleGreenscreenModeBtn) {
      toggleGreenscreenModeBtn.style.backgroundColor = '#4CAF50';
      toggleGreenscreenModeBtn.classList.add('active-mode');
    } else if (currentOverlayMode === 'flow' && toggleFlowModeBtn) {
      toggleFlowModeBtn.style.backgroundColor = '#4CAF50';
      toggleFlowModeBtn.classList.add('active-mode');
    }
    
    if(previewContainerEl) previewContainerEl.className = `preview ${currentOverlayMode}`;
    
    if (currentVideoInfo) {
      if(episodeTitleEl) episodeTitleEl.textContent = currentVideoInfo.episode || 'N/A';
      if(seriesTitleEl) seriesTitleEl.textContent = currentVideoInfo.series || 'N/A';
      const currentTime = formatTime(currentVideoInfo.currentSeconds);
      const duration = formatTime(currentVideoInfo.durationSeconds);
      if(timeInfoEl) timeInfoEl.textContent = `${currentTime} / ${duration}`;
      
      if(previewTitleEl) previewTitleEl.textContent = currentVideoInfo.episode || '에피소드 제목';
      if(previewSeriesEl) previewSeriesEl.textContent = currentVideoInfo.series || '';
      if(previewTimeEl) previewTimeEl.textContent = `${currentTime} / ${duration}`;
    } else {
      if(episodeTitleEl) episodeTitleEl.textContent = '-';
      if(seriesTitleEl) seriesTitleEl.textContent = '-';
      if(timeInfoEl) timeInfoEl.textContent = '-';
      
      if(previewTitleEl) previewTitleEl.textContent = '에피소드 제목';
      if(previewSeriesEl) previewSeriesEl.textContent = '시리즈 제목';
      if(previewTimeEl) previewTimeEl.textContent = '00:00 / 00:00';
    }
  }
  
  function formatTime(totalSeconds) { // Added formatTime if it's used by UI and not defined elsewhere
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

  function handleResponse(response, type) {
    if (chrome.runtime.lastError) {
      console.error(`Popup: Error in ${type}:`, chrome.runtime.lastError.message);
      return;
    }
    if (response && !response.success && response.error) {
      console.warn(`Popup: Received non-success response for ${type}: ${response.error}`);
    }
  }
  
  // 오버레이 토글 버튼 클릭 핸들러
  if(toggleFetchingBtn){ 
    toggleFetchingBtn.addEventListener('click', () => {
      console.log("POPUP.JS: toggleFetchingBtn clicked."); 
      const action = currentIsFetchingActive ? 'stop' : 'start';
      console.log(`POPUP.JS: Sending POPUP_TOGGLE_FETCHING with action: ${action}`); 
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_FETCHING', action: action }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_FETCHING");
      });
    });
  } else {
    console.error("POPUP.JS: toggleFetchingBtn not found!");
  }

  if(toggleVisibilityBtn){ 
    toggleVisibilityBtn.addEventListener('click', () => {
      console.log("POPUP.JS: toggleVisibilityBtn clicked.");
      const action = currentIsOverlayVisible ? 'hide' : 'show';
      console.log(`POPUP.JS: Sending POPUP_TOGGLE_VISIBILITY with action: ${action}`);
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY', action: action }, (response) => {
          handleResponse(response, "POPUP_TOGGLE_VISIBILITY");
      });
    });
  } else {
      console.error("POPUP.JS: toggleVisibilityBtn not found!");
  }
  
  // Event Listeners for new mode buttons
  if(setNormalModeBtn) {
    setNormalModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_MODE', mode: 'normal' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_MODE_NORMAL");
      });
    });
  }

  if(setCompactModeBtn) {
    setCompactModeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_MODE', mode: 'compact' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_MODE_COMPACT");
      });
    });
  }

  if(toggleGreenscreenModeBtn) {
    toggleGreenscreenModeBtn.addEventListener('click', () => {
      // Simple toggle: if not greenscreen, switch to it. If already greenscreen, switch to normal.
      const newMode = currentOverlayMode === 'greenscreen' ? 'normal' : 'greenscreen';
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_MODE', mode: newMode }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_MODE_GREENSCREEN");
      });
    });
  }
  
  if(toggleFlowModeBtn){ 
    toggleFlowModeBtn.addEventListener('click', () => {
      // Simple toggle: if not flow, switch to it. If already flow, switch to normal.
      // This might also need a concept of previous non-flow mode if more complex behavior is needed.
      const newMode = currentOverlayMode === 'flow' ? 'normal' : 'flow';
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_MODE', mode: newMode }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_MODE_FLOW");
      });
    });
  }
  
  // 배경 스크립트로부터 상태 업데이트 받기
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BACKGROUND_STATE_UPDATE') {
      updatePopupUI(message.data);
    }
    return true;
  });
  
  // 초기 데이터 요청
  console.log("POPUP.JS: Requesting GET_POPUP_INITIAL_DATA from background."); 
  chrome.runtime.sendMessage({ type: 'GET_POPUP_INITIAL_DATA' }, (response) => {
    console.log("POPUP.JS: Received response for GET_POPUP_INITIAL_DATA:", response); // Log the raw response

    if (chrome.runtime.lastError) {
      console.error('Popup: Error getting initial data:', chrome.runtime.lastError.message);
      updatePopupUI({ 
        isFetchingActive: false, 
        isOverlayVisible: false, 
        overlayMode: 'normal', 
        lastVideoInfo: null, 
        isError: true, 
        activeTabHostname: 'Error retrieving host' // Show error for hostname
      });
      return;
    }

    if (response && typeof response === 'object') {
      // Ensure all expected properties are at least defaulted if not present in response
      // though background.js should always send them.
      const dataToUpdate = {
        isFetchingActive: response.isFetchingActive !== undefined ? response.isFetchingActive : false,
        isOverlayVisible: response.isOverlayVisible !== undefined ? response.isOverlayVisible : false,
        overlayMode: response.overlayMode || 'normal',
        lastVideoInfo: response.lastVideoInfo || null,
        isError: response.isError !== undefined ? response.isError : false, // Default to false if isError is missing
        activeTabHostname: response.activeTabHostname || 'N/A' // Process hostname
      };
      updatePopupUI(dataToUpdate);
    } else {
      console.warn("POPUP.JS: No valid data object received from background for GET_POPUP_INITIAL_DATA. Response:", response);
      updatePopupUI({ 
        isFetchingActive: false, 
        isOverlayVisible: false, 
        overlayMode: 'normal', 
        lastVideoInfo: null, 
        isError: true, // Treat as an error if response is not a valid object
        activeTabHostname: 'Error retrieving host' // Show error for hostname
      });
    }
  });
}); 