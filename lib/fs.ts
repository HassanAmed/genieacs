/**
#####################################    File Description    #######################################

This  file implements a listener for file server that listen to get requests of device/CPE and 
transfer file to them in response(They get files from db)


####################################################################################################
 */

import * as url from "url";
import * as querystring from "querystring";
import { IncomingMessage, ServerResponse } from "http";
import { GridFSBucket } from "mongodb";
import * as db from "./db";
import * as logger from "./logger";
import { getRequestOrigin } from "./forwarded";
/**
 * @description Listener for fs server only listens for Get Method on this server as 
 * CPE will make get request to file server to get file and download on its own storage.
 * @param request Incoming Message
 * @param response Server Response
 */
export function listener(
  request: IncomingMessage,
  response: ServerResponse
): void {
  const urlParts = url.parse(request.url, true);
  if (request.method === "GET") {
    const filename = querystring.unescape(urlParts.pathname.substring(1));
// log object to for creating logs of the operation
    const log = {
      message: "Fetch file",
      filename: filename,
      remoteAddress: getRequestOrigin(request).remoteAddress
    };
// search if file is in db (files are added in db by admin using interface )
    db.filesCollection.findOne({ _id: filename }, (err, file) => {
      if (err) throw err;
// if there is no file then send 404 response not found
      if (!file) {
        response.writeHead(404);
        response.end();
        log.message += " not found";
        logger.accessError(log);
        return;
      }
// Sending file in response if found
      response.writeHead(200, {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Length": file.length
      });

      const bucket = new GridFSBucket(db.client.db());
      const downloadStream = bucket.openDownloadStreamByName(filename);
      downloadStream.pipe(response);
//logging the operations (using log object we created at start of function)
      logger.accessInfo(log);
    });
  } else // only get requests allowed on this fs-server
   {
    response.writeHead(405, { Allow: "GET" });
    response.end("405 Method Not Allowed");
  }
}
