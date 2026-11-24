import type { PriceCurrency } from '../../types.ts';
import type { PriceTemplate } from './templates.ts';
export interface ApplyResult {
    ok: boolean;
    error?: string;
}
export declare function TemplateBar({ templates, currency, canSave, onApply, onDelete, onSave }: {
    templates: readonly PriceTemplate[];
    currency: PriceCurrency;
    canSave: boolean;
    onApply: (template: PriceTemplate) => ApplyResult;
    onDelete: (id: string) => void;
    onSave: (name: string) => void;
}): import("react").JSX.Element;
