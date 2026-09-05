import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, mkdir, open } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import { SUITES, type Suite } from "../suites/selection.ts";

const execute = promisify(execFile);
const suite = process.argv[2] as Suite;
let prerequisite = "Bun";
const versions: Record<string, string> = {};

function version(text: string): string {
  const match = /(\d+\.\d+(?:\.\d+)*(?:[-+][A-Za-z0-9.-]+)?)/.exec(text);
  if (!match) throw new Error("Missing version.");
  return match[1]!;
}

/** Descendants inherit the preflight process group; the parent owns its deadline. */
async function command(executable: string, args: string[]): Promise<string> {
  const result = await execute(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 64 * 1024,
  });
  return result.stdout;
}

async function executableOnPath(name: string): Promise<void> {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!isAbsolute(directory)) continue;
    try {
      await access(join(directory, name), constants.X_OK);
      return;
    } catch {
      /* Try the next declared executable directory. */
    }
  }
  throw new Error("Missing executable.");
}

async function copyCache(sourceHome: string | undefined, cacheParts: string[]): Promise<void> {
  if (!sourceHome || !isAbsolute(sourceHome) || !process.env.HOME || !isAbsolute(process.env.HOME))
    throw new Error("Missing isolated cache context.");
  let source = sourceHome;
  // Do not traverse symlinks below the explicitly supplied cache-source home.
  for (const part of cacheParts) {
    source = join(source, part);
    const stat = await lstat(source);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe cache directory.");
  }
  const destination = join(process.env.HOME, ...cacheParts);
  await mkdir(destination, { recursive: true });
  for (const extension of ["excel", "sqlite_scanner"]) {
    for (const suffix of [".duckdb_extension", ".duckdb_extension.info"]) {
      const name = `${extension}${suffix}`;
      const input = await open(join(source, name), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await input.stat();
        if (!stat.isFile() || stat.size === 0 || stat.size > 64 * 1024 * 1024)
          throw new Error("Invalid cache file.");
        const output = await open(join(destination, name), "wx", 0o600);
        try {
          await output.writeFile(await input.readFile());
        } finally {
          await output.close();
        }
      } finally {
        await input.close();
      }
    }
  }
}

try {
  if (!SUITES.includes(suite)) throw new Error("Invalid suite.");
  // process.versions avoids importing Bun types into the Node runtime compiler.
  if (!process.versions.bun) throw new Error("Bun is required.");
  versions.bun = version(process.versions.bun);
  prerequisite = "macOS process observation (/bin/ps)";
  if (process.platform !== "darwin") throw new Error("Unsupported platform.");
  await command("/bin/ps", ["-p", String(process.pid), "-o", "pid="]);

  if (suite === "app" || suite === "codex") {
    prerequisite = suite === "app" ? "Node.js with node:sqlite" : "Node.js";
    versions.node = version(
      await command("node", [
        "--input-type=module",
        "--eval",
        `${suite === "app" ? 'await import("node:sqlite");' : ""}process.stdout.write(process.versions.node);`,
      ]),
    );
    // Match the repository's supported Node runtime floor before any source CLI
    // or native package is exercised by tests.
    const [major, minor] = versions.node.split(".").map(Number);
    if (major! < 22 || (major === 22 && minor! < 23)) throw new Error("Unsupported Node runtime.");
  }
  if (suite === "codex") {
    prerequisite = "Installed repository Codex CLI";
    versions.codex = version(
      await command(join(process.cwd(), "node_modules/.bin/codex"), ["--version"]),
    );
  }
  if (suite === "pandoc") {
    prerequisite = "Pandoc";
    versions.pandoc = version(await command("pandoc", ["--version"]));
  }
  if (suite === "app") {
    prerequisite = "bash, git, zip, unzip, jq and macOS shell utilities";
    for (const [tool, flag] of [
      ["bash", "--version"],
      ["git", "--version"],
      ["zip", "-v"],
      ["unzip", "-v"],
      ["jq", "--version"],
    ] as const)
      versions[tool] = version(await command(tool, [flag]));
    for (const tool of [
      "sh",
      "cat",
      "chmod",
      "cp",
      "cut",
      "dirname",
      "head",
      "mkdir",
      "mktemp",
      "mv",
      "rm",
      "sed",
      "sort",
      "tail",
      "tr",
      "wc",
    ])
      await executableOnPath(tool);

    prerequisite = "DuckDB under Bun and Node.js";
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:", {
      autoinstall_known_extensions: "false",
      autoload_known_extensions: "false",
    });
    try {
      const connection = await instance.connect();
      try {
        const rawVersion = (await connection.runAndReadAll("SELECT version()")).getRows()[0]?.[0];
        const platform = (await connection.runAndReadAll("PRAGMA platform")).getRows()[0]?.[0];
        if (
          typeof rawVersion !== "string" ||
          !/^v\d+\.\d+\.\d+$/.test(rawVersion) ||
          typeof platform !== "string" ||
          !/^osx_(arm64|amd64)$/.test(platform)
        )
          throw new Error("Unrecognized native cache layout.");
        versions.duckdb = version(rawVersion);
        await command("node", [
          "--input-type=module",
          "--eval",
          'const {DuckDBInstance}=await import("@duckdb/node-api");const db=await DuckDBInstance.create(":memory:",{autoinstall_known_extensions:"false",autoload_known_extensions:"false"});try{const c=await db.connect();try{await c.run("SELECT 1");}finally{c.closeSync();}}finally{db.closeSync();}',
        ]);
        prerequisite = "Current DuckDB excel and sqlite_scanner extension cache";
        await copyCache(process.argv[3], [".duckdb", "extensions", rawVersion, platform]);
        await connection.run("LOAD excel");
        await connection.run("LOAD sqlite_scanner");
      } finally {
        connection.closeSync();
      }
    } finally {
      instance.closeSync();
    }
    prerequisite = "PDF.js package";
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof pdfjs.getDocument !== "function") throw new Error("PDF.js is unavailable.");
    versions.pdfjs = version(pdfjs.version);
  }
  process.stdout.write(JSON.stringify({ schema: 1, suite, versions }));
} catch {
  process.stdout.write(JSON.stringify({ schema: 1, suite, error: prerequisite }));
  process.exitCode = 1;
}
