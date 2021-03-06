/**
#####################################    File Description    #######################################

This  file implements function for default provision to reset reboot refresh etc device.
It simply make declaration which run on the device session.

####################################################################################################
 */

import Path from "./common/path";
import * as config from "./config";
import * as device from "./device";
import * as scheduling from "./scheduling";

const MAX_DEPTH = +config.get("MAX_DEPTH");
/**
 * @description Refresh and push new declarations
 * @param sessionContext session instance
 * @param provision provisons
 * @param declarations declarations
 */
export function refresh(sessionContext, provision, declarations): boolean {
  if (
    (provision.length !== 2 || typeof provision[1] !== "string") &&
    (provision.length !== 3 ||
      typeof provision[1] !== "string" ||
      typeof provision[2] !== "number")
  )
    throw new Error("Invalid arguments");

  const segments = Path.parse(provision[1]).segments.slice();
  const l = segments.length;
  segments.length = MAX_DEPTH;
  segments.fill("*", l);
  const path = Path.parse(segments.join("."));
  const every = 1000 * (provision[2] || 1);
  const offset = scheduling.variance(sessionContext.deviceId, every);
  const t = scheduling.interval(sessionContext.timestamp, every, offset);

  for (let i = l; i < path.length; ++i) {
    declarations.push({
      path: path.slice(0, i),
      pathGet: t,
      pathSet: null,
      attrGet: { object: 1, writable: 1, value: t },
      attrSet: null,
      defer: true
    });
  }

  return true;
}
/**
 * @description Fn to set value of a provision
 * @param sessionContext 
 * @param provision 
 * @param declarations 
 */
export function value(sessionContext, provision, declarations): boolean {
  if (provision.length !== 3 || typeof provision[1] !== "string")
    throw new Error("Invalid arguments");

  declarations.push({
    path: Path.parse(provision[1]),
    pathGet: 1,
    pathSet: null,
    attrGet: { value: 1 },
    attrSet: { value: [provision[2]] },
    defer: true
  });

  return true;
}
/**
 * @description function for tagging provision
 */
export function tag(sessionContext, provision, declarations): boolean {
  if (
    provision.length !== 3 ||
    typeof provision[1] !== "string" ||
    typeof provision[2] !== "boolean"
  )
    throw new Error("Invalid arguments");

  declarations.push({
    path: Path.parse(`Tags.${provision[1]}`),
    pathGet: 1,
    pathSet: null,
    attrGet: { value: 1 },
    attrSet: { value: [provision[2]] },
    defer: true
  });

  return true;
}
/**
 * @description reboot device provision
 * @param sessionContext 
 * @param provision 
 * @param declarations 
 */
export function reboot(sessionContext, provision, declarations): boolean {
  if (provision.length !== 1) throw new Error("Invalid arguments");

  declarations.push({
    path: Path.parse("Reboot"),
    pathGet: 1,
    pathSet: null,
    attrGet: { value: 1 },
    attrSet: { value: [sessionContext.timestamp] },
    defer: true
  });

  return true;
}
/**
 * @description reset provision (to factory reset device settings)
 * @param sessionContext 
 * @param provision 
 * @param declarations 
 */
export function reset(sessionContext, provision, declarations): boolean {
  if (provision.length !== 1) throw new Error("Invalid arguments");

  declarations.push({
    path: Path.parse("FactoryReset"),
    pathGet: 1,
    pathSet: null,
    attrGet: { value: 1 },
    attrSet: { value: [sessionContext.timestamp] },
    defer: true
  });

  return true;
}
/**
 * @summary download provisions
 */
export function download(sessionContext, provision, declarations): boolean {
  if (
    (provision.length !== 3 ||
      typeof provision[1] !== "string" ||
      typeof provision[2] !== "string") &&
    (provision.length !== 4 ||
      typeof provision[1] !== "string" ||
      typeof provision[2] !== "string" ||
      typeof provision[3] !== "string")
  )
    throw new Error("Invalid arguments");

  const alias = [
    `FileType:${JSON.stringify(provision[1] || "")}`,
    `FileName:${JSON.stringify(provision[2] || "")}`,
    `TargetFileName:${JSON.stringify(provision[3] || "")}`
  ].join(",");

  declarations.push({
    path: Path.parse(`Downloads.[${alias}]`),
    pathGet: 1,
    pathSet: 1,
    attrGet: null,
    attrSet: null,
    defer: true
  });

  declarations.push({
    path: Path.parse(`Downloads.[${alias}].Download`),
    pathGet: 1,
    pathSet: null,
    attrGet: { value: 1 },
    attrSet: { value: [sessionContext.timestamp] },
    defer: true
  });

  return true;
}
/**
 * @summary push an instance in declarations
 */
export function instances(
  sessionContext,
  provision,
  declarations,
  startRevision,
  endRevision
): boolean {
  if (provision.length !== 3 || typeof provision[1] !== "string")
    throw new Error("Invalid arguments");

  let count = Number(provision[2]);

  if (Number.isNaN(count)) throw new Error("Invalid arguments");

  const path = Path.parse(provision[1]);

  if (provision[2][0] === "+" || provision[2][0] === "-") {
    declarations.push({
      path: path,
      pathGet: 1,
      pathSet: null,
      attrGet: null,
      attrSet: null,
      defer: true
    });

    if (endRevision === startRevision) return false;

    const unpacked = device.unpack(
      sessionContext.deviceData,
      path,
      startRevision + 1
    );
    count = Math.max(0, unpacked.length + count);
  }

  declarations.push({
    path: path,
    pathGet: 1,
    pathSet: count,
    attrGet: null,
    attrSet: null,
    defer: true
  });

  return true;
}
