export const UNDEFINED_TYPE = "[object Undefined]";
export const NULL_TYPE = "[object Null]";
export const BOOLEAN_TYPE = "[object Boolean]";
export const NUMBER_TYPE = "[object Number]";
export const STRING_TYPE = "[object String]";
export const ARRAY_TYPE = "[object Array]";
export const OBJECT_TYPE = "[object Object]";
export const REGEXP_TYPE = "[object RegExp]";
export const DATE_TYPE = "[object Date]";
/**
 * @summary Tells type of object based on thier defination in common.ts
 * @param obj Object 
 */
export const typeOf = (obj): string => Object.prototype.toString.call(obj);
/**
 * @summary Generate a unique device ID from deviceID structure
 * @param deviceIdStruct CPE device ID structure/object struct from rpc request
 */
export function generateDeviceId(deviceIdStruct): string {
  // Escapes everything except alphanumerics and underscore
  function esc(str): string {
    return str.replace(/[^A-Za-z0-9_]/g, chr => {
      const buf = Buffer.from(chr, "utf8");
      let rep = "";
      for (const b of buf) rep += "%" + b.toString(16).toUpperCase();
      return rep;
    });
  }

  // Guaranteeing globally unique id as defined in TR-069
  if (deviceIdStruct["ProductClass"]) {
    return (
      esc(deviceIdStruct["OUI"]) +
      "-" +
      esc(deviceIdStruct["ProductClass"]) +
      "-" +
      esc(deviceIdStruct["SerialNumber"])
    );
  }
  return esc(deviceIdStruct["OUI"]) + "-" + esc(deviceIdStruct["SerialNumber"]);
}

/**
 * @summary Function to escape regular expression
 * @source Source: http://stackoverflow.com/a/6969486
 * @param str string 
 */
export function escapeRegExp(str): string {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}
