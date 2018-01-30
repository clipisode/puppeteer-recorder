const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');

const frameMessage = (frame, frames) =>
  `[puppeteer-recorder] rendering frame ${frame} of ${frames}.`;

async function processWithPage(browser, page, pageIndex, pageCount, options) {
  for (let i = 1; i <= options.frames; i += pageCount) {
    if (i + pageIndex > options.frames) return;
    if (options.logEachFrame)
      console.log(frameMessage(i + pageIndex, options.frames));

    await options.render(browser, page, i + pageIndex);

    const outputPath = path.join(
      options.dir,
      `img${('0000' + (i + pageIndex)).substr(-4, 4)}.png`
    );

    if (options.screenshot)
      await options.screenshot(
        async () => await page.screenshot({ path: outputPath })
      );
    else await page.screenshot({ path: outputPath });
  }
}

module.exports.record = async function record(options) {
  const pageCount = options.pageCount || 1;

  const browsers = options.browsers;
  const pagePromises = [];
  for (let i = 0; i < pageCount; i++) {
    pagePromises.push(browsers[i].newPage());
  }
  const pages = await Promise.all(pagePromises);

  await Promise.all(pages.map((p, i) => options.prepare(browsers[i], p)));

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
      processWithPage(
        browsers[pageIndex],
        page,
        pageIndex,
        pages.length,
        options
      )
    )
  );

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
  await Promise.all(pages.map(p => p.close()));
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
