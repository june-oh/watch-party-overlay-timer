# Watch Party Overlay Timer

A browser extension that overlays time and information directly onto a video, making it easy to capture with OBS.

## Key Features

- Displays current playback time and title information over the video player.
- Supports normal mode and greenscreen (chroma key) mode.
- Easy control via a popup interface.
- Designed for optimal OBS capture.

## Installation (Developer Mode)

1.  Clone or download this repository.
2.  Open Chrome/Edge and navigate to `chrome://extensions` or `edge://extensions`.
3.  Enable Developer Mode.
4.  Click "Load unpacked" and select the `overlay-timer` directory.

## Usage

1.  After installing, open a supported video player (e.g., Laftel).
2.  The overlay will automatically appear in the top-right corner of the video.
3.  Click the extension icon to toggle the overlay or switch modes.

For detailed information in Korean, please see [README_ko.md](README_ko.md).

## Supported Sites

- Laftel (laftel.net)

## Development Information

This extension uses:

- JavaScript
- Chrome Extension Manifest V3
- CSS

## License

Distributed under the MIT License.

## Customizing Overlay Appearance

The visual appearance of the timer overlay can be customized by modifying CSS variables defined at the beginning of the `public/css/overlay.css` file.

Open the `public/css/overlay.css` file and look for the `:root` block at the top. You can change the values of these variables to alter the overlay's style.

### Available CSS Variables and Their Effects:

**Overlay Container:**
*   `--wp-overlay-top`: Distance from the top edge of the video player (e.g., `20px`).
*   `--wp-overlay-right`: Distance from the right edge of the video player (e.g., `20px`).
*   `--wp-overlay-width`: Width of the overlay (e.g., `300px`).
*   `--wp-overlay-bg-color`: Background color of the overlay (e.g., `rgba(0, 0, 0, 0.7)` for semi-transparent black).
*   `--wp-overlay-text-color`: Default text color within the overlay (e.g., `white`).
*   `--wp-overlay-padding`: Inner padding of the overlay (e.g., `8px 12px`).
*   `--wp-overlay-border-radius`: Rounded corner radius for the overlay (e.g., `4px`).
*   `--wp-overlay-font-family`: Default font family for the overlay text (e.g., `'Noto Sans KR', 'Open Sans', Arial, sans-serif`).

**Series Text (Top line, usually smaller):**
*   `--wp-series-font-size`: Font size for the series title (e.g., `13px`).
*   `--wp-series-opacity`: Opacity of the series title text (e.g., `0.9`).
*   `--wp-series-margin-bottom`: Bottom margin for the series title (e.g., `2px`).

**Episode Text (Middle line, usually main title):**
*   `--wp-episode-font-size`: Font size for the episode title (e.g., `16px`).
*   `--wp-episode-font-weight`: Font weight for the episode title (e.g., `bold`).
*   `--wp-episode-margin-bottom`: Bottom margin for the episode title (e.g., `4px`).

**Time Text (Bottom line, current/total time):**
*   `--wp-time-font-size`: Font size for the time display (e.g., `18px`).
*   `--wp-time-font-weight`: Font weight for the time display (e.g., `bold`).
*   `--wp-time-font-family`: Font family for the time display (e.g., `'Noto Sans Mono', 'Courier New', monospace`).

**Greenscreen Mode:**
*   `--wp-greenscreen-bg-color`: Background color for greenscreen mode (e.g., `rgb(0, 177, 64)`).
*   `--wp-greenscreen-border-color`: Border color for greenscreen mode (e.g., `rgb(0, 177, 64)`).
*   `--wp-greenscreen-text-color`: Text color in greenscreen mode (e.g., `black`).
*   `--wp-greenscreen-text-shadow`: Text shadow in greenscreen mode (e.g., `0px 0px 2px white, 0px 0px 3px white, 0px 0px 4px white`).

### How to Modify:

1.  Navigate to the `overlay-timer/public/css/` directory in your project.
2.  Open the `overlay.css` file in a text editor.
3.  Locate the `:root { ... }` block at the beginning of the file.
4.  Change the value of any variable to your desired setting. For example, to make the overlay wider, you could change:
    ```css
    --wp-overlay-width: 350px; 
    ```
5.  Save the `overlay.css` file.
6.  Reload the extension in Chrome (go to `chrome://extensions`, find the "Watch Party Overlay Timer", and click the reload button or toggle it off and on).
7.  If you are on a page where the content script is active (e.g., a Laftel video player), you may need to refresh the page to see the changes.

This method allows for easy customization without needing to delve into the main CSS rules. 