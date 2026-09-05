import {
  constants,
  lstatSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  realpathSync,
  fstatSync,
  linkSync,
  readdirSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import type { Suite } from "./selection.ts";
import { rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  assertRunParent,
  assertRunPath,
  readFixtureContext,
  suitePath,
  type FixtureContext,
  type RunContext,
} from "./run-context.ts";

export interface FixtureOutput {
  /** An explicitly designated generated file, never a fixture directory or raw account state. */
  source: string;
  name: string;
  kind: "generated" | "diagnostic";
  required?: boolean;
}
interface Owner {
  context?: FixtureContext;
  dev: number;
  ino: number;
  outputs: FixtureOutput[];
  receipt?: string;
}
const owners = new Map<string, Owner>();
const repoRoot = resolve(import.meta.dirname, "../..");

export function registerFixtureOwner(root: string): void {
  const context = readFixtureContext(process.env, repoRoot);
  if (context) {
    const parent = join(suitePath(context.run, context.suite, "scratch"), "fixtures");
    if (dirname(root) !== parent) throw new Error("Fixture is outside its managed owner.");
    assertRunParent(context.run, root);
  }
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(root) !== root)
    throw new Error("Fixture owner must be a canonical directory.");
  if (owners.has(root)) throw new Error("Fixture owner already registered.");
  owners.set(root, { context, dev: stat.dev, ino: stat.ino, outputs: [] });
}

export function assertFixtureOwner(root: string): void {
  const owner = owners.get(root);
  if (!owner) throw new Error("Unknown fixture owner.");
  if (owner.context) assertRunParent(owner.context.run, root);
  const stat = lstatSync(root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.dev !== owner.dev ||
    stat.ino !== owner.ino ||
    realpathSync(root) !== root
  )
    throw new Error("Fixture owner was replaced; refusing access.");
}

export function registerFixtureOutput(root: string, output: FixtureOutput): void {
  assertFixtureOwner(root);
  const path = relative(root, output.source);
  if (
    !isAbsolute(output.source) ||
    !path ||
    path.startsWith("..") ||
    isAbsolute(path) ||
    resolve(output.source) !== output.source
  )
    throw new Error("Export source must be inside its fixture.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(output.name) || output.name === "manifest.json")
    throw new Error("Invalid fixture export name.");
  const owner = owners.get(root)!;
  if (owner.outputs.some((item) => item.name === output.name))
    throw new Error("Duplicate fixture export name.");
  if (owner.context && !owner.receipt) {
    owner.receipt = randomUUID();
    writeReceipt(owner, ".pending", { fixture: basename(root), state: "pending" });
  }
  owner.outputs.push({ ...output });
}

function readOutput(root: string, output: FixtureOutput): Buffer | undefined {
  assertFixtureOwner(root);
  let current = root;
  for (const part of relative(root, output.source).split(sep)) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error("Export source contains a symbolic link.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && !output.required) return undefined;
      throw error;
    }
  }
  const fd = openSync(output.source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024)
      throw new Error("Export must be a small independent regular file.");
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

function receiptPath(owner: Owner, suffix: string): string {
  const { run, suite } = owner.context!;
  return join(suitePath(run, suite, "scratch"), "exports", owner.receipt! + suffix + ".json");
}
function writeReceipt(owner: Owner, suffix: string, value: object): void {
  const path = receiptPath(owner, suffix);
  assertRunParent(owner.context!.run, path);
  writeFileSync(path, JSON.stringify({ version: 1, id: owner.receipt, ...value }), {
    flag: "wx",
    mode: 0o600,
  });
}

/** Validate in both modes, and copy before fixture teardown. No recursive fixture retention. */
export async function flushFixtureExports(root: string, successful: boolean): Promise<void> {
  assertFixtureOwner(root);
  const owner = owners.get(root)!;
  if (!owner.outputs.length) return;
  const context = owner.context;
  const records: Array<{
    name: string;
    kind: FixtureOutput["kind"];
    status: string;
    bytes: number;
  }> = [];
  let destination: string | undefined;
  if (context) {
    destination = join(
      suitePath(context.run, context.suite, "scratch"),
      "exports",
      owner.receipt! + ".staging",
    );
    assertRunParent(context.run, destination);
    mkdirSync(destination, { mode: 0o700 });
  }
  const errors: unknown[] = [];
  for (const output of owner.outputs) {
    try {
      const bytes = readOutput(root, output);
      if (!bytes) continue;
      if (destination && context) {
        const target = join(destination, output.name);
        assertRunParent(context.run, target);
        let created = false;
        try {
          const fd = openSync(
            target,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          created = true;
          try {
            writeFileSync(fd, bytes);
          } finally {
            closeSync(fd);
          }
        } catch (error) {
          if (created) {
            assertRunPath(context.run, relative(context.run.root, target));
            unlinkSync(target);
          }
          throw error;
        }
      }
      records.push({
        name: output.name,
        kind: output.kind,
        status: successful ? "checks-passed" : "diagnostic-after-failure",
        bytes: bytes.length,
      });
    } catch (error) {
      errors.push(error);
    }
  }
  if (destination && context) {
    const target = join(destination, "manifest.json");
    assertRunParent(context.run, target);
    writeFileSync(
      target,
      JSON.stringify(
        { version: 1, successful, exports: records, exportFailures: errors.length },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  }
  if (destination && context) {
    const published = join(suitePath(context.run, context.suite, "results"), basename(root));
    assertRunParent(context.run, published);
    mkdirSync(published, { mode: 0o700 });
    const stat = lstatSync(published);
    writeReceipt(owner, ".publishing", {
      state: "publishing",
      fixture: basename(root),
      dev: stat.dev,
      ino: stat.ino,
    });
    for (const name of [...records.map((record) => record.name), "manifest.json"]) {
      const source = join(destination, name);
      const target = join(published, name);
      assertRunPath(context.run, relative(context.run.root, source));
      assertRunParent(context.run, target);
      linkSync(source, target);
      assertRunPath(context.run, relative(context.run.root, source));
      unlinkSync(source);
    }
  }
  if (context) writeReceipt(owner, ".complete", { state: "complete", ok: errors.length === 0 });
  owner.outputs = [];
  if (errors.length) throw new AggregateError(errors, "Fixture export failed.");
}

export async function removeFixtureDir(root: string): Promise<void> {
  assertFixtureOwner(root);
  await rm(root, { recursive: true, force: false });
  owners.delete(root);
}

/** Run after Bun exits: incomplete registrations are failures in either retention mode. */
export async function inspectFixtureExports(
  run: RunContext,
  suite: Suite,
): Promise<{ ok: boolean; issues: string[] }> {
  const directory = join(suitePath(run, suite, "scratch"), "exports");
  const base = "scratch/" + suite + "/exports";
  const issues: string[] = [];
  try {
    assertRunPath(run, base);
    const names = readdirSync(directory);
    const read = (id: string, suffix: string): Record<string, unknown> => {
      const name = id + suffix + ".json";
      assertRunPath(run, base + "/" + name);
      const stat = lstatSync(join(directory, name));
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096)
        throw new Error("Invalid export receipt.");
      const value = JSON.parse(readFileSync(join(directory, name), "utf8")) as Record<
        string,
        unknown
      >;
      if (value.id !== id || value.version !== 1)
        throw new Error("Invalid export receipt identity.");
      return value;
    };
    for (const name of names) {
      if (!/^[a-f0-9-]{36}(\.(pending|publishing|complete)\.json|\.staging)$/.test(name))
        throw new Error("Unexpected export receipt.");
      if (!names.includes(name.slice(0, 36) + ".pending.json"))
        throw new Error("Orphan export receipt.");
    }
    for (const name of names.filter((name) => name.endsWith(".pending.json"))) {
      const id = name.slice(0, 36);
      const pending = read(id, ".pending");
      if (
        pending.state !== "pending" ||
        typeof pending.fixture !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pending.fixture)
      )
        throw new Error("Invalid export fixture.");
      let completed = false;
      if (names.includes(id + ".complete.json")) {
        try {
          const completion = read(id, ".complete");
          completed = completion.state === "complete" && typeof completion.ok === "boolean";
          if (!completed || !completion.ok) issues.push("Fixture export completed with failures.");
        } catch {
          issues.push("Fixture export completion receipt is incomplete.");
        }
      } else issues.push("Fixture export completion is pending.");
      if (!completed && names.includes(id + ".publishing.json")) {
        const publication = read(id, ".publishing");
        if (publication.state !== "publishing" || publication.fixture !== pending.fixture)
          throw new Error("Invalid publication receipt.");
        const path = join(suitePath(run, suite, "results"), pending.fixture);
        assertRunPath(run, "results/" + suite + "/" + pending.fixture);
        const stat = lstatSync(path);
        if (!stat.isDirectory() || stat.dev !== publication.dev || stat.ino !== publication.ino)
          throw new Error("Export destination was replaced.");
        await rm(path, { recursive: true, force: false });
      }
    }
  } catch {
    issues.push("Fixture export receipts could not be verified.");
  }
  return { ok: issues.length === 0, issues };
}
