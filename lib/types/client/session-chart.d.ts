import type { SessionUsageGroup } from '../types.ts';
import { type PreviewMap } from './session-shared.ts';
export declare function TurnChart({ turns, previews }: {
    turns: readonly SessionUsageGroup[];
    previews: PreviewMap;
}): import("react").JSX.Element | null;
