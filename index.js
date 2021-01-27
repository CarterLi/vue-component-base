import { isEmpty } from 'lodash-es';
import 'reflect-metadata';
import Vue from 'vue';
import { LIFECYCLE_HOOKS } from 'vue/src/shared/constants.js';
import { pushOrCreate, hasOwn } from './helpers';
const $internalHooks = new Set(LIFECYCLE_HOOKS);
let currentComponentProps;
/** A fake base class generally for static type checking of TypeScript */
export const VueComponentBase = class {
    constructor() { return Object.create(currentComponentProps); }
};
const VueInreactive = Symbol('vue-inreactive');
export function Inreactive(prototype, prop) {
    pushOrCreate(prototype, VueInreactive, prop);
}
const VueField = Symbol('vue-decorate-field');
function decorateField(type, data) {
    return function decorate(prototype, field) {
        if (!prototype[VueField])
            prototype[VueField] = {};
        pushOrCreate(prototype[VueField], type, [field, data]);
        Inreactive(prototype, field);
    };
}
export const Prop = decorateField.bind(null, 'props');
export const Ref = decorateField.bind(null, 'refs');
const VueWatches = Symbol('vue-decorate-watch');
export function Watch(prop, option) {
    return function decorate(clazz, fn) {
        pushOrCreate(clazz[fn], VueWatches, { prop, option });
    };
}
const VueHooks = Symbol('vue-decorate-hook');
export function Hook(type) {
    return function decorate(clazz, fn) {
        pushOrCreate(clazz[fn], VueHooks, type);
    };
}
export function Component(...mixins) {
    return (clazz) => {
        const { prototype } = clazz;
        if (!prototype[VueField])
            prototype[VueField] = {};
        const lifeCycles = {
            beforeCreate: [function beforeCreate() {
                    currentComponentProps = isEmpty(this.$options.propsData)
                        ? Object.prototype
                        : this.$options.propsData;
                    const instance = new clazz();
                    if (currentComponentProps !== Object.prototype)
                        Object.setPrototypeOf(instance, Object.prototype);
                    const inreactiveProps = [];
                    // 找到子类与所有父类的VueInreactive
                    for (let proto = clazz.prototype; proto && proto[VueInreactive]; proto = Object.getPrototypeOf(proto)) {
                        if (hasOwn(proto, VueInreactive)) { // 避免找到原型链上的VueInreactive出现重复
                            inreactiveProps.push(...proto[VueInreactive]);
                        }
                    }
                    for (const prop of inreactiveProps) {
                        if (prop in instance) {
                            if (instance[prop] !== undefined) {
                                const propDef = this.$options.props[prop];
                                if (propDef) {
                                    const val = instance[prop];
                                    propDef.default = () => val; // Silence Vue dev warnings
                                    if (propDef.type === Object) {
                                        propDef.type = Object(val).constructor;
                                    }
                                }
                                else {
                                    this[prop] = instance[prop];
                                }
                            }
                            delete instance[prop];
                        }
                    }
                    this.$options.data = instance;
                    Object.defineProperties(this, Object.fromEntries((prototype[VueField].refs || []).map(([field, refKey = field]) => [field, {
                            get() { return this.$refs[refKey]; },
                        }])));
                }],
            created: [function created() {
                    Object.setPrototypeOf(this.$data, this);
                }],
        };
        const opts = {
            mixins: [...mixins, lifeCycles],
            props: Object.fromEntries((prototype[VueField].props || []).map(([field, config = {}]) => [field,
                !config.type
                    ? Object.assign({ type: Reflect.getMetadata('design:type', prototype, field) }, config)
                    : config,
            ])),
            computed: {},
            methods: {},
            filters: {},
            watch: {},
        };
        const lifeCycleHook = new Set();
        // Forwards class methods to vue methods
        for (let proto = prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            for (const [property, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
                if (property === 'constructor')
                    continue;
                console.assert(typeof (descriptor.value || descriptor.get || descriptor.set) === 'function', `Don't set normal properties on prototype of the class`);
                if ($internalHooks.has(property)) {
                    if (!lifeCycleHook.has(property)) {
                        pushOrCreate(lifeCycles, property, descriptor.value);
                        lifeCycleHook.add(property);
                    }
                }
                else if (property === 'render' || property === 'renderError') {
                    // render fn Cannot be an array
                    opts[property] = opts[property] || descriptor.value;
                }
                else if (descriptor.get || descriptor.set) {
                    opts.computed[property] = opts.computed[property] || {
                        get: descriptor.get,
                        set: descriptor.set,
                    };
                }
                else {
                    const watches = descriptor.value[VueWatches];
                    if (watches) {
                        watches.forEach(({ prop, option }) => {
                            pushOrCreate(opts.watch, prop, {
                                ...option,
                                handler: descriptor.value,
                            });
                        });
                    }
                    const hooks = descriptor.value[VueHooks];
                    hooks === null || hooks === void 0 ? void 0 : hooks.forEach(hook => pushOrCreate(lifeCycles, hook, descriptor.value));
                    opts.methods[property] = opts.methods[property] || descriptor.value;
                }
            }
        }
        const resultFn = Vue.extend(opts);
        // Copies static properties.
        // Note: Object.assign only copies enumerable properties, `name` and `prototype` are not enumerable.
        // WARNING: Vue has its own predefined static properties. Please make sure that they are not conflict.
        Object.assign(resultFn, clazz);
        return resultFn;
    };
}
Component.registerHooks = (hooks) => {
    hooks.forEach(x => $internalHooks.add(x));
};
//# sourceMappingURL=index.js.map