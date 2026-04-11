import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, createTempFixtureDir } from "./helpers/cli-test-utils";

type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function stripBenignGitWarnings(stderr: string): string {
  return stderr
    .split("\n")
    .filter(
      (line) =>
        line !==
        "git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead",
    )
    .join("\n")
    .trim();
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
  } = {},
): RunResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    input: options.input,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function expectSuccess(result: RunResult): void {
  expect(result.status).toBe(0);
  expect(stripBenignGitWarnings(result.stderr)).toBe("");
}

function git(cwd: string, ...args: string[]): RunResult {
  return runCommand("git", args, { cwd });
}

async function createReleaseFixtureRepo(prefix: string): Promise<string> {
  const repoDir = await createTempFixtureDir(prefix);

  expectSuccess(git(repoDir, "init", "-q"));
  expectSuccess(git(repoDir, "config", "user.name", "Release Tester"));
  expectSuccess(git(repoDir, "config", "user.email", "release.tester@example.com"));

  await writeFile(join(repoDir, "notes.txt"), "initial\n", "utf8");
  expectSuccess(git(repoDir, "add", "notes.txt"));
  expectSuccess(git(repoDir, "commit", "-m", "chore: bootstrap release fixtures"));
  expectSuccess(git(repoDir, "tag", "v0.1.0"));

  return repoDir;
}

describe("release workflow helpers", () => {
  test("filters allowed release branches by remote-prefix policy", () => {
    const result = runCommand(
      "bash",
      [join(REPO_ROOT, "scripts", "filter-allowed-release-branches.sh")],
      {
        input: [
          "origin/main",
          "origin/beta",
          "origin/alpha-release",
          "origin/canary-nightly",
          "origin/dev",
          "origin/feature/devtools-cleanup",
          "origin/hotfix/beta-roll-forward",
          "origin/release/canary-checks",
        ].join("\n"),
      },
    );

    expectSuccess(result);
    expect(result.stdout.trim().split("\n")).toEqual([
      "origin/beta",
      "origin/alpha-release",
      "origin/canary-nightly",
      "origin/dev",
    ]);
  });
});

describe("stable release notes script", () => {
  test("uses CHANGELOGS override content when a matching stable release note exists", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-manual-override");

    try {
      await mkdir(join(repoDir, "CHANGELOGS"), { recursive: true });
      await writeFile(
        join(repoDir, "CHANGELOGS", "v0.2.0.md"),
        [
          "## What's Changed",
          "",
          "### New Features",
          "- Added a hand-curated stable release body",
          "",
          "### Changelog",
          "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
          "",
        ].join("\n"),
        "utf8",
      );

      await writeFile(join(repoDir, "notes.txt"), "feature patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt", "CHANGELOGS/v0.2.0.md"));
      expectSuccess(
        git(repoDir, "commit", "-m", "feat(api): generated fallback should be skipped"),
      );
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
          "--repository",
          "example/project",
        ],
        { cwd: repoDir },
      );

      expectSuccess(result);
      expect(result.stdout).toContain("- Added a hand-curated stable release body");
      expect(result.stdout).toContain(
        "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
      );
      expect(result.stdout).not.toContain("generated fallback should be skipped");
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test("reads CHANGELOGS override content from the tagged tree instead of branch head", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-tagged-override");

    try {
      await mkdir(join(repoDir, "CHANGELOGS"), { recursive: true });
      await writeFile(
        join(repoDir, "CHANGELOGS", "v0.2.0.md"),
        [
          "## What's Changed",
          "",
          "### New Features",
          "- Tagged stable release body",
          "",
          "### Changelog",
          "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
          "",
        ].join("\n"),
        "utf8",
      );

      await writeFile(join(repoDir, "notes.txt"), "feature patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt", "CHANGELOGS/v0.2.0.md"));
      expectSuccess(git(repoDir, "commit", "-m", "feat(api): tag a curated stable release body"));
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      await writeFile(
        join(repoDir, "CHANGELOGS", "v0.2.0.md"),
        [
          "## What's Changed",
          "",
          "### New Features",
          "- Branch-head release body that should be ignored",
          "",
          "### Changelog",
          "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
          "",
        ].join("\n"),
        "utf8",
      );
      expectSuccess(git(repoDir, "add", "CHANGELOGS/v0.2.0.md"));
      expectSuccess(git(repoDir, "commit", "-m", "docs: rewrite stable notes after the tag"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
          "--repository",
          "example/project",
        ],
        { cwd: repoDir },
      );

      expectSuccess(result);
      expect(result.stdout).toContain("- Tagged stable release body");
      expect(result.stdout).not.toContain("- Branch-head release body that should be ignored");
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test("fails when a matching CHANGELOGS override file is empty", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-empty-override");

    try {
      await mkdir(join(repoDir, "CHANGELOGS"), { recursive: true });
      await writeFile(join(repoDir, "CHANGELOGS", "v0.2.0.md"), "\n \n\t", "utf8");

      await writeFile(join(repoDir, "notes.txt"), "feature patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt", "CHANGELOGS/v0.2.0.md"));
      expectSuccess(git(repoDir, "commit", "-m", "feat(api): empty override should fail"));
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
          "--repository",
          "example/project",
        ],
        { cwd: repoDir },
      );

      expect(result.status).toBe(1);
      expect(stripBenignGitWarnings(result.stderr)).toContain(
        "Stable release notes override exists but is empty: CHANGELOGS/v0.2.0.md",
      );
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test("falls back to generated notes when no matching CHANGELOGS override file exists", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-generated-fallback");

    try {
      await mkdir(join(repoDir, "CHANGELOGS"), { recursive: true });
      await writeFile(
        join(repoDir, "CHANGELOGS", "v9.9.9.md"),
        "## What's Changed\n\n- unrelated future note\n",
        "utf8",
      );

      await writeFile(join(repoDir, "notes.txt"), "feature patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt"));
      expectSuccess(git(repoDir, "commit", "-m", "feat(api): generated fallback still works"));
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
          "--repository",
          "example/project",
        ],
        { cwd: repoDir },
      );

      expectSuccess(result);
      expect(result.stdout).toContain("### New Features");
      expect(result.stdout).toContain("- feat(api): generated fallback still works");
      expect(result.stdout).toContain(
        "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
      );
      expect(result.stdout).not.toContain("unrelated future note");
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test("hybrid mode deduplicates grouped entries for multi-commit pull requests", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-hybrid");

    try {
      await writeFile(join(repoDir, "notes.txt"), "first patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt"));
      expectSuccess(git(repoDir, "commit", "-m", "fix(api): first patch (#42)"));

      await writeFile(join(repoDir, "notes.txt"), "second patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt"));
      expectSuccess(git(repoDir, "commit", "-m", "fix(api): second patch (#42)"));
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
        ],
        { cwd: repoDir },
      );

      expectSuccess(result);

      const groupedSection = result.stdout.split("### Changelog")[0] ?? "";
      expect(groupedSection).toContain("### Bug Fixes");
      expect(groupedSection.match(/\(#42\)/g)?.length ?? 0).toBe(1);
      expect(groupedSection).not.toContain("second patch (#42)");

      expect(result.stdout).toContain("Full Changelog: v0.1.0...v0.2.0");
      expect(result.stdout.match(/^- #42 /gm)?.length ?? 0).toBe(1);
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  test("groups PR-backed entries using the resolved PR title instead of the commit subject", async () => {
    const repoDir = await createReleaseFixtureRepo("release-notes-pr-title");
    const fakeBinDir = join(repoDir, "fake-bin");

    try {
      await mkdir(fakeBinDir, { recursive: true });

      await writeFile(
        join(fakeBinDir, "curl"),
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          'url="${@: -1}"',
          'if [[ "$url" == *"/repos/example/project/commits/"*"/pulls" ]]; then',
          '  printf \'%s\' \'[{"number":77,"title":"fix(parser): release-safe title","user":{"login":"alice"}}]\'',
          "else",
          "  printf '%s' '{}'",
          "fi",
          "",
        ].join("\n"),
        "utf8",
      );
      await chmod(join(fakeBinDir, "curl"), 0o755);

      await writeFile(join(repoDir, "notes.txt"), "parser patch\n", "utf8");
      expectSuccess(git(repoDir, "add", "notes.txt"));
      expectSuccess(git(repoDir, "commit", "-m", "chore: temporary title (#77)"));
      expectSuccess(git(repoDir, "tag", "v0.2.0"));

      const result = runCommand(
        "bash",
        [
          join(REPO_ROOT, "scripts", "generate-stable-release-notes.sh"),
          "--mode",
          "hybrid",
          "--range",
          "v0.1.0..v0.2.0",
          "--current-tag",
          "v0.2.0",
          "--previous-tag",
          "v0.1.0",
          "--repository",
          "example/project",
        ],
        {
          cwd: repoDir,
          env: {
            ...process.env,
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
          },
        },
      );

      expectSuccess(result);

      const groupedSection = result.stdout.split("### Changelog")[0] ?? "";
      expect(groupedSection).toContain("### Bug Fixes");
      expect(groupedSection).not.toContain("### Chores");
      expect(groupedSection).toContain("- fix(parser): release-safe title (#77)");
      expect(result.stdout).toContain(
        "Full Changelog: https://github.com/example/project/compare/v0.1.0...v0.2.0",
      );
      expect(result.stdout).toContain("- #77 fix(parser): release-safe title by @alice");
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });
});
