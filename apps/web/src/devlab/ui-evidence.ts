export interface UiControl {
  tag: string;
  role: string;
  name: string;
  value?: string;
  disabled: boolean;
}
export interface UiCapture {
  screen: string;
  state: string;
  viewport: string;
  screenshot: string;
  headings: string[];
  controls: UiControl[];
  text: string;
  overflow: boolean;
  unnamed: number;
  keyboard: string;
}
export interface UiScreenEvidence {
  id: string;
  fingerprint: string;
  capturedAt: string;
  captures: UiCapture[];
  errors: string[];
  flowIds?: string[];
}
export type UiFlowState =
  'vazio' | 'bloqueado' | 'erro' | 'sucesso' | 'confirmacao' | 'preenchimento';
export interface UiFlowDefinition {
  id: string;
  screen: string;
  title: string;
  source: string;
  preconditions: string[];
  fields: string[];
  commands: string[];
  expectedEffects: string[];
  states: UiFlowState[];
  exercisedBy?: string;
}
export interface UiWorldObservation {
  money: number;
  balances: Record<string, number>;
  inventory: Record<string, Record<string, number>>;
  shipments: number;
  delivered: number;
  jobs: number;
  completedJobs: number;
  orders: number;
  ledgerEntries: number;
}
export interface UiCommandEvidence {
  command: { type: string; [key: string]: unknown };
  actor: string;
  status: number;
  error?: string;
  before: UiWorldObservation;
  after: UiWorldObservation;
}
export interface UiFlowRun {
  flowId: string;
  viewport: string;
  status: 'passed' | 'failed' | 'not-exercised';
  states: UiFlowState[];
  assertions: { label: string; passed: boolean; expected?: unknown; actual?: unknown }[];
  requests: UiCommandEvidence[];
  observations?: { phase: string; world: UiWorldObservation }[];
  captures: string[];
  error?: string;
  reason?: string;
}
export interface UiCaptureComparison {
  screen: string;
  state: string;
  viewport: string;
  structuralChanged: boolean;
  structureChanges: string[];
  visual: 'unchanged' | 'changed' | 'size-mismatch' | 'unavailable' | 'missing';
  changedPixels?: number;
  changedRatio?: number;
  current: string;
  baseline?: string;
  diff?: string;
}
export interface UiComparison {
  baseline: 'missing' | 'available' | 'accepted';
  generatedAt: string;
  entries: UiCaptureComparison[];
  summary: {
    compared: number;
    changed: number;
    missing: number;
    visualUnavailable: number;
    functionalChanged?: number;
  };
  flowChanges?: {
    flowId: string;
    viewport: string;
    before: string;
    after: string;
    details: string[];
  }[];
  limits: string[];
}
export interface UiEvidence {
  schemaVersion: number;
  generatedAt: string;
  fixture: string;
  engineFingerprint: string;
  screens: UiScreenEvidence[];
  globalStates: UiCapture[];
  flowCatalog?: UiFlowDefinition[];
  flowRuns?: UiFlowRun[];
  comparison?: UiComparison;
  summary: {
    captured: number;
    reused: number;
    states: number;
    errors: number;
    overflow: number;
    unnamed: number;
  };
}
