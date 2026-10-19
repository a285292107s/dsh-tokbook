import type { Context } from '@deepseek-ai/cordis';
export interface SlotRegisterOptions {
    name: string;
    id?: string;
    order?: number;
    locale?: string;
    label?: string | (() => string);
    inject?: (...args: string[]) => Record<string, unknown>;
    children?: Record<string, unknown>;
}
export interface SlotsService {
    inject(name: string, callback: () => (() => void) | Iterable<() => void>): () => void;
    register(options: SlotRegisterOptions, component: unknown): () => void;
}
export type TokBookContext = Context & {
    slots: SlotsService;
};
