/**
#####################################    File Description    #######################################

dynamic loader to load different components of page. Single Page Application use dynamic loader

####################################################################################################
 */

import * as notifications from "./notifications";

export let codeMirror;
export let yaml;

let note;

function onError(): void {
  if (!note) {
    note = notifications.push(
      "error",
      "Error loading JS resource, please reload the page",
      {
        Reload: () => {
          window.location.reload();
        }
      }
    );
  }
}
/**
 * @description CodeMirror is a versatile text editor implemented in JavaScript for the browser.
 * @summary Used here when in setting code scripts for provisons configs virtual params on admin page.
 */
export function loadCodeMirror(): Promise<void> {
  if (codeMirror) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const promises = [
      import(/* webpackChunkName: "codemirror" */ "codemirror"),
      import(
        /* webpackChunkName: "codemirror" */ "codemirror/mode/javascript/javascript"
      ),
      import(/* webpackChunkName: "codemirror" */ "codemirror/mode/yaml/yaml")
    ];
    Promise.all(promises)
      .then(modules => {
        codeMirror = modules[0];
        resolve();
      })
      .catch(err => {
        onError();
        reject(err);
      });
  });
}
/**
 * @description Fn to loadYaml module
 */
export function loadYaml(): Promise<void> {
  if (yaml) return Promise.resolve();

  return new Promise((resolve, reject) => {
    import(/* webpackChunkName: "yaml" */ "yaml")
      .then(module => {
        yaml = module;
        resolve();
      })
      .catch(err => {
        onError();
        reject(err);
      });
  });
}
