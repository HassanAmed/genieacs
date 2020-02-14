/**
#####################################    File Description    #######################################

This  file implements clustering

A single instance of Node.js runs in a single thread. To take advantage of multi-core systems, 
the user will sometimes want to launch a cluster of Node.js processes to handle the load.

The cluster module allows easy creation of child processes that all share server ports.

####################################################################################################
 */

import cluster from "cluster";
import { cpus } from "os";
import * as logger from "./logger";
/**
 * Keep track of child process/worker's time
 */
let respawnTimestamp = 0;
/**
 * Keep track of child process/worker crashes
 * if worker crashes too many times it is exited.
 */
let crashes: number[] = [];
/**
 * @summary spawm a child process called worker used by cluster.start()
 * @returns returns the worker
 */
function fork(): cluster.Worker {
  const w = cluster.fork();
  w.on("error", (err: NodeJS.ErrnoException) => {
    // Avoid exception when attempting to kill the process just as it's exiting
    if (err.code !== "EPIPE") throw err;
    setTimeout(() => {
      if (!w.isDead()) throw err;
    }, 50);
  });
  return w;
}
/**
 * 
 * @param worker a child process/worker
 * @param code process code -to be sent for logging
 * @param signal process signal - to be sent for logging
 */
function restartWorker(worker, code, signal): void {
  const msg = {
    message: "Worker died",
    pid: worker.process.pid,
    exitCode: null,
    signal: null
  };

  if (code != null) msg.exitCode = code;

  if (signal != null) msg.signal = signal;

  logger.error(msg);

  const now = Date.now();
  crashes.push(now);

  let min1 = 0,
    min2 = 0,
    min3 = 0;

  crashes = crashes.filter(n => {
    if (n > now - 60000) ++min1;
    else if (n > now - 120000) ++min2;
    else if (n > now - 180000) ++min3;
    else return false;
    return true;
  });

  if (min1 > 5 && min2 > 5 && min3 > 5) {
    process.exitCode = 1;
    cluster.removeListener("exit", restartWorker);
    for (const pid in cluster.workers) cluster.workers[pid].kill();

    logger.error({
      message: "Too many crashes, exiting",
      pid: process.pid
    });
    return;
  }

  respawnTimestamp = Math.max(now, respawnTimestamp + 2000);
  if (respawnTimestamp === now) {
    fork();
    return;
  }

  setTimeout(() => {
    if (process.exitCode) return;
    fork();
  }, respawnTimestamp - now);
}
/**
 * @summary start a child process/worker
 * @param workerCount count of worker process for given service 
 * @param servicePort service port 
 * @param serviceAddress service address (e.g address of cwmp)
 */
export function start(workerCount, servicePort, serviceAddress): void {
  cluster.on("listening", (worker, address) => {
    if (
      (address.addressType === 4 || address.addressType === 6) &&
      address.address === serviceAddress &&
      address.port === servicePort
    ) {
      logger.info({
        message: "Worker listening",
        pid: worker.process.pid,
        address: address.address,
        port: address.port
      });
    }
  });

  cluster.on("exit", restartWorker);

  if (!workerCount) workerCount = Math.max(2, cpus().length);

  for (let i = 0; i < workerCount; ++i) fork();
}
/**
 * @summary stop/kill worker 
 */
export function stop(): void {
  cluster.removeListener("exit", restartWorker);
  for (const pid in cluster.workers) cluster.workers[pid].kill();
}
/**
 * Exporting worker for other files/modules to use
 */
export const worker = cluster.worker;
