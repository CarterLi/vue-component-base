import { mapValues } from 'lodash-es';
import './reflect-metadata';
import { hasOwn, pushOrCreate } from './helpers';
const $internalHooks = new Set([
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
    'setup',
    'render',
    'renderTracked',
    'renderTriggered',
    'errorCaptured',
    // deprecated
    'beforeDestroy',
    'destroyed',
]);
/** A fake base class generally for static type checking of TypeScript */
export const VueComponentBase = class {
    constructor() { return {}; }
};
const VueInreactive = Symbol('vue-inreactive');
export function Inreactive(prototype, prop) {
    pushOrCreate(prototype, VueInreactive, prop);
}
const VueField = Symbol('vue-decorate-field');
function decorateField(type, data) {
    return function decorate(prototype, field) {
        if (!hasOwn(prototype, VueField))
            prototype[VueField] = {};
        pushOrCreate(prototype[VueField], type, [field, data]);
    };
}
export const Prop = decorateField.bind(null, 'props');
/**
 * For `ref` in `v-for`, declare `ref="xxx"` in template as `:ref="x => refKey(index, x)"`
 * @param refKey For normal ref, an alias of the default ref key name; For array ref, the function name used by ref declaration in template ( xxxRefFn by default )
 */
export const Ref = decorateField.bind(null, 'refs');
export const Inject = decorateField.bind(null, 'injects');
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
        var _a, _b, _c, _d;
        const { prototype } = clazz;
        if (!prototype[VueField])
            prototype[VueField] = {};
        const watcher = [];
        const refs = {};
        const opts = {
            name: ((_a = mixins.find(x => x.name)) === null || _a === void 0 ? void 0 : _a.name) || clazz.name,
            mixins: mixins.concat({}),
            data() {
                const instance = new clazz();
                const inreactives = prototype[VueInreactive];
                if (inreactives) {
                    inreactives.forEach(key => {
                        if (hasOwn(instance, key)) {
                            const temp = instance[key];
                            delete instance[key];
                            this[key] = temp;
                        }
                    });
                }
                return instance;
            },
            beforeCreate() {
                Object.defineProperties(this, mapValues(refs, x => x || { value: [], configurable: false }));
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
        function addLifeCycleHook(prop, fn) {
            if (prop === 'setup') {
                // `setup` cannot be in mixins but `render` can ( strangely )
                opts.setup = fn;
            }
            else {
                const mixin = opts.mixins[opts.mixins.length - 1];
                if (hasOwn(mixin, prop)) {
                    mixins.push({ [prop]: fn });
                }
                else {
                    mixin[prop] = fn;
                }
            }
        }
        const lifeCycleHook = new Set();
        // Forwards class methods to vue methods
        for (let proto = prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            if (hasOwn(proto, VueField)) {
                (_b = proto[VueField].props) === null || _b === void 0 ? void 0 : _b.forEach(([field, config = {}]) => {
                    var _a;
                    (_a = opts.props)[field] || (_a[field] = !config.type
                        ? Object.assign({ type: Reflect.getMetadata('design:type', proto, field) }, config)
                        : config);
                });
                (_c = proto[VueField].refs) === null || _c === void 0 ? void 0 : _c.forEach(([field, refKey]) => {
                    var _a, _b;
                    const type = Reflect.getMetadata('design:type', proto, field);
                    refs[field] || (refs[field] = type !== Array
                        ? { get() { return this._.refs[refKey || field]; }, configurable: false }
                        : null);
                    if (type === Array) {
                        (_a = opts.methods)[_b = refKey || field + 'RefFn'] || (_a[_b] = function updateRefField(index, component) {
                            if (component) {
                                this[field][index] = component;
                            }
                            else {
                                this[field].length--;
                            }
                        });
                    }
                });
                (_d = proto[VueField].injects) === null || _d === void 0 ? void 0 : _d.forEach(([field, option]) => {
                    opts.inject || (opts.inject = {});
                    opts.inject[field] = option || field;
                });
            }
            for (const [property, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
                if (property === 'constructor')
                    continue;
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
                            if (prop.includes('.') || prop.includes('[')) {
                                // eslint-disable-next-line @typescript-eslint/no-implied-eval
                                watcher.push([new Function('"use strict";return this.' + prop), descriptor.value, option]);
                            }
                            else {
                                pushOrCreate(opts.watch, prop, {
                                    ...option,
                                    handler: descriptor.value,
                                });
                            }
                        });
                    }
                    const hooks = descriptor.value[VueHooks];
                    if (hooks) {
                        hooks.forEach(hook => addLifeCycleHook(hook, descriptor.value));
                    }
                    opts.methods[property] = opts.methods[property] || descriptor.value;
                }
            }
        }
        // Copies static properties.
        // Note: Object.assign only copies enumerable properties, `name` and `prototype` are not enumerable.
        // WARNING: Vue has its own predefined static properties. Please make sure that they are not conflict.
        return Object.assign(opts, clazz);
    };
}
Component.registerHooks = (hooks) => {
    hooks.forEach(x => $internalHooks.add(x));
};
//# sourceMappingURL=index.js.map