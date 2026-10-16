import type { extractCandidateDocxEvidence } from "./adapter";

export interface ChildMeasurement {
  pid: number;
  bootMs: number;
  firstPolicySampleMs: number | null;
  lastPolicySampleMs: number | null;
  finishedMs: number;
  policySamples: number;
  policyPeakRssBytes: number;
  observedPeakRssBytes: number;
}

export interface CandidateMeasurement {
  id: string;
  kind: "supported" | "expected-limit";
  repetition: number;
  callerLoad: "idle" | "loaded";
  callerRssBytes: number;
  apiMilliseconds: number;
  processingMilliseconds: number | null;
  ordinaryCjsApiMilliseconds: number;
  ordinaryEsmApiMilliseconds: number;
  inputMilliseconds: number;
  bootToFirstPolicySampleMilliseconds: number | null;
  supervisedProcessingMilliseconds: number | null;
  publicationValidationAndCleanupMilliseconds: number | null;
  child: ChildMeasurement | null;
  outcome: string;
  evidence: Awaited<ReturnType<typeof extractCandidateDocxEvidence>>;
  inputClosed: boolean;
  childExited: boolean;
  admissionReleased: boolean;
  fit: boolean;
}

export interface BaselineMeasurement {
  id: string;
  repetition: number;
  apiMilliseconds: number;
  extractionMilliseconds: number;
  peakRssBytes: number;
  outcome: string;
  confirmedClose: boolean;
  matched: boolean;
}

export interface MeasurementReport {
  kind: "candidate" | "baseline";
  candidate?: CandidateMeasurement[];
  baseline?: BaselineMeasurement[];
  passed: boolean;
}
