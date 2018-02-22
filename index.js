const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');
const Queue = require('promise-queue');
const fs = require('fs');
const genericPool = require('generic-pool');

async function processWithPage(pagePool, frame, options) {
  const page = await pagePool.acquire();

  await options.render(page, frame);

  let bfr = null;

  await options.screenshot(async () => {
    bfr = await page.screenshot({
      type: options.type || 'png',
      quality: options.quality
    });
  });

  pagePool.release(page);

  return bfr;
}

module.exports.record = async function record(options) {
  const pageCount = options.pageCount || 1;

  const { browserPool } = options;
  const pagePool = genericPool.createPool(
    {
      create: async () => {
        console.log('Acquiring browser...');
        const browser = await browserPool.acquire();
        console.log('Browser acquired.');
        const page = await browser.newPage();
        page.__browser = browser;
        await options.prepare(browser, page);
        return page;
      },
      destroy: async page => {
        await page.close();
        console.log(`Releasing browser: ${!!page.__browser}`);
        browserPool.release(page.__browser);
      }
    },
    { max: pageCount }
  );

  var ffmpegPath = options.ffmpeg || 'ffmpeg';
  var fps = options.fps || 60;

  var outFile = options.output;

  const args = ffmpegArgs(
    fps,
    options.originalPath,
    options.threadQueueSize,
    options.type || 'png'
  );

  args.push(outFile || '-');

  const prom = [];

  for (let i = 1; i <= options.frames; i++) {
    prom.push(processWithPage(pagePool, i, options));
  }

  const ffmpeg = spawn(ffmpegPath, args);

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', resolve);
  });

  for (let i = 1; i <= options.frames; i++) {
    let bfr = await prom[i];
    await write(ffmpeg.stdin, bfr);
  }
  ffmpeg.stdin.end();

  await closed;
  await pagePool.drain();
  await pagePool.clear();
};

const ffmpegArgs = (fps, originalPath, threadQueueSize, type) => {
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
    ...audioMap
  ];
};

const write = (stream, buffer) =>
  new Promise((resolve, reject) => {
    stream.write(buffer, error => {
      if (error) reject(error);
      else resolve();
    });
  });
