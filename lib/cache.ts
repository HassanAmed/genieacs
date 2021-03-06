/**
#####################################    File Description    #######################################

This  file as name suggests creates connection with db to cache data.

####################################################################################################
 */

import { MongoClient, Collection } from "mongodb";
import * as config from "./config";
/**
 * Max cache time limit -(TTL time to live)
 */
const MAX_CACHE_TTL = +config.get("MAX_CACHE_TTL");

let clientPromise: Promise<MongoClient>;
let mongoCollection: Collection;
let mongoTimeOffset = 0;
/**
 * @summary create connection with mongodb
 */
export async function connect(): Promise<void> {
  const MONGODB_CONNECTION_URL = "" + config.get("MONGODB_CONNECTION_URL");
  clientPromise = MongoClient.connect(MONGODB_CONNECTION_URL, {
    useNewUrlParser: true
  });
  const db = (await clientPromise).db();
  mongoCollection = db.collection("cache");
  await mongoCollection.createIndex({ expire: 1 }, { expireAfterSeconds: 0 });
  const now = Date.now();
  const res = await db.command({ hostInfo: 1 });
  mongoTimeOffset = res.system.currentTime.getTime() - now;
}
/**
 * @summary Disconnect form mongodb
 */
export async function disconnect(): Promise<void> {
  if (clientPromise) await (await clientPromise).close();
}
/**
 * @summary get values from db for provided key/keys
 * @param key key or key[array] 
 */
export async function get(key): Promise<any> {
  const expire = new Date(Date.now() - mongoTimeOffset);
  if (Array.isArray(key)) {
    const res = await mongoCollection.find({ _id: { $in: key } }).toArray();

    const indices = {};
    key.forEach((v, i) => {
      indices[v] = i;
    });

    const values = [];
    res.forEach(r => {
      if (r["expire"] > expire) values[indices[r["_id"]]] = r["value"];
    });

    return values;
  } else {
    const res = await mongoCollection.findOne({ _id: { $in: [key] } });
    if (res && res["expire"] > expire) return res["value"];
    return null;
  }
}
/**
 * @summary Delete key value pair/s for provieded key
 * @param key key or key[array]
 * @returns returns promise after deletion is done
 */
export async function del(key): Promise<void> {
  if (Array.isArray(key))
    await mongoCollection.deleteMany({ _id: { $in: key } });
  else await mongoCollection.deleteOne({ _id: key });
}
/**
 * @summary Set/Replace a key/value pair
 * @param key key
 * @param value value
 * @param ttl time to live = Max_CACHE_TTL
 */
export async function set(
  key: string,
  value: string | number,
  ttl: number = MAX_CACHE_TTL
): Promise<void> {
  const expire = new Date(Date.now() - mongoTimeOffset + ttl * 1000);
  await mongoCollection.replaceOne(
    { _id: key },
    { _id: key, value: value, expire: expire },
    { upsert: true }
  );
}
/**
 * @summary Find and delete key/value pair against given key
 * @param key key
 */
export async function pop(key): Promise<any> {
  const res = await mongoCollection.findOneAndDelete({ _id: key });

  if (
    res &&
    res["value"] &&
    +res["value"]["expire"] - (Date.now() - mongoTimeOffset)
  )
    return res["value"]["value"];

  return null;
}
/**
 * @description A database lock is used to “lock” some data in a database so that only one database
 *  user/session may update that particular data.
 * @param lockName 
 * @param ttl 
 */
export async function lock(lockName, ttl): Promise<Function> {
  //generate a token
  const token = Math.random()
    .toString(36)
    .slice(2);
/**
 * @description unlock or extend lock time to live
 */
  async function unlockOrExtend(extendTtl): Promise<void> {
    if (!extendTtl) {
      const res = await mongoCollection.deleteOne({
        _id: lockName,
        value: token
      });
      if (res["result"]["n"] !== 1) throw new Error("Lock expired");
    } else {
      const expire = new Date(Date.now() - mongoTimeOffset + extendTtl * 1000);
      const res = await mongoCollection.updateOne(
        { _id: lockName, value: token },
        { expire: expire }
      );
      if (res["result"]["n"] !== 1) throw new Error("Lock expired");
    }
  }

  const expireTest = new Date(Date.now() - mongoTimeOffset);
  const expireSet = new Date(Date.now() - mongoTimeOffset + ttl * 1000);

  try {
    await mongoCollection.updateOne(
      { _id: lockName, expire: { $lte: expireTest } },
      { $set: { value: token, expire: expireSet } },
      { upsert: true }
    );
  } catch (err) {
    if (err && err.code === 11000) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return lock(lockName, ttl);
    }
  }

  return unlockOrExtend;
}
