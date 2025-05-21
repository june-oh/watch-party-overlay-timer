document.addEventListener('DOMContentLoaded', () => {
  console.log("POPUP.JS: DOMContentLoaded, script running.");

  // --- DOM Element References ---
  // Status and Site Info
  const statusTextEl = document.getElementById('statusText');
  const currentSiteHostEl = document.getElementById('currentSiteHost');

  // Main Toggles
  // const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn'); // 기존 버튼 참조 제거
  const toggleVisibilitySwitch = document.getElementById('toggleVisibilitySwitch'); // 새 토글 스위치 참조

  // Mode Controls
  // const setNormalModeBtn = document.getElementById('setNormalModeBtn'); // 기존 버튼 참조 제거
  // const setCompactModeBtn = document.getElementById('setCompactModeBtn'); // 기존 버튼 참조 제거
  // const currentOverlayModeLabel = document.getElementById('currentOverlayModeLabel'); // 기존 레이블 참조 제거
  const toggleCompactModeSwitch = document.getElementById('toggleCompactModeSwitch'); // 새 컴팩트 모드 토글 스위치 참조

  // Position Controls
  // const setPositionLeftBtn = document.getElementById('setPositionLeftBtn'); // 제거
  // const setPositionRightBtn = document.getElementById('setPositionRightBtn'); // 제거
  // const currentOverlayPositionLabel = document.getElementById('currentOverlayPositionLabel'); // 제거
  const selectOverlayPosition = document.getElementById('selectOverlayPosition'); // 추가: 위치 설정 드롭다운

  // Time Display Controls
  const selectTimeDisplay = document.getElementById('selectTimeDisplay');

  // Theme Controls
  const selectTheme = document.getElementById('selectTheme');

  // NEW: Slider Control for Position Offset
  const sliderOffset = document.getElementById('sliderOffset');
  const inputOffsetValue = document.getElementById('inputOffsetValue'); // 추가: 숫자 입력 필드

  // NEW: Slider Control for Overlay Width
  const sliderOverlayWidth = document.getElementById('sliderOverlayWidth');
  const inputOverlayWidthValue = document.getElementById('inputOverlayWidthValue');

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
    console.log(`POPUP.JS: updatePopupUI - Received overlayMode: ${data.overlayMode}, overlayPositionSide: ${data.overlayPositionSide}, overlayTheme: ${data.overlayTheme}, timeDisplayMode: ${data.timeDisplayMode}, titleDisplayMode: ${data.titleDisplayMode}, overlayOffset: ${data.overlayOffset}, overlayWidth: ${data.overlayWidth}`);

    const {
      isFetchingActive,
      isOverlayVisible,
      overlayMode,
      timeDisplayMode,
      titleDisplayMode,
      overlayPositionSide,
      overlayTheme,
      lastVideoInfo,
      isError,
      errorMessage,
      activeTabHostname,
      overlayOffset,
      overlayWidth
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
    if (toggleVisibilitySwitch) { // 새 토글 스위치 상태 업데이트
      toggleVisibilitySwitch.checked = isOverlayVisible === true;
    }
    
    // 5. Update Mode Controls (Buttons & Label)
    // if (currentOverlayModeLabel) {
    //   currentOverlayModeLabel.textContent = getModeLabel(state.overlayMode);
    // }
    // if (setNormalModeBtn) setNormalModeBtn.classList.toggle('active-button', state.overlayMode === 'normal');
    // if (setCompactModeBtn) setCompactModeBtn.classList.toggle('active-button', state.overlayMode === 'compact');
    
    if (toggleCompactModeSwitch) { // 새 컴팩트 모드 토글 스위치 상태 업데이트
      toggleCompactModeSwitch.checked = data.overlayMode === 'compact';
    }

    // 6. Update Position Controls (Dropdown & Label)
    if (selectOverlayPosition) { // 수정: 드롭다운 값 설정
      selectOverlayPosition.value = overlayPositionSide || 'right'; // 기본값 오른쪽
    }

    // 7. Update Time Display Controls (Dropdown & Label)
    if (selectTimeDisplay) {
      selectTimeDisplay.value = timeDisplayMode;
    }

    // NEW: 8. Update Title Display Controls (Dropdown & Label)
    if (selectTitleDisplay) {
      selectTitleDisplay.value = titleDisplayMode || 'episode_series'; 
    }

    // 9. Update Theme Controls (Dropdown & Label)
    if (selectTheme) {
      selectTheme.value = overlayTheme || 'light'; // Null 체크 추가
    }
    
    // NEW: 10. Update Offset Slider Control and Input Field
    if (overlayOffset !== undefined) {
      if (sliderOffset) {
        sliderOffset.value = overlayOffset;
      }
      if (inputOffsetValue) {
        inputOffsetValue.value = overlayOffset;
      }
    }

    // NEW: 11. Update Overlay Width Slider Control and Input Field
    if (overlayWidth !== undefined) {
      if (sliderOverlayWidth) {
        sliderOverlayWidth.value = overlayWidth;
      }
      if (inputOverlayWidthValue) {
        inputOverlayWidthValue.value = overlayWidth;
      }
    }

    // 11. Preview update logic (If preview elements exist and are intended to be used)
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
  // if (toggleVisibilityBtn) { // 기존 버튼 리스너 제거
  //   toggleVisibilityBtn.addEventListener('click', () => {
  //     chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY' }, (response) => {
  //       handleResponse(response, "POPUP_TOGGLE_VISIBILITY");
  //     });
  //   });
  // }

  if (toggleVisibilitySwitch) { // 새 토글 스위치 이벤트 리스너 추가
    toggleVisibilitySwitch.addEventListener('change', () => {
      // const isVisible = toggleVisibilitySwitch.checked; // 이 값은 백그라운드에서 결정하여 다시 보내줌
      // console.log(`POPUP: Visibility switch changed. New state: ${isVisible}. Sending POPUP_TOGGLE_VISIBILITY to background.`);
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY' }, (response) => {
        // handleResponse는 background_state_update를 통해 UI가 갱신되므로 여기서는 간단한 에러 처리만 할 수 있음
        if (chrome.runtime.lastError) {
          console.error("POPUP.JS: Error in POPUP_TOGGLE_VISIBILITY (Switch):", chrome.runtime.lastError.message);
          if (statusTextEl) {
            statusTextEl.textContent = `오류: ${chrome.runtime.lastError.message}`;
            statusTextEl.style.color = 'red';
          }
          // 스위치 상태를 강제로 되돌릴 수도 있으나, 실제 상태는 background에 있으므로 주의
          // chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' }, initStateResponse => { ... }); // 상태 재요청
        } else if (response && !response.success) {
          console.warn("POPUP.JS: POPUP_TOGGLE_VISIBILITY (Switch) non-success:", response.error);
          if (statusTextEl) {
            statusTextEl.textContent = `경고: ${response.error}`;
            statusTextEl.style.color = 'orange';
          }
        }
        // 성공적인 응답 (response.success === true)의 경우, BACKGROUND_STATE_UPDATE 메시지를 통해 UI가 업데이트 될 것임
      });
    });
  }
  
  if (toggleCompactModeSwitch) {
    toggleCompactModeSwitch.addEventListener('change', () => {
      const newMode = toggleCompactModeSwitch.checked ? 'compact' : 'normal';
      console.log(`POPUP: Compact mode switch changed. New mode: ${newMode}. Sending SET_OVERLAY_MODE to background.`);
      chrome.runtime.sendMessage({ type: 'SET_OVERLAY_MODE', payload: { mode: newMode } }, handleResponse(`Mode set to ${newMode}`))
    });
  }
  
  // 추가: 위치 설정 드롭다운 이벤트 리스너
  if (selectOverlayPosition) {
    selectOverlayPosition.addEventListener('change', (event) => {
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: event.target.value }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_POSITION_DROPDOWN");
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
  
  // NEW: Offset Slider and Input Event Listeners
  if (sliderOffset && inputOffsetValue) {
    sliderOffset.addEventListener('input', (event) => {
      const value = parseInt(event.target.value, 10);
      inputOffsetValue.value = value;
      console.log('POPUP.JS: Slider input - value sent to background:', value);
      chrome.runtime.sendMessage({ 
        type: 'POPUP_SET_OVERLAY_OFFSET', 
        offset: value 
      }, (response) => {
        handleResponse(response, 'POPUP_SET_OVERLAY_OFFSET_SLIDER');
      });
    });

    inputOffsetValue.addEventListener('input', (event) => {
      let value = parseInt(event.target.value, 10);
      if (isNaN(value)) {
        console.log('POPUP.JS: Number input - NaN, returning early. Value:', event.target.value);
        return; 
      }
      // 범위 제한 (0 ~ 40)
      if (value < 0) value = 0;
      if (value > 40) value = 40;
      event.target.value = value; // 실제 입력 필드 값도 조정된 값으로 변경
      
      sliderOffset.value = value;
      console.log('POPUP.JS: Number input - value sent to background:', value);
      chrome.runtime.sendMessage({ 
        type: 'POPUP_SET_OVERLAY_OFFSET', 
        offset: value 
      }, (response) => {
        handleResponse(response, 'POPUP_SET_OVERLAY_OFFSET_INPUT');
      });
    });
  }
  
  // NEW: Overlay Width Slider and Input Event Listeners
  if (sliderOverlayWidth && inputOverlayWidthValue) {
    sliderOverlayWidth.addEventListener('input', (event) => {
      const value = parseInt(event.target.value, 10);
      inputOverlayWidthValue.value = value;
      chrome.runtime.sendMessage({ 
        type: 'POPUP_SET_OVERLAY_WIDTH', 
        width: value 
      }, (response) => {
        handleResponse(response, 'POPUP_SET_OVERLAY_WIDTH_SLIDER');
      });
    });

    inputOverlayWidthValue.addEventListener('input', (event) => {
      let value = parseInt(event.target.value, 10);
      if (isNaN(value)) return;
      // 범위 제한 (50 ~ 500)
      const minWidth = parseInt(sliderOverlayWidth.min, 10) || 50; // min 값 50으로 수정
      const maxWidth = parseInt(sliderOverlayWidth.max, 10) || 500; // max 값 500으로 수정
      if (value < minWidth) value = minWidth;
      if (value > maxWidth) value = maxWidth;
      event.target.value = value; 
      
      sliderOverlayWidth.value = value;
      chrome.runtime.sendMessage({ 
        type: 'POPUP_SET_OVERLAY_WIDTH', 
        width: value 
      }, (response) => {
        handleResponse(response, 'POPUP_SET_OVERLAY_WIDTH_INPUT');
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
      timeDisplayMode: 'current_duration', 
      titleDisplayMode: 'episode_series',
      overlayPositionSide: 'right', overlayTheme: 'light',
      overlayOffset: 8, 
      overlayWidth: 250, // 너비 기본값 250으로 수정
      lastVideoInfo: null, activeTabHostname: 'N/A',
      isError: false, errorMessage: '초기 데이터 로드 중...'
    };

    if (chrome.runtime.lastError) {
      console.error('POPUP.JS: Error getting initial data:', chrome.runtime.lastError.message);
      updatePopupUI({ 
        ...defaultInitialState, // 기본값 전체 사용
        isError: true, errorMessage: chrome.runtime.lastError.message
      });
      return;
    }

    if (response && typeof response === 'object') {
      console.log("POPUP.JS: Received response for GET_POPUP_INITIAL_DATA:", JSON.parse(JSON.stringify(response)));
      // Ensure new offset field has default if not provided by older background state
      const dataToUpdate = {
        ...defaultInitialState, // 기본값으로 시작
        ...response, // background에서 받은 값으로 덮어쓰기
        overlayOffset: response.overlayOffset !== undefined ? response.overlayOffset : defaultInitialState.overlayOffset,
        overlayWidth: response.overlayWidth !== undefined ? response.overlayWidth : defaultInitialState.overlayWidth // 너비 값 추가
      };
      updatePopupUI(dataToUpdate);
    } else {
      console.warn("POPUP.JS: No valid data object received for GET_POPUP_INITIAL_DATA. Response:", response);
      updatePopupUI({ 
        ...defaultInitialState, // 기본값 전체 사용
        isError: true, errorMessage: '초기 데이터 수신 실패'
      });
    }
  });
}); 