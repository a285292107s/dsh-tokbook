import type { TokBookViewStore } from './store.ts';
export interface FooterButtonProps {
    wide: boolean;
    view: TokBookViewStore;
}
export declare function FooterButton({ wide, view }: FooterButtonProps): import("react").JSX.Element;
