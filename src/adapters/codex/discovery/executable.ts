import { realpathSync, statSync } from "node:fs";
import * as nodeModule from "node:module";
import { delimiter, dirname, join } from "node:path";

function hasType(path: string, type: "file" | "directory"): boolean {
  try {
    const stat = statSync(path);
    return type === "file" ? stat.isFile() : stat.isDirectory();
  } catch {
    return false;
  }
}

function resolveSdkPackage(): string {
  if (typeof nodeModule.findPackageJSON === "function") {
    const path = nodeModule.findPackageJSON("@openai/codex-sdk", import.meta.url);
    if (path) return path;
  }
  // Fall back when the runtime has no package result (including Bun, which does
  // not yet implement findPackageJSON). Lookup paths bypass the ESM-only export map.
  const localRequire = nodeModule.createRequire(import.meta.url);
  for (const directory of localRequire.resolve.paths("@openai/codex-sdk") ?? []) {
    const path = join(directory, "@openai/codex-sdk/package.json");
    if (hasType(path, "file")) return realpathSync(path);
  }
  throw new Error();
}

/** Resolve the SDK's installed optional binary without accessing SDK internals. */
export function resolveDiscoveryExecutable(env: NodeJS.ProcessEnv): string {
  const override = env.CDX_CHORES_CODEX_PATH?.trim();
  if (override) return override;
  const platform = process.platform === "android" ? "linux" : process.platform;
  const targetPlatform = {
    linux: "unknown-linux-musl",
    darwin: "apple-darwin",
    win32: "pc-windows-msvc",
  }[platform as "linux" | "darwin" | "win32"];
  const targetArch = { x64: "x86_64", arm64: "aarch64" }[process.arch as "x64" | "arm64"];
  if (!targetPlatform || !targetArch) {
    throw new Error("Codex discovery is unsupported on this platform.");
  }
  try {
    const sdkRequire = nodeModule.createRequire(resolveSdkPackage());
    const codexRequire = nodeModule.createRequire(sdkRequire.resolve("@openai/codex/package.json"));
    const packagePath = codexRequire.resolve(
      `@openai/codex-${platform}-${process.arch}/package.json`,
    );
    const root = join(dirname(packagePath), "vendor", `${targetArch}-${targetPlatform}`);
    const name = platform === "win32" ? "codex.exe" : "codex";
    const modern = join(root, "bin", name);
    const isModern = hasType(modern, "file") && hasType(join(root, "codex-package.json"), "file");
    const binary = isModern ? modern : join(root, "codex", name);
    if (!hasType(binary, "file")) throw new Error();
    const pathDirectory = join(root, isModern ? "codex-path" : "path");
    if (hasType(pathDirectory, "directory")) {
      const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
      const pathKey =
        platform === "win32"
          ? pathKeys.includes("Path")
            ? "Path"
            : (pathKeys.at(-1) ?? "PATH")
          : "PATH";
      const previous = env[pathKey] ?? "";
      if (platform === "win32") {
        for (const key of pathKeys) if (key !== pathKey) delete env[key];
      }
      env[pathKey] = [
        pathDirectory,
        ...previous.split(delimiter).filter((entry) => entry !== "" && entry !== pathDirectory),
      ].join(delimiter);
    }
    return binary;
  } catch {
    throw new Error(
      "Unable to locate the installed Codex binary; install its optional dependencies or set CDX_CHORES_CODEX_PATH.",
    );
  }
}
