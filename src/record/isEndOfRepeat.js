module.exports = function isEndOfRepeat(repeats, frame) {
  return repeats.some(r => r[1] === frame);
};
