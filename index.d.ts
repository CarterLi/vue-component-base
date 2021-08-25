import type { DebuggerEvent, ComponentOptions, WatchOptions, ComponentPublicInstance, Prop as PropOptions, SetupContext } from 'vue';
import './reflect-metadata';
declare type DebuggerHook = (e: DebuggerEvent) => void;
declare type ErrorCapturedHook = (err: unknown, instance: ComponentPublicInstance | null, info: string) => boolean | void;
interface LifeCycleHook {
    beforeCreate?(): void;
    created?(): void;
    beforeMount?(): void;
    mounted?(): void;
    beforeUpdate?(): void;
    updated?(): void;
    activated?(): void;
    deactivated?(): void;
    beforeUnmount?(): void;
    unmounted?(): void;
    /** @deprecated use beforeUnmount instead */
    beforeDestroy?(): void;
    /** @deprecated use unmounted instead */
    destroyed?(): void;
}
interface VueComponentBase extends LifeCycleHook, ComponentPublicInstance {
    new (): VueComponentBase;
    setup?(this: void, props: Record<string, any>, ctx: SetupContext): Record<string, any> | void;
    render?(): any;
    renderTracked?: DebuggerHook;
    renderTriggered?: DebuggerHook;
    errorCaptured?: ErrorCapturedHook;
}
/** A fake base class generally for static type checking of TypeScript */
export declare const VueComponentBase: VueComponentBase;
export declare function Inreactive(prototype: any, prop: string): void;
export declare type Decorator = (prototype: any, prop: string) => void;
export declare const Prop: (config?: PropOptions<any>) => Decorator;
/**
 * For `ref` in `v-for`, declare `ref="xxx"` in template as `:ref="x => refKey(index, x)"`
 * @param refKey For normal ref, an alias of the default ref key name; For array ref, the function name used by ref declaration in template ( xxxRefFn by default )
 */
export declare const Ref: (refKey?: string) => Decorator;
export declare const Inject: (option?: ComponentOptions['inject']) => Decorator;
export declare function Watch(prop?: string, option?: WatchOptions): Decorator;
export declare function Hook(type: keyof LifeCycleHook): (clazz: any, fn: string) => void;
export declare function Component(...mixins: ComponentOptions[]): (clazz: VueComponentBase) => any;
export declare namespace Component {
    var registerHooks: (hooks: string[]) => void;
}
export {};
