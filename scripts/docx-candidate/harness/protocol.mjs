import { HarnessError, safeId } from "./errors.mjs";
import { createOutputWriter } from "./output.mjs";

const PREFIX = "DOCX_PROGRESS ";
const MAX_LINE = 512;

function validProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (value.event === "scope")
    return (
      keys === "event,total" &&
      Number.isSafeInteger(value.total) &&
      value.total > 0 &&
      value.total <= 100_000
    );
  if (value.event === "start" || value.event === "failure")
    return keys === "event,id" && safeId(value.id);
  return (
    value.event === "complete" &&
    keys === "completed,event,id" &&
    safeId(value.id) &&
    Number.isSafeInteger(value.completed) &&
    value.completed > 0 &&
    value.completed <= 100_000
  );
}

let output;
/** Child producers await writes only at case/workload boundaries. */
export async function emitProgress(event) {
  if (!validProgress(event)) throw new HarnessError("output");
  output ??= createOutputWriter(process.stderr);
  await output.write(`${PREFIX}${JSON.stringify(event)}\n`);
}

/** Ignore unrelated logs; never forward their bytes into public progress. */
export function createProgressDecoder(onEvent) {
  let partial = Buffer.alloc(0);
  let dropping = false;
  let total;
  let completed = 0;
  let current;
  let failureId;
  const accept = async (line) => {
    if (!line.startsWith(PREFIX)) return;
    let event;
    try {
      event = JSON.parse(line.slice(PREFIX.length));
    } catch {
      throw new HarnessError("output");
    }
    if (!validProgress(event)) throw new HarnessError("output");
    if (event.event === "scope") {
      if (total !== undefined) throw new HarnessError("output");
      total = event.total;
    } else if (event.event === "start") {
      if (!total || current || completed >= total) throw new HarnessError("output");
      current = event.id;
    } else if (event.event === "failure") {
      if (!total || event.id !== current) throw new HarnessError("output");
      failureId ??= event.id;
    } else {
      if (event.id !== current || event.completed !== completed + 1 || event.completed > total)
        throw new HarnessError("output");
      completed = event.completed;
      current = undefined;
    }
    await onEvent(event);
  };
  return {
    get current() {
      return failureId ?? current;
    },
    async push(chunk) {
      let offset = 0;
      while (offset < chunk.length) {
        const end = chunk.indexOf(10, offset);
        const limit = end < 0 ? chunk.length : end;
        if (!dropping) {
          const length = partial.length + limit - offset;
          if (length > MAX_LINE) {
            const prefixBytes = Buffer.concat([
              partial,
              chunk.subarray(offset, Math.min(limit, offset + PREFIX.length)),
            ]);
            if (prefixBytes.toString("utf8").startsWith(PREFIX)) throw new HarnessError("output");
            dropping = true;
            partial = Buffer.alloc(0);
          } else partial = Buffer.concat([partial, chunk.subarray(offset, limit)]);
        }
        if (end < 0) break;
        if (!dropping) await accept(partial.toString("utf8"));
        partial = Buffer.alloc(0);
        dropping = false;
        offset = end + 1;
      }
    },
    finish() {
      if (
        partial.toString("utf8").startsWith(PREFIX) ||
        (total !== undefined && (current || completed !== total))
      )
        throw new HarnessError("output");
    },
  };
}
