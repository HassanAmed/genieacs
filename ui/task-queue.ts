/**
#####################################    File Description    #######################################

This file implements task-queue using set data structure.

####################################################################################################
 */

import * as store from "./store";

const queue = new Set();
const staging = new Set();
/**
 * @description Queue a task (Any function before being performed is queued in task queue)
 */
export function queueTask(task): void {
  staging.delete(task);
  task.status = "queued";
  queue.add(task);
}
/**
 * @description Delete a task a task
 */
export function deleteTask(task): void {
  staging.delete(task);
  queue.delete(task);
}
/**
 * @description Get task Queue
 */
export function getQueue(): Set<{}> {
  return queue;
}
/**
 * @description Clear task queue
 */
export function clear(): void {
  queue.clear();
}
/**
 * @description Get currently staged tasks in queue
 */
export function getStaging(): Set<{}> {
  return staging;
}
/**
 * @description clear staging
 */
export function clearStaging(): void {
  staging.clear();
}
/**
 * @description Stage a task
 */
export function stageSpv(task): void {
  staging.add(task);
}
/**
 * @description Stage a download task
 */
export function stageDownload(task): void {
  staging.add(task);
}
/**
 * Function to commit a task and call fn postTask from store.ts that makes xhr request to api
 * @param tasks Task
 */
export function commit(tasks, callback): Promise<void> {
  const devices: { [deviceId: string]: any[] } = {};
  for (const t of tasks) {
    devices[t.device] = devices[t.device] || [];
    devices[t.device].push(t);
    queueTask(t);
  }

  return new Promise(resolve => {
    let counter = 1;
    for (const [deviceId, tasks2] of Object.entries(devices)) {
      ++counter;
      store
        .postTasks(deviceId, tasks2)
        .then(connectionRequestStatus => {
          for (const t of tasks2) {
            if (t.status === "pending") t.status = "stale";
            else if (t.status === "done") queue.delete(t);
          }
          callback(deviceId, null, connectionRequestStatus, tasks2);
          if (--counter === 0) resolve();
        })
        .catch(err => {
          for (const t of tasks2) t.status = "stale";
          callback(deviceId, err, null, tasks2);
          if (--counter === 0) resolve();
        });
    }

    if (--counter === 0) resolve();
  });
}
