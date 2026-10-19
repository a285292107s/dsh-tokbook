export interface PricingPanelProps {
    onChanged: () => void;
    onDirtyChange?: (dirty: boolean) => void;
}
export declare function PricingPanel({ onChanged, onDirtyChange }: PricingPanelProps): import("react").JSX.Element;
