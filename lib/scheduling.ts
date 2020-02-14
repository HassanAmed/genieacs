/**
#####################################    File Description    #######################################

Scheduler and some other functions

####################################################################################################
 */

import * as crypto from "crypto";
import * as later from "later";

function md532(str): number {
  const digest = crypto
    .createHash("md5")
    .update(str)
    .digest();
  return (
    digest.readUInt32LE(0) ^
    digest.readUInt32LE(4) ^
    digest.readUInt32LE(8) ^
    digest.readUInt32LE(12)
  );
}
// function to see offset
export function variance(deviceId, vrnc): number {
  return (md532(deviceId) >>> 0) % vrnc;
}
/**
 * @description Returns Session Interval 
 */
export function interval(timestamp, intrvl, offset = 0): number {
  return Math.trunc((timestamp + offset) / intrvl) * intrvl - offset;
}

export function parseCron(cronExp): any {
  const parts = cronExp.trim().split(/\s+/);
  if (parts.length === 5) parts.unshift("*");

  return later.schedule(later.parse.cron(parts.join(" "), true));
}
/**
 * @description Scheduler
 */
export function cron(timestamp, schedule, offset = 0): number[] {
  // TODO later.js doesn't throw erorr if expression is invalid!
  const ret = [0, 0];

  const prev = schedule.prev(1, new Date(timestamp + offset));
  if (prev) ret[0] = prev.setMilliseconds(0) - offset;

  const next = schedule.next(1, new Date(timestamp + offset + 1000));
  if (next) ret[1] = next.setMilliseconds(0) - offset;

  return ret;
}
