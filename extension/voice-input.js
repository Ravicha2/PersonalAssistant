/**
 * Voice input: Speech-to-text via Web Speech API, fills the message input.
 */
(function () {
  function getEl(id) { return document.getElementById(id); }
  const inputEl = getEl('input');
  const voiceBtn = getEl('voice-input-btn');
  const preferVoiceCheckbox = getEl('prefer-voice-response');

  if (!inputEl || !voiceBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.setAttribute('title', 'Voice input not supported in this browser');
    voiceBtn.setAttribute('aria-label', 'Voice input not supported');
    voiceBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  var isListening = false;

  function setListening(flag) {
    isListening = flag;
    voiceBtn.classList.toggle('listening', flag);
    voiceBtn.setAttribute('aria-label', flag ? 'Listening… Click to stop' : 'Voice input (speak your message)');
  }

  function showStatus(msg) {
    var status = getEl('status');
    if (status) status.textContent = msg;
  }

  function appendToInput(text) {
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    const before = inputEl.value.slice(0, start);
    const after = inputEl.value.slice(end);
    const newVal = before + (before && !/[\s,.]$/.test(before) ? ' ' : '') + text + after;
    inputEl.value = newVal;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.selectionStart = inputEl.selectionEnd = before.length + (before && !/[\s,.]$/.test(before) ? 1 : 0) + text.length;
  }

  function startListening() {
    setListening(true);
    showStatus('Listening… Speak now. Click mic again to stop.');
    try {
      recognition.start();
    } catch (err) {
      setListening(false);
      showStatus('Voice error: ' + (err.message || 'Could not start. Allow microphone when prompted.'));
    }
  }

  voiceBtn.addEventListener('click', function () {
    if (isListening) {
      try { recognition.stop(); } catch (e) {}
      setListening(false);
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.permissions && chrome.permissions.contains) {
      chrome.permissions.contains({ permissions: ['microphone'] }, function (granted) {
        if (granted) {
          startListening();
        } else if (chrome.permissions.request) {
          chrome.permissions.request({ permissions: ['microphone'] }, function (allowed) {
            if (allowed) startListening();
            else showStatus('Microphone permission is needed for voice input. Allow it in extension settings and try again.');
          });
        } else {
          startListening();
        }
      });
    } else {
      startListening();
    }
  });

  recognition.addEventListener('start', function () {
    if (preferVoiceCheckbox && !preferVoiceCheckbox.checked) {
      preferVoiceCheckbox.checked = true;
    }
  });

  recognition.addEventListener('result', function (e) {
    var final = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      var transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += transcript;
    }
    if (final) appendToInput(final);
  });

  recognition.addEventListener('end', function () {
    setListening(false);
    var st = getEl('status');
    if (st && st.textContent === 'Listening… Speak now. Click mic again to stop.') st.textContent = '';
  });

  recognition.addEventListener('error', function (e) {
    setListening(false);
    var msg = 'Voice: ';
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      msg = 'Microphone denied. Allow mic for this extension (click the puzzle icon → Personal Assistant → allow microphone), then try again.';
    } else if (e.error === 'no-speech') {
      msg = 'No speech heard. Try again.';
    } else if (e.error === 'network') {
      msg = 'Voice needs internet. Check connection and try again.';
    } else {
      msg = 'Voice error: ' + (e.error || 'unknown');
    }
    showStatus(msg);
  });
})();
