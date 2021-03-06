/**
#####################################    File Description    #######################################

This  file used for creating sandboxes which are used by session in order to keep sessions for
seprated all devices seprated.

####################################################################################################
 */

import * as vm from "vm";
import seedrandom from "seedrandom";
import * as device from "./device";
import * as extensions from "./extensions";
import * as logger from "./logger";
import * as scheduling from "./scheduling";
import Path from "./common/path";
import { Fault, SessionContext, ScriptResult } from "./types";

// Used for throwing to exit user script and commit
const COMMIT = Symbol();

// Used to execute extensions and restart
const EXT = Symbol();

const UNDEFINED = undefined;
/**
 * @description Context for a sandbox object
 */
const context = vm.createContext();

let state;

const runningExtensions = new WeakMap<
  SessionContext,
  Map<string, Promise<Fault>>
>();
/**
 * @description function to run extension service on new child process and get faults (if any)
 * @param sessionContext 
 * @param key 
 * @param extCall 
 */
function runExtension(sessionContext, key, extCall): Promise<Fault> {
  let re = runningExtensions.get(sessionContext);
  if (!re) {
    re = new Map<string, Promise<Fault>>();
    runningExtensions.set(sessionContext, re);
  }

  let prom = re.get(key);
  if (!prom) {
    re.set(
      key,
      (prom = new Promise((resolve, reject) => {
        extensions
          .run(extCall)
          .then(({ fault, value }) => {
            re.delete(key);
            if (!fault) sessionContext.extensionsCache[key] = value;
            resolve(fault);
          })
          .catch(reject);
      }))
    );
  }

  return prom;
}
/**
 * A class for sandbox dates 
 * Methods ParseDate and Date.UTC to get universal date.
 */
class SandboxDate {
  public constructor(
    ...argumentList: [
      number?,
      number?,
      number?,
      number?,
      number?,
      number?,
      number?
    ]
  ) {
    if (argumentList.length) return new Date(...argumentList);

    return new Date(state.sessionContext.timestamp);
  }

  public static now(intervalOrCron, variance): number {
    let t = state.sessionContext.timestamp;

    if (typeof intervalOrCron === "number") {
      if (variance == null) variance = intervalOrCron;

      let offset = 0;
      if (variance)
        offset = scheduling.variance(state.sessionContext.deviceId, variance);

      t = scheduling.interval(t, intervalOrCron, offset);
    } else if (typeof intervalOrCron === "string") {
      let offset = 0;
      if (variance)
        offset = scheduling.variance(state.sessionContext.deviceId, variance);
      const cron = scheduling.parseCron(intervalOrCron);
      t = scheduling.cron(t, cron, offset)[0];
    } else if (intervalOrCron) {
      throw new Error("Invalid Date.now() argument");
    }

    return t;
  }

  public static parse(dateString: string): number {
    return Date.parse(dateString);
  }

  public static UTC(
    ...args: [number, number?, number?, number?, number?, number?, number?]
  ): number {
    return Date.UTC(...args);
  }
}
// self explanotry
function random(): number {
  if (!state.rng) state.rng = seedrandom(state.sessionContext.deviceId);

  return state.rng();
}

random.seed = function(s) {
  state.rng = seedrandom(s);
};
/**
 * @description Wrapper class for params to define thier names
 */
class ParameterWrapper {
  public constructor(path: Path, attributes, unpacked?, unpackedRevision?) {
    for (const attrName of attributes) {
      Object.defineProperty(this, attrName, {
        get: function() {
          if (state.uncommitted) commit();

          if (state.revision !== unpackedRevision) {
            unpackedRevision = state.revision;
            unpacked = device.unpack(
              state.sessionContext.deviceData,
              path,
              state.revision
            );
          }

          if (!unpacked.length) return UNDEFINED;

          const attr = state.sessionContext.deviceData.attributes.get(
            unpacked[0],
            state.revision
          )[attrName];

          if (!attr) return UNDEFINED;

          return attr[1];
        }
      });
    }

    Object.defineProperty(this, "path", {
      get: function() {
        if (state.uncommitted) commit();

        if (state.revision !== unpackedRevision) {
          unpackedRevision = state.revision;
          unpacked = device.unpack(
            state.sessionContext.deviceData,
            path,
            state.revision
          );
        }

        if (!unpacked.length) return UNDEFINED;

        return unpacked[0].toString();
      }
    });

    Object.defineProperty(this, "size", {
      get: function() {
        if (state.uncommitted) commit();

        if (state.revision !== unpackedRevision) {
          unpackedRevision = state.revision;
          unpacked = device.unpack(
            state.sessionContext.deviceData,
            path,
            state.revision
          );
        }

        if (!unpacked.length) return UNDEFINED;

        return unpacked.length;
      }
    });

    this[Symbol.iterator] = function*() {
      if (state.uncommitted) commit();

      if (state.revision !== unpackedRevision) {
        unpackedRevision = state.revision;
        unpacked = device.unpack(
          state.sessionContext.deviceData,
          path,
          state.revision
        );
      }

      for (const p of unpacked)
        yield new ParameterWrapper(p, attributes, [p], state.revision);
    };
  }
}
/**
 * @description Method of context object initialized at start (Implementation of method is here
 * property added below)
 * @param path 
 * @param timestamps 
 * @param values 
 */
function declare(
  path: string,
  timestamps: { [attr: string]: number },
  values: { [attr: string]: any }
): ParameterWrapper {
  state.uncommitted = true;
  if (!timestamps) timestamps = {};

  if (!values) values = {};

  const parsedPath = Path.parse(path);

  const declaration = {
    path: parsedPath,
    pathGet: 1,
    pathSet: null,
    attrGet: null,
    attrSet: null,
    defer: true
  };

  const attrs = new Set();

  for (const [attrName, attrValue] of Object.entries(values)) {
    if (attrName === "path") {
      declaration.pathSet = attrValue;
    } else {
      attrs.add(attrName);
      if (!declaration.attrGet) declaration.attrGet = {};
      if (!declaration.attrSet) declaration.attrSet = {};
      declaration.attrGet[attrName] = 1;
      if (attrName === "value" && !Array.isArray(values.value))
        declaration.attrSet.value = [values.value];
      else declaration.attrSet[attrName] = values[attrName];
    }
  }

  for (const [attrName, attrTimestamp] of Object.entries(timestamps)) {
    if (attrName === "path") {
      declaration.pathGet = attrTimestamp;
    } else {
      attrs.add(attrName);
      if (!declaration.attrGet) declaration.attrGet = {};
      declaration.attrGet[attrName] = attrTimestamp;
    }
  }

  state.declarations.push(declaration);

  return new ParameterWrapper(parsedPath, attrs);
}
/**
 * @description Method of context object initialized at start (Implementation of method is here
 * property added below)
 * @param path 
 * @param timestamp 
 * @param attributes 
 */
function clear(path: string, timestamp: number, attributes?): void {
  state.uncommitted = true;

  if (state.revision === state.maxRevision)
    state.clear.push([Path.parse(path), timestamp, attributes]);
}
/**
 * @description Method of context object initialized at start (Implementation of method is here
 * property added below)
 */
function commit(): void {
  ++state.revision;
  state.uncommitted = false;

  if (state.revision === state.maxRevision + 1) {
    for (const d of state.declarations) d.defer = false;
    throw COMMIT;
  } else if (state.revision > state.maxRevision + 1) {
    throw new Error(
      "Declare function should not be called from within a try/catch block"
    );
  }
}
/**
 * @description Method of context object initialized at start (Implementation of method is here
 * property added below)
 */
function ext(): any {
  ++state.extCounter;
  const extCall = Array.from(arguments).map(String);
  const key = `${state.revision}: ${JSON.stringify(extCall)}`;

  if (key in state.sessionContext.extensionsCache)
    return state.sessionContext.extensionsCache[key];

  state.extensions[key] = extCall;
  throw EXT;
}
/**
 * @description Method of context object initialized at start (Implementation of method is here
 * property added below)
 * @param msg 
 * @param meta 
 */
function log(msg: string, meta: {}): void {
  if (state.revision === state.maxRevision && state.extCounter >= 0) {
    const details = Object.assign({}, meta, {
      sessionContext: state.sessionContext,
      message: `Script: ${msg}`
    });

    delete details["hostname"];
    delete details["pid"];
    delete details["name"];
    delete details["version"];
    delete details["deviceId"];
    delete details["remoteAddress"];

    logger.accessInfo(details);
  }
}

Object.defineProperty(context, "Date", { value: SandboxDate });
Object.defineProperty(context, "declare", { value: declare });
Object.defineProperty(context, "clear", { value: clear });
Object.defineProperty(context, "commit", { value: commit });
Object.defineProperty(context, "ext", { value: ext });
Object.defineProperty(context, "log", { value: log });

// Monkey-patch Math.random() to make it deterministic
context.random = random;
vm.runInContext("Math.random = random;", context);
delete context.random;
/**
 * @description Convert an error to fault object
 * @param err 
 */
function errorToFault(err: Error): Fault {
  if (!err) return null;

  if (!err.name) return { code: "script", message: `${err}` };

  const fault: Fault = {
    code: `script.${err.name}`,
    message: err.message,
    detail: {
      name: err.name,
      message: err.message
    }
  };

  if (err.stack) {
    fault.detail["stack"] = err.stack;
    // Trim the stack trace at the self-executing anonymous wrapper function
    const stackTrimIndex = fault.detail["stack"].match(
      /\s+at\s[^\s]+\s+at\s[^\s]+\s\(vm\.js.+\)/
    );
    if (stackTrimIndex) {
      fault.detail["stack"] = fault.detail["stack"].slice(
        0,
        stackTrimIndex.index
      );
    }
  }

  return fault;
}
/**
 * @description Run a sandbox environment
 * @param script 
 * @param globals 
 * @param sessionContext 
 * @param startRevision 
 * @param maxRevision 
 * @param extCounter 
 */
export async function run(
  script: vm.Script,
  globals: {},
  sessionContext: SessionContext,
  startRevision: number,
  maxRevision: number,
  extCounter = 0
): Promise<ScriptResult> {
  state = {
    sessionContext: sessionContext,
    revision: startRevision,
    maxRevision: maxRevision,
    uncommitted: false,
    declarations: [],
    extensions: {},
    clear: [],
    rng: null,
    extCounter: extCounter
  };

  for (const n of Object.keys(context)) delete context[n];

  Object.assign(context, globals);

  let ret, status;

  try {
    ret = script.runInContext(context, { displayErrors: false });
    status = 0;
  } catch (err) {
    if (err === COMMIT) {
      status = 1;
    } else if (err === EXT) {
      status = 2;
    } else {
      return {
        fault: errorToFault(err),
        clear: null,
        declare: null,
        done: false,
        returnValue: null
      };
    }
  }

  const _state = state;
  let fault;

  await Promise.all(
    Object.entries(_state.extensions).map(async ([k, v]) => {
      fault = (await runExtension(_state.sessionContext, k, v)) || fault;
    })
  );

  if (fault) {
    return {
      fault: fault,
      clear: null,
      declare: null,
      done: false,
      returnValue: null
    };
  }

  if (status === 2) {
    return run(
      script,
      globals,
      sessionContext,
      startRevision,
      maxRevision,
      extCounter - _state.extCounter
    );
  }

  return {
    fault: null,
    clear: _state.clear,
    declare: _state.declarations,
    done: status === 0,
    returnValue: ret
  };
}
