export interface CliRuntime {
  cwd: string;
  now: () => Date;
  platform: NodeJS.Platform;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdin: NodeJS.ReadStream;
  displayPathStyle: "relative" | "absolute";
}

export interface RunCliOptions {
  cwd?: string;
  now?: () => Date;
  platform?: NodeJS.Platform;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  stdin?: NodeJS.ReadStream;
  displayPathStyle?: "relative" | "absolute";
}

export interface PlannedRename {
  fromPath: string;
  toPath: string;
  changed: boolean;
}
