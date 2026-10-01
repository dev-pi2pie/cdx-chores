import assert from "node:assert/strict";
import { join } from "node:path";
import {
  writeFile,
  readFile,
  link,
  symlink,
  mkdir,
  readdir,
  open,
  unlink,
  rename,
  rmdir,
} from "node:fs/promises";
import { PublicationSession } from "../../../../src/cli/video-frames/publication";
import { ImageStager } from "../../../../src/cli/video-frames/staging";
import { inspectSource } from "../../../../src/cli/video-frames/source";
import { png } from "./framing";
const [mode, root] = process.argv.slice(2) as [string, string];
const errno = (code: string) => Object.assign(new Error(`controlled ${code}`), { code });
async function main() {
  const source = join(root, "source.data"),
    folder = mode.includes("direct-source") ? root : join(root, "outputs");
  await writeFile(source, "source preserved");
  if (mode === "source-alias" || mode === "overwrite-source-alias") {
    await mkdir(folder);
    await link(source, join(folder, "alias.png"));
    await symlink(source, join(folder, "symbolic.png"));
  }
  const signal = new AbortController();
  let copied = 0;
  const session = await PublicationSession.create({
    folder,
    sourcePath: source,
    source: await inspectSource(source),
    signal: signal.signal,
    overwrite: mode.startsWith("overwrite"),
    io:
      mode === "fallback" ||
      mode === "copy-cancel" ||
      mode === "copy-close" ||
      mode === "stage-close" ||
      mode === "disk-full" ||
      mode === "quota" ||
      mode === "fallback-collision"
        ? {
            link: async (from, target) => {
              if (mode === "stage-close" || mode === "disk-full" || mode === "quota") {
                await link(from, target);
                return;
              }
              throw errno("ENOTSUP");
            },
            open: async (...args: Parameters<typeof open>) => {
              if (mode === "fallback-collision" && args[0] === join(folder, "first.png"))
                await writeFile(args[0], "competing writer");
              const handle = await open(...args);
              if (
                String(args[0]).endsWith(".stage") &&
                (mode === "stage-close" || mode === "disk-full" || mode === "quota")
              ) {
                if (mode === "stage-close") {
                  const close = handle.close.bind(handle);
                  handle.close = async () => {
                    await close();
                    throw errno("EIO");
                  };
                } else {
                  const write = handle.write.bind(handle);
                  handle.write = async (buffer: unknown) => {
                    if (Buffer.isBuffer(buffer)) await write(buffer, 0, Math.min(buffer.length, 3));
                    throw errno(mode === "quota" ? "EDQUOT" : "ENOSPC");
                  };
                }
                return handle;
              }
              if (args[0] !== join(folder, "first.png")) return handle;
              copied++;
              if (mode === "copy-cancel") {
                const write = handle.write.bind(handle);
                handle.write = (async (buffer: Buffer, offset: number, length: number) => {
                  const result = await write(buffer, offset, length);
                  signal.abort();
                  return result;
                }) as typeof handle.write;
              }
              if (mode === "copy-close") {
                const close = handle.close.bind(handle);
                let first = true;
                handle.close = async () => {
                  await close();
                  if (first) {
                    first = false;
                    throw errno("EIO");
                  }
                };
              }
              return handle;
            },
          }
        : mode === "link-collision"
          ? {
              link: async (_from, target) => {
                await writeFile(target, "competing writer");
                throw errno("EEXIST");
              },
            }
          : mode === "overwrite-failure"
            ? {
                rename: async () => {
                  throw errno("EPERM");
                },
              }
            : mode === "cleanup-failure"
              ? {
                  unlink: async () => {
                    throw errno("EACCES");
                  },
                }
              : mode === "slow" || mode === "byte-backpressure"
                ? {
                    link: async (from, target) => {
                      await new Promise((resolve) => setTimeout(resolve, 10));
                      await link(from, target);
                    },
                  }
                : undefined,
  });
  const writer = new ImageStager(
    session,
    "png",
    (index) => (index === 1 ? "first.png" : index === 2 ? "second.png" : `image-${index}.png`),
    { bytes: mode === "limit" ? 50 : mode === "byte-backpressure" ? png().length + 8 : undefined },
  );
  let expectedFailure = false;
  try {
    await writeFile(join(folder, "stale.png"), "stale preserved");
    if (mode.includes("direct-source")) {
      await assert.rejects(() => session.checkTarget("source.data"), /aliases/);
      return { directSourceRejected: true };
    }
    if (mode === "parent-replaced") {
      const held = join(root, "held-output");
      await rename(folder, held);
      await mkdir(folder);
      try {
        await assert.rejects(() => session.checkTarget("first.png"), /ownership/);
        await assert.rejects(() => session.cleanup(true), /ownership/);
      } finally {
        await rmdir(folder);
        await rename(held, folder);
      }
      return { parentReplacementRejected: true };
    }
    if (mode === "source-alias" || mode === "overwrite-source-alias") {
      await assert.rejects(() => session.checkTarget("alias.png"), /aliases/);
      await assert.rejects(() => session.checkTarget("symbolic.png"), /ordinary/);
      return { aliasesRejected: true };
    }
    if (mode === "target-kind") {
      await mkdir(join(folder, "directory.png"));
      await assert.rejects(() => session.checkTarget("directory.png"), /ordinary/);
      await assert.rejects(() => session.checkTarget("../escape.png"), /basename/);
      return { kindRejected: true };
    }
    if (mode.startsWith("overwrite")) await writeFile(join(folder, "first.png"), "old target");
    if (mode === "overwrite-unrelated-hardlink")
      await link(join(folder, "first.png"), join(folder, "other-link.png"));
    if (mode === "late-collision") await writeFile(join(folder, "second.png"), "old second");
    if (mode === "partial") {
      await writer.chunk(Buffer.concat([png(), png().subarray(0, -1)]));
      await assert.rejects(() => writer.finish(), /incomplete/);
      expectedFailure = true;
      await writer.settle();
      assert.equal(session.written, 1);
      assert.equal((await readFile(join(folder, "first.png"))).equals(png()), true);
    } else if (
      [
        "limit",
        "link-collision",
        "overwrite-failure",
        "copy-cancel",
        "copy-close",
        "cleanup-failure",
        "late-collision",
        "stage-close",
        "disk-full",
        "quota",
        "fallback-collision",
      ].includes(mode)
    ) {
      await assert.rejects(async () => {
        await writer.chunk(Buffer.concat(mode === "late-collision" ? [png(), png()] : [png()]));
        await writer.finish();
      });
      expectedFailure = true;
      await writer.settle();
      assert.equal(
        session.written,
        mode === "cleanup-failure" || mode === "late-collision" ? 1 : 0,
      );
      if (mode === "overwrite-failure")
        assert.equal(await readFile(join(folder, "first.png"), "utf8"), "old target");
      if (mode === "link-collision")
        assert.equal(await readFile(join(folder, "first.png"), "utf8"), "competing writer");
      if (mode === "fallback-collision")
        assert.equal(await readFile(join(folder, "first.png"), "utf8"), "competing writer");
      if (mode === "late-collision")
        assert.equal(await readFile(join(folder, "second.png"), "utf8"), "old second");
      if (mode.startsWith("copy-")) assert.equal(session.incomplete, join(folder, "first.png"));
      if (mode === "limit") assert.ok(writer.peaks.bytes <= 50);
    } else {
      const count = mode === "slow" || mode === "byte-backpressure" ? 4 : 2;
      await writer.chunk(Buffer.concat(Array.from({ length: count }, () => png())));
      await writer.finish();
      assert.equal(session.written, count);
      assert.ok(writer.peaks.files <= 2);
      assert.ok(writer.peaks.bytes <= 256 * 1024 * 1024);
      if (mode === "slow" || mode === "byte-backpressure") assert.equal(writer.peaks.files, 2);
      if (mode === "byte-backpressure") assert.ok(writer.peaks.bytes <= png().length + 8);
      assert.ok((await readFile(join(folder, "first.png"))).equals(png()));
      assert.ok((await readFile(join(folder, "second.png"))).equals(png()));
      if (mode === "fallback") assert.equal(copied, 1); // Only the named handle is counted.
      if (mode === "overwrite-unrelated-hardlink")
        assert.equal(await readFile(join(folder, "other-link.png"), "utf8"), "old target");
      if (mode === "foreign-staging") {
        const foreign = join(session.staging, "foreign.stage");
        await writeFile(foreign, "foreign preserved");
        await assert.rejects(() => session.cleanup(true), /ownership/);
        assert.equal(await readFile(foreign, "utf8"), "foreign preserved");
        await unlink(foreign); // Owned test setup, deliberately outside product cleanup.
      }
      if (mode === "closure-unconfirmed")
        await assert.rejects(() => session.cleanup(false), /ownership/);
    }
    return {
      written: session.written,
      expectedFailure,
      peaks: writer.peaks,
      incomplete: Boolean(session.incomplete),
    };
  } finally {
    await writer.settle();
    if (mode === "cleanup-failure") {
      await assert.rejects(() => session.cleanup(true), /EACCES/);
      session.io.unlink = unlink;
    }
    await session.cleanup(true);
    assert.equal(await readFile(source, "utf8"), "source preserved");
    assert.equal(await readFile(join(folder, "stale.png"), "utf8"), "stale preserved");
    assert.ok(!(await readdir(folder)).some((name) => name.startsWith(".cdx-frames-")));
  }
}
main().then(
  (value) => console.log(JSON.stringify(value)),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
