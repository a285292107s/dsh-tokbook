export declare function defaultDataDir(configPath: string | undefined): string;
export declare const OWNER_FILE = "owner.json";
export declare function warnIfForeignOwner(dir: string, logger?: {
    warn?(...args: unknown[]): void;
    info?(...args: unknown[]): void;
}): Promise<boolean>;
export declare function writeOwnerMarker(dir: string): Promise<void>;
