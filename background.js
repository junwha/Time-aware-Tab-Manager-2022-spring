// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const ALARM_INTERVAL = 60 * 1000; // Threshold for update groups (milliseconds)
const THRESHOLD = [0.2, 1]; // Threshold for first and second stage (minute)
const SKIP_THRESHOLD = 2000; // Threshold for removing current visiting tab from target (milliseconds)

// Constants
const TIMEOUT = 100;
const MIN_TO_MS = (60 * 1000);

let currentActiveTab = [0, 0];
let tabInfoList = [];

/// Class for storing information of tabs.
// It maintains time information and window information
// You can get the tab by using chrome.tabs.get(tabInfo.getTabId());
class TabInfo {
    constructor(tab_id, window_id) {
        this.tab_id = tab_id;
        this.window_id = window_id;
        this.lastDeactivatedTime = getUnixTime();
        this.lastActivatedTime = getUnixTime();
    }

    // Getters
    getTabId() {
        return this.tab_id;
    }

    getWindowId() {
        return this.window_id;
    }

    getIdleTime() {
        return getUnixTime() - this.lastDeactivatedTime;
    }

    getActiveTime() {
        return getUnixTime() - this.lastActivatedTime;
    }

    // Setters
    setLastDeactivatedTime() {
        this.lastDeactivatedTime = getUnixTime();
    }

    setLastActivatedTime() {
        this.lastActivatedTime = getUnixTime();
    }
}


/// Utils

function getUnixTime() {
    return Math.floor(new Date().getTime());
}

function removeTabFromList(tab_id, windowid) {
    return tabInfoList.filter((t) => {
        return t.getTabId() != tab_id;
    });
}

function getTabFromList(tab_id, window_id) {
    return tabInfoList.filter((t) => {
        return t.getTabId() == tab_id;
    });
}

/// Listeners 

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
            if (t.getActiveTime() > SKIP_THRESHOLD)
                t.setLastDeactivatedTime();

        let [t2] = getTabFromList(currentActiveTab[0], currentActiveTab[1]);
        if (t2 !== undefined)
            t2.setLastActivatedTime();

        regroup();
    }
);

chrome.runtime.onUpdateAvailable.addListener(async () => {
    chrome.runtime.reload()
});

//add tab into 
chrome.tabs.onCreated.addListener(
    async (tab) => {
        var current_date = new Date();
        var tabInfo = new TabInfo(tab.id, tab.windowId);
        tabInfoList.push(tabInfo);
    }
);

//delete tab from list
chrome.tabs.onRemoved.addListener(
    async (tab_id, info) => {
        var current_date = new Date();
        tabInfoList = removeTabFromList(tab_id, info.windowId);
    }
);

// Check the tabs periodically 
setInterval(async () => {
    let [t] = getTabFromList(currentActiveTab[0], currentActiveTab[1]);
    if (t !== undefined)
        t.setLastActivatedTime();
    regroup();

}, ALARM_INTERVAL);


/// Main Logic

// Return two tab lists satisfying thresholds
function getTabListsByTime() {
    let firstStage = [];
    let secondStage = [];

    // Compare tab's idle time and threshold
    for (const tab of tabInfoList) {
        if (tab.getTabId() == currentActiveTab[0] && tab.getActiveTime() < SKIP_THRESHOLD)
            continue;
        let time = tab.getIdleTime();
        if (time < THRESHOLD[0] * MIN_TO_MS)
            continue;
        else if (time < THRESHOLD[1] * MIN_TO_MS)
            firstStage.push(tab);
        else
            secondStage.push(tab);
    }

    return [firstStage, secondStage];
}

// Regroup all collected tabs
function regroup() {
    let [firstStage, secondStage] = getTabListsByTime();
    ungroupAll();
    groupTabs(firstStage, THRESHOLD[0]);
    groupTabs(secondStage, THRESHOLD[1]);
}

// Ungroup all tabs in current state
async function ungroupAll() {
    if (tabInfoList.length == 0)
        return;

    var tabIdList = [];

    for (const t of tabInfoList) {
        tabIdList.push(t.getTabId());
    }

    ungroup(tabIdList);
}

// Wrapper of chrome.tabs.ungroup
async function ungroup(tabIdList) {
    chrome.tabs.ungroup(tabIdList).catch((e) => {
        setTimeout(
            () => ungroup(tabIdList),
            TIMEOUT
        );
    });
}

// This function returns two-dimension array,
// each array is the tabs which are adjacent
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

// Group all tabs
async function groupTabs(tab_info_list, elapsed_time) {
    if (tab_info_list.length == 0)
        return;
    var prom_list = [];

    for (const tab_info of tab_info_list) {
        prom_list.push(chrome.tabs.get(tab_info.getTabId()));
    }
    Promise.all(prom_list).then((tab_list) => {
        var all_list = groupAdjacentTIDs(tab_list);

        if (all_list.length == 0) return;

        for (const tid_list of all_list) {
            group(tid_list, elapsed_time);
        }
    });
}

// Wrapper of chrome.tabs.group
async function group(tid_list, elapsed_time) {
    chrome.tabs.group({ tabIds: tid_list }).catch((e) => setTimeout(() => group(tid_list, elapsed_time), TIMEOUT)).then((gid) => {
        if (gid === undefined)
            return;
        var _color, _time_info;

        if (elapsed_time >= THRESHOLD[1]) {
            _time_info = `${THRESHOLD[1]}m`;
            _color = "red";
        } else if (elapsed_time >= THRESHOLD[0]) {
            _time_info = `${THRESHOLD[0]}m`;
            _color = "yellow";
        } else {
            return;
        }

        var p = chrome.tabGroups.update(gid, {
            color: _color,
            title: _time_info
        });
        p.catch((e) => console.log("[Exception] no group"));
    })
}