import type { SessionStepRow, SessionUsageGroup } from '../types.ts';
import { type PreviewMap } from './session-shared.ts';
export declare function TurnBlocks({ turns, betweenTurns, unattributed, previews }: {
    turns: readonly SessionUsageGroup[];
    betweenTurns: SessionUsageGroup | null;
    unattributed: readonly SessionStepRow[];
    previews: PreviewMap;
}): import("react").JSX.Element;
