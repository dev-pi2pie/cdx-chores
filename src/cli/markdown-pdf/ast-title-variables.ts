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
const maxExpandedLength = 4096;

function trimCssWhitespace(value: string): string {
  // The declaration reader normalizes CSS whitespace to spaces before substitution.
  return value.replace(/^ +| +$/gu, "");
}

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
  let expandedLength = 0;
  for (let ref; (ref = functions.exec(value));) {
    const end = closingParen(value, functions.lastIndex);
    if (end < 0) return unresolved;
    const args = value.slice(functions.lastIndex, end);
    const comma = args.indexOf(",");
    const name = trimCssWhitespace(comma < 0 ? args : args.slice(0, comma));
    if (!/^--[-\w\u0080-\u{10ffff}]+$/u.test(name) || name.includes("\uFFFD")) return unresolved;
    let result = variables(name, depth + 1);
    // WeasyPrint uses a supplied fallback for a variable with zero computed tokens.
    if ((result === undefined || result === "") && comma >= 0)
      result = resolve(trimCssWhitespace(args.slice(comma + 1)), variables, depth + 1);
    if (result === undefined || result === unresolved) return unresolved;
    // The destination property validates the assembled value, including functions.
    // Bound expansion independently of that property's grammar.
    expandedLength += ref.index - cursor + result.length + 2;
    if (expandedLength > maxExpandedLength) return unresolved;
    parts.push(value.slice(cursor, ref.index), " ", result, " ");
    functions.lastIndex = cursor = end + 1;
  }
  if (!parts.length) return value;
  if (expandedLength + value.length - cursor > maxExpandedLength) return unresolved;
  parts.push(value.slice(cursor));
  return trimCssWhitespace(parts.join(""));
}

export function inlineValue(value: string, variables: InlineVariables): string | undefined {
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
      rule.value !== "" &&
      (rule.important || !local.get(rule.property)?.important)
    ) {
      local.set(rule.property, rule);
    }
  }
  if (!local.size) return inherited;
  const cache = new Map<string, Value>();
  const lookup: InlineVariables = (name, depth) => {
    const rule = local.get(name);
    // WeasyPrint substitutes custom property tokens before interpreting keywords
    // such as initial or inherit on the destination property.
    if (!rule) return inherited(name, depth);
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
