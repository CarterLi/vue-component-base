import 'reflect-metadata';
import Vue, { ComponentOptions, CreateElement, PropOptions, VNode } from 'vue';
import { LIFECYCLE_HOOKS } from 'vue/src/shared/constants.js';
import { WatchOptions, WatchOptionsWithHandler } from 'vue/types/options';

// import { isEmpty } from 'lodash-es';

function isEmpty(obj: object) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }

  return true;
}

const $internalHooks = new Set<string>([...LIFECYCLE_HOOKS, 'render', 'renderError']);

interface VueComponentBase extends Vue {
  // tslint:disable-next-line:no-misused-new
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

  render?(createElement: CreateElement): VNode;
  renderError?(createElement: CreateElement, err: Error): VNode;
}

let currentComponentProps: Record<string, any>;

/** A fake base class generally for static type checking of TypeScript */
export const VueComponentBase = class {
  constructor() { return Object.create(currentComponentProps); }
} as any as VueComponentBase;

const VueInreactive = Symbol('vue-inreactive');

export function Inreactive(prototype: any, prop: string) {
  const inreactives: string[] = prototype[VueInreactive] || (prototype[VueInreactive] = []);
  inreactives.push(prop);
}

const VueField = Symbol('vue-decorate-field');

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

const VueWatches = Symbol('vue-decorate-watch');

export function Watch(prop?: string, option?: WatchOptions): Decorator {
  return function decorate(clazz: any, fn: string) {
    const watches: any[] = clazz[fn][VueWatches] || (clazz[fn][VueWatches] = []);
    watches.push({ prop, option });
  };
}

export function Component(...mixins: Array<ComponentOptions<any>>) {
  return (clazz: VueComponentBase) => {
    const { prototype } = clazz;
    if (!prototype[VueField]) prototype[VueField] = {};

    const opts: ComponentOptions<any> = {
      mixins: [...mixins, {
        beforeCreate(this: Vue) {
          currentComponentProps = this.$options.propsData;
          if (isEmpty(currentComponentProps)) currentComponentProps = null;
          const instance = new clazz();
          if (currentComponentProps) Object.setPrototypeOf(instance, null);

          const inreactiveProps = clazz.prototype[VueInreactive] as string[];
          if (inreactiveProps) {
            for (const prop of inreactiveProps) {
              if (prop in instance) {
                if (instance[prop] !== undefined) {
                  const propDef: PropOptions<any> = this.$options.props[prop];
                  if (propDef) {
                    const val = instance[prop];
                    propDef.default = () => val; // Silence Vue dev warnings
                    if (propDef.type === Object) {
                      propDef.type = Object(val).constructor;
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

          Object.defineProperties(this, Object.fromEntries<PropertyDescriptor>(
            (prototype[VueField].refs || []).map(([field, refKey = field]) => [field, {
              get() { return this.$refs[refKey]; },
            }]),
          ));
        },
        created() {
          Object.setPrototypeOf(this.$data, this);
        },
      }],
      props: Object.fromEntries<PropOptions>(
        (prototype[VueField].props || []).map(([field, config = {}]) => [field,
          !config.type
            ? Object.assign({ type: Reflect.getMetadata('design:type', prototype, field) }, config)
            : config,
        ]),
      ),
      computed: {},
      methods: {},
      filters: {},
      watch: {},
    };

    // Forwards class methods to vue methods
    for (let proto = prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const [property, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
        if (property === 'constructor') continue;
        console.assert(typeof (descriptor.value || descriptor.get || descriptor.set) === 'function', `Don't set normal properties on prototype of the class`);

        if ($internalHooks.has(property)) {
          opts[property] = descriptor.value;
        } else if (descriptor.get || descriptor.set) {
          opts.computed[property] = {
            get: descriptor.get,
            set: descriptor.set,
          };
        } else {
          const watches = descriptor.value[VueWatches] as Array<{
            prop: string,
            option: WatchOptions,
          }>;
          if (watches) {
            watches.forEach(({ prop, option }) => {
              opts.watch[prop] = {
                ...option,
                handler: descriptor.value,
              } as WatchOptionsWithHandler<any>;
            });
          }
          opts.methods[property] = descriptor.value as (this: any, ...args: any[]) => any;
        }
      }
    }

    return Vue.extend(opts) as any;
  };
}

Component.registerHooks = (hooks: string[]) => {
  hooks.forEach(x => $internalHooks.add(x));
};
