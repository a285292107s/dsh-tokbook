import type { TokBookViewStore } from './store.ts';
export interface TokBookPanelIconProps {
    size: number;
    active: boolean;
    view: TokBookViewStore;
}
export declare function TokBookPanelIcon({ size, view }: TokBookPanelIconProps): import("react").JSX.Element;
