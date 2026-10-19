import type { UsageRecord } from './types.ts';
declare const DAY_FILE: RegExp;
export { DAY_FILE };
export declare function dayOfFileName(name: string): string | null;
export declare function dayFileName(date: Date): string;
export declare function dayFileNameOf(time: number): string;
export declare function ledgerGeneration(dir: string): number;
export declare function resetUsageLogState(dir?: string): void;
export declare class UsageLog {
    private readonly dir;
    private readonly logger;
    private readonly state;
    constructor(dir: string, logger?: {
        error(...args: unknown[]): void;
    });
    has(requestId: string): boolean;
    flush(): Promise<void>;
    scan(): Promise<void>;
    private doScan;
    record(record: UsageRecord): Promise<boolean>;
    private beginScan;
    private enqueue;
    refileByEventDay(): Promise<number>;
    private ensureDir;
    private appendOnce;
}
