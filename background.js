'use strict';

importScripts('api.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'dusie-root',
      title: chrome.i18n.getMessage('contextMenuRoot'),
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dusie-to-sie',
      parentId: 'dusie-root',
      title: chrome.i18n.getMessage('contextMenuToSie'),
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dusie-to-du',
      parentId: 'dusie-root',
      title: chrome.i18n.getMessage('contextMenuToDu'),
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId !== 'dusie-to-sie' && info.menuItemId !== 'dusie-to-du') return;

  const selectedText = info.selectionText;
  if (!selectedText || !selectedText.trim()) return;

  const mode = info.menuItemId === 'dusie-to-sie' ? 'du_to_sie' : 'sie_to_du';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (_) {
  }

  await delay(100);

  sendToTab(tab.id, { action: 'showLoading', mode });

  let storageData;
  try {
    storageData = await chrome.storage.local.get(['apiKey', 'toneIntensity']);
  } catch (_) {
    sendToTab(tab.id, {
      action: 'showError',
      error: chrome.i18n.getMessage('errorUnknown'),
      mode,
      originalText: selectedText
    });
    return;
  }

  const apiKey = storageData.apiKey || '';
  const intensity = storageData.toneIntensity || 'standard';

  if (!apiKey) {
    sendToTab(tab.id, {
      action: 'showError',
      error: chrome.i18n.getMessage('errorNoKey'),
      mode,
      originalText: selectedText
    });
    return;
  }

  try {
    const convertedText = await callDuSieAPIOnce({
      text: selectedText,
      mode,
      intensity,
      apiKey
    });
    sendToTab(tab.id, {
      action: 'showResult',
      convertedText,
      mode,
      originalText: selectedText
    });
  } catch (err) {
    const errorKey = (err && err.message) ? err.message : 'errorUnknown';
    const errorMsg = chrome.i18n.getMessage(errorKey) || chrome.i18n.getMessage('errorUnknown');
    sendToTab(tab.id, {
      action: 'showError',
      error: errorMsg,
      mode,
      originalText: selectedText
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    chrome.windows.getCurrent({}, (win) => {
      chrome.sidePanel.open({ windowId: win.id }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) { }
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
