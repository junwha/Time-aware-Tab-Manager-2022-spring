// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const global_tab_queue = new Set();
const waiting_queue = new Set();

class TabInfo {
  constructor(tabid, windowid, favIconUrl) {
      this.tabid = tabid;
      this.windowid = windowid;
      this.lastDeactivatedTime = 0;
      this.favIconUrl = favIconUrl;
  }

  getTabId() {
      return this.tabid;
  }

  getWindowId() {
      return this.windowid;
  }

  getIdleTime() {
      return getUnixTime() - this.lastDeactivatedTime;
  }

  setLastDeactivatedTime() {
      this.lastDeactivatedTime = getUnixTime();
  }

}

let currentActiveTab = [0, 0];
let tabInfoList = [];

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function removeTabFromList(tabid, windowid) {
  return tabInfoList.filter((t) => {
      return t.getTabId() != tabid;
  });
}

function getTabFromList(tab_id, window_id) {
  return tabInfoList.filter((t) => {
      return t.getTabId() == tab_id;
  });
}

chrome.alarms.onAlarm.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
  chrome.notifications.create({
    type: 'basic',
    //iconUrl: 'stay_hydrated.png',
    title: 'You have an unused tab',
    message: 'Check tab status',
    priority: 0
  });
});

chrome.runtime.onStartup.addListener(
  async () => {
    chrome.runtime.connect();
    const tab = getCurrentTab();
    console.log('tab created ' + tab.index);
    chrome.alarms.create({
      name: "Periodic check",
      periodInMinutes: 2
    });
  }
);

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log("update");
  if(changeInfo.favIconUrl != undefined){
    let [t] = getTabFromList(tab.id, tab.windowId);
    if (t !== undefined){
      tabInfoList = removeTabFromList(tab.id, tab.windowId);
      var tabInfo = new TabInfo(tab.id, tab.windowId, changeInfo.favIconUrl);
      tabInfoList.push(tabInfo);
    }
    console.log(changeInfo.favIconUrl);
  }
  console.log(tabInfoList);
}); 

//add tab into 
chrome.tabs.onCreated.addListener(
  async (tab) => {
      console.log(`tab created ${tab.id} ${tab.windowId}`);
      var current_date = new Date();
      console.log('created time');
      console.log(current_date);
      var tabInfo = new TabInfo(tab.id, tab.windowId, tab.favIconUrl);
      tabInfoList.push(tabInfo);
  }
);

//delete tab from list
chrome.tabs.onRemoved.addListener(
  async (tabid, info) => {
      console.log(`tab deleted ${tabid} ${info.windowId}`);
      var current_date = new Date();
      console.log('deleted time');
      console.log(current_date);
      tabInfoList = removeTabFromList(tabid, info.windowId);
  }
);

//ASDF
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log("update");
  if(changeInfo.favIconUrl != undefined){
    console.log("changefavi");
    console.log(changeInfo.favIconUrl);
  }
}); 



chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
    if (request.type === "0"){
      console.log(request.type);
      console.log(request.level);
      sendResponse({resp: "asdfdbye"});
    }
    if (request.type === "1"){
      console.log(request.thresholds);
      sendResponse({resp: "WTF"});
    }
  }
);