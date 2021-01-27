export const hasOwn: (obj: any, key: PropertyKey) => boolean
  = Object.call.bind(Object.prototype.hasOwnProperty);

export function pushOrCreate<T>(obj: Record<any, any>, key: any, value: T): T[] {
  if (hasOwn(obj, key)) {
    obj[key].push(value);
  } else {
    obj[key] = [value];
  }
  return obj[key];
}
