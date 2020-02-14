/**
#####################################    File Description    #######################################

This file is used to implement built in code editor in platform which open when we add new preset/
provision etc. In there we write javascript code.

####################################################################################################
 */

import { ClosureComponent, Component } from "mithril";
import { m } from "./components";
import { codeMirror } from "./dynamic-loader";

const component: ClosureComponent = (): Component => {
  return {
    view: vnode => {
      return m("textarea", {
        name: vnode.attrs["id"],
        value: vnode.attrs["value"],
        oncreate: _vnode => {
          const editor = codeMirror.fromTextArea(_vnode.dom, {
            mode: vnode.attrs["mode"],
            lineNumbers: true,
            readOnly: vnode.attrs["readOnly"],
            extraKeys: {
              "Ctrl-Enter": () => {
                if (vnode.attrs["onSubmit"])
                  vnode.attrs["onSubmit"](_vnode.dom);
              },
              "Cmd-Enter": () => {
                if (vnode.attrs["onSubmit"])
                  vnode.attrs["onSubmit"](_vnode.dom);
              }
            }
          });

          if (vnode.attrs["onChange"]) {
            editor.on("change", e => {
              vnode.attrs["onChange"](e.getValue());
            });
          }

          if (vnode.attrs["focus"]) editor.focus();
          if (vnode.attrs["onReady"]) vnode.attrs["onReady"](editor);
        }
      });
    }
  };
};
/**
 * @description Code editor component
 */
export default component;
