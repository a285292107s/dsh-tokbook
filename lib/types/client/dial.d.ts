import type { ReactNode } from 'react';
export interface DialSegment {
    key: string;
    value: number;
    fill: string;
}
export declare function Dial({ title, segments, defs, center }: {
    title: string;
    segments: readonly DialSegment[];
    defs?: ReactNode;
    center: ReactNode;
}): import("react").JSX.Element;
export declare function DialFigure({ text }: {
    text: string;
}): import("react").JSX.Element;
