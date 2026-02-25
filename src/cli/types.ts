export interface CliRuntime {
  cwd: string;
  now: () => Date;
  platform: NodeJS.Platform;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdin: NodeJS.ReadStream;
}

export interface RunCliOptions {
  cwd?: string;
  now?: () => Date;
  platform?: NodeJS.Platform;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  stdin?: NodeJS.ReadStream;
}

export interface PlannedRename {
  fromPath: string;
  toPath: string;
  changed: boolean;
}
