/**
#####################################    File Description    #######################################

This  file implements some functions which are used by apis in api.ts. This is to group different
things differently so api.ts only contains apis and function it uses are put here.

Note Functions this file implements are also dependent on functions from another api-functions.ts
file in parent directory of this folder (main lib folder).

####################################################################################################
 */

import { ObjectID } from "mongodb";
import * as db from "./db";
import { del } from "../cache";
import { getUsers } from "../local-cache";
import { hashPassword } from "../auth";
import {
  insertTasks,
  watchTask,
  connectionRequest,
  deleteDevice
} from "../api-functions";
/**
 * @description Function used by apis in api.ts to delete fault
 * @param id fault id
 */
async function deleteFault(id): Promise<void> {
  const deviceId = id.split(":", 1)[0];
  const channel = id.slice(deviceId.length + 1);

  await Promise.all([
    db.deleteFault(id),
    channel.startsWith("task_")
      ? db.deleteTask(new ObjectID(channel.slice(5)))
      : null
  ]);

  await del(`${deviceId}_tasks_faults_operations`);
}
/**
 * @description Function used by delete apis to delete resource
 * @param resource resource
 * @param id resource id
 */
export async function deleteResource(resource, id): Promise<void> {
  switch (resource) { //check which resource to delete and call respective db delete method to do so
    case "devices":
      await deleteDevice(id);
      break;

    case "files":
      await db.deleteFile(id);
      break;

    case "faults":
      await deleteFault(id);
      break;

    case "provisions":
      await db.deleteProvision(id);
      break;

    case "presets":
      await db.deletePreset(id);
      break;

    case "virtualParameters":
      await db.deleteVirtualParameter(id);
      break;

    case "config":
      await db.deleteConfig(id);
      break;

    case "permissions":
      await db.deletePermission(id);
      break;

    case "users":
      await db.deleteUser(id);
      break;
  }

  await del("presets_hash");
}
/**
 * @description Function used by apis to post queued tasks to device.
 * @param deviceId Device Id
 * @param tasks task to post
 * @param timeout Timeout
 * @param device device instance
 */
export async function postTasks(
  deviceId,
  tasks,
  timeout,
  device
): Promise<{ connectionRequest: string; tasks: any[] }> {
  for (const task of tasks) {
    delete task._id;
    task.device = deviceId;
  }
// Insert new tasks that is to be done to db and set status pending
  tasks = await insertTasks(tasks);
  const statuses = tasks.map(t => {
    return { _id: t._id, status: "pending" };
  });
// delete device previously faulted tasks against this key if any
  await del(`${deviceId}_tasks_faults_operations`);

  try {
    await connectionRequest(deviceId, device); // create http(tcp) or udp connection with device
  } catch (err) {
    return {
      connectionRequest: err.message,
      tasks: statuses
    };
  }
  // array is 0 index so pointing to current task
  const sample = tasks[tasks.length - 1];

  // Waiting for session to finish or timeout or return completed if tasks is done
  await watchTask(deviceId, sample._id, timeout);

  const promises = [];
  for (const s of statuses) {
    promises.push(db.query("tasks", ["=", ["PARAM", "_id"], s._id]));
    promises.push(
      db.query("faults", ["=", ["PARAM", "_id"], `${deviceId}:task_${s._id}`])
    );
  }

  const res = await Promise.all(promises);
  for (const [i, r] of statuses.entries()) {
    if (res[i * 2].length === 0) {
      r.status = "done";
    } else if (res[i * 2 + 1].length === 1) {
      r.status = "fault";
      r.fault = res[i * 2 + 1][0];
    }
    db.deleteTask(r._id); // all tasks that are done are deleted from db
  }

  return { connectionRequest: "OK", tasks: statuses }; //return response with task statuse.
}
/**
 * @description Interface for ping response
 */
interface PingResponse {
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: string;
  min: number;
  avg: number;
  max: number;
  mdev: number;
}
/**
 * @description function used by api to edit a resource
 * @param resource resource 
 * @param id resource Id
 * @param data data
 */
export async function putResource(resource, id, data): Promise<void> {
  if (resource === "presets") {
    await db.putPreset(id, data);
  } else if (resource === "provisions") {
    await db.putProvision(id, data);
  } else if (resource === "virtualParameters") {
    await db.putVirtualParameter(id, data);
  } else if (resource === "config") {
    await db.putConfig(id, data);
  } else if (resource === "permissions") {
    await db.putPermission(id, data);
  } else if (resource === "users") {
    delete data.password;
    delete data.salt;
    await db.putUser(id, data);
  }

  await del("presets_hash");
}
/**
 * @description Local Authorization 
 * @param snapshot Db snapshot
 * @param username username
 * @param password password
 */
export function authLocal(snapshot, username, password): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const users = getUsers(snapshot);
    const user = users[username];
    if (!user || !user.password) return void resolve(null);
    hashPassword(password, user.salt)
      .then(hash => {
        if (hash === user.password) resolve(true);
        else resolve(false);
      })
      .catch(reject);
  });
}
