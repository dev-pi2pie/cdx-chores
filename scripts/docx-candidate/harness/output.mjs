import { HarnessError } from "./errors.mjs";

/** Bound queued bytes and delivery time, including a destination that never drains. */
export function createOutputWriter(destination, onFailure = () => {}) {
  let failed;
  let pendingBytes = 0;
  let active;
  const queue = [];
  const fail = () => {
    if (failed) return;
    failed = new HarnessError("output");
    if (active) {
      clearTimeout(active.timer);
      active.reject(failed);
      active = undefined;
    }
    for (const item of queue.splice(0)) item.reject(failed);
    pendingBytes = 0;
    onFailure(failed);
    // Release a blocked pipe; late stream errors remain handled below.
    destination.destroy?.();
  };
  const error = () => fail();
  destination.on("error", error);
  const close = () => {
    if (active || queue.length) fail();
  };
  destination.on("close", close);
  const drain = () => {
    if (active || failed || !queue.length) return;
    const item = queue.shift();
    active = item;
    item.timer = setTimeout(fail, 5_000);
    try {
      destination.write(item.bytes, (writeError) => {
        if (writeError) return fail();
        if (active !== item) return;
        clearTimeout(item.timer);
        active = undefined;
        pendingBytes -= item.bytes.length;
        item.resolve();
        drain();
      });
    } catch {
      fail();
    }
  };
  return {
    get failed() {
      return failed;
    },
    write(value) {
      if (failed) return Promise.reject(failed);
      const bytes = Buffer.from(value);
      if (bytes.length + pendingBytes > 64 * 1024) {
        fail();
        return Promise.reject(failed);
      }
      pendingBytes += bytes.length;
      return new Promise((resolve, reject) => {
        queue.push({ bytes, resolve, reject });
        drain();
      });
    },
    dispose() {
      if (!failed) {
        destination.removeListener("error", error);
        destination.removeListener("close", close);
      }
    },
  };
}
