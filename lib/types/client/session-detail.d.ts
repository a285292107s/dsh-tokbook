import type { SessionStepRow, SessionUsageGroup } from '../types.ts';
import { type PreviewMap } from './session-shared.ts';
export declare function TurnBlocks({ turns, betweenTurns, unattributed, previews, providerLabels }: {
    turns: readonly SessionUsageGroup[];
    betweenTurns: SessionUsageGroup | null;
    unattributed: readonly SessionStepRow[];
    previews: PreviewMap;
    providerLabels?: Readonly<Record<string, string>>;
}): import("react").JSX.Element;
