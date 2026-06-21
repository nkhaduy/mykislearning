import {getNotifications,markAsRead} from "../mockDatabase.js";
export const notificationService={
  list(accountId){return getNotifications(accountId).filter(n=>!n.expiresAt||new Date(n.expiresAt)>=new Date());},
  get(id,accountId){return this.list(accountId).find(n=>n.id===id)||null;},
  markRead(id,accountId){const item=this.get(id,accountId);return item?markAsRead(id,accountId):null;},
  markAllRead(accountId){return this.list(accountId).filter(n=>!n.isRead).map(n=>markAsRead(n.id,accountId)).filter(Boolean);}
};
