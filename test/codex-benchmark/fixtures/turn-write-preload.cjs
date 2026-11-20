const { Socket } = require("node:net");
const { ok, strictEqual } = require("node:assert");

const write = Socket.prototype.write;
const mode = process.env.FIXTURE_TURN_WRITE;
const target = Number(process.env.FIXTURE_TURN_THREAD);
let threadStarts = 0;
Socket.prototype.write = function (chunk, ...args) {
  if (typeof chunk !== "string" || !chunk.startsWith('{"id":')) {
    return write.call(this, chunk, ...args);
  }
  const { method, params } = JSON.parse(chunk);
  if (mode === "ended") {
    const result = write.call(this, chunk, ...args);
    if (method === "thread/start" && ++threadStarts === target) this.end();
    return result;
  }
  if (method !== "turn/start" || params.threadId !== `thread-${target}`) {
    return write.call(this, chunk, ...args);
  }
  if (mode === "refused") throw new Error("fixture refused local write");
  if (mode === "peer-closed") {
    strictEqual(this.writable, true);
    const accepted = write.call(this, chunk, ...args);
    strictEqual(accepted, false);
    strictEqual(this.errored?.code, "EPIPE");
    process.stderr.write("fixture observed immediate EPIPE\n");
    return accepted;
  }

  // Buffer one complete JSON line until the real socket reports backpressure.
  this.cork();
  try {
    const padded = chunk.trimEnd() + " ".repeat(this.writableHighWaterMark) + "\n";
    const accepted = write.call(this, padded, ...args);
    strictEqual(accepted, false);
    strictEqual(this.errored, null);
    ok(this.writableLength > 0);
    process.stderr.write("fixture observed backpressure\n");
    return accepted;
  } finally {
    this.uncork();
  }
};
