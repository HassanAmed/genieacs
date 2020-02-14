/**
#####################################    File Description    #######################################

This file is used to implement functions that create notification which we see upon completion or
rejection of a task.

####################################################################################################
 */

import m from "mithril";

interface Notification {
  type: string;
  message: string;
  timestamp: number;
  actions?: { [label: string]: () => void };
}

const notifications = new Set<Notification>();
/**
 * @description fn to push a notifcation
 * @param type Type
 * @param message Message
 * @param actions Action
 */
export function push(type, message, actions?): Notification {
  const n: Notification = {
    type: type,
    message: message,
    timestamp: Date.now(),
    actions: actions
  };
  notifications.add(n);
  m.redraw();
  if (!actions) {
    setTimeout(() => {
      dismiss(n);
    }, 4000);
  }

  return n;
}
/**
 * @description Delete notification
 */
export function dismiss(n: Notification): void {
  notifications.delete(n);
  m.redraw();
}
/**
 * @description Get notification
 */
export function getNotifications(): Set<Notification> {
  return notifications;
}
