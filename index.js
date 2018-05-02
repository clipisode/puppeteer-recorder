const { spawn } = require("child_process");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const EventEmitter = require("events");

async function record() {
  this.emit("recording");

  this.options.repeats = this.options.repeats || [];

  const pageCount = this.options.pageCount || 1;

  const { browser } = this.options;
  const page = await browser.newPage();

  await this.options.prepare(browser, page);

  var ffmpegPath = this.options.ffmpeg || "ffmpeg";
  var fps = this.options.fps || 60;

  const {
    originalPath,
    threadQueueSize,
    type = "png",
    output = "-"
  } = this.options;

  const args = ffmpegArgs(fps, originalPath, threadQueueSize, type, output);

  const ffmpeg = spawn(ffmpegPath, args);

  if (this.options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", resolve);
  });

  let mostRecentBuffer = null;

  for (let i = 1; i <= this.options.frames; i++) {
    if (mostRecentBuffer && isRepeat(this.options.repeats, i)) {
      // do nothing
    } else
      mostRecentBuffer = await processWithPage(page, i, this.options, this);

    await write(ffmpeg.stdin, mostRecentBuffer);
    if (isEndOfRepeat(this.options.repeats, i)) mostRecentBuffer = null;
  }

  ffmpeg.stdin.end();

  await closed;

  this.emit("finished");
}

class PuppeteerRecorder extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;

    this.record = record.bind(this);
  }
}

module.exports = PuppeteerRecorder;

async function processWithPage(page, frame, options, emitter) {
  await options.render(page, frame);

  const start = process.hrtime();

  const screenshotBuffer = await page.screenshot({
    omitBackground: true,
    type: options.type || "png",
    quality: options.quality
  });

  emitter.emit("screenshot", hrtimeToMilliseconds(process.hrtime(start)));

  return screenshotBuffer;
}

function hrtimeToMilliseconds(hrtime) {
  const nanoseconds = hrtime[0] * 1e9 + hrtime[1];
  return nanoseconds / 1e6;
}

const isRepeat = (repeats, frame) =>
  repeats.some(r => frame > r[0] && frame <= r[1]);
const isEndOfRepeat = (repeats, frame) => repeats.some(r => r[1] === frame);

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
