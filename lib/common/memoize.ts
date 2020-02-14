
/**
#####################################    File Description    #######################################

This  file implements memoization
Memoize (optimization technique to speed up program by storing expensive fn call results)
Follow link to see whats memoization https://en.wikipedia.org/wiki/Memoization

####################################################################################################
 */
let cache1 = new Map();
let cache2 = new Map();
const keys = new WeakMap();
/**
 * @summary Get/Create Key for object 
 * @param obj Object
 * @returns Key or null incase of null object
 */
function getKey(obj): string {
  if (obj === null) return "null";
  else if (obj === undefined) return "undefined";

  const t = typeof obj;
  if (t === "number" || t === "boolean" || t === "string") return `${t}:${obj}`;
  if (t !== "function" && t !== "object")
    throw new Error(`Cannot memoize ${t} arguments`);

  let k = keys.get(obj);
  if (!k) {
    const rnd = Math.trunc(Math.random() * Number.MAX_SAFE_INTEGER);
    k = `${t}:${rnd.toString(36)}`;
    keys.set(obj, k);
  }
  return k;
}
/**
 * @summary Memoize (optimization technique to speed up program by storing expensive fn call results)
 * Follow link to see whats memoization https://en.wikipedia.org/wiki/Memoization
 * @param func Object to memoize
 */
export default function memoize<T extends Function>(func: T): T {
  const funcKey = getKey(func);
  return ((...args) => {
    const key = JSON.stringify(args.map(getKey)) + funcKey;

    if (cache1.has(key)) return cache1.get(key);

    let r;
    if (cache2.has(key)) r = cache2.get(key);
    else r = func(...args);
    cache1.set(key, r);
    return r;
  }) as any;
}

const interval = setInterval(() => {
  cache2 = cache1;
  cache1 = new Map();
}, 120000);

// Don't hold Node.js process
if (interval.unref) interval.unref();
