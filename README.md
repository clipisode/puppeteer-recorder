# puppeteer-recorder
Record animations using puppeteer. Based on electron-recorder.

# Usage
```
const { record } = require('puppeteer-recorder');

await record({
  browser: null, // Optional: a puppeteer Browser instance,
  page: null, // Optional: a puppeteer Page instance,
  output: 'output.webm',
  fps: 60,
  frames: 60 * 5, // 5 seconds at 60 fps
  prepare: function (browser, page) { /* executed before first capture */ },
  render: function (browser, page, frame) { /* executed before each capture */ }
});
```
