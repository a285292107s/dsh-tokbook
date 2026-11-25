import type { DaySet, PriceCurrency } from '../../types.ts';
export interface TemplateRates {
    input: string;
    output: string;
    cacheRead: string;
    cacheWrite: string;
}
export interface TemplateSlot extends TemplateRates {
    days: DaySet;
    start: string;
    end: string;
}
export interface PriceTemplate extends TemplateRates {
    id: string;
    name: string;
    currency: PriceCurrency;
    slots: TemplateSlot[];
}
export declare const TEMPLATES_KEY = "dsh-tokbook.price-templates";
export declare const MAX_TEMPLATES = 50;
export declare function parseTemplates(raw: unknown): PriceTemplate[];
export declare function readTemplates(): PriceTemplate[];
export declare function writeTemplates(templates: readonly PriceTemplate[]): void;
export declare function makeTemplate(name: string, rates: TemplateRates, slots: readonly TemplateSlot[], currency: PriceCurrency): PriceTemplate;
export declare function applyTemplate(template: PriceTemplate, targetCurrency: PriceCurrency, cnyPerUsd: number | null): {
    rates: TemplateRates;
    slots: TemplateSlot[];
} | null;
