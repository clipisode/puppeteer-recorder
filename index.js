const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');
const Queue = require('promise-queue');
const fs = require('fs');
const genericPool = require('generic-pool');

async function processWithPage(page, frame, options) {
  // const page = await pagePool.acquire();

  const renderResult = await options.render(page, frame);

  let bfr = null;

  if (renderResult !== false) {
    await options.screenshot(async () => {
      bfr = await page.screenshot({
        type: options.type || 'png',
        quality: options.quality
      });
    });
  }

  // pagePool.release(page);

  return bfr;
}

module.exports.record = async function record(options) {
  const pageCount = options.pageCount || 1;

  const { browser } = options;
  const page = await browser.newPage();

  await options.prepare(browser, page);

  var ffmpegPath = options.ffmpeg || 'ffmpeg';
  var fps = options.fps || 60;

  const args = ffmpegArgs(
    fps,
    options.originalPath,
    options.threadQueueSize,
    options.type || 'png',
    options.output || '-'
  );

  const ffmpeg = spawn(ffmpegPath, args);

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', resolve);
  });

  let mostRecentBuffer = null;

  for (let i = 1; i <= options.frames; i++) {
    let screenshotBuffer = await processWithPage(page, i, options);

    if (screenshotBuffer) {
      await write(ffmpeg.stdin, screenshotBuffer);
      mostRecentBuffer = screenshotBuffer;
    } else if (mostRecentBuffer) {
      console.log(`No bfr value for frame ${i}. Reusing most recent.`);
      await write(ffmpeg.stdin, mostRecentBuffer);
    }
  }

  ffmpeg.stdin.end();

  await closed;
  // await pagePool.drain();
  // await pagePool.clear();
};

const ffmpegArgs = (fps, originalPath, threadQueueSize, type, output) => {
  const audioInput = originalPath && ['-i', originalPath];
  const audioMap = originalPath && [
    '-map',
    '1:v',
    '-map',
    '0:a',
    '-c:a',
    'copy'
  ];
  const threadQueueSizeOption = threadQueueSize && [
    '-thread_queue_size',
    threadQueueSize
  ];

  return [
    '-y',
    ...audioInput,
    '-r',
    `${+fps}`,
    ...threadQueueSizeOption,
    '-i',
    '-',
    '-pix_fmt',
    'yuva420p',
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
