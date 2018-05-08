const hrtimeToMilliseconds = require("./hrtimeToMilliseconds");

module.exports = async function processWithPage(page, frame, options, emitter) {
  await options.render(page, frame);

  const start = process.hrtime();

  const screenshotBuffer = await page.screenshot({
    omitBackground: true,
    type: options.type || "png",
    quality: options.quality
  });

  emitter.emit("screenshot", hrtimeToMilliseconds(process.hrtime(start)));

  return screenshotBuffer;
};
