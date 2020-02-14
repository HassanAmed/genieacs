
/**
#####################################    File Description    #######################################

This  file implements function to ping server used by ping api in api.ts

* Important Note Genieacs is only support on linux os.
####################################################################################################
 */
import { platform } from "os";
import { exec } from "child_process";

interface Ping {
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: number;
  min: number;
  avg: number;
  max: number;
  mdev: number;
}
/**
 * @description Ping server
 */
export function ping(
  host: string,
  callback: (err, res?, stdout?) => void
): void {
  let cmd: string, parseRegExp1: RegExp, parseRegExp2: RegExp;
  switch (platform()) {
    case "linux":
      cmd = `ping -w 1 -i 0.2 -c 3 ${host}`;
      parseRegExp1 = /(\d+) packets transmitted, (\d+) received, ([\d.]+)% packet loss[^]*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/;
      parseRegExp2 = /(\d+) packets transmitted, (\d+) received, ([\d.]+)% packet loss/;
      break;

    case "freebsd":
      // Send a single packet because on FreeBSD only superuser can send
      // packets that are only 200 ms apart.
      cmd = `ping -t 1 -c 3 ${host}`;
      parseRegExp1 = /(\d+) packets transmitted, (\d+) packets received, ([\d.]+)% packet loss\nround-trip min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/;
      parseRegExp2 = /(\d+) packets transmitted, (\d+) packets received, ([\d.]+)% packet loss/;
      break;

    default:
      return callback(new Error("Platform not supported"));
  }

  exec(cmd, (err, stdout) => {
    let parsed: Ping;
    if (stdout) {
      const m1 = stdout.match(parseRegExp1);
      if (m1) {
        parsed = {
          packetsTransmitted: +m1[1],
          packetsReceived: +m1[2],
          packetLoss: +m1[3],
          min: +m1[4],
          avg: +m1[5],
          max: +m1[6],
          mdev: +m1[7]
        };
      } else {
        const m2 = stdout.match(parseRegExp2);
        if (m2) {
          parsed = {
            packetsTransmitted: +m2[1],
            packetsReceived: +m2[2],
            packetLoss: +m2[3],
            min: null,
            avg: null,
            max: null,
            mdev: null
          };
        }
      }
    }

    callback(err, parsed, stdout);
  });
}
