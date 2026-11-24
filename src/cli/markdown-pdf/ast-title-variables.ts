// A missing declaration may use its fallback. A declaration whose value cannot
// be resolved from inline styles must not silently take the missing-value path.
const unresolved = Symbol("unresolved inline value");
type Value = string | typeof unresolved;
export type InlineVariables = (name: string, depth: number) => Value | undefined;

export interface InlineDeclaration {
  property: string;
  value: string;
  important: boolean;
}

const maxDepth = 32;

function closingParen(value: string, start: number): number {
  let nesting = 1;
  for (let i = start; i < value.length; i++) {
    if (value[i] === "(") nesting++;
    else if (value[i] === ")" && --nesting === 0) return i;
  }
  return -1;
}

// Select a defined variable before examining its fallback. Substitution keeps
// token boundaries, so adjoining identifiers cannot form a new CSS keyword.
function resolve(value: string, variables: InlineVariables, depth: number): Value {
  if (depth >= maxDepth) return unresolved;
  const functions = /(?<![\w-])var\(/giu;
  const parts: string[] = [];
  let cursor = 0;
  for (let ref; (ref = functions.exec(value));) {
    const end = closingParen(value, functions.lastIndex);
    if (end < 0) return unresolved;
    const args = value.slice(functions.lastIndex, end);
    const comma = args.indexOf(",");
    const name = (comma < 0 ? args : args.slice(0, comma)).trim();
    if (!/^--[\w-]+$/u.test(name)) return unresolved;
    let result = variables(name, depth + 1);
    // WeasyPrint uses a supplied fallback for a variable with zero computed tokens.
    if ((result === undefined || result === "") && comma >= 0)
      result = resolve(args.slice(comma + 1).trim(), variables, depth + 1);
    if (result === undefined || result === unresolved) return unresolved;
    // The display grammar accepts at most three keywords. Avoid expanding
    // arbitrary custom-property data when inspecting a title.
    if (result && !/^[a-z-]+(?:\s+[a-z-]+){0,2}$/iu.test(result)) return "\uFFFD";
    parts.push(value.slice(cursor, ref.index), " ", result, " ");
    functions.lastIndex = cursor = end + 1;
  }
  if (!parts.length) return value;
  parts.push(value.slice(cursor));
  return parts.join("").trim();
}

export function inlineKeywords(value: string, variables: InlineVariables): string | undefined {
  const result = resolve(value, variables, 0);
  return result === unresolved ? undefined : result;
}

export function inlineVariables(
  rules: InlineDeclaration[],
  inherited: InlineVariables,
): InlineVariables {
  const local = new Map<string, InlineDeclaration>();
  for (const rule of rules) {
    if (
      rule.property.startsWith("--") &&
      (rule.important || !local.get(rule.property)?.important)
    ) {
      local.set(rule.property, rule);
    }
  }
  if (!local.size) return inherited;
  const cache = new Map<string, Value>();
  const lookup: InlineVariables = (name, depth) => {
    const rule = local.get(name);
    if (!rule || /^(inherit|unset)$/iu.test(rule.value)) return inherited(name, depth);
    if (/^initial$/iu.test(rule.value)) return undefined;
    if (depth >= maxDepth) return unresolved;
    const previous = cache.get(name);
    if (previous !== undefined) return previous;
    // Mark this name before following references to break cycles.
    cache.set(name, unresolved);
    const result = resolve(rule.value, lookup, depth);
    cache.set(name, result);
    return result;
  };
  return lookup;
}
