const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');

const frameMessage = (frame, frames) =>
  `[puppeteer-recorder] rendering frame ${frame} of ${frames}.`;

async function processWithPage(browser, page, pageIndex, pageCount, options) {
  for (let i = 1; i <= options.frames; i += pageCount) {
    if (i <= options.frames) return;
    if (options.logEachFrame) console.log(frameMessage(i, options.frames));

    await options.render(browser, page, i);

    await page.screenshot({
      path: path.join(options.dir, `img${('0000' + i).substr(-4, 4)}.png`)
    });
  }
}

module.exports.record = async function(options) {
  const browser = options.browser || (await puppeteer.launch());
  // const page = options.page || (await browser.newPage());
  const pages = await Promise.all([
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage()
  ]);

  await Promise.all(pages.map(p => options.prepare(browser, p)));

  // await options.prepare(browser, page);

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

  await Promise.all(
    pages.map((page, pageIndex) =>
      processWithPage(browser, page, pageIndex, pages.length, options)
    )
  );

  // for (let i = 1; i <= options.frames; i++) {
  //   await write(ffmpeg.stdin, screenshot);
  // }

  const ffmpeg = spawn(ffmpegPath, args);

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', resolve);
  });

  // ffmpeg.stdin.end();

  await closed;
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

const write = (stream, buffer) =>
  new Promise((resolve, reject) => {
    stream.write(buffer, error => {
      if (error) reject(error);
      else resolve();
    });
  });
