import type { CostedModelRow, WorkspaceUsageRow } from '../types.ts';
export declare function isNoPrice(cost: number, unpriced: boolean): boolean;
export declare function ModelRows({ byModel, totalTokens, money, unpriced, showMoney }: {
    byModel: readonly CostedModelRow[];
    totalTokens: number;
    money: (value: number) => string;
    unpriced: ReadonlySet<string>;
    showMoney: boolean;
}): import("react").JSX.Element;
export declare function WorkspaceRows({ rows, totalTokens, money, showMoney }: {
    rows: readonly WorkspaceUsageRow[];
    totalTokens: number;
    money: (value: number) => string;
    showMoney: boolean;
}): import("react").JSX.Element;
