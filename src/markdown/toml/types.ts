export type TomlValue =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | Record<string, unknown>;
