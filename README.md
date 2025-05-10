# 워치파티 오버레이 타이머 (Watch Party Overlay Timer)

영상 위에 시간 및 정보 오버레이를 표시하여 OBS 등으로 화면을 캡처할 때 유용하게 사용할 수 있는 브라우저 확장 프로그램입니다.

## 프로젝트 목표

온라인 스트리밍 서비스를 이용한 단체 시청(Watch Party) 시, 송출 화면에 현재 재생 시간과 영상 정보를 명확히 표시하여 시청 경험을 동기화하고 방송 프로그램으로 화면을 원활하게 캡처할 수 있도록 지원합니다.

## 주요 기능

*   비디오 플레이어 위에 현재 재생 시간 및 콘텐츠 제목 정보 표시
*   일반 모드 및 그린스크린(크로마키) 모드 지원
*   시간 표시 모드 순환 기능 (현재 시간만 / 현재 시간+전체 시간 / 숨김)
*   오버레이 위치 좌/우 토글 기능
*   간편한 팝업 UI를 통한 제어

## 설치 방법 (개발자 모드)

1.  이 저장소를 클론하거나 다운로드합니다.
2.  Chrome/Edge 브라우저를 열고 주소창에 `chrome://extensions` 또는 `edge://extensions`를 입력하여 확장 프로그램 관리 페이지로 이동합니다.
3.  개발자 모드(Developer Mode)를 활성화합니다.
4.  "압축 해제된 확장 프로그램을 로드합니다.(Load unpacked)" 버튼을 클릭하고, 다운로드한 `overlay-timer` 디렉터리를 선택합니다.

## 사용 방법

1.  설치 후, 지원되는 비디오 플레이어(예: 라프텔, 치지직) 페이지를 엽니다.
2.  오버레이는 기본적으로 영상의 우측 상단에 자동으로 나타납니다.
3.  확장 프로그램 아이콘을 클릭하여 팝업 UI를 통해 오버레이 표시 여부, 모드 변경, 위치 변경 등을 제어할 수 있습니다.

## 지원 사이트

*   라프텔 (laftel.net)
*   치지직 (chzzk.naver.com)

## 스크린샷

### 팝업 UI 예시

<!-- [[팝업 UI 스크린샷 위치]] -->
(팝업 UI 스크린샷을 여기에 추가해주세요.)

### 오버레이 예시

<!-- [[오버레이 작동 스크린샷 위치]] -->
(오버레이 작동 스크린샷을 여기에 추가해주세요.)

## 오버레이 외형 꾸미기

오버레이의 시각적 스타일은 `public/css/overlay.css` 파일 상단에 정의된 CSS 변수를 수정하여 사용자가 직접 변경할 수 있습니다.

`public/css/overlay.css` 파일을 열어 최상단의 `:root` 블록을 확인하십시오. 해당 변수들의 값을 변경하여 오버레이 스타일을 조절할 수 있습니다.

### 주요 CSS 변수 및 효과:

**오버레이 컨테이너:**
*   `--wp-overlay-top`: 비디오 플레이어 상단에서의 거리 (예: `20px`)
*   `--wp-overlay-right`: 비디오 플레이어 우측에서의 거리 (예: `20px`)
*   `--wp-overlay-width`: 오버레이 너비 (예: `300px`)
*   `--wp-overlay-bg-color`: 오버레이 배경색 (예: `rgba(0, 0, 0, 0.7)`)
*   `--wp-overlay-text-color`: 오버레이 기본 텍스트 색상 (예: `white`)
*   `--wp-overlay-padding`: 오버레이 내부 여백 (예: `8px 12px`)
*   `--wp-overlay-border-radius`: 오버레이 모서리 둥글기 반경 (예: `4px`)
*   `--wp-overlay-font-family`: 오버레이 기본 글꼴 (예: `'Noto Sans KR', 'Open Sans', Arial, sans-serif`)

**시리즈 텍스트 (상단, 일반적으로 작은 글씨):**
*   `--wp-series-font-size`: 시리즈 제목 글꼴 크기 (예: `13px`)
*   `--wp-series-opacity`: 시리즈 제목 투명도 (예: `0.9`)
*   `--wp-series-margin-bottom`: 시리즈 제목 하단 여백 (예: `2px`)

**에피소드 텍스트 (중간, 일반적으로 메인 제목):**
*   `--wp-episode-font-size`: 에피소드 제목 글꼴 크기 (예: `16px`)
*   `--wp-episode-font-weight`: 에피소드 제목 글꼴 두께 (예: `bold`)
*   `--wp-episode-margin-bottom`: 에피소드 제목 하단 여백 (예: `4px`)

**시간 텍스트 (하단, 현재/전체 시간):**
*   `--wp-time-font-size`: 시간 표시 글꼴 크기 (예: `18px`)
*   `--wp-time-font-weight`: 시간 표시 글꼴 두께 (예: `bold`)
*   `--wp-time-font-family`: 시간 표시 글꼴 (예: `'Noto Sans Mono', 'Courier New', monospace`)

**그린스크린 모드:**
*   `--wp-greenscreen-bg-color`: 그린스크린 모드 배경색 (예: `rgb(0, 177, 64)`)
*   `--wp-greenscreen-border-color`: 그린스크린 모드 테두리 색상 (예: `rgb(0, 177, 64)`)
*   `--wp-greenscreen-text-color`: 그린스크린 모드 텍스트 색상 (예: `black`)
*   `--wp-greenscreen-text-shadow`: 그린스크린 모드 텍스트 그림자 (예: `0px 0px 2px white, 0px 0px 3px white, 0px 0px 4px white`)

### 수정 방법:

1.  프로젝트 내 `overlay-timer/public/css/` 디렉터리로 이동합니다.
2.  텍스트 편집기로 `overlay.css` 파일을 엽니다.
3.  파일 시작 부분의 `:root { ... }` 블록을 찾습니다.
4.  원하는 변수의 값을 수정합니다. 예를 들어, 오버레이 너비를 넓히려면 다음처럼 변경합니다:
    ```css
    --wp-overlay-width: 350px; 
    ```
5.  `overlay.css` 파일을 저장합니다.
6.  Chrome/Edge 브라우저의 확장 프로그램 관리 페이지(`chrome://extensions` 또는 `edge://extensions`)에서 "워치파티 오버레이 타이머"를 찾아 새로고침 버튼을 클릭하거나, 확장 프로그램을 껐다가 다시 켭니다.
7.  콘텐츠 스크립트가 활성화된 페이지(예: 라프텔 비디오 플레이어)에 있다면, 페이지를 새로고침해야 변경 사항이 적용될 수 있습니다.

## 개발 정보

*   JavaScript
*   Chrome Extension Manifest V3
*   CSS

## 라이선스

GNU General Public License v3 (GPLv3)를 따릅니다. 자세한 내용은 `LICENSE` 파일을 참고하십시오.

## 기여 방법

버그 제보, 기능 제안 및 코드 기여는 언제나 환영합니다. GitHub 이슈 또는 Pull Request를 이용해주십시오.

## 감사 인사 (Acknowledgements)

Special thanks to:
*   초승달
*   뇨롱이
*   에스더
*   Gemini 2.5 