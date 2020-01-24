/**
 * Copyright 2013-2019  GenieACS Inc.
 *
 * This file is part of GenieACS.
 *
 * GenieACS is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * GenieACS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with GenieACS.  If not, see <http://www.gnu.org/licenses/>.
 */

import Path from "./common/path";
import PathSet from "./common/path-set";
import VersionedMap from "./versioned-map";
import InstanceSet from "./instance-set";
import { IncomingMessage, ServerResponse } from "http";
import { Script } from "vm";
/**
 * Custome Type Alias to be used by other files.
 */
export type Expression = string | number | boolean | null | any[];
/**
 * Interface to predefine model.
 */
export interface Fault {
  code: string;
  message: string;
  detail?:
    | FaultStruct
    | {
        name: string;
        message: string;
        stack?: string;
      };
  timestamp?: number;
}
/**
 * Interface to predefine model.
 */
export interface SessionFault extends Fault {
  timestamp: number;
  provisions: string[][];
  retryNow?: boolean;
  precondition?: boolean;
  retries?: number;
  expiry?: number;
}
/**
 * Interface to predefine model.
 */
export interface Attributes {
  object?: [number, 1 | 0];
  writable?: [number, 1 | 0];
  value?: [number, [string | number | boolean, string]];
}
/**
 * Interface to predefine model.
 */
export interface AttributeTimestamps {
  object?: number;
  writable?: number;
  value?: number;
}
/**
 * Interface to predefine model.
 */
export interface AttributeValues {
  object?: boolean;
  writable?: boolean;
  value?: [string | number | boolean, string?];
}
/**
 * Interface to predefine model.
 */
export interface DeviceData {
  paths: PathSet;
  timestamps: VersionedMap<Path, number>;
  attributes: VersionedMap<Path, Attributes>;
  trackers: Map<Path, { [name: string]: number }>;
  changes: Set<string>;
}
/**
 * Interface to predefine model.
 */
export type VirtualParameterDeclaration = [
  Path,
  { path?: number; object?: number; writable?: number; value?: number }?,
  {
    path?: [number, number];
    object?: boolean;
    writable?: boolean;
    value?: [string | number | boolean, string?];
  }?
];
/**
 * Interface to predefine model.
 */
export interface SyncState {
  refreshAttributes: {
    exist: Set<Path>;
    object: Set<Path>;
    writable: Set<Path>;
    value: Set<Path>;
  };
  spv: Map<Path, [string | number | boolean, string]>;
  gpn: Set<Path>;
  gpnPatterns: Map<Path, number>;
  tags: Map<Path, boolean>;
  virtualParameterDeclarations: VirtualParameterDeclaration[][];
  instancesToDelete: Map<Path, Set<Path>>;
  instancesToCreate: Map<Path, InstanceSet>;
  downloadsToDelete: Set<Path>;
  downloadsToCreate: InstanceSet;
  downloadsValues: Map<Path, string | number>;
  downloadsDownload: Map<Path, number>;
  reboot: number;
  factoryReset: number;
}
/**
 * Interface to predefine model.
 */
export interface SessionContext {
  sessionId?: string;
  timestamp: number;
  deviceId: string;
  deviceData: DeviceData;
  cwmpVersion: string;
  timeout: number;
  provisions: any[];
  channels: { [channel: string]: number };
  virtualParameters: [
    string,
    AttributeTimestamps,
    AttributeValues,
    AttributeTimestamps,
    AttributeValues
  ][][];
  revisions: number[];
  rpcCount: number;
  iteration: number;
  cycle: number;
  extensionsCache: any;
  declarations: Declaration[][];
  faults?: { [channel: string]: SessionFault };
  retries?: { [channel: string]: number };
  cacheSnapshot?: string;
  httpResponse?: ServerResponse;
  httpRequest?: IncomingMessage;
  faultsTouched?: { [channel: string]: boolean };
  presetCycles?: number;
  new?: boolean;
  debug?: boolean;
  state: number;
  authState: number;
  tasks?: Task[];
  operations?: { [commandKey: string]: Operation };
  cacheUntil?: number;
  syncState?: SyncState;
  lastActivity?: number;
  rpcRequest?: AcsRequest;
  operationsTouched?: { [commandKey: string]: 1 | 0 };
  provisionsRet?: any[];
  doneTasks?: string[];
}
/**
 * Interface to predefine model.
 */
export interface Task {
  _id: string;
  name: string;
  parameterNames?: string[];
  parameterValues?: [string, string | number | boolean, string?][];
  objectName?: string;
  fileType?: string;
  fileName?: string;
  targetFileName?: string;
  expiry?: number;
}
/**
 * Interface to predefine model.
 */
export interface Operation {
  name: string;
  timestamp: number;
  provisions: string[][];
  channels: { [channel: string]: number };
  retries: { [channel: string]: number };
  args: {
    instance: string;
    fileType: string;
    fileName: string;
    targetFileName: string;
  };
}
/**
 * Interface to predefine model.
 */
export interface AcsRequest {
  name: string;
  next?: string;
}
/**
 * Interface to predefine model.
 */
export interface GetAcsRequest extends AcsRequest {
  name: "GetParameterNames" | "GetParameterValues";
  objectName?: string;
  parameterNames?: string[];
  parameterPath?: string;
  nextLevel?: boolean;
  instanceValues?: { [name: string]: string };
}
/**
 * Interface to predefine model.
 */
export interface SetAcsRequest extends AcsRequest {
  name:
    | "SetParameterValues"
    | "AddObject"
    | "DeleteObject"
    | "FactoryReset"
    | "Reboot"
    | "Download";
  parameterList?: [string, string | number | boolean, string][];
  instanceValues?: { [param: string]: string | number | boolean };
  objectName?: string;
  DATETIME_MILLISECONDS?: boolean;
  BOOLEAN_LITERAL?: boolean;
  commandKey?: string;
  instance?: string;
  fileType?: string;
  fileSize?: number;
  url?: string;
  fileName?: string;
  targetFileName?: string;
}
/**
 * Interface to predefine model.
 */
export interface CpeResponse {
  name: string;
}
/**
 * Interface to predefine model.
 */
export interface SpvFault {
  parameterName: string;
  faultCode: string;
  faultString: string;
}
/**
 * Interface to predefine model.
 */
export interface FaultStruct {
  faultCode: string;
  faultString: string;
  setParameterValuesFault?: SpvFault[];
}
/**
 * Interface to predefine model.
 */
export interface CpeFault {
  faultCode: string;
  faultString: string;
  detail?: FaultStruct;
}
/**
 * Interface to predefine model.
 */
export interface CpeGetResponse extends CpeResponse {
  name: "GetParameterNamesResponse" | "GetParameterValuesResponse";
  parameterList?:
    | [string, boolean][]
    | [string, string | number | boolean, string][];
}
/**
 * Interface to predefine model.
 */
export interface CpeSetResponse extends CpeResponse {
  name:
    | "SetParameterValuesResponse"
    | "AddObjectResponse"
    | "DeleteObjectResponse"
    | "RebootResponse"
    | "FactoryResetResponse"
    | "DownloadResponse";
  status?: number;
  instanceNumber?: string;
  startTime?: number;
  completeTime?: number;
}
/**
 * Interface to predefine model.
 */
export interface CpeRequest {
  name: string;
  fileType?: string;
}
/**
 * Interface to predefine model.
 */
export interface InformRequest extends CpeRequest {
  name: "Inform";
  deviceId: {
    Manufacturer: string;
    OUI: string;
    ProductClass?: string;
    SerialNumber: string;
  };
  event: string[];
  retryCount: number;
  parameterList: [string, string | number | boolean, string][];
}
/**
 * Interface to predefine model.
 */
export interface TransferCompleteRequest extends CpeRequest {
  name: "TransferComplete";
  commandKey?: string;
  faultStruct?: FaultStruct;
  startTime?: number;
  completeTime?: number;
}
/**
 * Interface to predefine model.
 */
export interface AcsResponse {
  name: string;
  commandKey?: string;
  faultStruct?: FaultStruct;
}
/**
 * Interface to predefine model.
 */
export interface QueryOptions {
  projection?: any;
  skip?: number;
  limit?: number;
  sort?: {
    [param: string]: number;
  };
}
/**
 * Interface to predefine model.
 */
export interface Declaration {
  path: Path;
  pathGet: number;
  pathSet?: [number, number];
  attrGet?: { object?: number; writable?: number; value?: number };
  attrSet?: {
    object?: boolean;
    writable?: boolean;
    value?: [string | number | boolean, string?];
  };
  defer: boolean;
}
/**
 * Interface to predefine model.
 */
export type Clear = [
  Path,
  number,
  { object?: number; writable?: number; value?: number }?,
  number?
];
/**
 * Interface to predefine model.
 */
export interface Preset {
  name: string;
  channel: string;
  schedule?: { md5: string; duration: number; schedule: any };
  events?: { [event: string]: boolean };
  precondition?: {};
  provisions: string[][];
}
/**
 * Interface to predefine model.
 */
export interface Provisions {
  [name: string]: { md5: string; script: Script };
}
/**
 * Interface to predefine model.
 */
export interface VirtualParameters {
  [name: string]: { md5: string; script: Script };
}
/**
 * Interface to predefine model.
 */
export interface Files {
  [name: string]: { length: number; md5: string; contentType: string };
}
/**
 * Interface to predefine model.
 */
export interface Users {
  [name: string]: { password: string; salt: string; roles: string[] };
}
/**
 * Interface to predefine model.
 */
export interface Permissions {
  [role: string]: {
    [access: number]: {
      [resource: string]: {
        access: number;
        filter: Expression;
        validate?: Expression;
      };
    };
  };
}
/**
 * Interface to predefine model.
 */
export type PermissionSet = {
  [resource: string]: {
    access: number;
    validate?: Expression;
    filter: Expression;
  };
}[];
/**
 * Interface to predefine model.
 */
export interface Config {
  [name: string]: Expression;
}
/**
 * Interface to predefine model.
 */
export interface UiConfig {
  filters: {};
  device: {};
  index: {};
  overview: {
    charts?: {};
    groups?: {};
  };
  pageSize?: Expression;
}
/**
 * Interface to predefine model.
 */
export interface SoapMessage {
  id: string;
  cwmpVersion: string;
  sessionTimeout: number;
  cpeRequest?: CpeRequest;
  cpeFault?: CpeFault;
  cpeResponse?: CpeResponse;
}
/**
 * Interface to predefine model.
 */
export interface ScriptResult {
  fault: Fault;
  clear: Clear[];
  declare: Declaration[];
  done: boolean;
  returnValue: any;
}
