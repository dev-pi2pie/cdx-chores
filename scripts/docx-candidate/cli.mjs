import { createOutputWriter } from "./harness/output.mjs";

const commands = {
  comparison: {
    description: "Compare DOCX candidate output in ESM/CJS (full corpus by default).",
    script: "launch.mjs",
    usage: " [--smoke [--keep-artifacts]]",
    options: [
      "  --smoke           Run the smoke corpus.",
      "  --keep-artifacts  Keep smoke inputs/results; requires --smoke.",
    ],
    notes: ["Kept artifacts: examples/playground/docx-candidate/smoke/<run-id>/"],
  },
  measurement: {
    description: "Measure the DOCX candidate and baseline across 18 workloads.",
    script: "measure-launch.mjs",
    usage: "",
    options: [],
    notes: ["Requires POSIX process groups."],
  },
  package: {
    description: "Check the DOCX package and eight fresh npm/Bun consumer paths.",
    script: "package-check.mjs",
    usage: "",
    options: [],
    notes: ["Requires npm, Bun, tar, registry access, and POSIX process groups."],
  },
};

function help(command) {
  return [
    command.description,
    "",
    `Usage: node ./scripts/docx-candidate/${command.script}${command.usage}`,
    "",
    "Options:",
    ...command.options,
    "  -h, --help        Show help.",
    "",
    ...command.notes,
  ].join("\n");
}

/**
 * Pure parsing lets entry points resolve help/errors before importing execution code.
 * @param {'comparison' | 'measurement' | 'package'} kind
 * @param {readonly string[]} args
 * @returns {{action: 'run', smoke?: boolean, keepArtifacts?: boolean} | {action: 'help' | 'error', text: string}}
 */
export function parseCandidateCli(kind, args) {
  if (!Object.hasOwn(commands, kind)) throw new TypeError("Unknown candidate command kind");
  const text = help(commands[kind]);
  /** @returns {{action: 'error', text: string}} */
  const error = (message) => ({ action: "error", text: `${message}\n\n${text}` });
  const isHelp = (argument) => argument === "--help" || argument === "-h";
  if (args.length === 1 && isHelp(args[0])) return { action: "help", text };
  if (args.some(isHelp)) return error("Use --help or -h alone.");
  if (kind !== "comparison") {
    return args.length
      ? error("This command accepts no execution options or arguments.")
      : { action: "run" };
  }
  if (args.some((argument) => !["--smoke", "--keep-artifacts"].includes(argument)))
    return error("Unknown option or positional argument.");
  if (new Set(args).size !== args.length) return error("Specify each option only once.");
  const smoke = args.includes("--smoke");
  const keepArtifacts = args.includes("--keep-artifacts");
  if (keepArtifacts && !smoke) return error("--keep-artifacts requires --smoke.");
  return { action: "run", smoke, keepArtifacts };
}

export async function candidateCliOptions(kind, args = process.argv.slice(2)) {
  const options = parseCandidateCli(kind, args);
  if (options.action === "run") return options;
  const output = createOutputWriter(options.action === "help" ? process.stdout : process.stderr);
  if (options.action === "error") process.exitCode = 1;
  try {
    await output.write(`${options.text}\n`);
  } catch {
    process.exitCode = 1;
  } finally {
    output.dispose();
  }
}
