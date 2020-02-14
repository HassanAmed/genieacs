/**
#####################################    File Description    #######################################

This  file creates debuggin files of all incoming and outgoing request.

####################################################################################################
 */

import {
  IncomingMessage,
  ServerResponse,
  ClientRequest,
  RequestOptions
} from "http";
import { Socket } from "net";
import { appendFileSync } from "fs";
import * as yaml from "yaml";
import * as config from "./config";

const DEBUG_FILE = "" + config.get("DEBUG_FILE");
const DEBUG_FORMAT = "" + config.get("DEBUG_FORMAT");

const connectionTimestamps = new WeakMap<Socket, Date>();
/**
 * @description return time stamp of when connection was made
 * @param connection 
 */
function getConnectionTimestamp(connection: Socket): Date {
  let t = connectionTimestamps.get(connection);
  if (!t) {
    t = new Date();
    connectionTimestamps.set(connection, t);
  }
  return t;
}
/**
 * @summary Debug(create debugging file) incoming http requests
 * @param httpRequest http request  
 * @param deviceId device Id
 * @param body body
 */
export function incomingHttpRequest(
  httpRequest: IncomingMessage,
  deviceId: string,
  body: string
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const con = httpRequest.connection;
  const msg = {
    event: "incoming HTTP request",
    timestamp: now,
    remoteAddress: con.remoteAddress,
    deviceId: deviceId,
    connection: getConnectionTimestamp(con),
    localPort: con.localPort,
    method: httpRequest.method,
    url: httpRequest.url,
    headers: httpRequest.headers,
    body: body
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
/**
 * @description Debug(create debuggin file ) for out going http Response
 * @param httpResponse 
 * @param deviceId 
 * @param body 
 */
export function outgoingHttpResponse(
  httpResponse: ServerResponse,
  deviceId: string,
  body: string
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const con = httpResponse.connection;
  const msg = {
    event: "outgoing HTTP response",
    timestamp: now,
    remoteAddress: con.remoteAddress,
    deviceId: deviceId,
    connection: getConnectionTimestamp(con),
    statusCode: httpResponse.statusCode,
    headers: httpResponse.getHeaders(),
    body: body
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
/**
 * @description Debug(create debuggin file ) for out going http requests
 * @param httpRequest 
 * @param deviceId 
 * @param options 
 * @param body 
 */
export function outgoingHttpRequest(
  httpRequest: ClientRequest,
  deviceId: string,
  options: RequestOptions,
  body: string
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const con = httpRequest.connection;
  const msg = {
    event: "outgoing HTTP request",
    timestamp: now,
    remoteAddress: con.remoteAddress,
    deviceId: deviceId,
    connection: getConnectionTimestamp(con),
    remotePort: options.port,
    method: options.method || "GET",
    url: options.path,
    headers: httpRequest.getHeaders(),
    body: body
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
/**
 * @summary Debuggin(create debugging file) for outgoing http request Errors
 * @param httpRequest 
 * @param deviceId 
 * @param options 
 * @param err 
 */
export function outgoingHttpRequestError(
  httpRequest: ClientRequest,
  deviceId: string,
  options: RequestOptions,
  err: Error
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const msg = {
    event: "outgoing HTTP request",
    timestamp: now,
    remoteAddress: options.hostname,
    deviceId: deviceId,
    connection: null,
    remotePort: options.port,
    method: options.method,
    url: options.path,
    headers: httpRequest.getHeaders(),
    error: err.message
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
/**
 * @description Debug(create debuggin file ) for incoming http requests
 * @param httpRequest 
 * @param deviceId 
 * @param options 
 * @param err 
 */
export function incomingHttpResponse(
  httpResponse: IncomingMessage,
  deviceId: string,
  body: string
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const con = httpResponse.connection;
  const msg = {
    event: "incoming HTTP response",
    timestamp: now,
    remoteAddress: con.remoteAddress,
    deviceId: deviceId,
    connection: getConnectionTimestamp(httpResponse.connection),
    statusCode: httpResponse.statusCode,
    headers: httpResponse.headers,
    body: body
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
/**
 * @description Debug outgoing udp Message
 * @param remoteAddress 
 * @param deviceId 
 * @param remotePort 
 * @param body 
 */
export function outgoingUdpMessage(
  remoteAddress: string,
  deviceId: string,
  remotePort: number,
  body: string
): void {
  if (!DEBUG_FILE) return;
  const now = new Date();
  const msg = {
    event: "outgoing UDP message",
    timestamp: now,
    remoteAddress: remoteAddress,
    deviceId: deviceId,
    remotePort: remotePort,
    body: body
  };

  if (DEBUG_FORMAT === "yaml")
    appendFileSync(DEBUG_FILE, "---\n" + yaml.stringify(msg));
  else if (DEBUG_FORMAT === "json")
    appendFileSync(DEBUG_FILE, JSON.stringify(msg) + "\n");
  else throw new Error(`Unrecognized DEBUG_FORMAT option`);
}
