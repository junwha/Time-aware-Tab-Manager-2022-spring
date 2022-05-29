// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const DEBUG = false;
const ALARM_INTERVAL = 1; // Threshold for update groups (minute)
const THRESHOLD = [5, 60]; // Threshold for first and second stage (minute)
const SKIP_THRESHOLD = 2000; // Threshold for removing current visiting tab from target (milliseconds)
const MAX_TRIAL = 3;
// Constants
const TIMEOUT = 100;
const MIN_TO_MS = DEBUG ? 1000 : 60 * 1000;

let currentActiveTab;
let tabInfoMap = new Map();
let targetGroupIDs = [];

///
/// Message passing with popup.js
///
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.type == 0) { // Close tabs
            let tabAllList = getTabListsByTime();

            var tabIdList = [];

            for (const tab_info of tabAllList[request.level]) {
                tabIdList.push(tab_info.getTabId());
            }

            remove(tabIdList);
            console.log("closed");
        } else if (request.type == 1) { // Update thresholds
            console.log(request);
            THRESHOLD[0] = request.thresholds[0];
            THRESHOLD[1] = request.thresholds[1];
        } else if (request.type == 2) {
            sendFavIcons(sendResponse);
            regroup();
            return true;
        } else {
            console.log(request);
            sendResponse({ status: 0 }); // failed
        }
        if (request.type != 2)
            sendResponse({ status: 1 }); // succeed
    }
);

// Send fav icons
async function sendFavIcons(sendResponse) {
    let twoLevelInfo = getTabListsByTime();
    console.log("Background will send response");

    var prom_lists = [[], []];
    console.log(twoLevelInfo);

    for (var i = 0; i < 2; i++) {
        for (var j = 0; j < twoLevelInfo[i].length; j++) {
            if (j > 8) break;
            prom_lists[i].push(chrome.tabs.get(twoLevelInfo[i][j].getTabId()));
        }
    }

    var twoLevelFavIcons = [[], []];

    for (var i = 0; i < 2; i++) {
        var tabList = await Promise.all(prom_lists[i]);
        for (var tab of tabList) {
            console.log(tab.favIconUrl);
            if (tab.favIconUrl != "") {
                twoLevelFavIcons[i].push(tab.favIconUrl);
            } else {
                twoLevelFavIcons[i].push("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/1920px-Google_Chrome_icon_%28February_2022%29.svg.png");
            }

        }
    }
    console.log("Send response!");
    sendResponse({
        status: twoLevelFavIcons[0].length > 0 || twoLevelFavIcons[1].length > 0,
        tab_info: {
            first: twoLevelFavIcons[0],
            second: twoLevelFavIcons[1]
        }
    });
}

/// Class for storing information of tabs.
// It maintains time information and window information
// You can get the tab by using chrome.tabs.get(tabInfo.getTabId());
class TabInfo {
    constructor(tab) {
        console.log("[DEBUG] new tab information is created: " + tab.title);
        this.tab = tab;
        // this.tab_id = tab_id;
        // this.windowId = windowId;
        this.lastDeactivatedTime = getUnixTime();
        this.lastActivatedTime = getUnixTime();
        this.isWhiteList = false;
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
    isInWhiteList() {
        return this.isWhiteList;
    }

    // Setters
    setLastDeactivatedTime() {
        this.lastDeactivatedTime = getUnixTime();
    }

    setLastActivatedTime() {
        this.lastActivatedTime = getUnixTime();
    }
    setTab(tab) {
        this.tab = tab;
    }
    setWhiteList(flag) {
        this.isWhiteList = flag;
    }
}

// class TabInfoList { // @Singleton object
//     constructor() {
//         chrome.storage.local.set({ "tab_info_list": [] });
//     }
//     push(elem) {
//         chrome.storage.local.get(["tab_info_list"], function (items) {
//             temp_list = items["tab_info_list"];
//             temp_list.push(elem);
//             chrome.storage.local.set({ "tab_info_list": temp_list });
//         });
//     }

//     filter() {
//         chrome.storage.local.get(["tab_info_list"], function (items) {
//             temp_list = items["tab_info_list"];
//             temp_list.push(elem);
//             chrome.storage.sync.set({ "tab_info_list": temp_list });
//         });
//     }
// }

/// Utils

function getUnixTime() {
    return Math.floor(new Date().getTime());
}

function removeTabFromList(tab_id) {
    tabInfoMap.delete(tab_id);
}

function getTabFromMap(tab_id) {
    return tabInfoMap.get(tab_id);
}

/// Listeners 

function init_extension() {
    chrome.alarms.create(
        "tab_timer",
        { periodInMinutes: ALARM_INTERVAL },
    );

    chrome.tabs.query({}).then((tabs) => {
        for (var tab of tabs) {
            tabInfoMap[tab.id] = new TabInfo(tab);
        }
    });

    chrome.storage.sync.set({ "tab_info_map": tabInfoMap });

    console.log("[DEBUG] Initial tabs are added into info map");
    console.log(tabInfoMap);
}
// Listen for installation 
chrome.runtime.onInstalled.addListener((details) => {
    // Initialize periodical timer
    init_extension();
    chrome.storage.sync.set({ "threshold1": THRESHOLD[0], "threshold2": THRESHOLD[1] }); // Initial thresholds

});

// When chrome is newly loaded
chrome.runtime.onStartup.addListener(
    async () => {
        // Initialize periodical timer
        init_extension();

        // Restore thresholds from storage (popup.js has saved the values)
        chrome.storage.sync.get(["threshold1", "threshold2"], function (items) {
            THRESHOLD[0] = items["threshold1"];
            THRESHOLD[1] = items["threshold2"];
        });

        chrome.runtime.connect();

        console.log("[DEBUG] initial thresholds are: " + THRESHOLD[0] + ", " + THRESHOLD[1]);
    }
);

// Periodically update tab groups
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log("[DEBUG] checking on interval ... ");
    console.log(tabInfoMap);

    // restore
    if (currentActiveTab !== undefined) regroup(); // if current tab is null, we don't need to regroup yet
});

// Update tab groups when active tab is changed
chrome.tabs.onActivated.addListener(
    async (chrome_tab_info) => {
        // Initialize
        if (currentActiveTab === undefined) {
            currentActiveTab = chrome_tab_info;
        }

        let t = getTabFromMap(currentActiveTab.tabId); // Last activated tab

        if (t !== undefined) {
            if (t.getActiveTime() > SKIP_THRESHOLD)
                t.setLastDeactivatedTime();
            chrome.tabs.get(t.getTabId()).then((tab) => {
                console.log("[DEBUG] latest tab: " + tab.title);
                t.setTab(tab);
            });
        }
        currentActiveTab = chrome_tab_info; // Update active tab as current active tab

        let t2 = getTabFromMap(currentActiveTab.tabId); // Newly activated tab

        if (t2 !== undefined) {
            t2.setLastActivatedTime();
            chrome.tabs.get(t2.getTabId()).then((tab) => {
                console.log("[DEBUG] current tab: " + tab.title);
                t2.setTab(tab);
            });
        }

        regroup();
    }
);

///
/// Chrome tab group Listeners
///
function isTargetGroup(gid) {
    return (targetGroupIDs.filter(id => gid == id).length != 0);
}

function markTabsInGroup(gid, mark) {
    chrome.tabs.query({ groupId: gid }).then(
        (tabs) => {
            for (var tab of tabs) {
                var tabInfo = tabInfoMap.get(tab.id);
                tabInfo.setWhiteList(mark);
                console.log("[DEBUG] this tab is set to or remove from white list: " + tabInfo.tab.title);
                console.log(mark);
            }
        }
    );
}

chrome.tabGroups.onCreated.addListener((tabGroup) => {
    if (!isTargetGroup(tabGroup.id)) {
        console.log("[DEBUG] this group isn't target group (white list): " + tabGroup.title);
        markTabsInGroup(tabGroup.id, true);
    }
}
);

chrome.tabGroups.onRemoved.addListener((tabGroup) => {
    markTabsInGroup(tabGroup.id, false);
}
);

chrome.tabGroups.onUpdated.addListener((tabGroup) => {
    if (!isTargetGroup(tabGroup.id)) {
        console.log("[DEBUG] this group isn't target group (white list): " + tabGroup.title);
        markTabsInGroup(tabGroup.id, true);
    }
}
);

chrome.tabGroups.onMoved.addListener((tabGroup) => {
    console.log("[DEBUG] tabgroup moved");
}
);
// chrome.runtime.onUpdateAvailable.addListener(async () => {
//     chrome.runtime.reload();
// });

// Add tab into map
chrome.tabs.onCreated.addListener(
    async (tab) => {
        var tabInfo = new TabInfo(tab);
        tabInfoMap.set(tabInfo.getTabId(), tabInfo);
    }
);

// Remove tab info from from map
chrome.tabs.onRemoved.addListener(
    async (tab_id, info) => {
        var current_date = new Date();
        removeTabFromList(tab_id);
    }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo["groupId"] == undefined || isTargetGroup(changeInfo["groupId"])) {
        console.log("[DEBUG] this tab is removed from white list: " + tabId);
        console.log(tabInfoMap);
        tabInfoMap.get(tabId).setWhiteList(false);
    } else {
        console.log("[DEBUG] this tab is added into white list: " + tabId);
        console.log(tabInfoMap);
        tabInfoMap.get(tabId).setWhiteList(true);

    }
});



/// Main Logic

// Return two tab lists satisfying thresholds
function getTabListsByTime() {
    let firstStage = [];
    let secondStage = [];

    // Compare tab's idle time and threshold
    for (const tab of tabInfoMap.values()) {
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
    if (tabInfoMap.size == 0)
        return;

    var tabIdList = [];

    for (const t of tabInfoMap.values()) {
        if (!t.isInWhiteList()) // Check if the tab is in white list
            tabIdList.push(t.getTabId());
        else
            console.log("[DEBUG] this tab is in white list: " + t.tab.title);
    }

    targetGroupIDs = []; // untrack all (we already checked)

    ungroup(tabIdList, 1);
}

// Wrapper of chrome.tabs.ungroup
async function ungroup(tabIdList, trial) {
    try {
        if (trial <= MAX_TRIAL) {
            chrome.tabs.ungroup(tabIdList).catch((e) => {

                setTimeout(
                    () => ungroup(tabIdList, trial),
                    TIMEOUT
                );

            });
        }
    } catch {
        console.log("[DEBUG] Promise error on ungroup");
        return;
    }
}

// Wrapper of chrome.tabs.remove
function remove(tabIdList) {
    chrome.tabs.remove(tabIdList).catch((e) => {
        setTimeout(
            () => remove(tabIdList),
            TIMEOUT
        );
    });
}

// This function returns two-dimension array,
// each array is the tabs which are adjacent
function groupAdjacentTIDs(tabList) {
    if (tabList.length == 0) return [];

    var allList = new Array();

    tabList.sort(function (a, b) {
        return a.index - b.index;
    });

    var lastIndex = tabList[0].index - 1;
    var eachList = new Array();

    for (const tab of tabList) {
        if (tab.index - 1 != lastIndex) {
            allList.push(eachList);
            eachList = new Array();
        }

        eachList.push(tab.id);
        lastIndex = tab.index;
    }

    if (eachList.length != 0) allList.push(eachList);

    return allList;
}

// Group all tabs
async function groupTabs(tabInfoList, elapsedTime) {
    if (tabInfoList.length == 0)
        return;
    var promList = [];

    var filteredTabInfoList = tabInfoList.filter(info => !info.isInWhiteList());

    for (const tabInfo of filteredTabInfoList) {
        promList.push(chrome.tabs.get(tabInfo.getTabId()));
    }

    Promise.all(promList).then((tabList) => {
        tabList.sort(function (a, b) {
            return a.windowId - b.windowId;
        });


        var tmpList = [];
        for (let i = 0; i < tabList.length; i++) {
            tmpList.push(tabList[i]);

            if (i == tabList.length - 1 || tabList[i].windowId != tabList[i + 1].windowId) {
                var allList = groupAdjacentTIDs(tmpList);
                var windowId = tmpList[0].windowId;
                for (var tab of tmpList) {
                    if (tab.windowId != windowId) console.log("false!!!!!");
                }

                if (allList.length == 0) return;

                for (const tidList of allList) {
                    group(tidList, elapsedTime, windowId, 1);
                }
                tmpList = [];
            }

        }
    });
}

// Wrapper of chrome.tabs.group
async function group(tidList, elapsedTime, windowId, trial) {
    try {
        if (trial <= MAX_TRIAL) {
            chrome.tabs.group({ createProperties: { windowId: windowId }, tabIds: tidList }).catch((e) => setTimeout(() => group(tidList, elapsedTime, windowId, trial + 1), TIMEOUT)).then((gid) => {
                if (gid === undefined)
                    return;
                // console.log(gid);
                var _color, _timeInfo;

                if (parseInt(elapsedTime) >= parseInt(THRESHOLD[1])) {
                    _timeInfo = `${THRESHOLD[1]}m`;
                    _color = "red";
                } else if (parseInt(elapsedTime) >= parseInt(THRESHOLD[0])) {
                    _timeInfo = `${THRESHOLD[0]}m`;
                    _color = "yellow";
                } else {
                    return;
                }

                targetGroupIDs.push(gid); // tracking our target groups

                var p = chrome.tabGroups.update(gid, {
                    color: _color,
                    title: _timeInfo
                });
                p.catch((e) => console.log("[Exception] no group"));
            });
        }
    } catch {
        console.log("[DEBUG] Promise error on group");
        return;
    }
}


