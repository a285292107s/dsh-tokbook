import type { QuotaCard } from '../../types.ts';
export declare function QuotaCardView({ provider, card, error, loading, onRefresh }: {
    provider: string;
    card: QuotaCard | null;
    error: string | null;
    loading: boolean;
    onRefresh: () => void;
}): import("react").JSX.Element;
