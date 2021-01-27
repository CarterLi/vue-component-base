export const hasOwn = Object.call.bind(Object.prototype.hasOwnProperty);
export function pushOrCreate(obj, key, value) {
    if (hasOwn(obj, key)) {
        obj[key].push(value);
    }
    else {
        obj[key] = [value];
    }
    return obj[key];
}
//# sourceMappingURL=helpers.js.map