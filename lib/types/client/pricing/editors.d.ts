import type { BillingNature, HolidaySyncView, PriceCurrency } from '../../types.ts';
import { type CalendarDraft, type CalendarEntries, type ModelDraft } from './draft.ts';
export declare function CalendarEditor({ entries, missingYears, autoYears, dirty, sync, syncing, onChange, className }: {
    entries: CalendarEntries;
    missingYears: readonly string[];
    autoYears?: readonly string[];
    dirty: boolean;
    onChange: (year: string, next: CalendarDraft | null) => void;
    sync?: HolidaySyncView;
    syncing?: boolean;
    className?: string;
}): import("react").JSX.Element;
export declare const ModelDetail: import("react").NamedExoticComponent<{
    route: string;
    row: ModelDraft;
    billing: BillingNature;
    baseline: ReadonlyMap<string, string>;
    holidays: ReadonlySet<string>;
    currency: PriceCurrency;
    rate: number | null;
    onCurrency: (currency: PriceCurrency) => void;
    onRowChange: (route: string, model: string, next: ModelDraft) => void;
    onBilling: (route: string, billing: BillingNature) => void;
}>;
