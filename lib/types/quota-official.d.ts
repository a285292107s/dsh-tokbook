import type { PlanConfig, QuotaCard } from './types.ts';
export interface CredentialResolver {
    resolve(ref: string): Promise<string | undefined>;
}
export interface QuotaFetchDeps {
    plan?: PlanConfig;
    logger?: {
        error(...args: unknown[]): void;
        warn?(...args: unknown[]): void;
    };
    credentials?: CredentialResolver;
}
export declare function resolvePlanApiKey(provider: string, plan: PlanConfig | undefined, credentials: CredentialResolver | undefined): Promise<string | undefined>;
export declare function fetchCommandCodeQuota(deps?: QuotaFetchDeps): Promise<QuotaCard>;
export declare function parseOpenCodeGoUsage(body: Record<string, unknown>, now?: number): QuotaCard;
export declare function fetchOpenCodeGoQuota(deps?: QuotaFetchDeps): Promise<QuotaCard>;
export declare function fetchOfficialQuota(provider: string, deps?: QuotaFetchDeps): Promise<QuotaCard>;
