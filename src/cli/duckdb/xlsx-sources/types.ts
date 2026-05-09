export interface ZipEntryMeta {
  compressionMethod: number;
  compressedSize: number;
  fileName: string;
  localHeaderOffset: number;
}

export interface XlsxSheetSnapshotCell {
  ref: string;
  value: string;
}

export interface XlsxSheetSnapshotRow {
  cellCount: number;
  cells: XlsxSheetSnapshotCell[];
  firstRef: string;
  lastRef: string;
  rowNumber: number;
}

export interface XlsxSheetSnapshot {
  mergedRanges: string[];
  mergedRangesTruncated: boolean;
  nonEmptyCellCount: number;
  nonEmptyRowCount: number;
  rows: XlsxSheetSnapshotRow[];
  rowsTruncated: boolean;
  sheetName: string;
  usedRange?: string;
}

export interface XlsxWorkbookPackage {
  buffer: Buffer;
  entries: ZipEntryMeta[];
}

export interface XlsxWorkbookSheetEntry {
  name: string;
  targetPath: string;
}
