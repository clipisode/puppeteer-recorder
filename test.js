const { record } = require('./index');
const puppeteer = require('puppeteer');

function pageRender(_frame) {
  if (_frame <= 20 || _frame >= 130)
    document.body.innerHTML = `<h1 style="background-color:black;padding:5px;color:white">Frame: ${_frame}</h1>`;
  else return false;
}

(async () => {
  await record({
    browser: await puppeteer.launch(),
    output: '/Users/max/Desktop/rendered.mp4',
    prepare: () => {},
    render: async (page, frame) => await page.evaluate(pageRender, frame),
    fps: 30,
    frames: 150,
    originalPath: '/Users/max/Documents/sample.mp4',
    threadQueueSize: 512,
    type: 'png',
    pipeOutput: true,
    screenshot: async capture => await capture()
  });
  process.exit(0);
})();
