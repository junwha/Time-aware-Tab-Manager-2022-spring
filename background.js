// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const global_tab_queue = new Set();
const waiting_queue = new Map();

// TODO : query를 통해 얻어지는게 한 개가 아닐수도?
async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function getWindowId() {
  let queryOptions = { windowId: true };
  let [info] = await chrome.tabs.query(queryOptions);
  return info;
}

async function updateWaitingQueue() {
  let current_tab = getCurrentTab();
  global_tab_queue.forEach(function (tab) {
    if (tab.index === current_tab.index) {
      //don't add
      waiting_queue.delete(tab);
    }
    else {
      waiting_queue.add(tab);
    }
  });
}

chrome.alarms.onAlarm.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
  chrome.notifications.create({
    type: 'basic',
    //iconUrl: 'stay_hydrated.png',
    title: 'alarm is activated',
    message: 'activated alarm check',
    priority: 0
  });
  console.log(global_tab_queue);
});

/*
activate alarm issuer
add the first tab into global tab list
initialize waiting tab map
map[key:tabid,value:waitingtime]
*/

const TIME_TO_ALARM = 4000;

async function listener() {
  console.log("listener called");
}

async function periodic_alarm_startup() {
  console.log("startup called");
}

chrome.runtime.onStartup.addListener(
  async () => {
    const tab = getCurrentTab();
    console.log(['initial tab created ' , tab.id]);
    //chrome.alarms.create("Periodic Check",{ periodInMinutes: 1});
    notify_cnt = 0;
    periodic_alarm_startup();
  }
);

//add tab into 
chrome.tabs.onCreated.addListener(
  //TODO : tabinfo 클래스에 맞춰서
  async (tab) => {
    console.log('tab created' + tab.id + tab.url + 'windowid' + tab.windowId);
    var current_date = new Date().getTime();
    console.log('created time');
    console.log(current_date);
    global_tab_queue.add(tab.id);
  }
);

//delete tab from list
chrome.tabs.onRemoved.addListener(
  async function (tabId, removeInfo)  {
    console.log('tab deleted ' + tabId);
    var current_date = new Date().getTime();
    console.log('deleted time');
    console.log(current_date);
    global_tab_queue.delete(tabId);
    waiting_queue.delete(tabId);
  }
);

const cyrb53 = function (str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

const turn_notification_on = true;
var notify_cnt = 0;
var grouped_notification_name = 'grouped_notifier'

async function grouped_notifier() {
  console.log('grouped_notifier called');
  notify_cnt++;
  //const noti_name = new String(grouped_notification_name + notify_cnt);
  chrome.notifications.create(
    grouped_notification_name + cyrb53(Date()),
    {
      type: 'basic',
      //requireInteraction: true,
      iconUrl: 'stay_hydrated.png',
      title: 'Unused tabs are grouped.',
      message: 'Check the unused tabs',
      buttons: [
        { title: 'See grouped tabs'},
        { title: 'Close' }
      ]
    }
    ,
    (notificationId) => {
      console.log(notificationId, grouped_notification_name);
    }
  );
}

const tab_group_queue = new Array();

chrome.tabGroups.onCreated.addListener((group) => {
  console.log('tab group id : ', group.id)
  tab_group_queue.add(group.id);
});

chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    console.log(notificationId, buttonIndex);
    chrome.notifications.clear(notificationId);
    if (notificationId.startsWith(grouped_notification_name)) {
      if (buttonIndex === 0) {
        chrome.tabGroups.move(tab_group_queue[0],-1);
      }
    }
  }
);


setInterval(() => {
  //alarm listener 호출!
  grouped_notifier();
  listener();
}, TIME_TO_ALARM)