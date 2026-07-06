import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import { CliError } from "./errors";

interface SafeWriteOptions {
  displayPath?: (path: string) => string;
  label?: string;
  overwrite?: boolean;
  parentRootDirectory?: string;
  sanitizeMessage?: (message: string) => string;
}

type FileContent = Buffer | string;

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isInsideDirectory(input: { directory: string; path: string }): boolean {
  const relativePath = relative(input.directory, input.path);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export async function assertNoSymlinkPathParents(input: {
  displayPath?: (path: string) => string;
  label: string;
  parentRootDirectory?: string;
  path: string;
  sanitizeMessage?: (message: string) => string;
}): Promise<void> {
  const absolutePath = resolve(input.path);
  const parentDirectory = dirname(absolutePath);
  const preferredRoot = input.parentRootDirectory ? resolve(input.parentRootDirectory) : undefined;
  const root =
    preferredRoot && isInsideDirectory({ directory: preferredRoot, path: parentDirectory })
      ? preferredRoot
      : parse(parentDirectory).root;
  const relativeParentDirectory = relative(root, parentDirectory);

  let currentPath = root;
  for (const segment of ["", ...relativeParentDirectory.split(sep).filter(Boolean)]) {
    if (segment) {
      currentPath = join(currentPath, segment);
    }
    try {
      const stats = await lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new CliError(
          `${input.label} parent directory is a symlink and cannot be written safely: ${
            input.displayPath?.(currentPath) ?? currentPath
          }`,
          {
            code: "OUTPUT_SYMLINK",
            exitCode: 2,
          },
        );
      }
      if (!stats.isDirectory()) {
        throw new CliError(
          `${input.label} parent path is not a directory: ${
            input.displayPath?.(currentPath) ?? currentPath
          }`,
          {
            code: "INVALID_INPUT",
            exitCode: 2,
          },
        );
      }
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
      if (isNotFoundError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Failed to inspect ${input.label} parent path: ${
          input.displayPath?.(currentPath) ?? currentPath
        } (${input.sanitizeMessage?.(message) ?? message})`,
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
        },
      );
    }
  }
}

async function assertNoSymlinkParentSegments(input: {
  displayPath?: (path: string) => string;
  label: string;
  parentRootDirectory?: string;
  path: string;
  sanitizeMessage?: (message: string) => string;
}): Promise<void> {
  if (!input.parentRootDirectory) {
    return;
  }
  await assertNoSymlinkPathParents(input);
}

async function writeFileHandleContent(
  handle: Awaited<ReturnType<typeof open>>,
  content: FileContent,
) {
  if (typeof content === "string") {
    await handle.writeFile(content, "utf8");
    return;
  }
  await handle.writeFile(content);
}

async function assertExistingOutputPathWritable(input: {
  displayPath?: (path: string) => string;
  existingFileLabel: string;
  label: string;
  overwrite: boolean;
  path: string;
  sanitizeMessage?: (message: string) => string;
}): Promise<void> {
  const displayPath = input.displayPath?.(input.path) ?? input.path;
  try {
    const outputStats = await lstat(input.path);
    if (outputStats.isSymbolicLink()) {
      throw new CliError(
        `${input.label} is a symlink and cannot be written safely: ${displayPath}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (outputStats.isDirectory()) {
      throw new CliError(`${input.label} is a directory: ${displayPath}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!input.overwrite) {
      throw new CliError(
        `${input.existingFileLabel} already exists: ${displayPath}. Use --overwrite to replace it.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (!isNotFoundError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(
        `Failed to inspect ${input.label}: ${displayPath} (${
          input.sanitizeMessage?.(message) ?? message
        })`,
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
        },
      );
    }
  }
}

async function writeFileViaTempReplace(input: {
  content: FileContent;
  displayPath?: (path: string) => string;
  label: string;
  parentRootDirectory: string;
  path: string;
  sanitizeMessage?: (message: string) => string;
}): Promise<void> {
  const parentDirectory = dirname(input.path);
  const tempPath = join(
    parentDirectory,
    `.${basename(input.path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  const displayPath = input.displayPath?.(input.path) ?? input.path;
  try {
    await assertNoSymlinkParentSegments(input);
    handle = await open(
      tempPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    await writeFileHandleContent(handle, input.content);
    await handle.close();
    handle = undefined;
    await assertNoSymlinkParentSegments(input);
    await rename(tempPath, input.path);
  } catch (error) {
    await handle?.close();
    await rm(tempPath, { force: true });
    if (error instanceof CliError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to write ${input.label}: ${displayPath} (${
        input.sanitizeMessage?.(message) ?? message
      })`,
      {
        code: "FILE_WRITE_ERROR",
        exitCode: 2,
      },
    );
  }
}

export async function readTextFileRequired(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read file: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

export async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function writeTextFileSafe(
  path: string,
  content: string,
  options: SafeWriteOptions = {},
): Promise<void> {
  await writeFileSafe(path, content, options);
}

export async function writeBufferFileSafe(
  path: string,
  content: Buffer,
  options: SafeWriteOptions = {},
): Promise<void> {
  await writeFileSafe(path, content, options);
}

async function writeFileSafe(
  path: string,
  content: FileContent,
  options: SafeWriteOptions = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  const label = options.label ?? "Output path";
  const existingFileLabel = options.label ?? "Output file";
  await assertNoSymlinkParentSegments({
    displayPath: options.displayPath,
    label,
    parentRootDirectory: options.parentRootDirectory,
    path,
    sanitizeMessage: options.sanitizeMessage,
  });
  await assertExistingOutputPathWritable({
    displayPath: options.displayPath,
    existingFileLabel,
    label,
    overwrite,
    path,
    sanitizeMessage: options.sanitizeMessage,
  });

  await ensureParentDir(path);
  await assertNoSymlinkParentSegments({
    displayPath: options.displayPath,
    label,
    parentRootDirectory: options.parentRootDirectory,
    path,
    sanitizeMessage: options.sanitizeMessage,
  });
  if (overwrite && options.parentRootDirectory) {
    await writeFileViaTempReplace({
      content,
      displayPath: options.displayPath,
      label,
      parentRootDirectory: options.parentRootDirectory,
      path,
      sanitizeMessage: options.sanitizeMessage,
    });
    return;
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  const flags = overwrite
    ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let handle;
  const displayPath = options.displayPath?.(path) ?? path;
  try {
    handle = await open(path, flags, 0o666);
    await writeFileHandleContent(handle, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to write file: ${displayPath} (${options.sanitizeMessage?.(message) ?? message})`,
      {
        code: "FILE_WRITE_ERROR",
        exitCode: 2,
      },
    );
  } finally {
    await handle?.close();
  }
}
