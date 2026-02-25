declare module "papaparse" {
  export interface ParseError {
    row?: number;
    code?: string;
    message: string;
    type?: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: Record<string, unknown>;
  }

  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    newline?: string;
    delimiter?: string;
  }

  export interface UnparseConfig {
    header?: boolean;
    newline?: string;
    delimiter?: string;
  }

  export interface PapaStatic {
    parse<T = unknown>(input: string, config?: ParseConfig): ParseResult<T>;
    unparse(input: unknown, config?: UnparseConfig): string;
  }

  const Papa: PapaStatic;
  export default Papa;
}

