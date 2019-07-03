import 'reflect-metadata';
import Vue, { ComponentOptions, PropOptions } from 'vue';
import { LIFECYCLE_HOOKS } from 'vue/src/shared/constants.js';
import { Constructor, WatchOptions, WatchOptionsWithHandler } from 'vue/types/options';

const $lifecycleHooks = new Set<string>(LIFECYCLE_HOOKS);

interface VueComponentBase extends Vue {
  // tslint:disable-next-line: no-misused-new
  new(): VueComponentBase;

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

/** A fake base class generally for static type checking of TypeScript */
export const VueComponentBase = Object as any as VueComponentBase;

const VueInreactive = Symbol('vue-inreactive');
const VueField = Symbol('vue-decorate-field');
const VueMethod = Symbol('vue-decorate-method');

export function Inreactive(prototype: any, prop: string) {
  const inreactives: string[] = prototype[VueInreactive] || (prototype[VueInreactive] = []);
  inreactives.push(prop);
}

function decorateField(type: string, data?: any) {
  return function decorate(prototype: any, field: string) {
    if (!prototype[VueField]) prototype[VueField] = {};
    const array: any[] = prototype[VueField][type] || (prototype[VueField][type] = []);
    array.push([field, data]);
    Inreactive(prototype, field);
  };
}

type Decorator = (prototype: any, prop: string) => void;

export const Prop: (config?: PropOptions) => Decorator = decorateField.bind(null, 'props');
export const Ref: (refKey?: string) => Decorator = decorateField.bind(null, 'refs');

function decorateMethod(type: string, data?: string, option?: object) {
  return function decorate(clazz: any, fn: string) {
    console.assert(!clazz[fn][VueMethod], `The method ${fn} has been used as another special method`);
    clazz[fn][VueMethod] = {
      type,
      data: data || fn,
      option,
    };
  };
}

export const Watch: (prop?: string, option?: WatchOptions) => Decorator = decorateMethod.bind(null, 'watch');
export const Filter: (name?: string) => Decorator = decorateMethod.bind(null, 'filters');

export const NoCache = decorateMethod('nocache');

export function Component(...options: Array<ComponentOptions<any>>) {
  return (clazz: Constructor) => {
    const { prototype } = clazz;
    if (!prototype[VueField]) prototype[VueField] = {};

    const opts: ComponentOptions<any> = {
      beforeCreate: [
        function initData(this: Vue) {
          const instance = new clazz();
          // FIXME: Is this necessary?
          // Object.setPrototypeOf(instance, Object.prototype);

          const inreactiveProps = clazz.prototype[VueInreactive] as string[];
          if (inreactiveProps) {
            for (const prop of inreactiveProps) {
              if (instance.hasOwnProperty(prop)) {
                if (instance[prop] !== undefined) {
                  const propDef: PropOptions<any> = this.$options.props[prop];
                  if (propDef) {
                    if (process.env.NODE_ENV !== 'production') {
                      const val = instance[prop];
                      propDef.default = () => val; // Silence Vue dev warnings
                      if (propDef.type === Object) {
                        propDef.type = Object(val).constructor;
                      }
                    } else {
                      propDef.default = instance[prop];
                    }
                  } else {
                    this[prop] = instance[prop];
                  }
                }
                delete instance[prop];
              }
            }
          }

          this.$options.data = instance;
        },
      ],
      props: Object.fromEntries<PropOptions>(
        (prototype[VueField].props || []).map(([field, config = {}]) => [field,
          !config.type && process.env.NODE_ENV !== 'production'
            ? Object.assign({ type: Reflect.getMetadata('design:type', prototype, field) }, config)
            : config,
        ]),
      ),
      computed: Object.fromEntries<() => any>(
        (prototype[VueField].refs || []).map(([field, refKey = field]) => [field, {
          cache: false,
          get() { return this.$refs[refKey]; },
        }]),
      ),
      methods: {},
      filters: {},
      watch: {},
      render: prototype.render,
      ...Object.assign({}, ...options),
    };

    // Forwards class methods to vue methods
    for (let proto = prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const [properity, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
        if (properity === 'constructor') continue;
        console.assert(typeof (descriptor.value || descriptor.get || descriptor.set) === 'function', `Don't set normal properties on prototype of the class`);

        if ($lifecycleHooks.has(properity)) {
          (opts[properity] || (opts[properity] = [])).push(descriptor.value);
        } else if (descriptor.get || descriptor.set) {
          opts.computed[properity] = {
            get: descriptor.get,
            set: descriptor.set,
            cache: descriptor.get[VueMethod] && descriptor.get[VueMethod].type === 'nocache',
          };
        } else if (descriptor.value[VueMethod]) {
          const { type, data, option } = descriptor.value[VueMethod];
          if (!option) {
            opts[type][data] = descriptor.value;
          } else if (type === 'watch') {
            opts.watch[data] = {
              ...option as WatchOptions,
              handler: descriptor.value,
            } as WatchOptionsWithHandler<any>;
          }
        } else {
          opts.methods[properity] = descriptor.value as (this: any, ...args: any[]) => any;
        }
      }
    }

    return Vue.extend(opts) as any;
  };
}

Component.registerHooks = (hooks: string[]) => {
  hooks.forEach(x => $lifecycleHooks.add(x));
};
