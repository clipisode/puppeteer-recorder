module.exports = function childProcessToPromise(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.on("error", reject);
    childProcess.on("close", resolve);
  });
};
