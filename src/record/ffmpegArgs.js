const ffmpegArgs = (fps, originalPath, threadQueueSize, type, output) => {
  const audioInput = originalPath && ["-i", originalPath];
  const audioMap = originalPath && ["-map", "0:a", "-c:a", "copy"];
  const threadQueueSizeOption = threadQueueSize && [
    "-thread_queue_size",
    threadQueueSize
  ];

  return [
    "-y",
    ...audioInput,
    "-r",
    `${+fps}`,
    ...threadQueueSizeOption,
    "-i",
    "-",
    "-filter_complex",
    "[0:0] setsar=1/1[sarfix];[sarfix]overlay",
    "-pix_fmt",
    "yuva420p",
    ...audioMap,
    output
  ];
};

module.exports = ffmpegArgs;
