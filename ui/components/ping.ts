/**
#####################################    File Description    #######################################

This file is used to create ping component which is when we open a device page it starts pinging 
server at 3s time interval
Inspect device page and go to network here you can see device constantly pinging server

####################################################################################################
 */

import { ClosureComponent, Component, VnodeDOM } from "mithril";
import { m } from "../components";
import * as store from "../store";

const REFRESH_INTERVAL = 3000;

const component: ClosureComponent = (vn): Component => {
  let interval: ReturnType<typeof setInterval>;
  let host: string;

  const refresh = async (): Promise<void> => {
    let status = "";
    if (host) {
      try {
        const res = await store.ping(host);
        if (res["avg"] != null) status = `${Math.trunc(res["avg"])} ms`;
        else status = "Unreachable";
      } catch (err) {
        setTimeout(() => {
          throw err;
        }, 0);
      }
    }

    const dom = (vn as VnodeDOM).dom;

    if (dom) dom.innerHTML = `Pinging ${host}: ${status}`;
  };

  return {
    onremove: () => {
      clearInterval(interval);
    },
    view: vnode => {
      const device = vnode.attrs["device"];
      let param =
        device["InternetGatewayDevice.ManagementServer.ConnectionRequestURL"];
      if (!param)
        param = device["Device.ManagementServer.ConnectionRequestURL"];

      let h;
      if (param && param.value) {
        const url = new URL(param.value[0]);
        h = url.hostname;
      }

      if (host !== h) {
        host = h;
        clearInterval(interval);
        if (host) {
          refresh();
          interval = setInterval(refresh, REFRESH_INTERVAL);
        }
      }

      return m("div", `Pinging ${host}:`);
    }
  };
};
/**
 * @description Ping Component
 */
export default component;
