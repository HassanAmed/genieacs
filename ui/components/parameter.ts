/**
#####################################    File Description    #######################################

This file is used for creating component of device parameters in device page

####################################################################################################
 */

import { ClosureComponent, Component, VnodeDOM } from "mithril";
import { m } from "../components";
import * as taskQueue from "../task-queue";
import * as store from "../store";
import * as expression from "../../lib/common/expression";
import memoize from "../../lib/common/memoize";
import timeAgo from "../timeago";
import { getIcon } from "../icons";

const evaluateParam = memoize((exp, obj, now: number) => {
  let timestamp = now;
  const params = new Set();
  const value = expression.evaluate(exp, obj, now, e => {
    if (Array.isArray(e)) {
      if (e[0] === "PARAM") {
        params.add(e[1]);
        if (!Array.isArray(e[1])) {
          const p = obj[e[1]];
          if (p && p.valueTimestamp)
            timestamp = Math.min(timestamp, p.valueTimestamp);
        }
      }
      if (e[0] === "FUNC" && e[1] === "DATE_STRING" && !Array.isArray(e[2]))
        return new Date(e[2]).toLocaleString();
    }
    return e;
  });

  let parameter = params.size === 1 ? params.values().next().value : null;
  if (Array.isArray(parameter)) parameter = null;
  return { value, timestamp, parameter };
});

const component: ClosureComponent = (): Component => {
  return {
    view: vnode => {
      const device = vnode.attrs["device"];

      const { value, timestamp, parameter } = evaluateParam(
        vnode.attrs["parameter"],
        vnode.attrs["device"],
        store.getTimestamp()
      );

      if (value == null) return null;

      let edit;
      if (device[parameter] && device[parameter].writable) {
        edit = m(
          "button",
          {
            title: "Edit parameter value",
            onclick: () => {
              taskQueue.stageSpv({
                name: "setParameterValues",
                device: device["DeviceID.ID"].value[0],
                parameterValues: [
                  [
                    parameter,
                    device[parameter].value[0],
                    device[parameter].value[1]
                  ]
                ]
              });
            }
          },
          getIcon("edit")
        );
      }

      const el = m("long-text", { text: `${value}` });

      return m(
        "span",
        {
          class: "parameter-value",
          onmouseover: e => {
            e.redraw = false;
            // Don't update any child element
            if (e.target === (el as VnodeDOM).dom) {
              const now = Date.now();
              const localeString = new Date(timestamp).toLocaleString();
              e.target.title = `${localeString} (${timeAgo(now - timestamp)})`;
            }
          }
        },
        el,
        edit
      );
    }
  };
};
/**
 * @description Virtual param component
 */
export default component;
