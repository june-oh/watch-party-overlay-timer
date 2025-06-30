// Music Player Style Overlay Display JavaScript
class OverlayDisplayManager {
    constructor() {
        this.isOverlayVisible = false;
        this.displayMode = 'normal';
        this.timeDisplayMode = 'current_duration';
        this.overlayPosition = 'right';
        this.currentVideoInfo = null;
        this.sourceTabId = null;
        this.lastUpdateTime = null;
        this.isExpanded = false;
        
        // Customization settings
        this.customSettings = {
            bgColor: '#000000',
            bgOpacity: 90,
            textColor: '#ffffff',
            accentColor: '#00ff88',
            borderRadius: 0, // 곡률 제거
            episodeFontSize: 16,
            seriesFontSize: 11,
            timeFontSize: 14,
            windowHeight: 100, // Chrome 최소 높이에 맞춤
            displayMode: 'normal'
        };
        
        // Main UI elements
        this.videoBarContainer = document.getElementById('video-bar-container');
        this.mainBar = document.getElementById('main-bar');
        
        // Normal mode elements
        this.normalModeContainer = document.getElementById('normal-mode-container');
        this.episodeTitle = document.getElementById('episode-title');
        this.seriesTitle = document.getElementById('series-title');
        this.siteName = document.getElementById('site-name');
        this.currentTime = document.getElementById('current-time');
        this.durationTime = document.getElementById('duration-time');
        this.progressBar = document.getElementById('progress-bar');
        this.progressFill = document.getElementById('progress-fill');
        
        // Compact mode elements
        this.compactModeContainer = document.getElementById('compact-mode-container');
        this.compactEpisodeTitle = document.getElementById('compact-episode-title');
        this.compactCurrentTime = document.getElementById('compact-current-time');
        this.compactDurationTime = document.getElementById('compact-duration-time');
        
        // Controls
        this.expandBar = document.getElementById('expand-bar');
        this.expandArrow = document.getElementById('expand-arrow');
        this.expandedPanel = document.getElementById('expanded-panel');
        
        // Settings elements
        this.displayModeSelect = document.getElementById('display-mode-select');
        this.timeDisplaySelect = document.getElementById('time-display-select');
        this.windowHeightSlider = document.getElementById('window-height-slider');
        this.windowHeightValue = document.getElementById('window-height-value');
        
        // Customization elements
        this.bgColorPicker = document.getElementById('bg-color-picker');
        this.bgOpacitySlider = document.getElementById('bg-opacity-slider');
        this.bgOpacityValue = document.getElementById('bg-opacity-value');
        this.textColorPicker = document.getElementById('text-color-picker');
        this.accentColorPicker = document.getElementById('accent-color-picker');
        this.borderRadiusSlider = document.getElementById('border-radius-slider');
        this.borderRadiusValue = document.getElementById('border-radius-value');
        this.episodeFontSizeSlider = document.getElementById('episode-font-size-slider');
        this.episodeFontSizeValue = document.getElementById('episode-font-size-value');
        this.seriesFontSizeSlider = document.getElementById('series-font-size-slider');
        this.seriesFontSizeValue = document.getElementById('series-font-size-value');
        this.timeFontSizeSlider = document.getElementById('time-font-size-slider');
        this.timeFontSizeValue = document.getElementById('time-font-size-value');
        this.resetAppearanceBtn = document.getElementById('reset-appearance-btn');
        this.applyAppearanceBtn = document.getElementById('apply-appearance-btn');
        
        // Status elements
        this.connectionStatusDetail = document.getElementById('connection-status-detail');
        this.sourceTab = document.getElementById('source-tab');
        this.lastUpdate = document.getElementById('last-update');
        
        this.init();
    }
    
    init() {
        this.loadCustomSettings();
        this.setupEventListeners();
        this.setupCustomizationListeners();
        this.updateCustomizationUI();
        this.applyCustomStyles();
        this.updateDisplayMode();
        this.updateConnectionStatus('connecting');
        this.connectToExtension();
        
        // Start listening for extension messages
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleExtensionMessage(message, sender, sendResponse);
            });
        }
        
        // Start periodic state updates
        this.startPeriodicUpdates();
    }
    
    startPeriodicUpdates() {
        // Request state updates every 2 seconds
        setInterval(async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'REQUEST_OVERLAY_STATE'
                });
                
                console.log('Periodic update response:', response);
                
                if (response && response.success && response.data) {
                    this.handleStateUpdate(response.data);
                    this.updateConnectionStatus('connected');
                } else {
                    console.warn('Failed to get state:', response);
                    this.updateConnectionStatus('disconnected');
                }
            } catch (error) {
                console.error('Periodic update error:', error);
                this.updateConnectionStatus('disconnected');
            }
        }, 2000);
    }
    
    setupEventListeners() {
        // Expand bar
        if (this.expandBar && this.expandedPanel) {
            this.expandBar.addEventListener('click', () => {
                this.toggleExpandedPanel();
            });
        }
        
        // Help section toggle
        const helpHeader = document.querySelector('.collapsible-header');
        const helpContent = document.getElementById('help-content');
        const helpToggle = document.getElementById('help-toggle');
        
        if (helpHeader && helpContent && helpToggle) {
            helpHeader.addEventListener('click', () => {
                const isHidden = helpContent.style.display === 'none';
                helpContent.style.display = isHidden ? 'block' : 'none';
                helpToggle.textContent = isHidden ? '▼' : '▶';
            });
        }
        
        // VDO.Ninja button
        const vdoNinjaBtn = document.getElementById('open-vdo-ninja-btn');
        if (vdoNinjaBtn) {
            vdoNinjaBtn.addEventListener('click', () => {
                window.open('https://vdo.ninja/', '_blank');
            });
        }
        

        
        // Settings change handlers
        if (this.displayModeSelect) {
            this.displayModeSelect.addEventListener('change', (e) => {
                this.displayMode = e.target.value;
                this.updateDisplayMode();
                this.saveCustomSettings();
            });
        }
        
        if (this.timeDisplaySelect) {
            this.timeDisplaySelect.addEventListener('change', (e) => {
                this.timeDisplayMode = e.target.value;
                this.updateTimeDisplay();
                this.updateDisplayMode();
                this.sendSettingsToExtension();
            });
        }
        
        // Window height slider
        if (this.windowHeightSlider) {
            this.windowHeightSlider.addEventListener('input', () => {
                const height = parseInt(this.windowHeightSlider.value);
                this.windowHeightValue.textContent = height + 'px';
                this.customSettings.windowHeight = height;
                // CSS variable update
                document.documentElement.style.setProperty('--window-height', height + 'px');
                // Apply immediately for preview
                this.applyCustomStyles();
            });
        }
    }
    
    setupCustomizationListeners() {
        // Background color and opacity
        if (this.bgColorPicker) {
            this.bgColorPicker.addEventListener('input', () => {
                this.customSettings.bgColor = this.bgColorPicker.value;
                this.applyCustomStyles();
            });
        }
        
        if (this.bgOpacitySlider) {
            this.bgOpacitySlider.addEventListener('input', () => {
                this.customSettings.bgOpacity = parseInt(this.bgOpacitySlider.value);
                this.bgOpacityValue.textContent = this.customSettings.bgOpacity + '%';
                this.applyCustomStyles();
            });
        }
        
        // Text color
        if (this.textColorPicker) {
            this.textColorPicker.addEventListener('input', () => {
                this.customSettings.textColor = this.textColorPicker.value;
                this.applyCustomStyles();
            });
        }
        
        // Accent color
        if (this.accentColorPicker) {
            this.accentColorPicker.addEventListener('input', () => {
                this.customSettings.accentColor = this.accentColorPicker.value;
                this.applyCustomStyles();
            });
        }
        
        // Border radius
        if (this.borderRadiusSlider) {
            this.borderRadiusSlider.addEventListener('input', () => {
                this.customSettings.borderRadius = parseInt(this.borderRadiusSlider.value);
                this.borderRadiusValue.textContent = this.customSettings.borderRadius + 'px';
                this.applyCustomStyles();
            });
        }
        
        // Font sizes
        if (this.episodeFontSizeSlider) {
            this.episodeFontSizeSlider.addEventListener('input', () => {
                this.customSettings.episodeFontSize = parseInt(this.episodeFontSizeSlider.value);
                this.episodeFontSizeValue.textContent = this.customSettings.episodeFontSize + 'px';
                this.applyCustomStyles();
            });
        }
        
        if (this.seriesFontSizeSlider) {
            this.seriesFontSizeSlider.addEventListener('input', () => {
                this.customSettings.seriesFontSize = parseInt(this.seriesFontSizeSlider.value);
                this.seriesFontSizeValue.textContent = this.customSettings.seriesFontSize + 'px';
                this.applyCustomStyles();
            });
        }
        
        if (this.timeFontSizeSlider) {
            this.timeFontSizeSlider.addEventListener('input', () => {
                this.customSettings.timeFontSize = parseInt(this.timeFontSizeSlider.value);
                this.timeFontSizeValue.textContent = this.customSettings.timeFontSize + 'px';
                this.applyCustomStyles();
            });
        }
        
        // Buttons
        if (this.resetAppearanceBtn) {
            this.resetAppearanceBtn.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
        
        if (this.applyAppearanceBtn) {
            this.applyAppearanceBtn.addEventListener('click', () => {
                this.saveCustomSettings();
                this.showApplySuccess();
            });
        }
    }
    
    loadCustomSettings() {
        try {
            const saved = localStorage.getItem('overlay-custom-settings');
            if (saved) {
                this.customSettings = { ...this.customSettings, ...JSON.parse(saved) };
                this.displayMode = this.customSettings.displayMode || 'normal';
                console.log('Loaded custom settings:', this.customSettings);
            }
        } catch (error) {
            console.error('Failed to load custom settings:', error);
        }
    }
    
    saveCustomSettings() {
        try {
            this.customSettings.displayMode = this.displayMode;
            localStorage.setItem('overlay-custom-settings', JSON.stringify(this.customSettings));
            console.log('Saved custom settings:', this.customSettings);
        } catch (error) {
            console.error('Failed to save custom settings:', error);
        }
    }
    
    updateCustomizationUI() {
        if (this.displayModeSelect) this.displayModeSelect.value = this.displayMode;
        if (this.bgColorPicker) this.bgColorPicker.value = this.customSettings.bgColor;
        if (this.bgOpacitySlider) {
            this.bgOpacitySlider.value = this.customSettings.bgOpacity;
            this.bgOpacityValue.textContent = this.customSettings.bgOpacity + '%';
        }
        if (this.textColorPicker) this.textColorPicker.value = this.customSettings.textColor;
        if (this.accentColorPicker) this.accentColorPicker.value = this.customSettings.accentColor;
        if (this.borderRadiusSlider) {
            this.borderRadiusSlider.value = this.customSettings.borderRadius;
            this.borderRadiusValue.textContent = this.customSettings.borderRadius + 'px';
        }
        if (this.episodeFontSizeSlider) {
            this.episodeFontSizeSlider.value = this.customSettings.episodeFontSize;
            this.episodeFontSizeValue.textContent = this.customSettings.episodeFontSize + 'px';
        }
        if (this.seriesFontSizeSlider) {
            this.seriesFontSizeSlider.value = this.customSettings.seriesFontSize;
            this.seriesFontSizeValue.textContent = this.customSettings.seriesFontSize + 'px';
        }
        if (this.timeFontSizeSlider) {
            this.timeFontSizeSlider.value = this.customSettings.timeFontSize;
            this.timeFontSizeValue.textContent = this.customSettings.timeFontSize + 'px';
        }
        if (this.windowHeightSlider) {
            this.windowHeightSlider.value = this.customSettings.windowHeight;
            this.windowHeightValue.textContent = this.customSettings.windowHeight + 'px';
        }
    }
    
    applyCustomStyles() {
        const root = document.documentElement;
        
        // Convert hex color to rgba
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        const bgRgb = hexToRgb(this.customSettings.bgColor);
        const bgOpacity = this.customSettings.bgOpacity / 100;
        
        // Apply CSS variables
        root.style.setProperty('--bg-color', `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${bgOpacity})`);
        root.style.setProperty('--text-color', this.customSettings.textColor);
        root.style.setProperty('--accent-color', this.customSettings.accentColor);
        root.style.setProperty('--progress-fill', this.customSettings.accentColor);
        root.style.setProperty('--border-radius', this.customSettings.borderRadius + 'px');
        root.style.setProperty('--font-size-episode', this.customSettings.episodeFontSize + 'px');
        root.style.setProperty('--font-size-series', this.customSettings.seriesFontSize + 'px');
        root.style.setProperty('--font-size-time', this.customSettings.timeFontSize + 'px');
        root.style.setProperty('--window-height', this.customSettings.windowHeight + 'px');
    }
    
    resetToDefaults() {
        this.customSettings = {
            bgColor: '#000000',
            bgOpacity: 90,
            textColor: '#ffffff',
            accentColor: '#00ff88',
            borderRadius: 0, // 곡률 제거
            episodeFontSize: 16,
            seriesFontSize: 11,
            timeFontSize: 14,
            windowHeight: 100, // Chrome 최소 높이에 맞춤
            displayMode: 'normal'
        };
        this.displayMode = 'normal';
        this.updateCustomizationUI();
        this.applyCustomStyles();
        this.updateDisplayMode();
    }
    
    showApplySuccess() {
        const originalText = this.applyAppearanceBtn.textContent;
        this.applyAppearanceBtn.textContent = '✓ Saved';
        this.applyAppearanceBtn.style.background = '#00ff88';
        
        setTimeout(() => {
            this.applyAppearanceBtn.textContent = originalText;
            this.applyAppearanceBtn.style.background = '';
        }, 1500);
    }
    
    toggleExpandedPanel() {
        const isCollapsed = this.expandedPanel.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand panel
            this.expandedPanel.classList.remove('collapsed');
            this.expandBar.classList.add('expanded');
            if (this.expandArrow) {
                this.expandArrow.textContent = '▲';
            }
            this.isExpanded = true;
            
            // Resize window to accommodate expanded content
            this.resizeWindow(600, 650);
        } else {
            // Collapse panel
            this.expandedPanel.classList.add('collapsed');
            this.expandBar.classList.remove('expanded');
            if (this.expandArrow) {
                this.expandArrow.textContent = '▼';
            }
            this.isExpanded = false;
            
            // Resize window back to custom height based on display mode
            const baseHeight = this.displayMode === 'compact' ? 80 : 100;
            this.resizeWindow(this.displayMode === 'compact' ? 450 : 600, baseHeight + 40); // 컨텐츠 + 화살표(10px) + 타이틀바(30px)
        }
    }
    
    resizeWindow(width, height) {
        // Send message to background to resize window
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'RESIZE_STREAMING_DISPLAY_WINDOW',
                width: width,
                height: height
            }).catch(error => {
                console.log('Window resize not supported:', error);
            });
        }
    }
    

    
    async connectToExtension() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // Send connection message to background script
                const response = await chrome.runtime.sendMessage({
                    type: 'OVERLAY_DISPLAY_CONNECT'
                });
                
                console.log('Connection response:', response);
                
                if (response && response.success) {
                    this.updateConnectionStatus('connected');
                    console.log('Connected to extension successfully');
                    
                    // Handle initial state if provided
                    if (response.initialState) {
                        console.log('Received initial state:', response.initialState);
                        this.handleStateUpdate(response.initialState);
                    }
                } else {
                    this.updateConnectionStatus('disconnected');
                    console.log('Connection failed:', response);
                }
            } else {
                this.updateConnectionStatus('disconnected');
                console.warn('Chrome extension API not available');
            }
        } catch (error) {
            console.error('Failed to connect to extension:', error);
            this.updateConnectionStatus('disconnected');
        }
    }
    
    handleExtensionMessage(message, sender, sendResponse) {
        console.log('Received message:', message);
        
        switch (message.type) {
            case 'VIDEO_INFO_UPDATE':
                this.handleVideoInfoUpdate(message.data);
                sendResponse({ success: true });
                break;
            case 'STATE_UPDATE':
            case 'BACKGROUND_STATE_UPDATE':  // Handle both message types
                this.handleStateUpdate(message.data);
                sendResponse({ success: true });
                break;
            default:
                console.log('Unknown message type:', message.type);
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }
    
    handleVideoInfoUpdate(videoInfo) {
        console.log('Video info update:', videoInfo);
        this.currentVideoInfo = videoInfo;
        this.lastUpdateTime = new Date();
        this.updateOverlayContent(videoInfo);
        this.updateStatusDisplay();
    }
    
    handleStateUpdate(state) {
        console.log('Handling state update:', state);
        

        
        if (state.timeDisplayMode) {
            this.timeDisplayMode = state.timeDisplayMode;
            if (this.timeDisplaySelect) {
                this.timeDisplaySelect.value = this.timeDisplayMode;
            }
            this.updateTimeDisplay();
        }
        
        if (state.overlayPositionSide) {
            this.overlayPosition = state.overlayPositionSide;
        }
        
        if (state.lastVideoInfo) {
            console.log('Updating video info:', state.lastVideoInfo);
            this.handleVideoInfoUpdate(state.lastVideoInfo);
        } else {
            console.log('No video info available');
            // Update with placeholder text when no info is available
            this.updateOverlayContent();
        }
        
        this.updateStatusDisplay();
    }
    
    updateOverlayContent(videoInfo = null) {
        const info = videoInfo || this.currentVideoInfo || {};
        
        // Update title elements (episode title is main, series is sub)
        if (this.episodeTitle) {
            this.episodeTitle.textContent = info.episode || '에피소드 정보를 가져오는 중...';
        }
        
        if (this.compactEpisodeTitle) {
            this.compactEpisodeTitle.textContent = info.episode || '에피소드 정보를 가져오는 중...';
        }
        
        if (this.seriesTitle) {
            // 빈 문자열인 경우 의도적으로 빈 상태로 유지하여 CSS의 :empty 규칙이 작동하도록 함
            if (info.series === "") {
                this.seriesTitle.textContent = "";
                this.seriesTitle.setAttribute('data-empty', 'true');
            } else if (info.series) {
                this.seriesTitle.textContent = info.series;
                this.seriesTitle.removeAttribute('data-empty');
            } else {
                this.seriesTitle.textContent = '시리즈 정보 없음';
                this.seriesTitle.removeAttribute('data-empty');
            }
        }
        
        if (this.siteName) {
            this.siteName.textContent = info.siteName || '사이트 정보 없음';
        }
        
        // Update time displays
        this.updateTimeDisplay(info);
        
        // Update progress bar
        if (info.currentSeconds && info.durationSeconds) {
            this.updateProgressBar(info.currentSeconds, info.durationSeconds);
        }
        
        // Update display mode
        this.updateDisplayMode();
    }
    
    updateProgressBar(currentSeconds, durationSeconds) {
        if (this.progressFill && durationSeconds > 0) {
            const percentage = (currentSeconds / durationSeconds) * 100;
            this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
    }
    
    updateTimeDisplay(info = null) {
        const videoInfo = info || this.currentVideoInfo || {};
        
        // Update time elements based on timeDisplayMode
        if (this.currentTime) {
            this.currentTime.textContent = this.formatTime(videoInfo.currentSeconds || 0);
        }
        if (this.compactCurrentTime) {
            this.compactCurrentTime.textContent = this.formatTime(videoInfo.currentSeconds || 0);
        }
        
        if (this.durationTime) {
            this.durationTime.textContent = this.formatTime(videoInfo.durationSeconds || 0);
        }
        if (this.compactDurationTime) {
            this.compactDurationTime.textContent = this.formatTime(videoInfo.durationSeconds || 0);
        }
        
        // Handle different time display modes
        const timeDisplay = document.getElementById('time-display');
        const compactTimeDisplay = document.getElementById('compact-time-display');
        const timeSeparator = document.getElementById('time-separator');
        const compactTimeSeparator = document.getElementById('compact-time-separator');
        
        const updateTimeMode = (display, separator, duration) => {
            if (!display) return;
            
            switch (this.timeDisplayMode) {
                case 'current_duration':
                    display.style.display = '';
                    if (separator) separator.style.display = 'inline';
                    if (duration) duration.style.display = 'inline';
                    break;
                case 'current_only':
                    display.style.display = '';
                    if (separator) separator.style.display = 'none';
                    if (duration) duration.style.display = 'none';
                    break;
                case 'none':
                    display.style.display = 'none';
                    break;
            }
        };
        
        updateTimeMode(timeDisplay, timeSeparator, this.durationTime);
        updateTimeMode(compactTimeDisplay, compactTimeSeparator, this.compactDurationTime);
    }
    
    updateDisplayMode() {
        if (this.displayMode === 'compact') {
            this.normalModeContainer.style.display = 'none';
            this.compactModeContainer.style.display = 'flex';
            
            // 컴팩트 모드일 때 높이 조정
            document.documentElement.style.setProperty('--window-height', '80px');
            document.getElementById('main-bar').style.height = '80px';
            
            // 컴팩트 모드일 때 창 크기 조정 (타이틀바 포함)
            if (!this.isExpanded) {
                this.resizeWindow(450, 120); // 80px 컨텐츠 + 10px 화살표 + 30px 타이틀바
            }
        } else {
            this.normalModeContainer.style.display = 'flex';
            this.compactModeContainer.style.display = 'none';
            
            // 일반 모드일 때 높이 조정
            document.documentElement.style.setProperty('--window-height', '100px');
            document.getElementById('main-bar').style.height = '100px';
            
            // 일반 모드일 때 창 크기 조정 (타이틀바 포함)
            if (!this.isExpanded) {
                this.resizeWindow(600, 140); // 100px 컨텐츠 + 10px 화살표 + 30px 타이틀바
            }
        }
    }
    
    updateConnectionStatus(status) {
        if (this.connectionStatusDetail) {
            this.connectionStatusDetail.textContent = status === 'connected' ? '연결됨' : 
                                                   status === 'connecting' ? '연결 중...' : '연결 끊김';
        }
    }
    
    updateStatusDisplay() {
        if (this.sourceTab) {
            this.sourceTab.textContent = this.sourceTabId ? `Tab ${this.sourceTabId}` : 'None';
        }
        
        if (this.lastUpdate) {
            this.lastUpdate.textContent = this.lastUpdateTime ? 
                this.lastUpdateTime.toLocaleTimeString() : 'Never';
        }
    }
    

    
    async sendSettingsToExtension() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_OVERLAY_SETTINGS',
                    settings: {
                        timeDisplayMode: this.timeDisplayMode
                    }
                });
                console.log('Settings sent to extension');
            }
        } catch (error) {
            console.error('Failed to send settings:', error);
        }
    }
    
    formatTime(totalSeconds) {
        if (!totalSeconds || totalSeconds < 0) return '00:00';
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Overlay Display Manager...');
    window.overlayDisplayManager = new OverlayDisplayManager();
}); 