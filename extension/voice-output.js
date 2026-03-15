/**
 * Voice output: Read aloud the last assistant message using SpeechSynthesis.
 * Strips markdown and formats text so it makes sense when spoken.
 */
(function () {
  const readAloudBtn = document.getElementById('read-aloud-btn');
  const messagesEl = document.getElementById('messages');

  if (!readAloudBtn || !messagesEl) return;

  function getTextForSpeech(node) {
    if (!node) return '';
    var text = node.textContent || '';
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    return text;
  }

  function getLastAssistantMessage() {
    var lastBubble = messagesEl.querySelector('.message.assistant:last-of-type .bubble');
    if (lastBubble) return getTextForSpeech(lastBubble);
    var byRole = messagesEl.querySelectorAll('.message.assistant .bubble');
    if (byRole.length) return getTextForSpeech(byRole[byRole.length - 1]);
    var anyBubble = messagesEl.querySelector('.message .bubble');
    if (anyBubble) return getTextForSpeech(anyBubble);
    return getTextForSpeech(messagesEl);
  }

  function showStatus(msg) {
    var el = document.getElementById('status');
    if (el) el.textContent = msg;
  }

  var synth = window.speechSynthesis;
  var utterance = null;

  function stopSpeaking() {
    if (synth && synth.speaking) {
      synth.cancel();
    }
    utterance = null;
    readAloudBtn.classList.remove('speaking');
    readAloudBtn.setAttribute('aria-label', 'Read last response aloud');
  }

  readAloudBtn.addEventListener('click', function () {
    if (!synth) {
      showStatus('Text-to-speech not supported in this browser.');
      return;
    }
    if (synth.speaking) {
      stopSpeaking();
      showStatus('');
      return;
    }
    var text = getLastAssistantMessage();
    if (!text || text.length < 2) {
      readAloudBtn.setAttribute('aria-label', 'No response to read');
      showStatus('No response to read. Send a message and get a reply first.');
      return;
    }
    if (text.length > 4000) {
      text = text.slice(0, 4000) + '. End of excerpt.';
    }
    utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    readAloudBtn.classList.add('speaking');
    readAloudBtn.setAttribute('aria-label', 'Stop reading');
    utterance.onend = function () {
      readAloudBtn.classList.remove('speaking');
      readAloudBtn.setAttribute('aria-label', 'Read last response aloud');
      showStatus('');
    };
    utterance.onerror = function () {
      readAloudBtn.classList.remove('speaking');
      readAloudBtn.setAttribute('aria-label', 'Read last response aloud');
      showStatus('Could not read aloud. Try again.');
    };
    showStatus('Reading aloud…');
    synth.speak(utterance);
  });

  if (synth) {
    window.addEventListener('beforeunload', stopSpeaking);
  }
})();
