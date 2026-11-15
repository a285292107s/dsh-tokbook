import type { Context } from '@deepseek-ai/cordis';
export interface SlotRegisterOptions {
    name: string;
    id?: string;
    key?: string;
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
export interface SidebarRightTabDefinition {
    id: string;
    kind: string;
    title: (address: string) => string;
}
export interface SidebarRightTabsService {
    register(definition: SidebarRightTabDefinition): () => void;
}
export interface SidebarRightService {
    openTab(kind: string): void;
}
export type TokBookContext = Context & {
    slots: SlotsService;
    sidebarRightTabs: SidebarRightTabsService;
    sidebarRight: SidebarRightService;
};
