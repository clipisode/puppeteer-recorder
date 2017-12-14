const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

module.exports.record = async function(options) {
  const browser = options.browser || (await puppeteer.launch());
  const page = options.page || (await browser.newPage());

  await options.prepare(browser, page);

  var ffmpegPath = options.ffmpeg || 'ffmpeg';
  var fps = options.fps || 60;

  var outFile = options.output;

  const args = ffmpegArgs(fps);

  if ('format' in options) args.push('-f', options.format);
  else if (!outFile) args.push('-f', 'matroska');

  args.push(outFile || '-');

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
    if (options.logEachFrame)
      console.log(
        `[puppeteer-recorder] rendering frame ${i} of ${options.frames}.`
      );

    await options.render(browser, page, i);

    let screenshot = await page.screenshot({ omitBackground: true });

    await write(ffmpeg.stdin, screenshot);
  }

  ffmpeg.stdin.end();

  await closed;
};

const ffmpegArgs = fps => [
  '-y',
  '-f',
  'image2pipe',
  '-r',
  `${+fps}`,
  '-i',
  '-',
  '-c:v',
  'libvpx',
  '-auto-alt-ref',
  '0',
  '-pix_fmt',
  'yuva420p',
  '-metadata:s:v:0',
  'alpha_mode="1"'
];

const write = (stream, buffer) =>
  new Promise((resolve, reject) => {
    stream.write(buffer, error => {
      if (error) reject(error);
      else resolve();
    });
  });
