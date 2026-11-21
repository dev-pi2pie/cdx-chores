const originatorToken = /^[^/\s]+\//u;
const versionToken = /^((\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?)(?=\s|$)/u;

export function extractAppServerVersion(userAgent: unknown, env: NodeJS.ProcessEnv) {
  if (typeof userAgent !== "string") return undefined;

  const originator = env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  const configuredPrefix = originator === undefined ? undefined : `${originator}/`;
  const prefix =
    configuredPrefix && userAgent.startsWith(configuredPrefix)
      ? configuredPrefix
      : originatorToken.exec(userAgent)?.[0];
  if (!prefix) return undefined;

  const match = versionToken.exec(userAgent.slice(prefix.length));
  if (!match?.[1]) return undefined;
  const [, version, major, minor, patch, prerelease] = match;
  return { version, core: [Number(major), Number(minor), Number(patch)], prerelease: !!prerelease };
}
