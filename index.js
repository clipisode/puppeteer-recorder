const { spawn } = require("child_process");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

async function processWithPage(page, frame, options) {
  // const page = await pagePool.acquire();

  const renderResult = await options.render(page, frame);

  let bfr = null;

  await options.screenshot(async () => {
    bfr = await page.screenshot({
      omitBackground: true,
      type: options.type || "png",
      quality: options.quality
    });
  });

  // pagePool.release(page);

  return bfr;
}

const isRepeat = (repeats, frame) =>
  repeats.some(r => frame > r[0] && frame <= r[1]);
const isEndOfRepeat = (repeats, frame) => repeats.some(r => r[1] === frame);

module.exports.record = async function record(options) {
  options.repeats = options.repeats || [];

  const pageCount = options.pageCount || 1;

  const { browser } = options;
  const page = await browser.newPage();

  await options.prepare(browser, page);

  var ffmpegPath = options.ffmpeg || "ffmpeg";
  var fps = options.fps || 60;

  const args = ffmpegArgs(
    fps,
    options.originalPath,
    options.threadQueueSize,
    options.type || "png",
    options.output || "-"
  );

  const ffmpeg = spawn(ffmpegPath, args);

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", resolve);
  });

  let mostRecentBuffer = null;

  for (let i = 1; i <= options.frames; i++) {
    if (mostRecentBuffer && isRepeat(options.repeats, i)) {
      // do nothing
    } else mostRecentBuffer = await processWithPage(page, i, options);

    await write(ffmpeg.stdin, mostRecentBuffer);
    if (isEndOfRepeat(options.repeats, i)) mostRecentBuffer = null;
  }

  ffmpeg.stdin.end();

  await closed;
  // await pagePool.drain();
  // await pagePool.clear();
};

const ffmpegArgs = (fps, originalPath, threadQueueSize, type, output) => {
  const audioInput = originalPath && ["-i", originalPath];
  const audioMap = originalPath && ["-map", "0:a", "-c:a", "copy"];
  const threadQueueSizeOption = threadQueueSize && [
    "-thread_queue_size",
    threadQueueSize
  ];

  return [
    "-y",
    ...audioInput,
    "-r",
    `${+fps}`,
    ...threadQueueSizeOption,
    "-i",
    "-",
    "-filter_complex",
    "[0:0] setsar=1/1[sarfix];[sarfix]overlay",
    "-pix_fmt",
    "yuva420p",
    ...audioMap,
    output
  ];
};

const write = (stream, buffer) =>
  new Promise((resolve, reject) => {
    stream.write(buffer, error => {
      if (error) reject(error);
      else resolve();
    });
  });
