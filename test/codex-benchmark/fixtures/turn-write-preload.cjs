const { Socket } = require("node:net");
const { strictEqual } = require("node:assert");

const write = Socket.prototype.write;
Socket.prototype.write = function (chunk, ...args) {
  if (typeof chunk !== "string" || !chunk.startsWith('{"id":')) {
    return write.call(this, chunk, ...args);
  }
  const { method, params } = JSON.parse(chunk);
  if (method !== "turn/start" || params.threadId !== "thread-2") {
    return write.call(this, chunk, ...args);
  }
  if (process.env.FIXTURE_TURN_WRITE === "refused") throw new Error("fixture refused local write");

  // Buffer one complete JSON line until the real socket reports backpressure.
  this.cork();
  try {
    const padded = chunk.trimEnd() + " ".repeat(this.writableHighWaterMark) + "\n";
    const accepted = write.call(this, padded, ...args);
    strictEqual(accepted, false);
    process.stderr.write("fixture observed backpressure\n");
    return accepted;
  } finally {
    this.uncork();
  }
};
