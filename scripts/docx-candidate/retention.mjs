import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, opendir, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { HarnessError, safeId } from "./harness/errors.mjs";

const formats = ["esm", "cjs"];
const outcomes = new Set(["pending", "passed", "failed"]);
const inputLimit = 8 * 1024 * 1024;
const resultLimit = 2 * 1024 * 1024;
const totalLimit = 64 * 1024 * 1024;

function invalid() {
  return new HarnessError("runner", "Retain smoke artifacts");
}

async function directory(path, create = false) {
  if (create) {
    try {
      await mkdir(path);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalid();
  return stat;
}

async function entries(path, limit) {
  const names = [];
  const stream = await opendir(path);
  for await (const entry of stream) {
    if (names.length >= limit || (!entry.isDirectory() && !entry.isFile())) throw invalid();
    names.push(entry.name);
  }
  return names.sort();
}

async function readSelected(path, limit) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit) throw invalid();
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size > limit)
      throw invalid();
    // Read at most one byte beyond the declared bound, including if a file grows.
    const bytes = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    if (offset !== stat.size) throw invalid();
    return bytes.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function resultRecord(bytes, id, format) {
  const value = JSON.parse(bytes.toString("utf8"));
  if (
    !value ||
    Array.isArray(value) ||
    value.id !== id ||
    value.format !== format ||
    !outcomes.has(value.outcome) ||
    (value.outcome === "passed" &&
      (!Object.hasOwn(value, "read") || !Object.hasOwn(value, "evidence"))) ||
    Object.keys(value).some((key) => !["id", "format", "outcome", "read", "evidence"].includes(key))
  )
    throw invalid();
  return value;
}

/** Publication is called only after the harness has confirmed process settlement. */
export async function prepareSmokeRetention(repo, { expectedCaseIds }) {
  if (
    !Array.isArray(expectedCaseIds) ||
    !expectedCaseIds.length ||
    expectedCaseIds.length > 256 ||
    expectedCaseIds.some((id) => !safeId(id)) ||
    new Set(expectedCaseIds).size !== expectedCaseIds.length
  )
    throw invalid();
  const ids = [...expectedCaseIds].sort();
  const allowedIds = new Set(ids);
  const root = resolve(repo);
  await directory(root);
  const canonicalRoot = await realpath(root);
  async function destination(create) {
    if ((await realpath(root)) !== canonicalRoot) throw invalid();
    let path = root;
    await directory(path);
    for (const part of ["examples", "playground", "docx-candidate", "smoke"]) {
      path = join(path, part);
      await directory(path, create);
    }
    return path;
  }
  const target = await destination(true);
  const targetIdentity = await lstat(target);
  async function verifyDestination() {
    await destination(false);
    const stat = await lstat(target);
    if (stat.dev !== targetIdentity.dev || stat.ino !== targetIdentity.ino) throw invalid();
  }

  return {
    async publish(workspace, { outcome }) {
      if (!["passed", "failed", "cancelled"].includes(outcome)) throw invalid();
      let run;
      let identity;
      try {
        await verifyDestination();
        run = await mkdtemp(join(target, "run-"));
        identity = await lstat(run);
        const summary = {
          schemaVersion: 1,
          scope: "smoke",
          outcome,
          complete: false,
          formats: {},
        };
        let totalBytes = 0;
        await directory(workspace);
        const source = join(workspace, "smoke-artifacts");
        let sourceFormats = [];
        try {
          await directory(source);
          sourceFormats = await entries(source, formats.length);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (sourceFormats.some((format) => !formats.includes(format))) throw invalid();
        for (const format of formats) {
          const cases = [];
          const formatSource = join(source, format);
          const present = sourceFormats.includes(format)
            ? await entries(formatSource, ids.length)
            : [];
          if (present.some((id) => !allowedIds.has(id))) throw invalid();
          for (const id of present) {
            const caseSource = join(formatSource, id);
            await directory(formatSource);
            await directory(caseSource);
            const files = await entries(caseSource, 2);
            if (files.some((name) => !["input.docx", "result.json"].includes(name)))
              throw invalid();
            const caseTarget = join(run, format, id);
            await mkdir(caseTarget, { recursive: true });
            let result;
            for (const file of files) {
              await directory(caseSource);
              const bytes = await readSelected(
                join(caseSource, file),
                file === "input.docx" ? inputLimit : resultLimit,
              );
              totalBytes += bytes.length;
              if (totalBytes > totalLimit) throw invalid();
              if (file === "result.json") result = resultRecord(bytes, id, format);
              await writeFile(join(caseTarget, file), bytes, { flag: "wx" });
            }
            cases.push({
              id,
              outcome: result?.outcome ?? "pending",
              complete: files.length === 2 && result?.outcome === "passed",
            });
          }
          summary.formats[format] = {
            expected: ids.length,
            retained: cases.length,
            passed: cases.filter((item) => item.complete).length,
            failed: cases.filter((item) => item.outcome === "failed").length,
            cases,
          };
        }
        summary.complete =
          outcome === "passed" &&
          formats.every((format) => summary.formats[format].passed === ids.length);
        if (outcome === "passed" && !summary.complete) throw invalid();
        await verifyDestination();
        await writeFile(join(run, "summary.json"), JSON.stringify(summary, null, 2) + "\n", {
          flag: "wx",
        });
        return relative(root, run).split("\\").join("/");
      } catch {
        if (run && identity) {
          // Never remove a replacement directory or traverse a substituted ancestor.
          await verifyDestination();
          const current = await lstat(run);
          if (
            current.dev === identity.dev &&
            current.ino === identity.ino &&
            current.isDirectory() &&
            !current.isSymbolicLink()
          )
            await rm(run, { recursive: true, force: false });
        }
        throw invalid();
      }
    },
  };
}
