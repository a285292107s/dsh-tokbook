export declare const MODELS_DEV_URL = "https://models.dev/api.json";
export declare const MODELS_DEV_TIMEOUT_MS = 15000;
export interface ModelsDevCost {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
}
export interface ModelsDevEntry {
    provider: string;
    modelId: string;
    name: string;
    cost: ModelsDevCost;
}
export type ModelsDevCatalog = Map<string, ModelsDevEntry>;
export declare const FIRST_PARTY_PROVIDERS: ReadonlySet<string>;
export declare function normalizeModelId(modelId: string): string;
export declare function parseCatalog(value: unknown): ModelsDevCatalog;
export declare function fetchCatalog(): Promise<ModelsDevCatalog>;
export declare const LOOKUP_LIMIT = 8;
export interface ModelsDevMatch {
    entry: ModelsDevEntry;
    key: string;
    score: number;
}
export declare function searchCatalog(catalog: ModelsDevCatalog, keyword: string, limit?: number): ModelsDevMatch[];
