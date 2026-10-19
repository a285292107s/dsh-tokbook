import type { RouteCatalogEntry } from './types.ts';
export declare const DEEPSEEK_ROUTE = "deepseek-official";
export interface SettingsLike {
    get(ns: string): unknown;
}
export interface LlmLike {
    listProviders(): readonly {
        id: string;
        name: string;
    }[];
    listModels(provider: string): Promise<readonly {
        id: string;
        name?: string;
    }[]>;
}
interface Logger {
    error(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
}
export declare function routesFromSettings(settings: SettingsLike | undefined): RouteCatalogEntry[];
export declare function routeLabels(settings: SettingsLike | undefined, llm: LlmLike | undefined, logger?: Logger): Record<string, string>;
export declare function collectRoutes(settings: SettingsLike | undefined, llm: LlmLike | undefined, logger?: Logger): Promise<RouteCatalogEntry[]>;
export {};
