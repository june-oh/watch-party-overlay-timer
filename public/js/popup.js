document.addEventListener('DOMContentLoaded', () => {
  console.log("POPUP.JS: DOMContentLoaded, script running.");

  // --- Load and Display Extension Version ---
  const extensionVersionEl = document.getElementById('extensionVersion');
  if (extensionVersionEl) {
    const manifest = chrome.runtime.getManifest();
    extensionVersionEl.textContent = manifest.version;
  }

  // --- DOM Element References ---
  const statusTextEl = document.getElementById('statusText');
  const currentSiteHostEl = document.getElementById('currentSiteHost');
  
  // 새로운 토글 스위치 요소들
  const toggleFetchingInput = document.getElementById('toggleFetching');
  const toggleVisibilityInput = document.getElementById('toggleVisibility');
  const toggleCompactModeInput = document.getElementById('toggleCompactMode');
  const togglePositionInput = document.getElementById('togglePosition');
  const toggleShowHostnameInput = document.getElementById('toggleShowHostname');

  const selectTimeDisplay = document.getElementById('selectTimeDisplay');

  const selectTitleDisplay = document.getElementById('selectTitleDisplay');

  const selectTheme = document.getElementById('selectTheme');

  // 통합 여백 요소들
  const sliderUnifiedOffset = document.getElementById('sliderUnifiedOffset');
  const inputUnifiedOffset = document.getElementById('inputUnifiedOffset');
  const unifiedOffsetControl = document.getElementById('unifiedOffsetControl');
  
  // 통합 줄간격 요소들
  const sliderUnifiedLineSpacing = document.getElementById('sliderUnifiedLineSpacing');
  const inputUnifiedLineSpacing = document.getElementById('inputUnifiedLineSpacing');
  const unifiedLineSpacingControl = document.getElementById('unifiedLineSpacingControl');
  
  // 개별 여백 요소들 (고급 설정용)
  const sliderHorizontalOffset = document.getElementById('sliderHorizontalOffset');
  const inputHorizontalOffset = document.getElementById('inputHorizontalOffset');
  const horizontalOffsetControl = document.getElementById('horizontalOffsetControl');
  const sliderVerticalOffset = document.getElementById('sliderVerticalOffset');
  const inputVerticalOffset = document.getElementById('inputVerticalOffset');
  const verticalOffsetControl = document.getElementById('verticalOffsetControl');

  // 개별 줄간격 요소들 (고급 설정용)
  const sliderOverlayLineSpacingAdvanced = document.getElementById('sliderOverlayLineSpacingAdvanced');
  const inputOverlayLineSpacingAdvanced = document.getElementById('inputOverlayLineSpacingAdvanced');
  const lineSpacingControl = document.getElementById('lineSpacingControl');

  // 컨테이너 내부 여백 요소들 (고급 설정용)
  const sliderContainerPadding = document.getElementById('sliderContainerPadding');
  const inputContainerPadding = document.getElementById('inputContainerPadding');

  // 개별 내부 여백 요소들 (고급 설정용) - 제거됨
  const sliderOverlayPaddingAdvanced = document.getElementById('sliderOverlayPaddingAdvanced');
  const inputOverlayPaddingAdvanced = document.getElementById('inputOverlayPaddingAdvanced');
  const paddingControl = document.getElementById('paddingControl');

  // 고급 설정 요소들
  const advancedContent = document.getElementById('advancedContent');
  
  // 폰트 크기 조정 요소들
  const sliderSeriesFontSize = document.getElementById('sliderSeriesFontSize');
  const inputSeriesFontSize = document.getElementById('inputSeriesFontSize');
  const sliderEpisodeFontSize = document.getElementById('sliderEpisodeFontSize');
  const inputEpisodeFontSize = document.getElementById('inputEpisodeFontSize');
  const sliderCurrentTimeFontSize = document.getElementById('sliderCurrentTimeFontSize');
  const inputCurrentTimeFontSize = document.getElementById('inputCurrentTimeFontSize');
  const sliderDurationFontSize = document.getElementById('sliderDurationFontSize');
  const inputDurationFontSize = document.getElementById('inputDurationFontSize');
  
  // 폰트 배율 요소들
  const sliderFontScale = document.getElementById('sliderFontScale');
  const inputFontScale = document.getElementById('inputFontScale');
  
  // 오버레이 크기 조정 요소들 (통합 최소 너비)
  const sliderUnifiedWidth = document.getElementById('sliderUnifiedWidth');
  const inputUnifiedWidth = document.getElementById('inputUnifiedWidth');
  const unifiedWidthControl = document.getElementById('unifiedWidthControl');
  
  // 개별 최소 너비 요소들 (고급 설정용)
  const sliderOverlayMinWidthAdvanced = document.getElementById('sliderOverlayMinWidthAdvanced');
  const inputOverlayMinWidthAdvanced = document.getElementById('inputOverlayMinWidthAdvanced');
  const minWidthControl = document.getElementById('minWidthControl');

  // 고급 설정 토글 요소들
  const toggleAdvancedSettingsInput = document.getElementById('toggleAdvancedSettings');

  // 설정 관리 버튼들
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');

  // 스트리밍 디스플레이 버튼들
  const openStreamingDisplayBtn = document.getElementById('openStreamingDisplayBtn');
  const copyVdoNinjaUrlBtn = document.getElementById('copyVdoNinjaUrlBtn');

  const videoTitleEl = document.getElementById('videoTitle');
  const videoSeriesEl = document.getElementById('videoSeries');
  const videoTimeEl = document.getElementById('videoTime');

  // Throttling을 위한 변수들
  let throttleTimeouts = {};
  
  function throttle(key, func, delay = 100) {
    if (throttleTimeouts[key]) {
      clearTimeout(throttleTimeouts[key]);
    }
    throttleTimeouts[key] = setTimeout(() => {
      func();
      delete throttleTimeouts[key];
    }, delay);
  }

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
      titleDisplayMode,
      overlayPositionSide,
      overlayTheme,
      overlayOffsetX,
      overlayOffsetY,
      seriesFontSize,
      episodeFontSize,
      currentTimeFontSize,
      durationFontSize,
      fontScale,
      overlayMinWidth,
      overlayLineSpacing,
      overlayPadding,
      showHostname,
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
        statusTextEl.textContent = '비디오 정보 가져오기 중지됨.';
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
      videoTimeEl.textContent = isFetchingActive ? '시간 정보 수신 중...' : 'N/A';
    }

    // 4. Update Toggle Switches
    if (toggleFetchingInput) {
      toggleFetchingInput.checked = isFetchingActive === true;
    }
    
    if (toggleVisibilityInput) {
      toggleVisibilityInput.checked = isOverlayVisible === true;
    }
    
    if (toggleCompactModeInput) {
      toggleCompactModeInput.checked = overlayMode === 'compact';
    }
    
    if (togglePositionInput) {
      togglePositionInput.checked = overlayPositionSide === 'left';
    }
    
    if (toggleShowHostnameInput) {
      toggleShowHostnameInput.checked = showHostname !== false;
    }
    
    // 5. Update Time Display Controls
    if (selectTimeDisplay) selectTimeDisplay.value = timeDisplayMode || 'current_duration';

    // 6. Update Title Display Controls
    if (selectTitleDisplay) selectTitleDisplay.value = titleDisplayMode || 'episode_series';

    // 7. Update Theme Controls
    if (selectTheme) selectTheme.value = overlayTheme || 'light';
    
    // 8. Update Offset Controls
    if (sliderUnifiedOffset && inputUnifiedOffset) {
      const unifiedValue = overlayOffsetX !== undefined ? overlayOffsetX : 8;
      sliderUnifiedOffset.value = unifiedValue;
      inputUnifiedOffset.value = unifiedValue;
    }
    
    if (sliderHorizontalOffset && inputHorizontalOffset) {
      const horizontalValue = overlayOffsetX !== undefined ? overlayOffsetX : 8;
      sliderHorizontalOffset.value = horizontalValue;
      inputHorizontalOffset.value = horizontalValue;
    }
    
    if (sliderVerticalOffset && inputVerticalOffset) {
      const verticalValue = overlayOffsetY !== undefined ? overlayOffsetY : 8;
      sliderVerticalOffset.value = verticalValue;
      inputVerticalOffset.value = verticalValue;
    }

    // 9. Update Width Controls (NEW)
    if (sliderUnifiedWidth && inputUnifiedWidth) {
      const unifiedWidthValue = overlayMinWidth !== undefined ? overlayMinWidth : 150;
      sliderUnifiedWidth.value = unifiedWidthValue;
      inputUnifiedWidth.value = unifiedWidthValue;
    }
    
    if (sliderOverlayMinWidthAdvanced && inputOverlayMinWidthAdvanced) {
      const minWidthAdvancedValue = overlayMinWidth !== undefined ? overlayMinWidth : 150;
      sliderOverlayMinWidthAdvanced.value = minWidthAdvancedValue;
      inputOverlayMinWidthAdvanced.value = minWidthAdvancedValue;
    }
    
    if (minWidthControl) minWidthControl.value = overlayMinWidth !== undefined ? overlayMinWidth : 150;

    // 10. Update Padding Controls (NEW)
    if (sliderUnifiedLineSpacing && inputUnifiedLineSpacing) {
      const unifiedLineSpacingValue = overlayLineSpacing !== undefined ? overlayLineSpacing : 2;
      sliderUnifiedLineSpacing.value = unifiedLineSpacingValue;
      inputUnifiedLineSpacing.value = unifiedLineSpacingValue;
    }
    
    if (sliderOverlayLineSpacingAdvanced && inputOverlayLineSpacingAdvanced) {
      const lineSpacingAdvancedValue = overlayLineSpacing !== undefined ? overlayLineSpacing : 2;
      sliderOverlayLineSpacingAdvanced.value = lineSpacingAdvancedValue;
      inputOverlayLineSpacingAdvanced.value = lineSpacingAdvancedValue;
    }

    // 11. Update Container Padding Controls (NEW)
    if (sliderContainerPadding && inputContainerPadding) {
      const containerPaddingValue = overlayPadding !== undefined ? overlayPadding : 8;
      sliderContainerPadding.value = containerPaddingValue;
      inputContainerPadding.value = containerPaddingValue;
    }

    // 12. Update Font Size Controls (NEW)
    if (sliderSeriesFontSize && inputSeriesFontSize) {
      const seriesValue = seriesFontSize !== undefined ? seriesFontSize : 10;
      sliderSeriesFontSize.value = seriesValue;
      inputSeriesFontSize.value = seriesValue;
    }
    
    if (sliderEpisodeFontSize && inputEpisodeFontSize) {
      const episodeValue = episodeFontSize !== undefined ? episodeFontSize : 14;
      sliderEpisodeFontSize.value = episodeValue;
      inputEpisodeFontSize.value = episodeValue;
    }
    
    if (sliderCurrentTimeFontSize && inputCurrentTimeFontSize) {
      const currentTimeValue = currentTimeFontSize !== undefined ? currentTimeFontSize : 14;
      sliderCurrentTimeFontSize.value = currentTimeValue;
      inputCurrentTimeFontSize.value = currentTimeValue;
    }
    
    if (sliderDurationFontSize && inputDurationFontSize) {
      const durationValue = durationFontSize !== undefined ? durationFontSize : 14;
      sliderDurationFontSize.value = durationValue;
      inputDurationFontSize.value = durationValue;
    }

    if (sliderFontScale && inputFontScale) {
      const scaleValue = fontScale !== undefined ? fontScale : 1.0;
      sliderFontScale.value = scaleValue;
      inputFontScale.value = scaleValue;
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
  
  // 토글 스위치 이벤트 리스너
  if (toggleFetchingInput) {
    toggleFetchingInput.addEventListener('change', () => {
      console.log("POPUP.JS: Fetching toggle clicked, new state:", toggleFetchingInput.checked);
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_FETCHING' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_FETCHING");
        if (response && response.success) {
          console.log("POPUP.JS: Fetching toggle successful");
          // requestInitialState() 제거 - background에서 BACKGROUND_STATE_UPDATE로 자동 전송됨
        }
      });
    });
  }
  
  if (toggleVisibilityInput) {
    toggleVisibilityInput.addEventListener('change', () => {
      console.log("POPUP.JS: Visibility toggle clicked, new state:", toggleVisibilityInput.checked);
      chrome.runtime.sendMessage({ type: 'POPUP_TOGGLE_VISIBILITY' }, (response) => {
        handleResponse(response, "POPUP_TOGGLE_VISIBILITY");
        if (response && response.success) {
          console.log("POPUP.JS: Visibility toggle successful");
          // requestInitialState() 제거 - background에서 BACKGROUND_STATE_UPDATE로 자동 전송됨
        }
      });
    });
  }
  
  if (toggleCompactModeInput) {
    toggleCompactModeInput.addEventListener('change', () => {
      const mode = toggleCompactModeInput.checked ? 'compact' : 'normal';
      console.log("POPUP.JS: Compact mode toggle clicked, new mode:", mode);
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MODE', mode: mode }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_MODE");
        if (response && response.success) {
          console.log("POPUP.JS: Compact mode toggle successful");
          // requestInitialState() 제거 - background에서 BACKGROUND_STATE_UPDATE로 자동 전송됨
        }
      });
    });
  }
  
  if (togglePositionInput) {
    togglePositionInput.addEventListener('change', () => {
      const position = togglePositionInput.checked ? 'left' : 'right';
      console.log("POPUP.JS: Position toggle clicked, new position:", position);
      chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_POSITION', position: position }, (response) => {
        handleResponse(response, "POPUP_SET_OVERLAY_POSITION");
        if (response && response.success) {
          console.log("POPUP.JS: Position toggle successful");
          // requestInitialState() 제거 - background에서 BACKGROUND_STATE_UPDATE로 자동 전송됨
        }
      });
    });
  }
  
  if (toggleShowHostnameInput) {
    toggleShowHostnameInput.addEventListener('change', () => {
      const showHostname = toggleShowHostnameInput.checked;
      console.log("POPUP.JS: Show hostname toggle clicked, new state:", showHostname);
      chrome.runtime.sendMessage({ type: 'POPUP_SET_SHOW_HOSTNAME', showHostname: showHostname }, (response) => {
        handleResponse(response, "POPUP_SET_SHOW_HOSTNAME");
        if (response && response.success) {
          console.log("POPUP.JS: Show hostname toggle successful");
          // requestInitialState() 제거 - background에서 BACKGROUND_STATE_UPDATE로 자동 전송됨
        }
      });
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

  // 슬라이더와 숫자 입력 연동 함수
  function syncSliderAndInput(slider, input, messageType, offsetType) {
    if (!slider || !input) return;

    // 슬라이더 변경 시 (throttled)
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      input.value = value;
      
      throttle(`${messageType}_${offsetType}`, () => {
        const message = { type: messageType };
        message[offsetType] = value;
        chrome.runtime.sendMessage(message, handleResponse);
      }, 50); // 50ms throttling
    });

    // 입력 필드 변경 시 (개선된 처리)
    input.addEventListener('input', () => {
      // 입력값이 비어있으면 처리하지 않음
      if (input.value === '') return;
      
      let value = parseFloat(input.value);
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      
      // 유효하지 않은 값이면 최소값으로 설정
      if (isNaN(value)) {
        value = min;
        input.value = value;
      }
      
      // 범위를 벗어나면 조정하되, 입력 중일 수 있으므로 즉시 수정하지 않음
      if (value < min) {
        value = min;
        input.value = value;
      } else if (value > max) {
        value = max;
        input.value = value;
      }
      
      slider.value = value;
      
      throttle(`${messageType}_${offsetType}`, () => {
        const message = { type: messageType };
        message[offsetType] = value;
        chrome.runtime.sendMessage(message, handleResponse);
      }, 100); // 100ms throttling for input
    });

    // blur 이벤트로 최종 검증
    input.addEventListener('blur', () => {
      let value = parseFloat(input.value);
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      
      if (isNaN(value) || value < min) {
        value = min;
      } else if (value > max) {
        value = max;
      }
      
      input.value = value;
      slider.value = value;
      
      const message = { type: messageType };
      message[offsetType] = value;
      chrome.runtime.sendMessage(message, handleResponse);
    });
  }

  // 슬라이더와 숫자 입력 연동 설정
  syncSliderAndInput(sliderHorizontalOffset, inputHorizontalOffset, 'POPUP_SET_OVERLAY_OFFSET_X', 'offsetX');
  syncSliderAndInput(sliderVerticalOffset, inputVerticalOffset, 'POPUP_SET_OVERLAY_OFFSET_Y', 'offsetY');
  syncSliderAndInput(sliderSeriesFontSize, inputSeriesFontSize, 'POPUP_SET_SERIES_FONT_SIZE', 'seriesFontSize');
  syncSliderAndInput(sliderEpisodeFontSize, inputEpisodeFontSize, 'POPUP_SET_EPISODE_FONT_SIZE', 'episodeFontSize');
  syncSliderAndInput(sliderCurrentTimeFontSize, inputCurrentTimeFontSize, 'POPUP_SET_CURRENT_TIME_FONT_SIZE', 'currentTimeFontSize');
  syncSliderAndInput(sliderDurationFontSize, inputDurationFontSize, 'POPUP_SET_DURATION_FONT_SIZE', 'durationFontSize');
  syncSliderAndInput(sliderFontScale, inputFontScale, 'POPUP_SET_FONT_SCALE', 'fontScale');
  syncSliderAndInput(sliderOverlayMinWidthAdvanced, inputOverlayMinWidthAdvanced, 'POPUP_SET_OVERLAY_MIN_WIDTH', 'overlayMinWidth');
  syncSliderAndInput(sliderOverlayLineSpacingAdvanced, inputOverlayLineSpacingAdvanced, 'POPUP_SET_OVERLAY_LINE_SPACING', 'overlayLineSpacing');
  syncSliderAndInput(sliderContainerPadding, inputContainerPadding, 'POPUP_SET_OVERLAY_PADDING', 'overlayPadding');

  // 특별한 슬라이더들 설정
  setupSpecialSliders();

  // 고급 설정 토글 기능
  if (toggleAdvancedSettingsInput && advancedContent) {
    // 초기 상태: 접힌 상태로 설정
    toggleAdvancedSettingsInput.checked = false;
    advancedContent.style.display = 'none';
    
    // 초기 상태에서 통합 컨트롤 표시, 개별 컨트롤 숨김
    if (unifiedOffsetControl) unifiedOffsetControl.style.display = 'block';
    if (horizontalOffsetControl) horizontalOffsetControl.style.display = 'none';
    if (verticalOffsetControl) verticalOffsetControl.style.display = 'none';
    
    if (unifiedWidthControl) unifiedWidthControl.style.display = 'block';
    if (minWidthControl) minWidthControl.style.display = 'none';
    
    if (unifiedLineSpacingControl) unifiedLineSpacingControl.style.display = 'block';
    if (lineSpacingControl) lineSpacingControl.style.display = 'none';
    
    toggleAdvancedSettingsInput.addEventListener('change', () => {
      const isAdvancedOn = toggleAdvancedSettingsInput.checked;
      
      if (isAdvancedOn) {
        // 고급 설정 열기
        advancedContent.style.display = 'block';
        
        // 통합 컨트롤 숨기고 개별 컨트롤 표시
        if (unifiedOffsetControl) unifiedOffsetControl.style.display = 'none';
        if (horizontalOffsetControl) horizontalOffsetControl.style.display = 'block';
        if (verticalOffsetControl) verticalOffsetControl.style.display = 'block';
        
        if (unifiedWidthControl) unifiedWidthControl.style.display = 'none';
        if (minWidthControl) minWidthControl.style.display = 'block';
        
        if (unifiedLineSpacingControl) unifiedLineSpacingControl.style.display = 'none';
        if (lineSpacingControl) lineSpacingControl.style.display = 'block';
      } else {
        // 고급 설정 닫기
        advancedContent.style.display = 'none';
        
        // 개별 컨트롤 숨기고 통합 컨트롤 표시
        if (unifiedOffsetControl) unifiedOffsetControl.style.display = 'block';
        if (horizontalOffsetControl) horizontalOffsetControl.style.display = 'none';
        if (verticalOffsetControl) verticalOffsetControl.style.display = 'none';
        
        if (unifiedWidthControl) unifiedWidthControl.style.display = 'block';
        if (minWidthControl) minWidthControl.style.display = 'none';
        
        if (unifiedLineSpacingControl) unifiedLineSpacingControl.style.display = 'block';
        if (lineSpacingControl) lineSpacingControl.style.display = 'none';
      }
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
        overlayOffsetX: 8, overlayOffsetY: 8,
        seriesFontSize: 10, episodeFontSize: 14,
        currentTimeFontSize: 14,
        durationFontSize: 14,
        fontScale: 1.0,
        overlayMinWidth: 150,
        overlayLineSpacing: 2,
        overlayPadding: 8,
        showHostname: true,
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

  // 특별한 슬라이더들을 위한 별도 함수
  function setupSpecialSliders() {
    // 통합 여백 슬라이더
    if (sliderUnifiedOffset && inputUnifiedOffset) {
      sliderUnifiedOffset.addEventListener('input', () => {
        const value = parseInt(sliderUnifiedOffset.value);
        inputUnifiedOffset.value = value;
        
        throttle('unified_offset', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_OFFSET_X', offsetX: value }, handleResponse);
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_OFFSET_Y', offsetY: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderHorizontalOffset && inputHorizontalOffset) {
            sliderHorizontalOffset.value = value;
            inputHorizontalOffset.value = value;
          }
          if (sliderVerticalOffset && inputVerticalOffset) {
            sliderVerticalOffset.value = value;
            inputVerticalOffset.value = value;
          }
        }, 50);
      });
      
      inputUnifiedOffset.addEventListener('input', () => {
        let value = Math.max(0, Math.min(100, parseInt(inputUnifiedOffset.value) || 0));
        inputUnifiedOffset.value = value;
        sliderUnifiedOffset.value = value;
        
        throttle('unified_offset', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_OFFSET_X', offsetX: value }, handleResponse);
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_OFFSET_Y', offsetY: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderHorizontalOffset && inputHorizontalOffset) {
            sliderHorizontalOffset.value = value;
            inputHorizontalOffset.value = value;
          }
          if (sliderVerticalOffset && inputVerticalOffset) {
            sliderVerticalOffset.value = value;
            inputVerticalOffset.value = value;
          }
        }, 100);
      });
    }
    
    // 통합 너비 슬라이더 (최소 너비)
    if (sliderUnifiedWidth && inputUnifiedWidth) {
      sliderUnifiedWidth.addEventListener('input', () => {
        const value = parseInt(sliderUnifiedWidth.value);
        inputUnifiedWidth.value = value;
        
        throttle('unified_width', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MIN_WIDTH', overlayMinWidth: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderOverlayMinWidthAdvanced && inputOverlayMinWidthAdvanced) {
            sliderOverlayMinWidthAdvanced.value = value;
            inputOverlayMinWidthAdvanced.value = value;
          }
        }, 50);
      });
      
      inputUnifiedWidth.addEventListener('input', () => {
        if (inputUnifiedWidth.value === '') return;
        
        let value = Math.max(50, Math.min(800, parseInt(inputUnifiedWidth.value) || 150));
        inputUnifiedWidth.value = value;
        sliderUnifiedWidth.value = value;
        
        throttle('unified_width', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MIN_WIDTH', overlayMinWidth: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderOverlayMinWidthAdvanced && inputOverlayMinWidthAdvanced) {
            sliderOverlayMinWidthAdvanced.value = value;
            inputOverlayMinWidthAdvanced.value = value;
          }
        }, 100);
      });

      inputUnifiedWidth.addEventListener('blur', () => {
        let value = Math.max(50, Math.min(800, parseInt(inputUnifiedWidth.value) || 150));
        inputUnifiedWidth.value = value;
        sliderUnifiedWidth.value = value;
        chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_MIN_WIDTH', overlayMinWidth: value }, handleResponse);
      });
    }
    
    // 통합 줄간격 슬라이더
    if (sliderUnifiedLineSpacing && inputUnifiedLineSpacing) {
      sliderUnifiedLineSpacing.addEventListener('input', () => {
        const value = parseInt(sliderUnifiedLineSpacing.value);
        inputUnifiedLineSpacing.value = value;
        
        throttle('unified_padding', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_LINE_SPACING', overlayLineSpacing: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderOverlayLineSpacingAdvanced && inputOverlayLineSpacingAdvanced) {
            sliderOverlayLineSpacingAdvanced.value = value;
            inputOverlayLineSpacingAdvanced.value = value;
          }
        }, 50);
      });
      
      inputUnifiedLineSpacing.addEventListener('input', () => {
        if (inputUnifiedLineSpacing.value === '') return;
        
        let value = Math.max(-5, Math.min(10, parseInt(inputUnifiedLineSpacing.value) || 2));
        inputUnifiedLineSpacing.value = value;
        sliderUnifiedLineSpacing.value = value;
        
        throttle('unified_padding', () => {
          chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_LINE_SPACING', overlayLineSpacing: value }, handleResponse);
          
          // 개별 슬라이더 동기화
          if (sliderOverlayLineSpacingAdvanced && inputOverlayLineSpacingAdvanced) {
            sliderOverlayLineSpacingAdvanced.value = value;
            inputOverlayLineSpacingAdvanced.value = value;
          }
        }, 100);
      });

      inputUnifiedLineSpacing.addEventListener('blur', () => {
        let value = Math.max(-5, Math.min(10, parseInt(inputUnifiedLineSpacing.value) || 2));
        inputUnifiedLineSpacing.value = value;
        sliderUnifiedLineSpacing.value = value;
        chrome.runtime.sendMessage({ type: 'POPUP_SET_OVERLAY_LINE_SPACING', overlayLineSpacing: value }, handleResponse);
      });
    }
  }

  // --- 설정 관리 함수들 ---
  function saveCurrentSettings() {
    chrome.runtime.sendMessage({ type: 'GET_ALL_SETTINGS' }, (response) => {
      if (response && response.success) {
        const settings = response.settings;
        const timestamp = new Date().toLocaleString('ko-KR');
        const settingsData = {
          ...settings,
          savedAt: timestamp,
          version: '1.0'
        };
        
        // localStorage에 저장
        try {
          localStorage.setItem('wp_overlay_saved_settings', JSON.stringify(settingsData));
          showNotification('설정이 저장되었습니다!', 'success');
        } catch (e) {
          showNotification('설정 저장에 실패했습니다.', 'error');
          console.error('Settings save error:', e);
        }
      } else {
        showNotification('현재 설정을 가져올 수 없습니다.', 'error');
      }
    });
  }

  function resetToDefaultSettings() {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      chrome.runtime.sendMessage({ type: 'RESET_ALL_SETTINGS' }, (response) => {
        if (response && response.success) {
          showNotification('설정이 초기화되었습니다!', 'success');
          // background.js의 broadcastStateToAllTabs()가 자동으로 상태를 전송함
        } else {
          showNotification('설정 초기화에 실패했습니다.', 'error');
        }
      });
    }
  }

  function loadSavedSettings() {
    try {
      const savedData = localStorage.getItem('wp_overlay_saved_settings');
      if (savedData) {
        const settings = JSON.parse(savedData);
        if (confirm(`저장된 설정을 불러오시겠습니까?\n\n저장 시간: ${settings.savedAt || '알 수 없음'}`)) {
          chrome.runtime.sendMessage({ type: 'LOAD_SETTINGS', settings: settings }, (response) => {
            if (response && response.success) {
              showNotification('설정이 불러와졌습니다!', 'success');
              // background.js의 broadcastStateToAllTabs()가 자동으로 상태를 전송함
            } else {
              showNotification('설정 불러오기에 실패했습니다.', 'error');
            }
          });
        }
      } else {
        showNotification('저장된 설정이 없습니다.', 'info');
      }
    } catch (e) {
      showNotification('저장된 설정을 읽을 수 없습니다.', 'error');
      console.error('Settings load error:', e);
    }
  }

  function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 250px;
      word-wrap: break-word;
    `;

    // 타입별 색상 설정
    switch (type) {
      case 'success':
        notification.style.background = 'rgba(76, 175, 80, 0.9)';
        break;
      case 'error':
        notification.style.background = 'rgba(244, 67, 54, 0.9)';
        break;
      case 'info':
      default:
        notification.style.background = 'rgba(33, 150, 243, 0.9)';
        break;
    }

    // 애니메이션 CSS 추가
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // 3초 후 자동 제거
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  // 설정 관리 버튼 이벤트 리스너
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveCurrentSettings);
  }
  
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', resetToDefaultSettings);
  }
  
  // 저장 버튼 더블클릭 시 설정 불러오기 (숨겨진 기능)
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('dblclick', loadSavedSettings);
  }

  // --- 스트리밍 디스플레이 기능 ---
  let streamingDisplayTabId = null;
  let streamingDisplayUrl = null;

  // 스트리밍 디스플레이 탭 열기
  if (openStreamingDisplayBtn) {
    openStreamingDisplayBtn.addEventListener('click', async () => {
      try {
        // Background script를 통해 새 창 생성 요청
        const response = await chrome.runtime.sendMessage({
          type: 'OPEN_STREAMING_DISPLAY_WINDOW'
        });
        
        if (response && response.success) {
          streamingDisplayTabId = response.windowId;
          streamingDisplayUrl = response.url;
          
          // VDO.Ninja URL 생성 및 표시
          const vdoNinjaUrl = generateVdoNinjaUrl(streamingDisplayUrl);
          
          // 버튼 텍스트 변경
          openStreamingDisplayBtn.textContent = '✅ 스트리밍 디스플레이 열림';
          openStreamingDisplayBtn.style.background = 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)';
          
          // VDO.Ninja URL 복사 버튼 표시
          if (copyVdoNinjaUrlBtn) {
            copyVdoNinjaUrlBtn.style.display = 'block';
            copyVdoNinjaUrlBtn.dataset.vdoUrl = vdoNinjaUrl;
          }
          
          showNotification('스트리밍 디스플레이 창이 열렸습니다!', 'success');
        } else {
          throw new Error(response?.error || '스트리밍 디스플레이 창 생성 실패');
        }
        
      } catch (error) {
        console.error('스트리밍 디스플레이 탭 생성 실패:', error);
        showNotification('스트리밍 디스플레이 탭 생성에 실패했습니다.', 'error');
      }
    });
  }

  // VDO.Ninja URL 복사
  if (copyVdoNinjaUrlBtn) {
    copyVdoNinjaUrlBtn.addEventListener('click', async () => {
      try {
        const vdoUrl = copyVdoNinjaUrlBtn.dataset.vdoUrl;
        if (vdoUrl) {
          await navigator.clipboard.writeText(vdoUrl);
          
          // 버튼 피드백
          const originalText = copyVdoNinjaUrlBtn.textContent;
          copyVdoNinjaUrlBtn.textContent = '📋 복사됨!';
          copyVdoNinjaUrlBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
          
          setTimeout(() => {
            copyVdoNinjaUrlBtn.textContent = originalText;
            copyVdoNinjaUrlBtn.style.background = 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)';
          }, 2000);
          
          showNotification('VDO.Ninja URL이 클립보드에 복사되었습니다!', 'success');
        } else {
          showNotification('먼저 스트리밍 디스플레이를 열어주세요.', 'info');
        }
      } catch (error) {
        console.error('URL 복사 실패:', error);
        showNotification('URL 복사에 실패했습니다.', 'error');
      }
    });
  }

  // VDO.Ninja URL 생성 함수
  function generateVdoNinjaUrl(displayUrl) {
    const roomName = `wp-overlay-${Date.now()}`;
    // VDO.Ninja 송신 URL (원본 컴퓨터에서 사용)
    const pushUrl = `https://vdo.ninja/?push=${roomName}&website=${encodeURIComponent(displayUrl)}&autostart&cleanoutput`;
    // VDO.Ninja 수신 URL (방송 컴퓨터 OBS에서 사용)
    const viewUrl = `https://vdo.ninja/?view=${roomName}&autostart&transparent`;
    
    console.log('VDO.Ninja URLs generated:');
    console.log('- Push URL (원본 컴퓨터):', pushUrl);
    console.log('- View URL (방송 컴퓨터 OBS):', viewUrl);
    
    return pushUrl; // 기본적으로 송신 URL 반환
  }

  // 윈도우 닫힘 감지 및 상태 초기화
  chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === streamingDisplayTabId) {
      streamingDisplayTabId = null;
      streamingDisplayUrl = null;
      
      // 버튼 상태 초기화
      if (openStreamingDisplayBtn) {
        openStreamingDisplayBtn.textContent = '📺 스트리밍 디스플레이 열기';
        openStreamingDisplayBtn.style.background = 'linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)';
      }
      
      // VDO.Ninja URL 복사 버튼 숨기기
      if (copyVdoNinjaUrlBtn) {
        copyVdoNinjaUrlBtn.style.display = 'none';
      }
    }
  });

  // 페이지 로드 시 기존 스트리밍 디스플레이 창 확인
  chrome.tabs.query({ url: chrome.runtime.getURL('public/overlay-display.html') }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      streamingDisplayTabId = tab.windowId; // Use windowId instead of tab.id
      streamingDisplayUrl = tab.url;
      
      // 버튼 상태 업데이트
      if (openStreamingDisplayBtn) {
        openStreamingDisplayBtn.textContent = '✅ 스트리밍 디스플레이 열림';
        openStreamingDisplayBtn.style.background = 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)';
      }
      
      // VDO.Ninja URL 복사 버튼 표시
      if (copyVdoNinjaUrlBtn) {
        copyVdoNinjaUrlBtn.style.display = 'block';
        copyVdoNinjaUrlBtn.dataset.vdoUrl = generateVdoNinjaUrl(streamingDisplayUrl);
      }
    }
  });
}); 