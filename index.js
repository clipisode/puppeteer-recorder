const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');
const Queue = require('promise-queue');
const fs = require('fs');
const genericPool = require('generic-pool');

const frameMessage = (frame, frames) =>
  `[puppeteer-recorder] rendering frame ${frame} of ${frames}.`;

async function processWithPage(pagePool, frame, options) {
  const page = await pagePool.acquire();

  if (options.logEachFrame) console.log(frameMessage(frame, options.frames));

  await options.render(page, frame);

  const outputPath = path.join(
    options.dir,
    `img${('0000' + frame).substr(-4, 4)}.png`
  );

  if (options.screenshot)
    await options.screenshot(async () => {
      await page.screenshot({ path: outputPath });
    });
  else await page.screenshot({ path: outputPath });

  pagePool.release(page);
}

module.exports.record = async function record(options) {
  const pageCount = options.pageCount || 1;

  const { browserPool } = options;
  const pagePool = genericPool.createPool(
    {
      create: async () => {
        const browser = await browserPool.acquire();
        const page = await browser.newPage();
        await options.prepare(browser, page);
        return page;
      },
      destroy: async page => {
        await page.close();
        await browserPool.release(browser);
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
    options.dir
  );

  args.push(outFile || '-');

  const prom = [];

  for (let i = 1; i <= options.frames; i++) {
    prom.push(processWithPage(pagePool, i, options));
  }

  await Promise.all(prom);

  const drainPromise = pagePool.drain();

  const ffmpeg = spawn(ffmpegPath, args);

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', resolve);
  });

  await closed;
  await drainPromise;
};

const ffmpegArgs = (fps, originalPath, threadQueueSize, dir) => {
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
    path.join(dir, 'img%04d.png'),
    '-pix_fmt',
    'yuva420p',
    ...audioMap
  ];
};
