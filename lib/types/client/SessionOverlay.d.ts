import type { ReactNode } from 'react';
import type { SessionStepRow, SessionUsageView } from '../types.ts';
export interface ModelLabel {
    text: string;
    count: number;
    title: string;
}
export interface OverlayCard {
    key: string;
    turn: number;
    meta: string;
    model: ModelLabel;
    leading: ReactNode;
    body: ReactNode;
}
export interface SessionOverlayProps {
    sessionId?: string;
    triggerTitle: string;
    triggerLabel: string;
    triggerIcon: ReactNode;
    panelTitle: string;
    panelLabel: string;
    emptyText: string;
    footnote: string;
    skeletonClass?: string;
    cards: (view: SessionUsageView) => OverlayCard[];
}
export declare function modelLabelOf(rows: readonly SessionStepRow[], labels: Readonly<Record<string, string>>): ModelLabel;
export declare function SessionOverlay({ sessionId, triggerTitle, triggerLabel, triggerIcon, panelTitle, panelLabel, emptyText, footnote, skeletonClass, cards, }: SessionOverlayProps): import("react").JSX.Element | null;
