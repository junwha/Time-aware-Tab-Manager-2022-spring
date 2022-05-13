// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const ALARM_INTERVAL = 60 * 1000;
const THRESHOLD = [3, 10];
const TIMEOUT = 100;

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
        return t.getTabId() != tabid;
    });
}

function getTabFromList(tabid, windowid) {
    return tabInfoList.filter((t) => {
        return t.getTabId() == tabid;
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
    async (tab) => {
        let [t] = getTabFromList(currentActiveTab[0], currentActiveTab[1]);
        currentActiveTab = [tab.tabId, tab.windowId];
        if (t !== undefined)
            t.setLastDeactivatedTime();
        
        let [firstStage, secondStage] = getTabGroupByTime();
        ungroupTabs();
        groupTabs(firstStage, THRESHOLD[0]);
        groupTabs(secondStage, THRESHOLD[1]);
    }
);

chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload()
});

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

setInterval(async () => {
    let [firstStage, secondStage] = getTabGroupByTime();

    await ungroupTabs();
    groupTabs(firstStage, THRESHOLD[0]);
    groupTabs(secondStage, THRESHOLD[1]);

}, ALARM_INTERVAL);

async function ungroupTabs() {
    if (tabInfoList.length == 0)
        return;
    var tabIdList = [];

    for (const t of tabInfoList) {
        tabIdList.push(t.getTabId());
    }

    await ungroup(tabIdList);    
}

async function ungroup(tabIdList) {
    chrome.tabs.ungroup(tabIdList).catch((e) => {
        setTimeout(
            ()=>ungroup(tabIdList),
            TIMEOUT
        );
    });
}

function groupAdjacentTIDs(tab_list) {
    if (tab_list.length == 0) return [];

    var all_list = new Array();

    tab_list.sort(function (a, b) {
        return a.index - b.index;
    });

    var last_index = tab_list[0].index - 1;
    var each_list = new Array();

    for (const tab of tab_list) {
        if (tab.index - 1 != last_index) {
            all_list.push(each_list);
            each_list = new Array();
        }

        each_list.push(tab.id);
        last_index = tab.index;
    }

    if (each_list.length != 0) all_list.push(each_list);

    return all_list;
}


async function groupTabs(tab_info_list, elapsed_time) {
    if (tab_info_list.length == 0)
        return;
    var tab_list = [];

    for (const tab_info of tab_info_list) {
        tab_list.push(await chrome.tabs.get(tab_info.getTabId()));
    }

    var all_list = groupAdjacentTIDs(tab_list);

    if (all_list.length == 0) return;

    for (const tid_list of all_list) {
        group(tid_list, elapsed_time);
    }
}

async function group(tid_list, elapsed_time) {
    chrome.tabs.group({ tabIds: tid_list }).catch((e)=>setTimeout(()=>group(tid_list, elapsed_time), TIMEOUT)).then((gid) => {
        if (gid === undefined)
            return;
        var _color, _time_info;

        if (elapsed_time >= THRESHOLD[1]) {
            _time_info = "40s ago";
            _color = "red";
        } else if (elapsed_time >= THRESHOLD[0]) {
            _time_info = "20s ago";
            _color = "yellow";
        } else {
            return;
        }

        var p = chrome.tabGroups.update(gid, {
            color: _color,
            title: _time_info
        });
        p.catch((e)=>console.log("no group"));
    })
}