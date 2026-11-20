import type { ReactNode } from 'react';
import type { TokBookOverview } from '../types.ts';
export declare function LedgerView({ overview, busy, retry, onRescan, quota }: {
    overview: TokBookOverview;
    busy: boolean;
    retry: boolean;
    onRescan: () => void;
    quota: ReactNode;
}): import("react").JSX.Element;
export declare function LedgerSkeleton(): import("react").JSX.Element;
