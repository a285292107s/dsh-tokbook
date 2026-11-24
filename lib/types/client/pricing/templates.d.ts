import type { PriceCurrency } from '../../types.ts';
export interface PriceTemplate {
    id: string;
    name: string;
    input: string;
    output: string;
    cacheRead: string;
    cacheWrite: string;
    currency: PriceCurrency;
}
export interface TemplateRates {
    input: string;
    output: string;
    cacheRead: string;
    cacheWrite: string;
}
export declare const TEMPLATES_KEY = "dsh-tokbook.price-templates";
export declare const MAX_TEMPLATES = 50;
export declare function parseTemplates(raw: unknown): PriceTemplate[];
export declare function readTemplates(): PriceTemplate[];
export declare function writeTemplates(templates: readonly PriceTemplate[]): void;
export declare function makeTemplate(name: string, rates: TemplateRates, currency: PriceCurrency): PriceTemplate;
export declare function applyTemplate(template: PriceTemplate, targetCurrency: PriceCurrency, cnyPerUsd: number | null): TemplateRates | null;
