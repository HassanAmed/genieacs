/**
#####################################    File Description    #######################################

Smart query is a multi dimensional query means it can execute on multiple resources

####################################################################################################
 */

import config from "./config";
import { Expression } from "../lib/types";
/**
 * @description Resources object
 */
const resources = {
  devices: {},
  faults: {
    Device: { parameter: ["PARAM", "device"], type: "string" },
    Channel: { parameter: ["PARAM", "channel"], type: "string" },
    Code: { parameter: ["PARAM", "code"], type: "string" },
    Retries: { parameter: ["PARAM", "retries"], type: "number" },
    Timestamp: { parameter: ["PARAM", "timestamp"], type: "timestamp" }
  },
  presets: {
    ID: { parameter: ["PARAM", "_id"], type: "string" },
    Channel: { parameter: ["PARAM", "channel"], type: "string" },
    Weight: { parameter: ["PARAM", "weight"], type: "number" }
  },
  provisions: {
    ID: { parameter: ["PARAM", "_id"], type: "string" }
  },
  virtualParameters: {
    ID: { parameter: ["PARAM", "_id"], type: "string" }
  },
  files: {
    ID: { parameter: ["PARAM", "_id"], type: "string" },
    Type: { parameter: ["PARAM", "metadata.fileType"], type: "string" },
    OUI: { parameter: ["PARAM", "metadata.oui"], type: "string" },
    "Product class": {
      parameter: ["PARAM", "metadata.productClass"],
      type: "string"
    },
    Version: { parameter: ["PARAM", "metadata.version"], type: "string" }
  },
  permissions: {
    Role: { parameter: ["PARAM", "role"], type: "string" },
    Resource: { parameter: ["PARAM", "resource"], type: "string" },
    Access: { parameter: ["PARAM", "access"], type: "number" }
  },
  users: { Username: { parameter: ["PARAM", "_id"], type: "string" } }
};

for (const v of Object.values(config.ui.filters as {
  label: string;
  parameter: string;
  type: string;
}[])) {
  resources.devices[v.label] = {
    parameter: v.parameter,
    type: (v.type || "").split(",").map(s => s.trim())
  };
}
/**
 * @description fn to query label
 */
export function getLabels(resource): string[] {
  if (!resources[resource]) return [];
  return Object.keys(resources[resource]);
}
/**
 * @description fn to query number
 */
function queryNumber(param, value): Expression {
  let op = "=";
  for (const o of ["<>", "=", "<=", "<", ">=", ">"]) {
    if (value.startsWith(o)) {
      op = o;
      value = value.slice(o.length).trim();
      break;
    }
  }

  const v = parseInt(value);
  if (v !== +value) return null;

  return [op, param, v];
}
/**
 * @description fn to query timestamp
 */
function queryTimestamp(param, value): Expression {
  let op = "=";
  for (const o of ["<>", "=", "<=", "<", ">=", ">"]) {
    if (value.startsWith(o)) {
      op = o;
      value = value.slice(o.length).trim();
      break;
    }
  }

  let v = parseInt(value);
  if (v !== +value) v = Date.parse(value);
  if (isNaN(v)) return null;
  return [op, param, v];
}
/**
 * @description fn to query string
 */
function queryString(param, value): Expression {
  return ["LIKE", ["FUNC", "LOWER", param], value.toLowerCase()];
}

function queryMac(param, value): Expression {
  value = value.replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (!value) return null;
  if (value.length === 12) {
    return [
      "LIKE",
      ["FUNC", "LOWER", param],
      value.replace(/(..)(?!$)/g, "$1:")
    ];
  }

  return [
    "OR",
    [
      "LIKE",
      ["FUNC", "LOWER", param],
      `%${value.replace(/(..)(?!$)/g, "$1:")}%`
    ],
    ["LIKE", ["FUNC", "LOWER", param], `%${value.replace(/(.)(.)/g, "$1:$2")}%`]
  ];
}

function queryTag(tag: string): Expression {
  const t = tag.replace(/[^a-zA-Z0-9-]+/g, "_");
  return ["IS NOT NULL", ["PARAM", `Tags.${t}`]];
}
/**
 * @description Tip for smart Query
 * @param resource Resource
 * @param label label
 */
export function getTip(resource, label): string {
  let tip;
  if (resources[resource] && resources[resource][label]) {
    const param = resources[resource][label];
    const types =
      resource === "devices" ? param["type"] : param["type"].split(",");

    const tips = [];
    for (const type of types) {
      switch (type.trim()) {
        case "string":
          tips.push("case insensitive string pattern");
          break;
        case "number":
          tips.push("numeric value");
          break;
        case "timestamp":
          tips.push(
            "Unix timestamp or string in the form YYYY-MM-DDTHH:mm:ss.sssZ"
          );
          break;
        case "mac":
          tips.push("partial case insensitive MAC address");
          break;
        case "tag":
          tips.push("case sensitive string");
          break;
      }
    }

    if (tips.length) tip = `${label}: ${tips.join(", ")}`;
  }
  return tip;
}
/**
 * @description fn to get/unpack query response
 * @param resource resource
 * @param label label
 * @param value value
 */
export function unpack(resource, label, value): Expression {
  if (!resources[resource]) return null;
  const type = resources[resource][label].type;
  value = value.trim();
  const res: Expression = ["OR"];

  if (type.length === 0 || type.includes("number")) {
    const q = queryNumber(resources[resource][label].parameter, value);
    if (q) res.push(q);
  }

  if (type.length === 0 || type.includes("string")) {
    const q = queryString(resources[resource][label].parameter, value);
    if (q) res.push(q);
  }

  if (type.length === 0 || type.includes("timestamp")) {
    const q = queryTimestamp(resources[resource][label].parameter, value);
    if (q) res.push(q);
  }

  if (type.includes("mac")) {
    const q = queryMac(resources[resource][label].parameter, value);
    if (q) res.push(q);
  }

  if (type.includes("tag")) {
    const q = queryTag(value);
    if (q) res.push(q);
  }

  if (res.length <= 1) return null;
  else if (res.length === 2) return res[1];
  else return res;
}
