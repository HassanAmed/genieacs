/**
#####################################    File Description    #######################################

This file is used to start and stop http server. The functions are used by bin folder server to start
the services.

####################################################################################################
 */

import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { ROOT_DIR } from "./config";
/**
 *  An Http/Https server
 */
let server: http.Server | https.Server;
/**
 *  An Http/Https listener.
 */
let listener: (...args) => void;
/**
 * @summary Closes server connection
 * @param timeout time to close connection
 * @param callback returns callback when connection successfuly closed
 */
function closeServer(timeout, callback): void {
  if (!server) return void callback();

  setTimeout(() => {
    if (!callback) return;

    // Ignore HTTP requests from connection that may still be open
    server.removeListener("request", listener);
    server.setTimeout(1);

    const cb = callback;
    callback = null;
    setTimeout(cb, 1000);
  }, timeout).unref();

  server.close(() => {
    if (!callback) return;

    const cb = callback;
    callback = null;
    // Allow some time for connection close events to fire
    setTimeout(cb, 50);
  });
}
/**
 * @summary Start an http server
 * @param port port no
 * @param networkInterface url (0.0.0.0)
 * @param ssl ssl object containing ssl key and certificate
 * @param _listener http listener 
 * @param onConnection onconnection
 * @param keepAliveTimeout Timer to keep connection live
 */
export function start(
  port,
  networkInterface,
  ssl,
  _listener,
  onConnection?,
  keepAliveTimeout: number = -1
): void {
  listener = _listener;

  if (ssl && ssl.key && ssl.cert) {
    const options = {
      key: ssl.key
        .split(":")
        .map(f => fs.readFileSync(path.resolve(ROOT_DIR, f.trim()))),
      cert: ssl.cert
        .split(":")
        .map(f => fs.readFileSync(path.resolve(ROOT_DIR, f.trim())))
    };
// create a http server using npm http module
    server = https.createServer(options, listener);
    if (onConnection != null) server.on("secureConnection", onConnection);
  } else {
    server = http.createServer(listener);
    if (onConnection != null) server.on("connection", onConnection);
  }

  if (keepAliveTimeout >= 0) server.keepAliveTimeout = keepAliveTimeout;
  server.listen(port, networkInterface);
}
/**
 * @summary Stops server using fn closeServer() then returns promise
 */
export function stop(): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Could not close server in a timely manner"));
    }, 30000).unref();
    closeServer(20000, resolve);
  });
}
