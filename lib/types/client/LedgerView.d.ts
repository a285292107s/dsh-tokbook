import type { TokBookOverview } from '../types.ts';
export declare function LedgerView({ overview, busy, retry, onRescan }: {
    overview: TokBookOverview;
    busy: boolean;
    retry: boolean;
    onRescan: () => void;
}): import("react").JSX.Element;
export declare function LedgerSkeleton(): import("react").JSX.Element;
