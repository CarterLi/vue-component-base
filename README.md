# VueComponentBase

For Vue 3.

## Functional difference from v2

* Default prop value with field init syntax won't work, use prop option instead.

```ts
// @Prop() readonly prop = 'default prop'; // Doesn't work
@Prop({ default: 'default prop' }) prop: string; // Works
```

* For `@Ref` that maps an array ( i.e. `ref` used in `v-for` ), declare `ref="xxx"` in template as `:ref="x => xxxRefFn(index, x)"`

```ts
@Ref() divs: HTMLDivElement[];
```

```html
<div v-for="(item, index) of [1, 2, 3]"
     :key="item"
     :ref="x => divsRefFn(index, x)"></div>
```

* Lifecycle hook `beforeDestroy` and `destroyed` are deprecated to follow the change of Vue 3, but they are still supported and are treated as the alias of `beforeUnmount` and `unmounted`.

All other functions stay the same.

## Usage

```ts
import { Component, VueComponentBase } from 'vue-component-base';

@Component() // Parens are required
export default class MyComponent extends VueComponentBase { // NOT `extends Vue`. Note `extends MyBaseComponent` works
  @Prop({ default: 'default prop' }) readonly prop: string; // https://github.com/kaorun343/vue-property-decorator#Prop

  @Ref() readonly div: HTMLDivElement; // $refs.div

  @Inject() inject readonly: Something; // inject

  foo = ''; // Normal property
  arrowFn = () => this.foo = 456; // Arrow function property

  undefinedValue = undefined; // Different from https://github.com/vuejs/vue-class-component#undefined-will-not-be-reactive, this is reactive

  undefinedValue2; // This is NOT reactive, TypeScript won't generate code for fields that have no init value. ( while babel and the standard do )

  @Inreactive // It's not reactive, useful for constant values
  readonly MY_CONSTANT = 'some constants';

  setup(props: Record<string, any>, ctx: SetupContext) {} // setup function, you cannot use this in it

  mounted() {} // Lifecycle hook with intellisense

  doSomeAction() {} // Normal method

  @Hook('mounted') // Another Lifecycle hook
  fetchData() {} // Accepted as a normal method too

  @Watch('field') // https://github.com/kaorun343/vue-property-decorator#-watchpath-string-options-watchoptions---decorator
  onFieldChange(val: string, oldVal: string) {}

  get computedVar() { // Computed properties
    return 'field: ' + this.field;
  }
}
```

## License

MIT
