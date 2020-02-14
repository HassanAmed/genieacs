/**
#####################################    File Description    #######################################

This file implements functions to getIcons  

####################################################################################################
 */

import { Children } from "mithril";
import m from "mithril";
/**
 * @description fn Get Icons for pages
 * @param name Icone name
 */
export function getIcon(name: string): Children {
  return m(
    `svg.icon.icon-${name}`,
    { key: `icon-${name}` },
    m("use", { href: `icons.svg#icon-${name}` })
  );
}
