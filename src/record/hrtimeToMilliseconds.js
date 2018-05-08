module.exports = function hrtimeToMilliseconds(hrtime) {
  const nanoseconds = hrtime[0] * 1e9 + hrtime[1];
  return nanoseconds / 1e6;
};
