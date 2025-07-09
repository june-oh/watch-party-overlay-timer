// Music Player Style Overlay Display JavaScript
class OverlayDisplayManager {
    constructor() {
        // DOM element references
        this.episodeTitle = null;
        this.compactEpisodeTitle = null;
        this.seriesTitle = null;
        this.siteName = null;
        this.currentTime = null;
        this.compactCurrentTime = null;
        this.durationTime = null;
        this.compactDurationTime = null;
        this.progressFill = null;
        this.normalModeContainer = null;
        this.compactModeContainer = null;
        this.expandedPanel = null;
        this.expandBar = null;
        this.expandArrow = null;
        
        // Settings
        this.customSettings = {
            bgColor: '#000000',
            bgOpacity: 90,
            textColor: '#ffffff',
            accentColor: '#00ff88',
            progressColor: '#00ff88',
            borderRadius: 0,
            episodeFontSize: 16,
            seriesFontSize: 11,
            timeFontSize: 14,
            windowHeight: 100,
            windowWidth: 600,
            displayMode: 'normal',
            showProgressBar: true,
            showPlatformBadge: true
        };
        
        // Platform detection mapping
        this.platformMapping = {
            'youtube': ['youtube', 'youtu.be', '유튜브'],
            'chzzk': ['chzzk', 'naver.com', '치지직'],
            'laftel': ['laftel', '라프텔'],
            'netflix': ['netflix', '넷플릭스'],
            // Add more platforms as needed
            'twitch': ['twitch', '트위치'],
            'afreeca': ['afreeca', 'afreecatv', '아프리카'],
            'wavve': ['wavve', '웨이브'],
            'tving': ['tving', '티빙']
        };
        
        // State
        this.displayMode = 'normal';
        this.timeDisplayMode = 'current_duration';
        this.overlayPosition = 'left';
        this.isExpanded = false;
        this.currentVideoInfo = null;
        this.lastUpdateTime = null;
        this.sourceTabId = null;
        
        // Tutorial state
        this.tutorialCompleted = localStorage.getItem('overlay-tutorial-completed') === 'true';
        this.tutorialActive = false;
        this.currentTutorialStep = 1;
        this.totalTutorialSteps = 4;
        this.originalWindowSize = null;
        
        this.init();
    }
    
    init() {
        console.log('Initializing overlay display...');
        
        // Initialize DOM elements
        this.initializeDOMElements();
        
        // Load saved settings
        this.loadCustomSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        this.setupCustomizationListeners();
        
        // Setup tutorial system
        this.setupTutorial();
        
        // Apply initial styles
        this.updateCustomizationUI();
        this.applyCustomStyles();
        this.updateDisplayMode();
        this.updateDisplayElements();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        console.log('Overlay display initialized');
    }
    
    initializeDOMElements() {
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
        this.windowWidthSlider = document.getElementById('window-width-slider');
        this.windowWidthValue = document.getElementById('window-width-value');
        
        // Tutorial elements
        this.tutorialOverlay = document.getElementById('tutorial-overlay');
        this.tutorialSteps = document.querySelectorAll('.tutorial-step');
        this.tutorialDots = document.querySelectorAll('.tutorial-dots .dot');
        this.tutorialPrevBtn = document.getElementById('tutorial-prev');
        this.tutorialNextBtn = document.getElementById('tutorial-next');
        this.tutorialCloseBtn = document.getElementById('tutorial-close');
        this.tutorialDontShowCheckbox = document.getElementById('tutorial-dont-show');
        
        // Customization elements
        this.bgColorPicker = document.getElementById('bg-color-picker');
        this.bgOpacitySlider = document.getElementById('bg-opacity-slider');
        this.bgOpacityValue = document.getElementById('bg-opacity-value');
        this.textColorPicker = document.getElementById('text-color-picker');
        this.accentColorPicker = document.getElementById('accent-color-picker');
        this.progressColorPicker = document.getElementById('progress-color-picker');
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
        
        // Progress bar size elements
        this.progressBarWidthSlider = document.getElementById('progress-bar-width-slider');
        this.progressBarWidthValue = document.getElementById('progress-bar-width-value');
        this.progressBarHeightSlider = document.getElementById('progress-bar-height-slider');
        this.progressBarHeightValue = document.getElementById('progress-bar-height-value');
        
        // Toggle elements
        this.progressBarToggle = document.getElementById('progress-bar-toggle');
        this.platformBadgeToggle = document.getElementById('platform-badge-toggle');
        
        // Status elements
        this.connectionStatusDetail = document.getElementById('connection-status-detail');
        this.sourceTab = document.getElementById('source-tab');
        this.lastUpdate = document.getElementById('last-update');
    }
    
    startPeriodicUpdates() {
        // Start data update if tutorial is completed
        this.startDataUpdate();
        
        // Start listening for extension messages
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleExtensionMessage(message, sender, sendResponse);
            });
        }
        
        // Periodic connection check (every 5 seconds)
        setInterval(() => {
            if (this.tutorialCompleted) {
                this.connectToExtension();
            }
        }, 5000);
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
            let heightResizeTimeout;
            this.windowHeightSlider.addEventListener('input', () => {
                const height = parseInt(this.windowHeightSlider.value);
                this.windowHeightValue.textContent = height + 'px';
                this.customSettings.windowHeight = height;
                // CSS variable update
                document.documentElement.style.setProperty('--window-height', height + 'px');
                // Apply immediately for preview
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
                
                // Debounce window resize to prevent continuous resizing during drag
                clearTimeout(heightResizeTimeout);
                heightResizeTimeout = setTimeout(() => {
                    // 설정 패널이 닫혀있을 때만 높이 조정 (열려있을 때는 650px 고정)
                    if (!this.isExpanded) {
                        this.resizeWindow(this.customSettings.windowWidth, height + 40);
                    }
                }, 300); // 300ms 지연 후 창 크기 변경
            });
        }
        
        // Window width slider
        if (this.windowWidthSlider) {
            let widthResizeTimeout;
            this.windowWidthSlider.addEventListener('input', () => {
                const width = parseInt(this.windowWidthSlider.value);
                this.windowWidthValue.textContent = width + 'px';
                this.customSettings.windowWidth = width;
                // CSS variable update
                document.documentElement.style.setProperty('--window-width', width + 'px');
                // Apply immediately for preview
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
                
                // Debounce window resize to prevent continuous resizing during drag
                clearTimeout(widthResizeTimeout);
                widthResizeTimeout = setTimeout(() => {
                    const currentHeight = this.isExpanded ? 650 : this.customSettings.windowHeight + 40;
                    this.resizeWindow(width, currentHeight);
                }, 300); // 300ms 지연 후 창 크기 변경
            });
        }
    }
    
    setupCustomizationListeners() {
        // Background color and opacity
        if (this.bgColorPicker) {
            this.bgColorPicker.addEventListener('input', () => {
                this.customSettings.bgColor = this.bgColorPicker.value;
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        if (this.bgOpacitySlider) {
            this.bgOpacitySlider.addEventListener('input', () => {
                this.customSettings.bgOpacity = parseInt(this.bgOpacitySlider.value);
                this.bgOpacityValue.textContent = this.customSettings.bgOpacity + '%';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Text color
        if (this.textColorPicker) {
            this.textColorPicker.addEventListener('input', () => {
                this.customSettings.textColor = this.textColorPicker.value;
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Accent color
        if (this.accentColorPicker) {
            this.accentColorPicker.addEventListener('input', () => {
                this.customSettings.accentColor = this.accentColorPicker.value;
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Progress color
        if (this.progressColorPicker) {
            this.progressColorPicker.addEventListener('input', () => {
                this.customSettings.progressColor = this.progressColorPicker.value;
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Progress bar size sliders
        if (this.progressBarWidthSlider) {
            this.progressBarWidthSlider.addEventListener('input', () => {
                this.customSettings.progressBarWidth = parseInt(this.progressBarWidthSlider.value);
                this.progressBarWidthValue.textContent = this.customSettings.progressBarWidth + 'px';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        if (this.progressBarHeightSlider) {
            this.progressBarHeightSlider.addEventListener('input', () => {
                this.customSettings.progressBarHeight = parseInt(this.progressBarHeightSlider.value);
                this.progressBarHeightValue.textContent = this.customSettings.progressBarHeight + 'px';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Progress bar toggle
        if (this.progressBarToggle) {
            this.progressBarToggle.addEventListener('change', () => {
                this.customSettings.showProgressBar = this.progressBarToggle.checked;
                this.applyCustomStyles();
                this.updateDisplayElements();
            });
        }
        
        // Platform badge toggle
        if (this.platformBadgeToggle) {
            this.platformBadgeToggle.addEventListener('change', () => {
                this.customSettings.showPlatformBadge = this.platformBadgeToggle.checked;
                this.applyCustomStyles();
                this.updateDisplayElements();
            });
        }
        
        // Border radius
        if (this.borderRadiusSlider) {
            this.borderRadiusSlider.addEventListener('input', () => {
                this.customSettings.borderRadius = parseInt(this.borderRadiusSlider.value);
                this.borderRadiusValue.textContent = this.customSettings.borderRadius + 'px';
                
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        // Font sizes
        if (this.episodeFontSizeSlider) {
            this.episodeFontSizeSlider.addEventListener('input', () => {
                this.customSettings.episodeFontSize = parseInt(this.episodeFontSizeSlider.value);
                this.episodeFontSizeValue.textContent = this.customSettings.episodeFontSize + 'px';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        if (this.seriesFontSizeSlider) {
            this.seriesFontSizeSlider.addEventListener('input', () => {
                this.customSettings.seriesFontSize = parseInt(this.seriesFontSizeSlider.value);
                this.seriesFontSizeValue.textContent = this.customSettings.seriesFontSize + 'px';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
            });
        }
        
        if (this.timeFontSizeSlider) {
            this.timeFontSizeSlider.addEventListener('input', () => {
                this.customSettings.timeFontSize = parseInt(this.timeFontSizeSlider.value);
                this.timeFontSizeValue.textContent = this.customSettings.timeFontSize + 'px';
                this.applyCustomStyles();
                this.saveCustomSettings(); // 자동 저장 추가
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
        
        // Show tutorial button
        const showTutorialButton = document.getElementById('show-tutorial-button');
        if (showTutorialButton) {
            showTutorialButton.addEventListener('click', () => {
                this.currentTutorialStep = 1;
                // 현재 확장 패널 상태를 저장하고 닫기
                const wasExpanded = this.isExpanded;
                if (this.isExpanded) {
                    this.toggleExpandedPanel(); // 패널을 닫아서 깔끔하게 보이도록
                }
                this.showTutorial();
            });
        }
        
        // Reset button
        const resetButton = document.getElementById('reset-button');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
    }
    
    loadCustomSettings() {
        try {
            const saved = localStorage.getItem('overlay-custom-settings');
            if (saved) {
                this.customSettings = { ...this.customSettings, ...JSON.parse(saved) };
                this.displayMode = this.customSettings.displayMode || 'normal';
                
                // 진행바 설정 기본값 보장
                if (!this.customSettings.progressBarWidth) {
                    this.customSettings.progressBarWidth = 120;
                }
                if (!this.customSettings.progressBarHeight) {
                    this.customSettings.progressBarHeight = 4;
                }
                
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
        if (this.progressColorPicker) this.progressColorPicker.value = this.customSettings.progressColor;
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
        if (this.windowWidthSlider) {
            this.windowWidthSlider.value = this.customSettings.windowWidth;
            this.windowWidthValue.textContent = this.customSettings.windowWidth + 'px';
        }
        
        // Update progress bar sliders
        if (this.progressBarWidthSlider) {
            this.progressBarWidthSlider.value = this.customSettings.progressBarWidth;
            this.progressBarWidthValue.textContent = this.customSettings.progressBarWidth + 'px';
        }
        if (this.progressBarHeightSlider) {
            this.progressBarHeightSlider.value = this.customSettings.progressBarHeight;
            this.progressBarHeightValue.textContent = this.customSettings.progressBarHeight + 'px';
        }
        
        // Update toggles
        if (this.progressBarToggle) this.progressBarToggle.checked = this.customSettings.showProgressBar;
        if (this.platformBadgeToggle) this.platformBadgeToggle.checked = this.customSettings.showPlatformBadge;
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
        
        // Calculate luminance for automatic color contrast
        const getLuminance = (r, g, b) => {
            const [rs, gs, bs] = [r, g, b].map(c => {
                c = c / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        };
        
        const bgRgb = hexToRgb(this.customSettings.bgColor);
        const bgOpacity = this.customSettings.bgOpacity / 100;
        const luminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
        
        // Auto-adjust text colors based on background luminance
        const isDark = luminance < 0.5;
        const autoTextColor = isDark ? '#ffffff' : '#000000';
        const autoTextColorSecondary = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        const autoBorderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        const autoInputBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        // Apply CSS variables
        root.style.setProperty('--bg-color', `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${bgOpacity})`);
        root.style.setProperty('--text-color', this.customSettings.textColor);
        root.style.setProperty('--accent-color', this.customSettings.accentColor);
        root.style.setProperty('--progress-fill', this.customSettings.progressColor);
        root.style.setProperty('--border-radius', this.customSettings.borderRadius + 'px');
        root.style.setProperty('--font-size-episode', this.customSettings.episodeFontSize + 'px');
        root.style.setProperty('--font-size-series', this.customSettings.seriesFontSize + 'px');
        root.style.setProperty('--font-size-time', this.customSettings.timeFontSize + 'px');
        root.style.setProperty('--window-height', this.customSettings.windowHeight + 'px');
        root.style.setProperty('--window-width', this.customSettings.windowWidth + 'px');
        root.style.setProperty('--progress-bar-width', this.customSettings.progressBarWidth + 'px');
        root.style.setProperty('--progress-bar-height', this.customSettings.progressBarHeight + 'px');
        
        // Apply automatic color contrast
        root.style.setProperty('--auto-text-color', autoTextColor);
        root.style.setProperty('--auto-text-color-secondary', autoTextColorSecondary);
        root.style.setProperty('--auto-border-color', autoBorderColor);
        root.style.setProperty('--auto-input-bg', autoInputBg);
        root.style.setProperty('--auto-input-border', autoBorderColor);
    }
    
    resetToDefaults() {
        this.customSettings = {
            bgColor: '#000000',
            bgOpacity: 90,
            textColor: '#ffffff',
            accentColor: '#00ff88',
            progressColor: '#00ff88',
            borderRadius: 0, // 곡률 제거
            episodeFontSize: 16,
            seriesFontSize: 11,
            timeFontSize: 14,
            windowHeight: 100, // Chrome 최소 높이에 맞춤
            windowWidth: 600, // 기본 너비
            displayMode: 'normal',
            showProgressBar: true,
            showPlatformBadge: true,
            progressBarWidth: 120, // 진행바 기본 너비
            progressBarHeight: 4   // 진행바 기본 높이
        };
        this.displayMode = 'normal';
        this.updateCustomizationUI();
        this.applyCustomStyles();
        
        // 창 크기를 즉시 변경하여 너비가 바로 적용되도록 함
        this.resizeWindow(this.customSettings.windowWidth, this.customSettings.windowHeight + 40);
        
        // 약간의 지연 후 다시 한 번 업데이트 (확실한 적용을 위해)
        setTimeout(() => {
            this.updateDisplayMode();
            this.updateDisplayElements();
        }, 100);
        
        this.saveCustomSettings(); // 저장 기능 추가
        
        // 성공 메시지 표시
        const resetButton = document.getElementById('reset-button');
        if (resetButton) {
            const originalText = resetButton.textContent;
            resetButton.textContent = '✓ 재설정 완료';
            resetButton.style.background = 'linear-gradient(135deg, #00ff88, #00cc6a)';
            
            setTimeout(() => {
                resetButton.textContent = originalText;
                resetButton.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a5a)';
            }, 1500);
        }
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
            this.resizeWindow(this.customSettings.windowWidth, 650);
        } else {
            // Collapse panel
            this.expandedPanel.classList.add('collapsed');
            this.expandBar.classList.remove('expanded');
            if (this.expandArrow) {
                this.expandArrow.textContent = '▼';
            }
            this.isExpanded = false;
            
            // Resize window back to custom size
            this.resizeWindow(this.customSettings.windowWidth, this.customSettings.windowHeight + 40);
        }
    }
    
    resizeWindow(width, height) {
        // 튜토리얼이 활성화된 경우 외부에서의 창 크기 변경을 무시
        if (this.tutorialActive) {
            return;
        }
        
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
    
    // 튜토리얼 전용 창 크기 변경 함수 (tutorialActive 상태 무시)
    forceResizeWindow(width, height) {
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
            
            // Apply platform-specific styling based on site name
            this.siteName.className = 'platform-badge'; // Reset to base class
            
            if (info.siteName) {
                const siteName = info.siteName.toLowerCase();
                for (const [platform, aliases] of Object.entries(this.platformMapping)) {
                    if (aliases.some(alias => siteName.includes(alias))) {
                        this.siteName.classList.add(platform);
                        break;
                    }
                }
            }
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
            
            // 컴팩트 모드일 때 높이를 사용자 설정값으로 조정
            document.documentElement.style.setProperty('--window-height', this.customSettings.windowHeight + 'px');
            document.getElementById('main-bar').style.height = this.customSettings.windowHeight + 'px';
            
            // 컴팩트 모드일 때 창 크기 조정 - 사용자 설정 높이 사용
            if (!this.isExpanded) {
                this.resizeWindow(this.customSettings.windowWidth, this.customSettings.windowHeight + 40);
            }
        } else {
            this.normalModeContainer.style.display = 'flex';
            this.compactModeContainer.style.display = 'none';
            
            // 일반 모드일 때 높이를 사용자 설정값으로 조정
            document.documentElement.style.setProperty('--window-height', this.customSettings.windowHeight + 'px');
            document.getElementById('main-bar').style.height = this.customSettings.windowHeight + 'px';
            
            // 일반 모드일 때 창 크기 조정 - 사용자 설정 높이 사용
            if (!this.isExpanded) {
                this.resizeWindow(this.customSettings.windowWidth, this.customSettings.windowHeight + 40);
            }
        }
        
        // 표시 요소 업데이트
        this.updateDisplayElements();
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

    // Tutorial system methods
    setupTutorial() {
        // Show tutorial if not completed
        if (!this.tutorialCompleted) {
            setTimeout(() => {
                this.showTutorial();
            }, 1000); // Show after 1 second delay
        }
        
        // Tutorial navigation
        if (this.tutorialPrevBtn) {
            this.tutorialPrevBtn.addEventListener('click', () => {
                this.goToPreviousTutorialStep();
            });
        }
        
        if (this.tutorialNextBtn) {
            this.tutorialNextBtn.addEventListener('click', () => {
                this.goToNextTutorialStep();
            });
        }
        
        if (this.tutorialCloseBtn) {
            this.tutorialCloseBtn.addEventListener('click', () => {
                this.closeTutorial();
            });
        }
        
        // Dot navigation
        this.tutorialDots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.goToTutorialStep(index + 1);
            });
        });
    }
    
    showTutorial() {
        if (this.tutorialOverlay) {
            this.tutorialActive = true; // 튜토리얼 활성 상태 설정
            this.tutorialOverlay.style.display = 'flex';
            this.updateTutorialStep();
            
            // 튜토리얼 시작 시 자동으로 정보 가져오기 시작
            this.startDataUpdate();
            
            // 튜토리얼 표시 시 창 크기를 늘려서 제대로 보이도록 함
            this.originalWindowSize = {
                width: this.customSettings.windowWidth,
                height: this.customSettings.windowHeight,
                isExpanded: this.isExpanded
            };
            
            // 튜토리얼용 최적 크기로 조정 (너비 800px, 높이 700px)
            this.forceResizeWindow(800, 700);
        }
    }
    
    hideTutorial() {
        if (this.tutorialOverlay) {
            this.tutorialActive = false; // 튜토리얼 활성 상태 해제
            this.tutorialOverlay.style.display = 'none';
            
            // 원래 창 크기로 복원
            if (this.originalWindowSize) {
                const targetHeight = this.originalWindowSize.isExpanded ? 
                    650 : this.originalWindowSize.height + 40;
                this.forceResizeWindow(this.originalWindowSize.width, targetHeight);
                this.isExpanded = this.originalWindowSize.isExpanded;
                
                // 확장 패널 상태도 복원
                if (this.isExpanded) {
                    this.expandedPanel.classList.remove('collapsed');
                    this.expandBar.classList.add('expanded');
                    if (this.expandArrow) {
                        this.expandArrow.textContent = '▲';
                    }
                } else {
                    this.expandedPanel.classList.add('collapsed');
                    this.expandBar.classList.remove('expanded');
                    if (this.expandArrow) {
                        this.expandArrow.textContent = '▼';
                    }
                }
                
                this.originalWindowSize = null; // 복원 완료 후 초기화
            }
        }
    }
    
    goToNextTutorialStep() {
        if (this.currentTutorialStep < this.totalTutorialSteps) {
            this.currentTutorialStep++;
            this.updateTutorialStep();
        } else {
            this.closeTutorial();
        }
    }
    
    goToPreviousTutorialStep() {
        if (this.currentTutorialStep > 1) {
            this.currentTutorialStep--;
            this.updateTutorialStep();
        }
    }
    
    goToTutorialStep(step) {
        if (step >= 1 && step <= this.totalTutorialSteps) {
            this.currentTutorialStep = step;
            this.updateTutorialStep();
        }
    }
    
    updateTutorialStep() {
        // Update step visibility
        this.tutorialSteps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentTutorialStep);
        });
        
        // Update dots
        this.tutorialDots.forEach((dot, index) => {
            dot.classList.toggle('active', index + 1 === this.currentTutorialStep);
        });
        
        // Update navigation buttons
        if (this.tutorialPrevBtn) {
            this.tutorialPrevBtn.disabled = this.currentTutorialStep === 1;
        }
        
        if (this.tutorialNextBtn) {
            this.tutorialNextBtn.textContent = this.currentTutorialStep === this.totalTutorialSteps ? '완료' : '다음';
        }
    }
    
    closeTutorial() {
        // Save preference if checkbox is checked
        if (this.tutorialDontShowCheckbox && this.tutorialDontShowCheckbox.checked) {
            localStorage.setItem('overlay-tutorial-completed', 'true');
            this.tutorialCompleted = true;
        }
        
        this.hideTutorial();
        
        // Initialize the rest of the app
        this.updateCustomizationUI();
        this.updateConnectionStatus('connecting');
        this.connectToExtension();
    }

    startDataUpdate() {
        // Initialize the rest of the app if tutorial is already completed
        if (this.tutorialCompleted) {
            this.updateCustomizationUI();
            this.updateConnectionStatus('connecting');
            this.connectToExtension();
        }
    }

    // 진행바와 플랫폼 배지 표시/숨김 처리
    updateDisplayElements() {
        // Progress bar visibility
        const progressSection = document.getElementById('progress-section');
        const progressBarContainer = document.getElementById('progress-bar-container');
        const mainBar = document.getElementById('main-bar');
        
        if (progressSection && progressBarContainer && mainBar) {
            if (this.customSettings.showProgressBar) {
                progressBarContainer.style.display = 'block';
                mainBar.classList.remove('no-progress-bar');
            } else {
                progressBarContainer.style.display = 'none';
                mainBar.classList.add('no-progress-bar');
            }
        }
        
        // Platform badge visibility
        const platformBadges = document.querySelectorAll('.platform-badge');
        platformBadges.forEach(badge => {
            if (this.customSettings.showPlatformBadge) {
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        });
        
        // 컴팩트 모드에서는 진행바와 플랫폼 배지를 자동으로 숨김
        if (this.displayMode === 'compact') {
            if (progressBarContainer) {
                progressBarContainer.style.display = 'none';
            }
            if (mainBar) {
                mainBar.classList.add('no-progress-bar');
            }
            platformBadges.forEach(badge => {
                badge.style.display = 'none';
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Overlay Display Manager...');
    window.overlayDisplayManager = new OverlayDisplayManager();
}); 