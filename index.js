const EventEmitter = require("events");
const record = require("./src/record");

class PuppeteerRecorder extends EventEmitter {
  constructor(options) {
    super();

    this.record = record.bind(this, options);
  }
}

module.exports = PuppeteerRecorder;
