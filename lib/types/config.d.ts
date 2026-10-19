import type { PlanConfig, TokBookConfig } from './types.ts';
export declare function validateConfig(config: TokBookConfig): void;
export declare function coercePlanConfig(value: unknown): PlanConfig | undefined;
export declare function coercePlansConfig(value: unknown): Record<string, PlanConfig>;
