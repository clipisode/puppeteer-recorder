const { spawn } = require("child_process");
const ffmpegArgs = require("./ffmpegArgs");
const isEndOfRepeat = require("./isEndOfRepeat");
const isRepeat = require("./isRepeat");
const processWithPage = require("./processWithPage");
const write = require("./write");
const childProcessToPromise = require("../util/childProcessToPromsie");

module.exports = async function record(options) {
  this.emit("recording");

  options.repeats = options.repeats || [];

  const pageCount = options.pageCount || 1;

  const { browser } = options;
  const page = await browser.newPage();

  await options.prepare(browser, page);

  var ffmpegPath = options.ffmpeg || "ffmpeg";
  var fps = options.fps || 60;

  const { originalPath, threadQueueSize, type = "png", output = "-" } = options;

  const args = ffmpegArgs(fps, originalPath, threadQueueSize, type, output);

  const ffmpeg = spawn(ffmpegPath, args);

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  const closed = childProcessToPromise(ffmpeg);

  let mostRecentBuffer = null;

  for (let i = 1; i <= options.frames; i++) {
    if (!mostRecentBuffer || !isRepeat(options.repeats, i))
      mostRecentBuffer = await processWithPage(page, i, options, this);

    await write(ffmpeg.stdin, mostRecentBuffer);
    if (isEndOfRepeat(options.repeats, i)) mostRecentBuffer = null;
  }

  ffmpeg.stdin.end();

  await closed;

  this.emit("finished");
};
