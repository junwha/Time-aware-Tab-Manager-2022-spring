// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

const global_tab_queue = new Set();
const waiting_queue = new Set();

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
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

//add tab into 
chrome.tabs.onCreated.addListener(
  async (tab) => {
    console.log('tab created '+tab.index);
    var current_date = new Date();
    console.log('created time');
    console.log(current_date);
    global_tab_queue.add(tab);
  }
);

//delete tab from list
chrome.tabs.onRemoved.addListener(
  async (tab) => {
    console.log('tab deleted ' + tab.index);
    var current_date = new Date();
    console.log('deleted time');
    console.log(current_date);
    global_tab_queue.delete(tab);
  }
);