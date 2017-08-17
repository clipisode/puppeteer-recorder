const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

module.exports.record = async function(options) {
  const browser = options.browser || (await puppeteer.launch());
  const page = options.page || (await browser.newPage());

  var ffmpegPath = options.ffmpeg || 'ffmpeg';
  var fps = options.fps || 60;

  var args = [
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

  var outFile = options.output;

  if ('format' in options) {
    args.push('-f', options.format);
  } else if (!outFile) {
    args.push('-f', 'matroska');
  }

  args.push(outFile || '-');

  await options.prepare(browser, page);

  const ffmpeg = spawn(ffmpegPath, args);
  const ffmpegClose = new Promise(resolve => ffmpeg.on('close', resolve));

  ffmpeg.stdout.on('data', data => console.log(data.toString()));
  ffmpeg.stderr.on('data', data => console.log(data.toString()));

  for (let i = 1; i <= options.frames; i++) {
    console.log(`Frame ${i}/${options.frames}.`);
    let screenshot = await page.screenshot();

    await write(ffmpeg.stdin, screenshot);
  }

  ffmpeg.stdin.end();

  await ffmpegClose;
};

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function write(stream, buffer) {
  return new Promise((resolve, reject) => {
    stream.write(buffer, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}
