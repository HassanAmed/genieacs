/**
#####################################    File Description    #######################################

This file create component for device-faults being shown inside device page

####################################################################################################
 */

import { ClosureComponent, Component } from "mithril";
import { m } from "../components";
import * as store from "../store";
import * as notifications from "../notifications";
import { getIcon } from "../icons";

const component: ClosureComponent = (): Component => {
  return {
    view: vnode => {
      const device = vnode.attrs["device"];
      const deviceId = device["DeviceID.ID"].value[0];
      const faults = store.fetch("faults", [
        "AND",
        [">", ["PARAM", "_id"], `${deviceId}:`],
        ["<", ["PARAM", "_id"], `${deviceId}:zzzz`]
      ]);

      const headers = [
        "Channel",
        "Code",
        "Message",
        "Retries",
        "Timestamp"
      ].map(l => m("th", l));
      const thead = m("thead", m("tr", headers));

      const rows = [];
      for (const f of faults.value) {
        rows.push([
          m("td", f["channel"]),
          m("td", f["code"]),
          m("td", f["message"]),
          m("td", f["retries"]),
          m("td", new Date(f["timestamp"]).toLocaleString()),
          m(
            "td",
            m(
              "button",
              {
                title: "Delete fault",
                onclick: e => {
                  e.redraw = false;
                  store
                    .deleteResource("faults", f["_id"])
                    .then(() => {
                      notifications.push("success", "Fault deleted");
                      store.fulfill(Date.now(), Date.now());
                      m.redraw();
                    })
                    .catch(err => {
                      notifications.push("error", err.message);
                      store.fulfill(Date.now(), Date.now());
                    });
                }
              },
              getIcon("remove")
            )
          )
        ]);
      }

      let tbody;
      if (rows.length) {
        tbody = m("tbody", rows.map(r => m("tr", r)));
      } else {
        tbody = m(
          "tbody",
          m("tr.empty", m("td", { colspan: headers.length }, "No faults"))
        );
      }

      return m("table.table", thead, tbody);
    }
  };
};
/**
 * @description Mithril component for device faults table
 */
export default component;
