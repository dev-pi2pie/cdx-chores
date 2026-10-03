import { expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, stat, writeFile, link, symlink } from "node:fs/promises";
import { frameDestination } from "../../../src/cli/video-frames/destination";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
test("destinations use source-adjacent defaults, invocation-cwd custom paths, and mode-specific kinds without creating folders", () =>
  withTempFixtureDir("frame-destinations", async (root) => {
    const inputs = join(root, "inputs"),
      source = join(inputs, "Crème Clip.mp4");
    await mkdir(inputs);
    await writeFile(source, "source");
    const single = await frameDestination({ mode: "single", source, format: "png" });
    expect(single.kind).toBe("file");
    expect(single.path).toBe(join(inputs, "creme-clip-frame.png"));
    for (const mode of ["set", "sequence"] as const) {
      const value = await frameDestination({ mode, source, format: "png" });
      expect(value.kind).toBe("folder");
      expect(value.path).toBe(join(inputs, "creme-clip-frames"));
      await expect(stat(value.path)).rejects.toMatchObject({ code: "ENOENT" });
    }
    const literal = await frameDestination({
      mode: "single",
      source,
      format: "jpg",
      output: "My image.JPEG",
      cwd: root,
    });
    expect(literal.path).toBe(join(root, "My image.JPEG"));
    const sequence = await frameDestination({
      mode: "sequence",
      source,
      format: "png",
      output: "one-image.png",
      cwd: root,
    });
    expect(sequence.kind).toBe("folder");
    expect(sequence.path).toBe(join(root, "one-image.png"));
    await expect(stat(sequence.path)).rejects.toMatchObject({ code: "ENOENT" });
    for (const output of ["no-extension", "wrong.webp", "empty."])
      await expect(
        frameDestination({ mode: "single", source, format: "jpg", output, cwd: root }),
      ).rejects.toMatchObject({ code: "FRAME_EXTENSION_INVALID" });
    await expect(
      frameDestination({ mode: "single", source, format: "png", output: " ", cwd: root }),
    ).rejects.toMatchObject({ code: "FRAME_TARGET_INVALID" });
  }));
test("existing kind, aliases and nonempty folders are inspected without clearing files", () =>
  withTempFixtureDir("frame-destinations", async (root) => {
    const source = join(root, "source.png"),
      folder = join(root, "images"),
      alias = join(root, "alias.png");
    await writeFile(source, "source");
    await mkdir(folder);
    await writeFile(join(folder, "stale.txt"), "stale");
    const existing = await frameDestination({
      mode: "sequence",
      source,
      format: "png",
      output: folder,
    });
    expect(existing.nonempty).toBe(true);
    expect((await stat(join(folder, "stale.txt"))).isFile()).toBe(true);
    await expect(
      frameDestination({ mode: "single", source, format: "png", output: source }),
    ).rejects.toMatchObject({ code: "FRAME_SOURCE_ALIAS" });
    await link(source, alias);
    await expect(
      frameDestination({ mode: "single", source, format: "png", output: alias }),
    ).rejects.toMatchObject({ code: "FRAME_SOURCE_ALIAS" });
    await expect(
      frameDestination({ mode: "sequence", source, format: "png", output: source }),
    ).rejects.toMatchObject({ code: "FRAME_TARGET_KIND" });
    await expect(
      frameDestination({ mode: "single", source, format: "png", output: folder }),
    ).rejects.toMatchObject({ code: "FRAME_EXTENSION_INVALID" });
    const linked = join(root, "link.png");
    await symlink(source, linked);
    await expect(
      frameDestination({ mode: "single", source, format: "png", output: linked }),
    ).rejects.toMatchObject({ code: "FRAME_TARGET_KIND" });
  }));
