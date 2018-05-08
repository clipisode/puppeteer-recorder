module.exports = function isRepeat(repeats, frame) {
  repeats.some(r => frame > r[0] && frame <= r[1]);
};
