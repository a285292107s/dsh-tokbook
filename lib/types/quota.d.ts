import type { QuotaCard, QuotaGate, QuotaPlanInfo, QuotaWindowView } from './types.ts';
export type { QuotaCard, QuotaView, QuotaWindowView } from './types.ts';
export declare const OPENCODE_GO_PROVIDER = "opencode-go";
export declare const COMMAND_CODE_PROVIDER = "commandcode";
export declare const BUILTIN_PLAN_TITLES: Readonly<Record<string, string>>;
export declare const COMMAND_CODE_PLAN_NAMES: Readonly<Record<string, string>>;
export declare const BUILTIN_KEY_ENV: Readonly<Record<string, string>>;
export declare const QUOTA_ALERT_PERCENT = 90;
export declare function isQuotaAlert(card: QuotaCard | null | undefined): boolean;
export declare function isBuiltinQuotaPlan(provider: string): boolean;
export declare function orderQuotaProviders(providers: readonly string[], gateOf: (provider: string) => QuotaGate | undefined): string[];
export declare const QUOTA_IN_FORCE_STATUSES: readonly string[];
export declare function quotaGate(planInfo: QuotaPlanInfo | undefined, now?: number): QuotaGate;
export declare function dayText(epochMs: number): string;
export declare function balanceGateNote(planInfo: QuotaPlanInfo | undefined, now?: number): string;
export declare function clampPercent(value: unknown): number;
export declare function resetEpoch(value: unknown, now?: number): number | null;
export declare function windowFromCreditsBlock(id: string, label: string, raw: {
    used?: unknown;
    cap?: unknown;
    exceeded?: unknown;
    resetAt?: unknown;
} | undefined, now?: number): QuotaWindowView;
export declare function windowFromUsagePercent(id: string, label: string, raw: {
    status?: unknown;
    percent?: unknown;
    resetsAt?: unknown;
    usagePercent?: unknown;
    resetInSec?: unknown;
} | undefined, now?: number): QuotaWindowView;
export declare function planInfoFromSubscriptions(raw: {
    planId?: unknown;
    status?: unknown;
    currentPeriodEnd?: unknown;
} | undefined): QuotaPlanInfo | undefined;
export declare function hasQuotaContent(card: QuotaCard): boolean;
export declare function unconfiguredCard(provider: string, hint?: string): QuotaCard;
export declare function errorCard(provider: string, reason: string): QuotaCard;
export declare function noSubscriptionCard(provider: string, note: string, now?: number): QuotaCard;
