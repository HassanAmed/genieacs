/**
#####################################    File Description    #######################################

This  file implements function to be used in making proper queries 

####################################################################################################
 */
import * as common from "./common";
/**
 * @summary Convert string to regular expressions 
 * @param input input string
 * @param flags Optional
 */
function stringToRegexp(input, flags?): RegExp | false {
  if (input.indexOf("*") === -1) return false;

  let output = input.replace(/[[\]\\^$.|?+()]/, "\\$&");
  if (output[0] === "*") output = output.replace(/^\*+/g, "");
  else output = "^" + output;

  if (output[output.length - 1] === "*") output = output.replace(/\*+$/g, "");
  else output = output + "$";

  output = output.replace(/[*]/, ".*");
  return new RegExp(output, flags);
}
/**
 * @summary String Normalization convert string to array object
 * @param input Input string to be normalized.
 */
function normalize(input): any {
  if (common.typeOf(input) === common.STRING_TYPE) {
    const vals = [input];
    const m = /^\/(.*?)\/(g?i?m?y?)$/.exec(input);
    if (m) vals.push({ $regex: new RegExp(m[1], m[2]) });

    if (+input === parseFloat(input)) vals.push(+input);

    const d = new Date(input);
    if (input.length >= 8 && d.getFullYear() > 1983) vals.push(d);

    const r = stringToRegexp(input);
    if (r !== false) vals.push({ $regex: r });

    return vals;
  }
  return input;
}
/**
 * @summary A complex values, such as tables, lists, records or links, can be expanded
 *  to reveal the values contained in the complex value.
 * @param value 
 */
export function expandValue(value): any[] {
  if (common.typeOf(value) === common.ARRAY_TYPE) {
    let a = [];
    for (const j of value) a = a.concat(expandValue(j));
    return [a];
  } else if (common.typeOf(value) !== common.OBJECT_TYPE) {
    const n = normalize(value);
    if (common.typeOf(n) !== common.ARRAY_TYPE) return [n];
    else return n;
  }

  const objs = [];
  const indices = [];
  const keys = [];
  const values = [];
  for (const [k, v] of Object.entries(value)) {
    keys.push(k);
    values.push(expandValue(v));
    indices.push(0);
  }

  let i = 0;
  while (i < indices.length) {
    const obj = {};
    for (let j = 0; j < keys.length; ++j) obj[keys[j]] = values[j][indices[j]];
    objs.push(obj);

    for (i = 0; i < indices.length; ++i) {
      indices[i] += 1;
      if (indices[i] < values[i].length) break;
      indices[i] = 0;
    }
  }
  return objs;
}
/**
 * @description return a changed form by expanding complex value in data structure.
 * @param param 
 * @param val 
 */
function permute(param, val): any[] {
  const conditions = [];
  const values = expandValue(val);

  if (param[param.lastIndexOf(".") + 1] !== "_") param += "._value";

  for (const v of values) {
    const obj = {};
    obj[param] = v;
    conditions.push(obj);
  }

  return conditions;
}
/**
 * @description Expand a query and return new formed  
 * @param query 
 */
export function expand(query): {} {
  const newQuery = {};
  for (const [k, v] of Object.entries(query)) {
    if (k[0] === "$") {
      // Operator
      newQuery[k] = (v as any[]).map(e => expand(e));
    } else {
      const conditions = permute(k, v);
      if (conditions.length > 1) {
        newQuery["$and"] = newQuery["$and"] || [];
        if (v && (v["$ne"] != null || v["$not"] != null)) {
          if (Object.keys(v).length > 1)
            throw new Error("Cannot mix $ne or $not with other operators");
          for (const c of conditions) newQuery["$an"].push(c);
        } else {
          newQuery["$and"].push({ $or: conditions });
        }
      } else {
        Object.assign(newQuery, conditions[0]);
      }
    }
  }

  return newQuery;
}
/**
 * @description Test Expression
 */
function testExpressions(params, expressions, lop): boolean {
  for (const f of expressions) {
    const res = test(params, f);
    switch (lop) {
      case "$and":
        if (!res) return false;
        break;
      case "$or":
        if (res) return true;
        break;
      case "$nor":
        if (res) return false;
    }
  }

  switch (lop) {
    case "$and":
      return true;
    case "$or":
      return false;
    case "$nor":
      return true;
    default:
      throw new Error("Unknown logical operator");
  }
}
/**
 * @description Test a query
 */
export function test(params, query): boolean {
  let res;
  for (const [k, v] of Object.entries(query)) {
    if (k.charAt(0) === "$") {
      // Logical operator
      res = testExpressions(params, v, k);
    } else {
      const value = params[k];
      if (common.typeOf(v) !== common.OBJECT_TYPE) {
        if (common.typeOf(value) === common.ARRAY_TYPE) {
          // TODO comparing array to regex, array to array, and object to object
          res = value.indexOf(v) !== -1;
        } else {
          if (common.typeOf(v) === common.REGEXP_TYPE)
            res = (v as RegExp).test(value);
          else res = v === value;
        }
      } else {
        for (const [k2, v2] of Object.entries(v)) {
          switch (k2) {
            case "$ne":
              if (common.typeOf(value) === common.ARRAY_TYPE)
                res = value.indexOf(v2) === -1;
              else res = value !== v2;
              break;
            case "$lt":
              res = value < v2;
              break;
            case "$lte":
              res = value <= v2;
              break;
            case "$gt":
              res = value > v2;
              break;
            case "$gte":
              res = value >= v2;
              break;
            case "$regex":
              res = v2.test(value);
              break;
            case "$in":
              throw new Error("Operator not supported");
            case "$nin":
              throw new Error("Operator not supported");
            case "$all":
              throw new Error("Operator not supported");
            case "$exists":
              throw new Error("Operator not supported");
            default:
              throw new Error("Operator not supported");
          }
        }
      }
    }

    if (!res) return false;
  }
  return true;
}
/**
 * @description Sanitize Query Types
 */
export function sanitizeQueryTypes(query, types): {} {
  for (const [k, v] of Object.entries(query)) {
    if (k[0] === "$") {
      // Logical operator
      for (const vv of v as any[]) sanitizeQueryTypes(vv, types);
    } else if (k in types) {
      if (common.typeOf(v) === common.OBJECT_TYPE) {
        for (const [kk, vv] of Object.entries(v)) {
          switch (kk) {
            case "$in":
            case "$nin":
              for (let i = 0; i < vv.length; ++i) vv[i] = types[k](vv[i]);
              break;
            case "$eq":
            case "$gt":
            case "$gte":
            case "$lt":
            case "$lte":
            case "$ne":
              v[kk] = types[k](vv);
              break;
            case "$exists":
            case "$type":
              // Ignore
              break;
            default:
              throw new Error("Operator not supported");
          }
        }
      } else {
        query[k] = types[k](query[k]);
      }
    }
  }

  return query;
}
