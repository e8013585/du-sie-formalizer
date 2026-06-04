(function () {
  'use strict';

  const uiLang = chrome.i18n.getUILanguage().toLowerCase().split('-')[0];
  const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
  if (RTL_LANGS.includes(uiLang)) {
    document.body.setAttribute('dir', 'rtl');
  }

  function t(key, subs) {
    if (subs) return chrome.i18n.getMessage(key, subs);
    return chrome.i18n.getMessage(key) || key;
  }

  const $ = id => document.getElementById(id);

  const els = {
    headerTitle:         $('headerTitle'),
    settingsToggle:      $('settingsToggle'),
    settingsPanel:       $('settingsPanel'),
    apiKeyLabel:         $('apiKeyLabel'),
    apiKeyInput:         $('apiKeyInput'),
    showHideKey:         $('showHideKey'),
    keyStatusBadge:      $('keyStatusBadge'),
    saveKeyBtn:          $('saveKeyBtn'),
    testKeyBtn:          $('testKeyBtn'),
    testKeyResult:       $('testKeyResult'),
    keySavedConfirm:     $('keySavedConfirm'),
    modelLabel:          $('modelLabel'),
    modelDisplay:        $('modelDisplay'),
    toneIntensityLabel:  $('toneIntensityLabel'),
    toneIntensitySelect: $('toneIntensitySelect'),
    optStandard:         $('optStandard'),
    optPolished:         $('optPolished'),
    optStrictCorporate:  $('optStrictCorporate'),
    modeDuToSie:         $('modeDuToSie'),
    modeSieToDu:         $('modeSieToDu'),
    noKeyWarning:        $('noKeyWarning'),
    noKeyWarningText:    $('noKeyWarningText'),
    noKeyWarningLink:    $('noKeyWarningLink'),
    notGermanWarning:    $('notGermanWarning'),
    notGermanWarningText:$('notGermanWarningText'),
    inputLabel:          $('inputLabel'),
    inputTextarea:       $('inputTextarea'),
    inputCharCount:      $('inputCharCount'),
    convertBtn:          $('convertBtn'),
    outputLabel:         $('outputLabel'),
    outputTextarea:      $('outputTextarea'),
    outputCharCount:     $('outputCharCount'),
    copyBtn:             $('copyBtn'),
    clearBtn:            $('clearBtn'),
    openSidePanelBtn:    $('openSidePanelBtn'),
  };

  let currentMode = 'du_to_sie';
  let currentIntensity = 'standard';
  let apiKey = '';
  let isConverting = false;
  let activeAbortController = null;
  let settingsOpen = false;

  function localizeUI() {
    els.headerTitle.textContent         = t('extensionName');
    els.settingsToggle.setAttribute('aria-label', t('ariaSettingsToggle'));
    els.settingsToggle.title            = t('settingsTitle');
    els.apiKeyLabel.textContent         = t('apiKeyLabel');
    els.apiKeyInput.placeholder         = t('apiKeyPlaceholder');
    els.showHideKey.textContent         = t('showKeyButton');
    els.showHideKey.setAttribute('aria-label', t('ariaShowPassword'));
    els.saveKeyBtn.textContent          = t('saveKeyButton');
    els.testKeyBtn.textContent          = t('testKeyButton');
    els.modelLabel.textContent          = t('modelLabel');
    els.modelDisplay.textContent        = t('modelValue');
    els.toneIntensityLabel.textContent  = t('toneIntensityLabel');
    els.optStandard.textContent         = t('toneStandard');
    els.optPolished.textContent         = t('tonePolished');
    els.optStrictCorporate.textContent  = t('toneStrictCorporate');
    els.modeDuToSie.textContent         = t('modeToggleDuToSie');
    els.modeSieToDu.textContent         = t('modeToggleSieToDu');
    els.modeDuToSie.setAttribute('aria-label', t('modeToggleDuToSie'));
    els.modeSieToDu.setAttribute('aria-label', t('modeToggleSieToDu'));
    els.noKeyWarningText.textContent    = t('noApiKeyWarning');
    els.noKeyWarningLink.textContent    = t('noApiKeyWarningLink');
    els.notGermanWarningText.textContent= t('mayNotBeGermanWarning');
    els.inputLabel.textContent          = t('inputLabel');
    els.inputTextarea.placeholder       = t('inputPlaceholder');
    els.convertBtn.textContent          = t('convertButton');
    els.convertBtn.setAttribute('aria-label', t('ariaConvertButton'));
    els.outputLabel.textContent         = t('outputLabel');
    els.outputTextarea.placeholder      = t('outputPlaceholder');
    els.copyBtn.textContent             = t('copyButton');
    els.copyBtn.setAttribute('aria-label', t('ariaCopyOutput'));
    els.clearBtn.textContent            = t('clearButton');
    els.clearBtn.setAttribute('aria-label', t('ariaClearAll'));
    els.openSidePanelBtn.textContent    = t('openSidePanelButton');
    els.openSidePanelBtn.setAttribute('aria-label', t('ariaOpenSidePanel'));
    updateCharCount(els.inputTextarea, els.inputCharCount);
    updateCharCount(els.outputTextarea, els.outputCharCount);
  }

  function updateCharCount(textarea, countEl) {
    const n = textarea.value.length;
    countEl.textContent = t('charactersCount', [String(n)]);
  }

  function setMode(mode) {
    currentMode = mode;
    els.modeDuToSie.classList.toggle('active', mode === 'du_to_sie');
    els.modeSieToDu.classList.toggle('active', mode === 'sie_to_du');
    chrome.storage.local.set({ conversionMode: mode });
  }

  function updateKeyBadge(hasKey) {
    if (hasKey) {
      els.keyStatusBadge.textContent = '✅';
      els.keyStatusBadge.title = t('keyStatusPresent');
    } else {
      els.keyStatusBadge.textContent = '❌';
      els.keyStatusBadge.title = t('keyStatusMissing');
    }
  }

  function updateNoKeyWarning() {
    const show = !apiKey;
    els.noKeyWarning.hidden = !show;
    updateConvertBtn();
  }

  function updateConvertBtn() {
    const hasInput = els.inputTextarea.value.trim().length > 0;
    const hasKey = !!apiKey;
    els.convertBtn.disabled = !hasInput || !hasKey || isConverting;
  }

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    els.settingsPanel.hidden = !settingsOpen;
  }

  function toggleShowHideKey() {
    const isPassword = els.apiKeyInput.type === 'password';
    els.apiKeyInput.type = isPassword ? 'text' : 'password';
    els.showHideKey.textContent = isPassword ? t('hideKeyButton') : t('showKeyButton');
    els.showHideKey.setAttribute('aria-label', isPassword ? t('ariaHidePassword') : t('ariaShowPassword'));
  }

  function saveApiKey() {
    const val = els.apiKeyInput.value.trim();
    if (!val) return;
    apiKey = val;
    chrome.storage.local.set({ apiKey: val }, () => {
      updateKeyBadge(true);
      updateNoKeyWarning();
      const masked = val.slice(0, 8) + '...';
      els.keySavedConfirm.textContent = t('keySavedConfirm') + ' ' + masked;
      setTimeout(() => { els.keySavedConfirm.textContent = ''; }, 3000);
    });
  }

  function testApiKey() {
    const keyToTest = els.apiKeyInput.value.trim() || apiKey;
    if (!keyToTest) {
      showTestResult('invalid');
      return;
    }
    els.testKeyResult.textContent = t('testKeyTesting');
    els.testKeyResult.className = 'test-key-result';
    els.testKeyBtn.disabled = true;

    window.callDuSieAPI({
      text: 'Hallo, wie geht es dir?',
      mode: 'du_to_sie',
      intensity: 'standard',
      apiKey: keyToTest,
      onChunk: () => {},
      onDone: () => {
        showTestResult('valid');
        els.testKeyBtn.disabled = false;
      },
      onError: () => {
        showTestResult('invalid');
        els.testKeyBtn.disabled = false;
      }
    });
  }

  function showTestResult(state) {
    els.testKeyResult.textContent = state === 'valid' ? t('testKeyValid') : t('testKeyInvalid');
    els.testKeyResult.className = 'test-key-result ' + state;
    setTimeout(() => {
      els.testKeyResult.textContent = '';
      els.testKeyResult.className = 'test-key-result';
    }, 4000);
  }

  function startConversion() {
    if (isConverting) {
      if (activeAbortController) activeAbortController.abort();
      return;
    }
    const inputText = els.inputTextarea.value.trim();
    if (!inputText || !apiKey) return;

    isConverting = true;
    els.convertBtn.textContent = t('converting');
    els.convertBtn.disabled = true;
    els.outputTextarea.value = '';
    updateCharCount(els.outputTextarea, els.outputCharCount);
    els.notGermanWarning.hidden = true;

    let fullText = '';

    activeAbortController = window.callDuSieAPI({
      text: inputText,
      mode: currentMode,
      intensity: currentIntensity,
      apiKey,
      onChunk: (chunk) => {
        fullText += chunk;
        els.outputTextarea.value = fullText;
        els.outputTextarea.scrollTop = els.outputTextarea.scrollHeight;
        updateCharCount(els.outputTextarea, els.outputCharCount);
      },
      onDone: (result) => {
        els.outputTextarea.value = result;
        updateCharCount(els.outputTextarea, els.outputCharCount);
        finishConversion();
      },
      onError: (errMsg) => {
        els.outputTextarea.value = errMsg;
        updateCharCount(els.outputTextarea, els.outputCharCount);
        finishConversion();
      },
      onNotGerman: () => {
        els.notGermanWarning.hidden = false;
      }
    });
  }

  function finishConversion() {
    isConverting = false;
    activeAbortController = null;
    els.convertBtn.textContent = t('convertButton');
    updateConvertBtn();
  }

  function copyOutput() {
    const val = els.outputTextarea.value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      els.copyBtn.textContent = t('copiedButton');
      setTimeout(() => { els.copyBtn.textContent = t('copyButton'); }, 1500);
    }).catch(() => {});
  }

  function clearAll() {
    if (isConverting && activeAbortController) {
      activeAbortController.abort();
      finishConversion();
    }
    els.inputTextarea.value = '';
    els.outputTextarea.value = '';
    els.notGermanWarning.hidden = true;
    updateCharCount(els.inputTextarea, els.inputCharCount);
    updateCharCount(els.outputTextarea, els.outputCharCount);
    updateConvertBtn();
  }

  function openSidePanel() {
    chrome.storage.session.set({
      sidePanelInput: els.inputTextarea.value,
      sidePanelOutput: els.outputTextarea.value,
      sidePanelMode: currentMode,
      sidePanelIntensity: currentIntensity
    }, () => {
      chrome.runtime.sendMessage({ action: 'openSidePanel' }, () => {
        window.close();
      });
    });
  }

  function onIntensityChange() {
    currentIntensity = els.toneIntensitySelect.value;
    chrome.storage.local.set({ toneIntensity: currentIntensity });
  }

  els.inputTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!els.convertBtn.disabled) startConversion();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = els.inputTextarea.selectionStart;
      const end = els.inputTextarea.selectionEnd;
      const val = els.inputTextarea.value;
      els.inputTextarea.value = val.slice(0, start) + '\t' + val.slice(end);
      els.inputTextarea.selectionStart = els.inputTextarea.selectionEnd = start + 1;
      updateCharCount(els.inputTextarea, els.inputCharCount);
      updateConvertBtn();
    }
  });

  els.settingsToggle.addEventListener('click', toggleSettings);
  els.showHideKey.addEventListener('click', toggleShowHideKey);
  els.saveKeyBtn.addEventListener('click', saveApiKey);
  els.testKeyBtn.addEventListener('click', testApiKey);
  els.modeDuToSie.addEventListener('click', () => setMode('du_to_sie'));
  els.modeSieToDu.addEventListener('click', () => setMode('sie_to_du'));
  els.noKeyWarningLink.addEventListener('click', () => {
    if (!settingsOpen) toggleSettings();
    els.apiKeyInput.focus();
  });
  els.convertBtn.addEventListener('click', startConversion);
  els.copyBtn.addEventListener('click', copyOutput);
  els.clearBtn.addEventListener('click', clearAll);
  els.openSidePanelBtn.addEventListener('click', openSidePanel);
  els.toneIntensitySelect.addEventListener('change', onIntensityChange);
  els.inputTextarea.addEventListener('input', () => {
    updateCharCount(els.inputTextarea, els.inputCharCount);
    updateConvertBtn();
  });

  function init() {
    localizeUI();

    chrome.storage.local.get(['apiKey', 'conversionMode', 'toneIntensity'], (data) => {
      apiKey = data.apiKey || '';
      currentMode = data.conversionMode || 'du_to_sie';
      currentIntensity = data.toneIntensity || 'standard';

      setMode(currentMode);
      els.toneIntensitySelect.value = currentIntensity;
      updateKeyBadge(!!apiKey);
      updateNoKeyWarning();

      if (apiKey) {
        els.apiKeyInput.value = apiKey;
      }

      updateConvertBtn();
    });
  }

  init();

})();
