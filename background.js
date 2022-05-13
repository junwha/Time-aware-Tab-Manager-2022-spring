// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const ALARM_INTERVAL = 5*1000;
const THRESHOLD = [20, 40];

function getUnixTime() {
    return Math.floor(new Date().getTime() / 1000);
}
class TabInfo {
    constructor(tabid, windowid) {
        this.tabid = tabid;
        this.windowid = windowid;
        this.lastDeactivatedTime = 0;
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

function getTabGroupByTime() {
    let firstStage = [];
    let secondStage = [];
    for (const tab of tabInfoList) {
        if (tab.getTabId() == currentActiveTab[0] && tab.getWindowId() == currentActiveTab[1])
            continue;
        let time = tab.getIdleTime();
        if (time < THRESHOLD[0])
            continue;
        else if (THRESHOLD[0] <= time && time < THRESHOLD[1])
            firstStage.push(tab);
        else
            secondStage.push(tab);
    }
    console.log("first");
    console.log(firstStage);
    console.log("second");
    console.log(secondStage);
    return [firstStage, secondStage];
}

function removeTabFromList(tabid, windowid) {
    return tabInfoList.filter((t) => {
        return t.getTabId() != tabid || t.getWindowId() != windowid;
    });
}

function getTabFromList(tabid, windowid) {
    return tabInfoList.filter((t) => {
        return t.getTabId() == tabid && t.getWindowId() == windowid;
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
  }
);

chrome.tabs.onActivated.addListener(
    (tab) => {
        let [t] = getTabFromList(currentActiveTab[0], currentActiveTab[1]);
        currentActiveTab = [tab.tabId, tab.windowId];
        if (t !== undefined)
            t.setLastDeactivatedTime();
    }
);

//add tab into 
chrome.tabs.onCreated.addListener(
  async (tab) => {
    console.log(`tab created ${tab.id} ${tab.windowId}`);
    var current_date = new Date();
    console.log('created time');
    console.log(current_date);
    var tabInfo = new TabInfo(tab.id, tab.windowId);
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

setInterval(() => {
    let [firstStage, secondStage] = getTabGroupByTime();
}, ALARM_INTERVAL);