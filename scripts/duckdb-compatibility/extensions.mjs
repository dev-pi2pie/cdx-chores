import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extensionNames = ["excel", "sqlite_scanner"];
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const digest = (value) => createHash("sha256").update(value).digest("hex");

/** Downloads signed core extensions into a new cache, never the user's cache. */
export async function evaluateExtensions({ packageRoot, scratchDir, expectedEngine, otherCache }) {
  const require = createRequire(join(resolve(packageRoot), "package.json"));
  const { DuckDBInstance } = require("@duckdb/node-api");
  await mkdir(resolve(scratchDir), { recursive: true });
  const runDirectory = await mkdtemp(join(resolve(scratchDir), "extensions-"));
  const cacheDirectory = join(runDirectory, "cache");
  await mkdir(cacheDirectory);

  const settings = {
    extension_directory: cacheDirectory,
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
    allow_unsigned_extensions: "false",
    allow_extensions_metadata_mismatch: "false",
  };
  const withConnection = async (callback, extraSettings = {}) => {
    const instance = await DuckDBInstance.create(":memory:", { ...settings, ...extraSettings });
    try {
      const connection = await instance.connect();
      try {
        return await callback(connection);
      } finally {
        connection.closeSync();
      }
    } finally {
      instance.closeSync();
    }
  };
  const rows = async (connection, sql) => (await connection.runAndReadAll(sql)).getRowObjectsJson();
  const catalog = async (connection) =>
    rows(
      connection,
      "select extension_name, extension_version, installed, loaded, install_path from duckdb_extensions() where extension_name in ('excel', 'sqlite_scanner') order by extension_name",
    );
  const checks = [];
  const installedFiles = {};
  const metadata = await withConnection(async (connection) => {
    const engine = (await rows(connection, "select version() as engine"))[0].engine;
    const platform = (await rows(connection, "pragma platform"))[0].platform;
    assert.equal(engine, `v${expectedEngine}`);
    for (const setting of ["allow_unsigned_extensions", "allow_extensions_metadata_mismatch"]) {
      assert.equal(
        (await rows(connection, `select current_setting('${setting}') as value`))[0].value,
        false,
      );
    }
    for (const name of extensionNames) {
      await assert.rejects(
        connection.run(`load ${name}`),
        /not found|not installed|install it first/i,
      );
      checks.push(`${name}:missing-rejected`);
      await connection.run(`install ${name}`);
      await connection.run(`load ${name}`);
    }
    const entries = await catalog(connection);
    assert.equal(entries.length, 2);
    for (const entry of entries) {
      assert.equal(entry.installed, true);
      assert.equal(entry.loaded, true);
      assert.equal(typeof entry.extension_version, "string");
      assert.ok(entry.extension_version.length > 0);
      assert.ok(entry.install_path.startsWith(`${cacheDirectory}/`));
      assert.ok(entry.install_path.includes(`/${engine}/${platform}/`));
      installedFiles[entry.extension_name] = entry.install_path;
      checks.push(`${entry.extension_name}:signed-install-load`);
    }
    return {
      engine,
      platform,
      extensions: entries.map(({ extension_name, extension_version }) => ({
        name: extension_name,
        version: extension_version,
      })),
    };
  });

  const hashes = Object.fromEntries(
    await Promise.all(
      extensionNames.map(async (name) => [name, digest(await readFile(installedFiles[name]))]),
    ),
  );
  await withConnection(
    async (connection) => {
      for (const name of extensionNames) await connection.run(`load ${name}`);
      const entries = await catalog(connection);
      assert.ok(entries.every((entry) => entry.loaded && entry.installed));
      for (const name of extensionNames) {
        assert.equal(digest(await readFile(installedFiles[name])), hashes[name]);
        checks.push(`${name}:offline-cache-load`);
      }
    },
    { custom_extension_repository: join(runDirectory, "unavailable-repository") },
  );

  for (const name of extensionNames) {
    const bytes = Buffer.from(await readFile(installedFiles[name]));
    bytes[Math.floor(bytes.length / 2)] ^= 1;
    const corruptPath = join(runDirectory, `${name}-corrupt.duckdb_extension`);
    await writeFile(corruptPath, bytes, { flag: "wx" });
    await withConnection(async (connection) => {
      await assert.rejects(connection.run(`load ${quote(corruptPath)}`), /signature|unsigned/i);
      checks.push(`${name}:invalid-signature-rejected`);
    });
    if (otherCache) {
      const otherFile = join(resolve(otherCache), `${name}.duckdb_extension`);
      const before = digest(await readFile(otherFile));
      await withConnection(async (connection) => {
        await assert.rejects(
          connection.run(`load ${quote(otherFile)}`),
          /version|platform|compiled/i,
        );
        checks.push(`${name}:wrong-version-rejected`);
      });
      assert.equal(digest(await readFile(otherFile)), before);
    }
  }

  return {
    report: {
      ...metadata,
      checks,
      signaturesRequired: true,
      metadataMatchRequired: true,
      wrongVersionChecked: Boolean(otherCache),
    },
    cacheDirectory,
    platformCache: dirname(installedFiles.excel),
  };
}

/** Exercises the existing product adapters and cache preflight without product edits. */
export async function evaluateProductExtensions({
  packageRoot,
  scratchDir,
  expectedEngine,
  nodeExecutable: nodePath,
  bunExecutable = "bun",
}) {
  const root = resolve(packageRoot);
  const nodeExecutable = resolve(nodePath);
  await mkdir(resolve(scratchDir), { recursive: true });
  const runDirectory = await mkdtemp(join(resolve(scratchDir), "product-extensions-"));
  const sourceHome = join(runDirectory, "source-home");
  await mkdir(sourceHome);
  const env = {
    PATH: `${dirname(nodeExecutable)}${delimiter}${process.env.PATH ?? ""}`,
    HOME: sourceHome,
    TMPDIR: process.env.TMPDIR,
  };
  const command = (executable, args, home = sourceHome) => {
    const child = spawnSync(executable, args, {
      cwd: root,
      env: { ...env, HOME: home },
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 256 * 1024,
    });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, 0, child.stderr || child.stdout);
    return child.stdout;
  };
  const sourceProbe = String.raw`
    import assert from "node:assert/strict";
    import {createRequire} from "node:module";
    import {join} from "node:path";
    import {pathToFileURL} from "node:url";
    const root=process.argv[1], mode=process.argv[2];
    const {DuckDBInstance}=createRequire(join(root,"package.json"))("@duckdb/node-api");
    const adapters=await import(pathToFileURL(join(root,"src/cli/duckdb/extensions.ts")).href);
    const db=await DuckDBInstance.create(":memory:",{autoinstall_known_extensions:"false",autoload_known_extensions:"false",allow_unsigned_extensions:"false",allow_extensions_metadata_mismatch:"false"});
    const checks=[];
    try {
      const c=await db.connect();
      try {
        for (const name of ["excel","sqlite"]) {
          const before=await adapters.probeDuckDbManagedExtension(c,name);
          assert.equal(before.loadable,false);
          assert.equal(before.installed,mode==="repair");
          if(mode==="repair") assert.match(before.detail,/signature|unsigned/i);
          else {
            assert.equal(before.installable,true);
            await assert.rejects(adapters.ensureDuckDbManagedExtensionLoaded(c,name),e=>e.code==="DUCKDB_EXTENSION_UNAVAILABLE");
            assert.match(adapters.createDuckDbExtensionGuidanceMessage(name,before),/not installed/i);
          }
          checks.push(name+":"+mode+"-probe");
          let output="";
          const result=await adapters.installDuckDbManagedExtension(c,name,{statusStream:{write(s){output+=s;}}});
          assert.equal(result.loaded,true);
          assert.equal(result.installed,true);
          assert.equal(result.runtimeVersion,"v"+process.argv[3]);
          assert.match(output,/Load check: ok/);
          assert.match(output,mode==="repair"?/Refreshing DuckDB extension/:/Installing DuckDB extension/);
          assert.ok(adapters.sanitizeDuckDbPathForDisplay(result.cacheFilePath).startsWith("$HOME/"));
          checks.push(name+":"+mode+"-install");
          output="";
          await adapters.installDuckDbManagedExtension(c,name,{statusStream:{write(s){output+=s;}}});
          assert.match(output,/already present/);
          checks.push(name+":idempotent-install");
        }
      } finally {c.closeSync();}
    } finally {db.closeSync();}
    process.stdout.write(JSON.stringify({checks}));
  `;
  const checks = JSON.parse(
    command(bunExecutable, ["--eval", sourceProbe, root, "missing", expectedEngine]),
  ).checks;
  const cli = join(root, "dist/esm/bin.mjs");
  const doctor = JSON.parse(command(nodeExecutable, [cli, "data", "duckdb", "doctor", "--json"]));
  assert.equal(doctor.duckdb.runtimeVersion, `v${expectedEngine}`);
  for (const name of ["excel", "sqlite"]) {
    assert.equal(doctor.duckdb.extensions[name].loadability, true);
    assert.ok(doctor.duckdb.extensions[name].cacheFilePath.startsWith("$HOME/"));
  }
  checks.push("built-cli:doctor");
  const generalDoctor = JSON.parse(command(nodeExecutable, [cli, "doctor", "--json"]));
  assert.equal(generalDoctor.query.available, true);
  assert.equal(generalDoctor.query.runtimeVersion, `v${expectedEngine}`);
  for (const format of ["csv", "tsv", "parquet", "duckdb", "sqlite", "excel"]) {
    assert.equal(generalDoctor.query.formats[format].detectedSupport, true);
    assert.equal(generalDoctor.capabilities[`data.query.${format}`], true);
  }
  for (const name of ["excel", "sqlite"])
    assert.equal(generalDoctor.query.formats[name].loadability, true);
  checks.push("built-cli:general-doctor-capabilities");
  assert.match(
    command(nodeExecutable, [cli, "data", "duckdb", "extension", "install", "--all-supported"]),
    /already present/,
  );
  checks.push("built-cli:idempotent-install");
  const platform = doctor.duckdb.extensions.excel.cacheDirectory.split("/").at(-1);
  const platformCache = join(sourceHome, ".duckdb/extensions", `v${expectedEngine}`, platform);
  for (const name of extensionNames) {
    const file = join(platformCache, `${name}.duckdb_extension`);
    const bytes = Buffer.from(await readFile(file));
    bytes[Math.floor(bytes.length / 2)] ^= 1;
    await writeFile(file, bytes);
  }
  checks.push(
    ...JSON.parse(command(bunExecutable, ["--eval", sourceProbe, root, "repair", expectedEngine]))
      .checks,
  );
  const isolatedHome = join(runDirectory, "preflight-home");
  await mkdir(isolatedHome);
  const preflight = JSON.parse(
    command(
      bunExecutable,
      [join(root, "scripts/testing/execution/prerequisite-probe.ts"), "app", sourceHome],
      isolatedHome,
    ),
  );
  assert.equal(preflight.error, undefined, JSON.stringify(preflight));
  assert.equal(preflight.versions.duckdb, expectedEngine);
  const destination = join(isolatedHome, ".duckdb/extensions", `v${expectedEngine}`, platform);
  for (const name of extensionNames) {
    for (const suffix of [".duckdb_extension", ".duckdb_extension.info"]) {
      assert.equal(
        digest(await readFile(join(destination, `${name}${suffix}`))),
        digest(await readFile(join(platformCache, `${name}${suffix}`))),
      );
    }
  }
  checks.push("managed-preflight:matching-cache-copy");
  // Record the existing doctor side effect instead of claiming this path is read-only.
  const missingHome = join(runDirectory, "missing-home");
  await mkdir(missingHome);
  const missingDoctor = JSON.parse(
    command(nodeExecutable, [cli, "data", "duckdb", "doctor", "--json"], missingHome),
  );
  assert.equal(missingDoctor.duckdb.extensions.excel.loadability, false);
  assert.equal(missingDoctor.duckdb.extensions.excel.installed, false);
  assert.equal(missingDoctor.duckdb.extensions.sqlite.loadability, true);
  assert.equal(missingDoctor.duckdb.extensions.sqlite.installed, true);
  const autoInstalled = join(
    missingHome,
    ".duckdb/extensions",
    `v${expectedEngine}`,
    platform,
    "sqlite_scanner.duckdb_extension",
  );
  assert.ok((await readFile(autoInstalled)).length > 0);
  checks.push("built-cli:sqlite-doctor-autoinstall-observed");
  return {
    report: {
      engine: `v${expectedEngine}`,
      node: command(nodeExecutable, ["--version"]).trim(),
      bun: command(bunExecutable, ["--version"]).trim(),
      limitations: [
        "The default doctor probe autoinstalls SQLite into an empty cache on both evaluated engines.",
      ],
      checks,
    },
    sourceHome,
    platformCache,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  const keys = {
    "--package-root": "packageRoot",
    "--scratch-dir": "scratchDir",
    "--expected-engine": "expectedEngine",
    "--other-cache": "otherCache",
    "--output": "output",
    "--product-node": "nodeExecutable",
  };
  for (let index = 0; index < args.length; index += 2) {
    const key = keys[args[index]];
    if (!key || !args[index + 1])
      throw new Error(
        "Use --package-root, --scratch-dir, --expected-engine, optional --other-cache and --output.",
      );
    options[key] = args[index + 1];
  }
  if (!options.packageRoot || !options.scratchDir || !options.expectedEngine)
    throw new Error("--package-root, --scratch-dir and --expected-engine are required.");
  const result = await evaluateExtensions(options);
  if (options.nodeExecutable)
    result.report.product = (await evaluateProductExtensions(options)).report;
  const json = `${JSON.stringify(result.report, null, 2)}\n`;
  if (options.output) await writeFile(resolve(options.output), json, { flag: "wx" });
  process.stdout.write(json);
}
