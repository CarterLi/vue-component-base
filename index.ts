import type {
  DebuggerEvent,
  ComponentOptions,
  VNode,
  WatchOptions,
  ComponentPublicInstance,
  Prop as PropOptions,
} from 'vue';

// I removed the judgement in DecorateConstructor, the offical repo can't be used.
import './reflect-metadata';

const hasOwn: (obj: Record<PropertyKey, any>, key: PropertyKey) => boolean
  = Object.call.bind(Object.prototype.hasOwnProperty);

function pushOrCreate<T>(obj: Record<any, any>, key: any, value: T): T[] {
  if (hasOwn(obj, key)) {
    obj[key].push(value);
  } else {
    obj[key] = [value];
  }
  return obj[key];
}

function isEmpty(obj: object) {
  for (const key in obj) {
    if (hasOwn(obj, key)) {
      return false;
    }
  }

  return true;
}

const $internalHooks = new Set<string>([
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
  'deactivated',
  'beforeUnmount',
  'unmounted',
  'render',
  'renderTracked',
  'renderTriggered',
  'errorCaptured',

  // deprecated
  'beforeDestroy',
  'destroyed',
]);

type DebuggerHook = (e: DebuggerEvent) => void;
type ErrorCapturedHook = (err: unknown, instance: ComponentPublicInstance | null, info: string) => boolean | void;

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
  // eslint-disable-next-line @typescript-eslint/no-misused-new
  new(): VueComponentBase;

  render?(): VNode | VNode[];
  renderTracked?: DebuggerHook;
  renderTriggered?: DebuggerHook;
  errorCaptured?: ErrorCapturedHook;
}

let currentComponentProps: Record<string, any>;

/** A fake base class generally for static type checking of TypeScript */
export const VueComponentBase = class {
  constructor() { return Object.create(currentComponentProps); }
} as any as VueComponentBase;

const VueInreactive = Symbol('vue-inreactive');

export function Inreactive(prototype: any, prop: string) {
  pushOrCreate(prototype, VueInreactive, prop);
}

const VueField = Symbol('vue-decorate-field');

function decorateField(type: string, data?: any) {
  return function decorate(prototype: any, field: string) {
    if (!hasOwn(prototype, VueField)) prototype[VueField] = {};
    pushOrCreate(prototype[VueField], type, [field, data]);
  };
}

export type Decorator = (prototype: any, prop: string) => void;

export const Prop: (config?: PropOptions<any>) => Decorator = decorateField.bind(null, 'props');
/**
 * For `ref` in `v-for`, declare `ref="xxx"` in template as `:ref="x => refKey(index, x)"`
 * @param refKey For normal ref, an alias of the default ref key name; For array ref, the function name used by ref declaration in template ( xxxRefFn by default )
 */
export const Ref: (refKey?: string) => Decorator = decorateField.bind(null, 'refs');

const VueWatches = Symbol('vue-decorate-watch');

export function Watch(prop?: string, option?: WatchOptions): Decorator {
  return function decorate(clazz: any, fn: string) {
    pushOrCreate(clazz[fn], VueWatches, { prop, option });
  };
}

const VueHooks = Symbol('vue-decorate-hook');

export function Hook(type: keyof LifeCycleHook) {
  return function decorate(clazz: any, fn: string) {
    pushOrCreate(clazz[fn], VueHooks, type);
  };
}

export function Component(...mixins: ComponentOptions[]) {
  return (clazz: VueComponentBase) => {
    const { prototype } = clazz;
    if (!prototype[VueField]) prototype[VueField] = {};

    const watcher: [() => any, (...args: any[]) => any, WatchOptions][] = [];
    const refs: Record<string, PropertyDescriptor> = {};
    const opts: ComponentOptions = {
      mixins,

      data() {
        currentComponentProps = isEmpty(this.$props)
          ? Object.prototype
          : Object.assign({}, this.$props);
        const instance = new clazz();
        if (currentComponentProps !== Object.prototype) {
          Object.setPrototypeOf(instance, Object.prototype);
        }

        const inreactives = prototype[VueInreactive] as string[];
        if (inreactives) {
          inreactives.forEach(key => {
            if (hasOwn(instance, key)) {
              const temp = instance[key];
              delete instance[key];
              this[key] = temp;
            }
          })
        }
        return instance;
      },

      beforeCreate() {
        Object.defineProperties(this, refs);
      },
      created() {
        watcher.forEach(x => this.$watch(...x));
      },
      props: {},
      computed: {},
      methods: {},
      filters: {},
      watch: {},
    };

    function addLifeCycleHook(prop: string, fn: (this: any) => void) {
      opts.mixins.push({ [prop]: fn });
    }

    const lifeCycleHook = new Set();
    // Forwards class methods to vue methods
    for (let proto = prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      if (hasOwn(proto, VueField)) {
        (proto[VueField].props || []).map(([field, config = {} as any]) => {
          opts.props[field] ||= !config.type
            ? Object.assign({ type: Reflect.getMetadata('design:type', proto, field) }, config)
            : config;
        });

        (proto[VueField].refs || []).forEach(([field, refKey]) => {
          const type = Reflect.getMetadata('design:type', proto, field);

          refs[field] ||= type !== Array
            ? { get() { return this.$refs[refKey || field]; }, configurable: false }
            : { value: [], configurable: false };

          if (type === Array) {
            opts.methods[refKey || field + 'RefFn'] ||= function updateRefField(index: number, component: any) {
              if (component) {
                this[field][index] = component;
              } else {
                this[field].length--;
              }
            }
          }
        });
      }

      for (const [property, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
        if (property === 'constructor') continue;
        console.assert(typeof (descriptor.value || descriptor.get || descriptor.set) === 'function', `Don't set normal properties on prototype of the class`);

        if ($internalHooks.has(property)) {
          // TODO: remove this
          let fn = property;
          switch (property) {
            case 'beforeDestroy':
              console.warn('`beforeDestroy` is deprecated, use `beforeUnmount` instead', descriptor.value);
              fn = 'beforeUnmount';
              break;
            case 'destroyed':
              console.warn('`destroyed` is deprecated, use `unmounted` instead', descriptor.value);
              fn = 'unmounted';
              break;
          }
          if (!lifeCycleHook.has(fn)) {
            addLifeCycleHook(fn, descriptor.value);
            lifeCycleHook.add(fn);
          }
        } else if (descriptor.get || descriptor.set) {
          opts.computed[property] = opts.computed[property] || {
            get: descriptor.get,
            set: descriptor.set,
          };
        } else {
          const watches = descriptor.value[VueWatches] as {
            prop: string;
            option: WatchOptions;
          }[];
          if (watches) {
            watches.forEach(({ prop, option }) => {
              if (prop.includes('.') || prop.includes('[')) {
                watcher.push([new Function('"use strict";return this.' + prop) as () => any, descriptor.value, option]);
              } else {
                pushOrCreate(opts.watch, prop, {
                  ...option,
                  handler: descriptor.value,
                } as WatchOptions<any>);
              }
            })
          }
          const hooks = descriptor.value[VueHooks] as string[];
          if (hooks) {
            hooks.forEach(hook => addLifeCycleHook(hook, descriptor.value));
          }
          opts.methods[property] = opts.methods[property] || descriptor.value as (this: any, ...args: any[]) => any;
        }
      }
    }
    // Copies static properties.
    // Note: Object.assign only copies enumerable properties, `name` and `prototype` are not enumerable.
    // WARNING: Vue has its own predefined static properties. Please make sure that they are not conflict.
    return Object.assign(opts, clazz) as any;
  };
}

Component.registerHooks = (hooks: string[]) => {
  hooks.forEach(x => $internalHooks.add(x));
};
