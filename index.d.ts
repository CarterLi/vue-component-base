import 'reflect-metadata';
import Vue, { ComponentOptions, CreateElement, PropOptions, VNode, WatchOptions } from 'vue';
interface LifeCycleHook {
    /** Called synchronously immediately after the instance has been initialized, before data observation and event/watcher setup. */
    beforeCreate?(): void;
    /** Called synchronously after the instance is created. */
    created?(): void;
    /** Called right before the mounting begins: the render function is about to be called for the first time. */
    beforeMount?(): void;
    /** Called after the instance has been mounted, where el is replaced by the newly created vm.$el. */
    mounted?(): void;
    /** Called when data changes, before the DOM is patched. */
    beforeUpdate?(): void;
    /** Called after a data change causes the virtual DOM to be re-rendered and patched. */
    updated?(): void;
    /** Called when a kept-alive component is activated. */
    activated?(): void;
    /** Called when a kept-alive component is deactivated. */
    deactivated?(): void;
    /** Called right before a Vue instance is destroyed. */
    beforeDestroy?(): void;
    /** Called after a Vue instance has been destroyed. */
    destroyed?(): void;
    /** Called when an error from any descendent component is captured. */
    errorCaptured?(err: Error, vm: Vue, info: string): boolean | void;
    serverPrefetch?(): Promise<void>;
}
interface VueComponentBase extends Vue, LifeCycleHook {
    new (): VueComponentBase;
    render?(createElement: CreateElement): VNode;
    renderError?(createElement: CreateElement, err: Error): VNode;
}
/** A fake base class generally for static type checking of TypeScript */
export declare const VueComponentBase: VueComponentBase;
export declare function Inreactive(prototype: any, prop: string): void;
export declare type Decorator = (prototype: any, prop: string) => void;
export declare const Prop: (config?: PropOptions) => Decorator;
export declare const Ref: (refKey?: string) => Decorator;
export declare function Watch(prop?: string, option?: WatchOptions): Decorator;
export declare function Hook(type: keyof LifeCycleHook): (clazz: any, fn: string) => void;
export declare function Component(...mixins: ComponentOptions<any>[]): (clazz: VueComponentBase) => any;
export declare namespace Component {
    var registerHooks: (hooks: string[]) => void;
}
export {};
