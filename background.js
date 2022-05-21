// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const ALARM_INTERVAL = 2 * 1000; // Threshold for update groups (milliseconds)
const THRESHOLD = [0.2, 1]; // Threshold for first and second stage (minute)
const SKIP_THRESHOLD = 2000; // Threshold for removing current visiting tab from target (milliseconds)

// Constants
const TIMEOUT = 100;
const MIN_TO_MS = (60 * 1000);

let currentActiveTab;
let tabInfoList = [];

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.type == 0) { // Close tabs
            let tab_all_list = getTabListsByTime();

            var tab_id_list = [];

            for (const tab_info of tab_all_list[request.level]) {
                tab_id_list.push(tab_info.getTabId());
            }

            remove(tab_id_list);

            console.log("closed");
        } else if (request.type == 1) { // Update thresholds
            console.log(request);
            THRESHOLD[0] = request.thresholds[0];
            THRESHOLD[1] = request.thresholds[1];
        } else if (request.type == 2) {
            let [firstStage, secondStage] = getTabListsByTime();
            console.log("Background will send response");
            sendResponse({
                tab_info: {
                    first: firstStage,
                    second: secondStage
                }
            });
        } else {
            // sendResponse({ status: 0 }); // failed
        }
        // sendResponse({ status: 1 }); // succeed
    }
);


/// Class for storing information of tabs.
// It maintains time information and window information
// You can get the tab by using chrome.tabs.get(tabInfo.getTabId());
class TabInfo {
    constructor(tab) {
        this.tab = tab;
        // this.tab_id = tab_id;
        // this.window_id = window_id;
        this.lastDeactivatedTime = getUnixTime();
        this.lastActivatedTime = getUnixTime();
    }

    // Getters
    getTabId() {
        return this.tab.id;
    }

    getWindowId() {
        return this.tab.windowId;
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

function removeTabFromList(tab_id) {
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
        // chrome.storage.sync.get(["threshold1", "threshold2"], function (items) {
        //     THRESHOLD[0] = items["threshold1"];
        //     THRESHOLD[1] = items["threshold2"];
        // });
        // console.log("initial thresholds are: " + THRESHOLD[0] + ", " + THRESHOLD[1]);
        // Check the tabs periodically 

    }
);

setInterval(() => {
    if (currentActiveTab !== undefined) {
        // let [t] = getTabFromList(currentActiveTab.tabId, currentActiveTab.windowId);
        // if (t !== undefined)
        //     t.setLastActivatedTime();
        regroup();
    }
}, ALARM_INTERVAL);

chrome.tabs.onActivated.addListener(
    async (chrome_tab_info) => {
        if (currentActiveTab === undefined) {
            currentActiveTab = chrome_tab_info;
        }

        let [t] = getTabFromList(currentActiveTab.tabId, currentActiveTab.windowId);
        // console.log(t);
        // console.log(tabInfoList);
        // console.log(currentActiveTab);
        console.log(t.getActiveTime());
        if (t !== undefined)
            if (t.getActiveTime() > SKIP_THRESHOLD)
                t.setLastDeactivatedTime();

        currentActiveTab = chrome_tab_info;

        let [t2] = getTabFromList(currentActiveTab.tabId, currentActiveTab.windowId);
        // console.log(t2);
        // console.log(tabInfoList);
        // console.log(currentActiveTab);
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
        var tabInfo = new TabInfo(tab);
        tabInfoList.push(tabInfo);
    }
);

//delete tab from list
chrome.tabs.onRemoved.addListener(
    async (tab_id, info) => {
        var current_date = new Date();
        tabInfoList = removeTabFromList(tab_id);
    }
);




/// Main Logic

// Return two tab lists satisfying thresholds
function getTabListsByTime() {
    let firstStage = [];
    let secondStage = [];

    // Compare tab's idle time and threshold
    for (const tab of tabInfoList) {
        if (tab.getTabId() == currentActiveTab.tabId) {
            // console.log(tab.getActiveTime());
        }
        if (tab.getTabId() == currentActiveTab.tabId)
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
        tab_list.sort(function (a, b) {
            return a.windowId - b.windowId;
        });


        var tmp_list = [];
        for (let i = 0; i < tab_list.length; i++) {
            tmp_list.push(tab_list[i]);

            if (i == tab_list.length - 1 || tab_list[i].windowId != tab_list[i + 1].windowId) {
                var all_list = groupAdjacentTIDs(tmp_list);
                var winid = tmp_list[0].windowId;
                for (var tabb of tmp_list) {
                    if (tabb.windowId != winid) console.log("false!!!!!");
                }

                if (all_list.length == 0) return;

                for (const tid_list of all_list) {
                    group(tid_list, elapsed_time, winid);
                }
                tmp_list = [];
            }

        }
    });
}

// Wrapper of chrome.tabs.group
async function group(tid_list, elapsed_time, window_id) {
    chrome.tabs.group({ createProperties: { windowId: window_id }, tabIds: tid_list }).catch((e) => setTimeout(() => group(tid_list, elapsed_time, window_id), TIMEOUT)).then((gid) => {
        if (gid === undefined)
            return;
        // console.log(gid);
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