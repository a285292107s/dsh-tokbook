export interface SessionTokensProps {
    sessionId?: string;
    useProjection?: <T>(key: string) => T | undefined;
}
export declare function SessionTokens({ sessionId, useProjection }: SessionTokensProps): import("react").JSX.Element;
