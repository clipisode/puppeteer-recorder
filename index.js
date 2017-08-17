const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

function ffmpegWork(page, ffmpegPath, args) {
  return new Promise(function(resolve, reject) {
    var ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.on('close', resolve;

    page
      .screenshot()
      .then(buffer => {
        ffmpeg.stdin.write(buffer, err => {
          if (err) reject(err);
          else ffmpeg.stdin.end();
        });
      })
      .catch(reject);
  });
}

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
    '' + +fps,
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

  await ffmpegWork(page, ffmpegPath, args);
};
