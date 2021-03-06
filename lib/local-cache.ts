/**
#####################################    File Description    #######################################

This  file implements caching on client side. Keeps snapshots of db which are valid for some time
updata upon expiry and that way implement caching.

####################################################################################################
 */

import * as vm from "vm";
import * as crypto from "crypto";
import * as config from "./config";
import * as db from "./db";
import * as cache from "./cache";
import { mongoQueryToFilter } from "./mongodb-functions";
import * as logger from "./logger";
import * as scheduling from "./scheduling";
import * as expression from "./common/expression";
import { parse } from "./common/expression-parser";
import {
  Preset,
  Expression,
  Provisions,
  VirtualParameters,
  Files,
  Users,
  Permissions,
  Config,
  UiConfig
} from "./types";
/**
 * @description Snapshot interface contains all db collections interfaces
 */
interface Snapshot {
  presets: Preset[];
  provisions: Provisions;
  virtualParameters: VirtualParameters;
  files: Files;
  permissions: Permissions;
  users: Users;
  config: Config;
  ui: UiConfig;
}

const REFRESH = 3000;
const EVICT_TIMEOUT = 60000;

const snapshots = new Map<string, Snapshot>();
let currentSnapshot: string = null;
let nextRefresh = 1;
/**
 * @description MD5 hash for presets, provisions, virtual parameters for detecting changes
 * @param snapshot snapshot interface instance
 */
function computeHash(snapshot): string {

  const h = crypto.createHash("md5");
  for (const p of snapshot.presets) {
    h.update(JSON.stringify(p.name));
    h.update(JSON.stringify(p.channel));
    h.update(JSON.stringify(p.schedule));
    h.update(JSON.stringify(p.events));
    h.update(JSON.stringify(p.precondition));
    h.update(JSON.stringify(p.provisions));
  }

  let keys;

  keys = Object.keys(snapshot.provisions).sort();
  h.update(JSON.stringify(keys));
  for (const k of keys) h.update(snapshot.provisions[k].md5);

  keys = Object.keys(snapshot.virtualParameters).sort();
  h.update(JSON.stringify(keys));
  for (const k of keys) h.update(snapshot.virtualParameters[k].md5);

  keys = Object.keys(snapshot.config).sort();
  h.update(JSON.stringify(keys));
  for (const k of keys) h.update(JSON.stringify(snapshot.config[k]));

  keys = Object.keys(snapshot.files).sort();
  h.update(JSON.stringify(keys));
  for (const k of keys) h.update(JSON.stringify(snapshot.files[k]));

  keys = Object.keys(snapshot.users).sort();
  h.update(JSON.stringify(keys));
  for (const k of keys) h.update(JSON.stringify(snapshot.users[k]));

  const roles = Object.keys(snapshot.permissions).sort();
  h.update(JSON.stringify(roles));
  for (const r of roles) {
    const levels = Object.keys(snapshot.permissions[r]).sort();
    h.update(JSON.stringify(levels));
    for (const l of levels) {
      keys = Object.keys(snapshot.permissions[r][l]).sort();
      h.update(JSON.stringify(keys));
      for (const k of keys)
        h.update(JSON.stringify(snapshot.permissions[r][l][k]));
    }
  }

  return h.digest("hex");
}
/**
 * @description flatten nested objects in one object
 */
function flattenObject(src, prefix = "", dst = {}): {} {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (typeof v === "object" && !Array.isArray(v))
      flattenObject(v, `${prefix}${k}.`, dst);
    else dst[`${prefix}${k}`] = v;
  }
  return dst;
}
/**
 * @description fetch presets from db
 */
async function fetchPresets(): Promise<Preset[]> {
  const res = await db.getPresets();
  let objects = await db.getObjects();

  objects = objects.map(obj => {
    // Flatten object
    obj = flattenObject(obj);

    // If no keys are defined, consider all parameters as keys to keep the
    // same behavior from v1.0
    if (!obj["_keys"] || !obj["_keys"].length)
      obj["_keys"] = Object.keys(obj).filter(k => !k.startsWith("_"));

    return obj;
  });

  res.sort((a, b) => {
    if (a["weight"] === b["weight"])
      return a["_id"] > b["_id"] ? 1 : a["_id"] < b["_id"] ? -1 : 0;
    else return a["weight"] - b["weight"];
  });

  const presets = [] as Preset[];
  for (const preset of res) {
    let schedule: { md5: string; duration: number; schedule: any } = null;
    if (preset["schedule"]) {
      const parts = preset["schedule"].trim().split(/\s+/);
      schedule = {
        md5: crypto
          .createHash("md5")
          .update(preset["schedule"])
          .digest("hex"),
        duration: null,
        schedule: null
      };

      try {
        schedule.duration = +parts.shift() * 1000;
        schedule.schedule = scheduling.parseCron(parts.join(" "));
      } catch (err) {
        logger.warn({
          message: "Invalid preset schedule",
          preset: preset["_id"],
          schedule: preset["schedule"]
        });
        schedule.schedule = false;
      }
    }

    const events = preset["events"] || {};
    let precondition = true as Expression;
    if (preset["precondition"]) {
      try {
        precondition = parse(preset["precondition"]);
      } catch (error) {
        precondition = mongoQueryToFilter(JSON.parse(preset["precondition"]));
      }

      // Simplify expression
      precondition = expression.evaluate(precondition);
    }

    const _provisions = preset["provisions"] || [];

    // Generate provisions from the old configuration format
    for (const c of preset["configurations"]) {
      switch (c.type) {
        case "age":
          _provisions.push(["refresh", c.name, c.age]);
          break;

        case "value":
          _provisions.push(["value", c.name, c.value]);
          break;

        case "add_tag":
          _provisions.push(["tag", c.tag, true]);
          break;

        case "delete_tag":
          _provisions.push(["tag", c.tag, false]);
          break;

        case "provision":
          _provisions.push([c.name].concat(c.args || []));
          break;

        case "add_object":
          for (const obj of objects) {
            if (obj["_id"] === c.object) {
              const alias = obj["_keys"]
                .map(k => `${k}:${JSON.stringify(obj[k])}`)
                .join(",");
              const p = `${c.name}.[${alias}]`;
              _provisions.push(["instances", p, 1]);

              for (const k in obj) {
                if (!k.startsWith("_") && !(obj["_keys"].indexOf(k) !== -1))
                  _provisions.push(["value", `${p}.${k}`, obj[k]]);
              }
            }
          }

          break;

        case "delete_object":
          for (const obj of objects) {
            if (obj["_id"] === c.object) {
              const alias = obj["_keys"]
                .map(k => `${k}:${JSON.stringify(obj[k])}`)
                .join(",");
              const p = `${c.name}.[${alias}]`;
              _provisions.push(["instances", p, 0]);
            }
          }

          break;

        default:
          throw new Error(`Unknown configuration type ${c.type}`);
      }
    }

    presets.push({
      name: preset["_id"],
      channel: (preset["channel"] as string) || "default",
      schedule: schedule,
      events: events,
      precondition: precondition,
      provisions: _provisions
    });
  }

  return presets;
}
/**
 * @description fetch provisions from db
 */
async function fetchProvisions(): Promise<Provisions> {
  const res = await db.getProvisions();

  const provisions = {};
  for (const r of res) {
    provisions[r["_id"]] = {};
    provisions[r["_id"]].md5 = crypto
      .createHash("md5")
      .update(r["script"])
      .digest("hex");
    provisions[r["_id"]].script = new vm.Script(
      `"use strict";(function(){\n${r["script"]}\n})();`,
      { filename: r["_id"], lineOffset: -1, timeout: 50 }
    );
  }

  return provisions;
}
/**
 * @description Fetch virtual parameters from db
 */
async function fetchVirtualParameters(): Promise<VirtualParameters> {
  const res = await db.getVirtualParameters();

  const virtualParameters = {};
  for (const r of res) {
    virtualParameters[r["_id"]] = {};
    virtualParameters[r["_id"]].md5 = crypto
      .createHash("md5")
      .update(r["script"])
      .digest("hex");
    virtualParameters[r["_id"]].script = new vm.Script(
      `"use strict";(function(){\n${r["script"]}\n})();`,
      { filename: r["_id"], lineOffset: -1, timeout: 50 }
    );
  }

  return virtualParameters;
}
/**
 * @description Fetch permissions from db
 */
async function fetchPermissions(): Promise<Permissions> {
  const perms = await db.getPermissions();
  const permissions: Permissions = {};

  for (const p of perms) {
    if (!permissions[p.role]) permissions[p.role] = {};
    if (!permissions[p.role][p.access]) permissions[p.role][p.access] = {};

    permissions[p.role][p.access][p.resource] = {
      access: p.access,
      filter: parse(p.filter || "true")
    };
    if (p.validate)
      permissions[p.role][p.access][p.resource].validate = parse(p.validate);
  }

  return permissions;
}
/**
 * @description Fetch files from db
 */
async function fetchFiles(): Promise<Files> {
  const res = await db.getFiles();
  const files = {};

  for (const r of res) {
    const id = r["filename"] || r["_id"].toString();
    files[id] = {};
    files[id].length = r["length"];
    files[id].md5 = r["md5"];
    files[id].contentType = r["contentType"];
  }

  return files;
}
/**
 * @description fetch users from db
 */
async function fetchUsers(): Promise<Users> {
  const _users = await db.getUsers();
  const users = {};

  for (const user of _users) {
    users[user._id] = {
      password: user.password,
      salt: user.salt,
      roles: user.roles.split(",").map(s => s.trim())
    };
  }

  return users;
}
/**
 * @description fetch Config from db
 */
async function fetchConfig(): Promise<[Config, UiConfig]> {
  const conf = await db.getConfig();

  conf.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));

  const ui = {
    filters: {},
    device: {},
    index: {},
    overview: {}
  };
  const _config = {};

  for (const c of conf) {
    // Evaluate expressions to simplify them
    const val = expression.evaluate(c.value);
    _config[c.id] = val;
    if (c.id.startsWith("ui.")) {
      const keys = c.id.split(".");
      // remove the first key(ui)
      keys.shift();
      let ref = ui;
      while (keys.length > 1) {
        const k = keys.shift();
        if (typeof ref[k] !== "object") ref[k] = {};
        ref = ref[k];
      }
      ref[keys[0]] = val;
    }
  }

  return [_config, ui];
}
/**
 * @description refresh db and snapshot(to be used when we edit/add or update anything in db)
 */
async function refresh(): Promise<void> {
  if (!nextRefresh) {
    await new Promise(resolve => setTimeout(resolve, 20));
    await refresh();
    return;
  }

  nextRefresh = 0;
  const now = Date.now();

  const dbHash = await cache.get("presets_hash");

  if (currentSnapshot && dbHash === currentSnapshot) {
    nextRefresh = now + (REFRESH - (now % REFRESH));
    return;
  }

  const unlockOrExtend = await cache.lock("presets_hash_lock", 3);

  const res = await Promise.all([
    fetchPresets(),
    fetchProvisions(),
    fetchVirtualParameters(),
    fetchFiles(),
    fetchPermissions(),
    fetchUsers(),
    fetchConfig()
  ]);

  const snapshot = {
    presets: res[0],
    provisions: res[1],
    virtualParameters: res[2],
    files: res[3],
    permissions: res[4],
    users: res[5],
    config: res[6][0],
    ui: res[6][1]
  };

  if (currentSnapshot) {
    const h = currentSnapshot;
    const s = snapshots.get(h);
    setTimeout(() => {
      if (snapshots.get(h) === s) snapshots.delete(h);
    }, EVICT_TIMEOUT).unref();
  }

  currentSnapshot = computeHash(snapshot);
  snapshots.set(currentSnapshot, snapshot);
  await cache.set("presets_hash", currentSnapshot, 300);
  await unlockOrExtend(0);

  nextRefresh = now + (REFRESH - (now % REFRESH));
}
/**a
 * @description Get current Snapshot from cache
 */
export async function getCurrentSnapshot(): Promise<string> {
  if (Date.now() > nextRefresh) await refresh();
  return currentSnapshot;
}
/**
 * @description Check if Snapshot exists in cache
 */
export function hasSnapshot(hash): boolean {
  return snapshots.has(hash);
}
/**
 * Get Presets from snapshot in cahce
 */
export function getPresets(snapshotKey): Preset[] {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");
  return snapshot.presets;
}
/**
 * Get Provisions from snapshot incahce
 */
export function getProvisions(snapshotKey): Provisions {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");
  return snapshot.provisions;
}
/**
 * Get Virtual Params from snapshot in cahce
*/
export function getVirtualParameters(snapshotKey): VirtualParameters {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");
  return snapshot.virtualParameters;
}

/**
 * Get files from snapshot in cahce
 */
export function getFiles(snapshotKey): Files {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");
  return snapshot.files;
}
/**
 * Get Configurations 
 */

export function getConfig(
  snapshotKey: string,
  key: string,
  context: {},
  now: number,
  cb?: (Expression) => Expression
): string | number | boolean | null {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");

  const oldOpts = {
    "cwmp.downloadTimeout": "DOWNLOAD_TIMEOUT",
    "cwmp.debug": "DEBUG",
    "cwmp.retryDelay": "RETRY_DELAY",
    "cwmp.sessionTimeout": "SESSION_TIMEOUT",
    "cwmp.connectionRequestTimeout": "CONNECTION_REQUEST_TIMEOUT",
    "cwmp.gpnNextLevel": "GPN_NEXT_LEVEL",
    "cwmp.gpvBatchSize": "GPV_BATCH_SIZE",
    "cwmp.cookiesPath": "COOKIES_PATH",
    "cwmp.datetimeMilliseconds": "DATETIME_MILLISECONDS",
    "cwmp.booleanLiteral": "BOOLEAN_LITERAL",
    "cwmp.connectionRequestAllowBasicAuth":
      "CONNECTION_REQUEST_ALLOW_BASIC_AUTH",
    "cwmp.maxCommitIterations": "MAX_COMMIT_ITERATIONS",
    "cwmp.deviceOnlineThreshold": "DEVICE_ONLINE_THRESHOLD",
    "cwmp.udpConnectionRequestPort": "UDP_CONNECTION_REQUEST_PORT"
  };

  if (!(key in snapshot.config)) {
    if (key in oldOpts) {
      let id;
      if (context && context["id"]) {
        id = context["id"];
      } else if (cb) {
        id = cb(["PARAM", "DeviceID.ID"]);
        if (Array.isArray(id)) id = null;
      }
      return config.get(oldOpts[key], id);
    }
    return null;
  }

  const v = expression.evaluate(snapshot.config[key], context, now, cb);
  return Array.isArray(v) ? null : v;
}
/**
 * @description Get config Expression from chache
 * @param snapshotKey 
 * @param key 
 */
export function getConfigExpression(snapshotKey, key): Expression {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");

  return snapshot.config[key];
}
/**
 * Get users from snapshot
 */
export function getUsers(snapshotKey): {} {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");

  return snapshot.users;
}
/**
 * Get Permissions from snapshot
 * @param snapshotKey 
 */
export function getPermissions(snapshotKey): Permissions {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");

  return snapshot.permissions;
}
/**
 * Get UI configurations from snapshot
 * @param snapshotKey snapshot
 */
export function getUiConfig(snapshotKey): UiConfig {
  const snapshot = snapshots.get(snapshotKey);
  if (!snapshot) throw new Error("Cache snapshot does not exist");

  return snapshot.ui;
}
