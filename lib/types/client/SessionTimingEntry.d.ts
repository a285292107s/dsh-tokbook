export interface SessionTimingEntryProps {
    sessionId?: string;
    openTokens: () => void;
}
export declare function SessionTimingEntry({ sessionId, openTokens }: SessionTimingEntryProps): import("react").JSX.Element | null;
