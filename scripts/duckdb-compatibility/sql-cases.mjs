// Expected differences from the DuckDB 2 migration guide. Keep these probes explicit.
export const sqlCases = [
  { id: "regex-operator", sql: "select 'abc' ~ 'b'", baseline: [[false]], candidate: [[true]] },
  { id: "regex-full-function", sql: "select regexp_full_match('abc', 'b')", both: [[false]] },
  { id: "regex-partial-function", sql: "select regexp_matches('abc', 'b')", both: [[true]] },
  {
    id: "arrow-lambda",
    sql: "select list_transform([1, 2], x -> x + 1)",
    baseline: [[[2, 3]]],
    candidateError: /lambda|arrow/i,
  },
  {
    id: "explicit-lambda",
    sql: "select list_transform([1, 2], lambda x: x + 1)",
    both: [[[2, 3]]],
  },
  { id: "factorial-precedence", sql: "select 2 * 3!", baseline: [["720"]], candidate: [["12"]] },
  { id: "factorial-parentheses", sql: "select (2 * 3)!", both: [["720"]] },
  {
    id: "hex-literal",
    sql: "select typeof(X'AB')",
    baseline: [["VARCHAR"]],
    candidate: [["BLOB"]],
  },
  {
    id: "bit-literal",
    sql: "select typeof(B'101')",
    baseline: [["VARCHAR"]],
    candidate: [["BIT"]],
  },
  { id: "explicit-old-literal-strings", sql: "select 'xAB', 'b101'", both: [["xAB", "b101"]] },
  {
    id: "integer-zero-division",
    sql: "select 1 // 0",
    baseline: [[null]],
    candidateError: /division by zero/i,
  },
  {
    id: "modulo-zero",
    sql: "select 1 % 0",
    baseline: [[null]],
    candidateError: /division by zero/i,
  },
  { id: "try-zero-division", sql: "select try(1 // 0), try(1 % 0)", both: [[null, null]] },
  { id: "floating-zero-division", sql: "select 1.0 / 0", both: [["Infinity"]] },
  {
    id: "identifier-setting",
    sql: "select current_setting('preserve_identifier_case')",
    baseline: [[true]],
    candidate: [["preserve_case"]],
  },
  { id: "typed-null", sql: "select typeof(NULL::VARCHAR)", both: [["VARCHAR"]] },
  {
    id: "empty-column-types",
    sql: "select 1::INTEGER as id, NULL::VARCHAR as name where false",
    both: [],
    types: ["INTEGER", "VARCHAR"],
  },
  {
    id: "json-conversion",
    sql: "select 9007199254740993::BIGINT as big, 123456789012345.125::DECIMAL(18,3) as dec, timestamp '2026-03-01 12:34:56.123456' as stamp, [1, NULL, 3] as list, {'key': 'value'} as obj",
    both: [
      [
        "9007199254740993",
        "123456789012345.125",
        "2026-03-01 12:34:56.123456",
        [1, null, 3],
        { key: "value" },
      ],
    ],
  },
];
