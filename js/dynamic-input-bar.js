/**
 * dynamic-input-bar.js
 * Messenger-style Mobile Input Bar for Scheduler
 * Features:
 * - Dynamic Messenger expand/collapse transitions
 * - Web Speech API Voice-to-Text (0 dependencies, 0 API keys)
 * - Curated nurse & Canadian lifestyle/outdoors emoji palette (0 KB weight, 100% offline)
 * - Template strip quick toggler
 * - Seamless Classic vs. Dynamic mode switching
 */

(function () {
  'use strict';

  // --- Curated Emojis tailored for Nurse in Canada (Health, Outdoors, Home, Errands, Church, Social, Work) ---
  const CURATED_EMOJIS = [
    // Row 1: Clinical Essentials, Daily Laundry & Cooking
    '👩‍⚕️', '🩺', '🏥', '📋', '💊', '🌡️', '🧺', '🍳',
    // Row 2: Laptop Charting, Shift Alarm, Rest, Shopping & Canadian Outdoors
    '💻', '⏰', '😴', '🧘', '🛒', '🏔️', '⛰️', '🌊',
    // Row 3: Canadian Outdoors & Chores
    '🥾', '🌲', '🍁', '🏕️', '🛶', '❄️', '⛸️', '⛷️', '🎣', '🌅',
    // Home & Chores
    '🧹', '🧼', '🧽', '👕', '🫧', '🍲', '🥗', '🥘', '🍱', '🪴', '🗑️', '🪟',
    // Errands & Travel
    '🛍️', '🥦', '🍞', '🥩', '🚗', '🚙', '⛽', '✈️', '🧳', '🏖️', '📦',
    // Church & Celebrations
    '⛪', '🙏', '🕯️', '📖', '🎂', '🎈', '🎁', '🎉', '🎄', '🎆', '🥂', '💐', '✝️',
    // Treats & Coffee & Social
    '☕', '🥞', '🍰', '🍦', '🍩', '🍫', '🍪', '🧁', '👥', '💬', '🍹', '🍿', '🍎',
    // Work, Tasks & Focus
    '💼', '📄', '🔍', '🎯', '📌', '✅', '📝', '💡', '🔔', '⭐', '🔥', '❗'
  ];

  let recognitionInstance = null;
  let isVoiceRecording = false;
  let isManualExpanded = false;
  let isEmojiTrayOpen = false;

  // DOM Elements
  let slidingInputView = null;
  let templateTitleSubmitContainer = null;
  let dynamicLeftCluster = null;
  let dynamicCollapsibleTools = null;
  let btnCollapseActions = null;
  let btnToggleTemplateStrip = null;
  let btnVoiceInput = null;
  let btnEmojiPicker = null;
  let dynamicEmojiTray = null;
  let emojiGridContainer = null;
  let titleSubmitContainer = null;
  let taskTitle = null;
  let flowerContainer = null;
  let submitTask = null;
  let selectedTaskCounter = null;
  let addTaskWrapper = null;

  function cacheDomElements() {
    slidingInputView = document.getElementById('slidingInputView');
    templateTitleSubmitContainer = document.getElementById('templateTitleSubmitContainer');
    dynamicLeftCluster = document.getElementById('dynamicLeftCluster');
    dynamicCollapsibleTools = document.getElementById('dynamicCollapsibleTools');
    btnCollapseActions = document.getElementById('btnCollapseActions');
    btnToggleTemplateStrip = document.getElementById('btnToggleTemplateStrip');
    btnVoiceInput = document.getElementById('btnVoiceInput');
    btnEmojiPicker = document.getElementById('btnEmojiPicker');
    dynamicEmojiTray = document.getElementById('dynamicEmojiTray');
    emojiGridContainer = document.getElementById('emojiGridContainer');
    titleSubmitContainer = document.getElementById('titleSubmitContainer');
    taskTitle = document.getElementById('taskTitle');
    flowerContainer = document.querySelector('.flower-container');
    submitTask = document.getElementById('submitTask');
    selectedTaskCounter = document.querySelector('.selected-task');
    addTaskWrapper = document.querySelector('.add-task-wrapper');
  }

  // --- Voice-to-Text (Native Web Speech API - Cursor-Anchored Insertion) ---
  let voicePrefixText = '';
  let voiceSuffixText = '';
  let lastCursorStart = -1;
  let lastCursorEnd = -1;
  let originalTaskPlaceholder = '';
  let lastVoiceToggleTime = 0;

  function updateSavedCursor() {
    if (taskTitle) {
      if (typeof taskTitle.selectionStart === 'number' && taskTitle.selectionStart >= 0) {
        lastCursorStart = taskTitle.selectionStart;
        lastCursorEnd = taskTitle.selectionEnd;
      }
    }
  }

  function setVoiceRecordingMode(active) {
    if (!slidingInputView) return;
    if (active) {
      slidingInputView.classList.add('voice-recording-mode');
      slidingInputView.classList.remove('actions-collapsed');
    } else {
      slidingInputView.classList.remove('voice-recording-mode');
      updateCollapseLogic();
    }
  }

  // Assemble transcripts cleanly from event.results, preventing browser repetition or interim echoes
  function extractSessionTranscript(results) {
    let finalText = '';
    let interimText = '';

    for (let i = 0; i < results.length; ++i) {
      const res = results[i];
      const text = (res[0] && res[0].transcript) ? res[0].transcript.trim() : '';
      if (!text) continue;

      if (res.isFinal) {
        if (!finalText) {
          finalText = text;
        } else {
          const lowerFinal = finalText.toLowerCase();
          const lowerText = text.toLowerCase();
          // If browser speech recognizer returns cumulative text in subsequent results
          if (lowerText.startsWith(lowerFinal)) {
            finalText = text;
          } else if (lowerFinal.endsWith(lowerText)) {
            // Duplicate echo from browser bug: ignore
          } else {
            finalText += ' ' + text;
          }
        }
      } else {
        // Interim text
        interimText += (interimText ? ' ' : '') + text;
      }
    }

    finalText = finalText.trim();
    interimText = interimText.trim();

    // Deduplicate interim if it echoes or overlaps what was already finalized!
    if (finalText && interimText) {
      const lowerFinal = finalText.toLowerCase();
      const lowerInterim = interimText.toLowerCase();

      if (lowerInterim === lowerFinal || lowerFinal.endsWith(lowerInterim)) {
        // The interim is just an echo of the finalized text
        interimText = '';
      } else if (lowerInterim.startsWith(lowerFinal)) {
        // Interim contains the whole finalized string + new words
        interimText = interimText.slice(finalText.length).trim();
      } else {
        // Check if the last word(s) of finalText match the start of interimText
        const finalWords = finalText.split(/\s+/);
        const interimWords = interimText.split(/\s+/);
        let overlapCount = 0;
        const maxCheck = Math.min(finalWords.length, interimWords.length);
        for (let len = maxCheck; len > 0; len--) {
          const finalTail = finalWords.slice(-len).join(' ').toLowerCase();
          const interimHead = interimWords.slice(0, len).join(' ').toLowerCase();
          if (finalTail === interimHead) {
            overlapCount = len;
            break;
          }
        }
        if (overlapCount > 0) {
          interimText = interimWords.slice(overlapCount).join(' ');
        }
      }
    }

    return {
      finalText,
      interimText
    };
  }

  function combineVoiceText(prefix, suffix, sessionFinal, sessionInterim) {
    let speech = (sessionFinal || '');
    if (sessionInterim) {
      speech += (speech ? ' ' : '') + sessionInterim;
    }
    speech = speech.trim();

    if (!speech) {
      return {
        text: prefix + suffix,
        cursorPos: prefix.length
      };
    }

    // Smart leading space: if prefix exists and does not end with whitespace, insert a space before speech
    const needsLeadSpace = prefix.length > 0 && !/\s$/.test(prefix);
    const leadSpace = needsLeadSpace ? ' ' : '';

    // Smart trailing space: if suffix exists and does not start with whitespace, insert a space after speech
    const needsTrailSpace = suffix.length > 0 && !/^\s/.test(suffix);
    const trailSpace = needsTrailSpace ? ' ' : '';

    const insertedText = leadSpace + speech + trailSpace;
    const text = prefix + insertedText + suffix;
    // Cursor position immediately after the spoken words
    const cursorPos = prefix.length + leadSpace.length + speech.length;

    return { text, cursorPos };
  }

  function cleanupRecognitionInstance() {
    if (recognitionInstance) {
      try {
        recognitionInstance.onstart = null;
        recognitionInstance.onresult = null;
        recognitionInstance.onerror = null;
        recognitionInstance.onend = null;
        recognitionInstance.stop();
        recognitionInstance.abort();
      } catch (e) {
        // ignore
      }
      recognitionInstance = null;
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    // Do not start if drawer is closed
    if (slidingInputView && !slidingInputView.classList.contains('show')) {
      return;
    }

    cleanupRecognitionInstance();
    isVoiceRecording = true;

    if (taskTitle) {
      originalTaskPlaceholder = taskTitle.placeholder;
      taskTitle.placeholder = 'Listening... speak now';

      const val = taskTitle.value || '';
      let selStart = taskTitle.selectionStart;
      let selEnd = taskTitle.selectionEnd;

      // Fallback to saved cursor if textarea is currently blurred
      if (selStart === null || selStart === undefined || selStart < 0) {
        selStart = (lastCursorStart >= 0) ? lastCursorStart : val.length;
        selEnd = (lastCursorEnd >= 0) ? lastCursorEnd : selStart;
      }

      if (selStart > selEnd) {
        const tmp = selStart;
        selStart = selEnd;
        selEnd = tmp;
      }

      selStart = Math.max(0, Math.min(selStart, val.length));
      selEnd = Math.max(selStart, Math.min(selEnd, val.length));

      // Capture prefix and suffix at cursor/selection anchor
      voicePrefixText = val.slice(0, selStart);
      voiceSuffixText = val.slice(selEnd);

      taskTitle.focus();
      taskTitle.setSelectionRange(selStart, selStart);
      lastCursorStart = selStart;
      lastCursorEnd = selStart;
    }

    setVoiceRecordingMode(true);
    if (btnVoiceInput) {
      btnVoiceInput.classList.add('recording');
      btnVoiceInput.title = 'Listening... Tap mic to stop';
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-CA';

      rec.onstart = () => {
        isVoiceRecording = true;
        setVoiceRecordingMode(true);
        if (btnVoiceInput) {
          btnVoiceInput.classList.add('recording');
          btnVoiceInput.title = 'Listening... Tap mic to stop';
        }
      };

      rec.onresult = (event) => {
        if (!taskTitle) return;
        // If drawer has been closed in the meantime, stop immediately
        if (slidingInputView && !slidingInputView.classList.contains('show')) {
          stopSpeechRecognition();
          return;
        }
        const { finalText, interimText } = extractSessionTranscript(event.results);
        const { text, cursorPos } = combineVoiceText(voicePrefixText, voiceSuffixText, finalText, interimText);
        taskTitle.value = text;
        taskTitle.setSelectionRange(cursorPos, cursorPos);
        lastCursorStart = cursorPos;
        lastCursorEnd = cursorPos;
        autoResizeTextarea();
        taskTitle.dispatchEvent(new Event('input', { bubbles: true }));
      };

      rec.onerror = (event) => {
        console.warn('SpeechRecognition event/error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access was not allowed. Please grant microphone permission in your browser settings.');
        }
        stopSpeechRecognition();
      };

      rec.onend = () => {
        // Speech ended naturally - stop cleanly without restarting
        stopSpeechRecognition();
      };

      recognitionInstance = rec;
      rec.start();
    } catch (err) {
      console.warn('SpeechRecognition creation/start error:', err);
      stopSpeechRecognition();
    }
  }

  function stopSpeechRecognition() {
    if (!isVoiceRecording && !recognitionInstance) return;

    isVoiceRecording = false;

    if (btnVoiceInput) {
      btnVoiceInput.classList.remove('recording');
      btnVoiceInput.title = 'Voice to text';
    }

    if (taskTitle && originalTaskPlaceholder) {
      taskTitle.placeholder = originalTaskPlaceholder;
    }

    setVoiceRecordingMode(false);
    cleanupRecognitionInstance();

    if (taskTitle) {
      const curPos = (lastCursorStart >= 0) ? lastCursorStart : taskTitle.selectionStart;
      autoResizeTextarea();
      taskTitle.dispatchEvent(new Event('input', { bubbles: true }));
      if (curPos !== null && curPos !== undefined && curPos >= 0) {
        taskTitle.focus();
        taskTitle.setSelectionRange(curPos, curPos);
        lastCursorStart = curPos;
        lastCursorEnd = curPos;
      }
    }
  }

  function toggleSpeechRecognition() {
    const now = Date.now();
    if (now - lastVoiceToggleTime < 300) return;
    lastVoiceToggleTime = now;

    if (isVoiceRecording) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }

  window.stopSpeechRecognition = stopSpeechRecognition;

  // --- Curated Emoji Picker Rendering & Insertion ---
  function renderEmojiGrid() {
    if (!emojiGridContainer) return;
    emojiGridContainer.innerHTML = '';

    CURATED_EMOJIS.forEach((emoji) => {
      const emojiBtn = document.createElement('button');
      emojiBtn.type = 'button';
      emojiBtn.className = 'emoji-item-btn';
      emojiBtn.textContent = emoji;
      emojiBtn.title = `Insert ${emoji}`;
      emojiBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertEmoji(emoji);
      });
      emojiGridContainer.appendChild(emojiBtn);
    });
  }

  function insertEmoji(emoji) {
    if (!taskTitle) return;

    const start = taskTitle.selectionStart !== null && taskTitle.selectionStart !== undefined
      ? taskTitle.selectionStart
      : taskTitle.value.length;
    const end = taskTitle.selectionEnd !== null && taskTitle.selectionEnd !== undefined
      ? taskTitle.selectionEnd
      : taskTitle.value.length;
    const val = taskTitle.value;

    taskTitle.value = val.slice(0, start) + emoji + val.slice(end);
    const newPos = start + emoji.length;
    taskTitle.selectionStart = taskTitle.selectionEnd = newPos;
    taskTitle.focus();

    autoResizeTextarea();
    taskTitle.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openEmojiTray() {
    if (!dynamicEmojiTray || !slidingInputView) return;
    isEmojiTrayOpen = true;
    renderEmojiGrid();
    dynamicEmojiTray.classList.remove('hidden');
    slidingInputView.classList.add('emoji-tray-active');
    if (btnEmojiPicker) btnEmojiPicker.classList.add('active');
  }

  function closeEmojiTray() {
    if (!dynamicEmojiTray || !slidingInputView) return;
    isEmojiTrayOpen = false;
    dynamicEmojiTray.classList.add('hidden');
    slidingInputView.classList.remove('emoji-tray-active');
    if (btnEmojiPicker) btnEmojiPicker.classList.remove('active');
  }

  function toggleEmojiTray() {
    if (isEmojiTrayOpen) {
      closeEmojiTray();
    } else {
      openEmojiTray();
    }
  }

  // --- Auto-Resize Textarea (Max 3 lines, then scrollable) ---
  function autoResizeTextarea() {
    if (!taskTitle) return;
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    if (!taskTitle.value || taskTitle.value.length === 0) {
      taskTitle.style.height = '20px';
      taskTitle.style.overflowY = 'hidden';
      return;
    }
    // Reset to single-line height so scrollHeight recalculates accurately on backspace/paste
    taskTitle.style.height = '20px';
    const scrollH = taskTitle.scrollHeight;
    // Exactly 3 lines max: 3 lines * 20px line-height = 60px
    const newHeight = Math.min(scrollH, 60);
    taskTitle.style.height = `${Math.max(newHeight, 20)}px`;
    taskTitle.style.overflowY = scrollH > 60 ? 'auto' : 'hidden';
  }

  function collapseTextareaToSingleLine() {
    if (!taskTitle) return;
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    taskTitle.style.height = '20px';
    taskTitle.scrollTop = 0;
  }

  // --- Dynamic Collapse / Expand (Messenger Style) ---
  function setCollapsedState(collapsed) {
    if (!slidingInputView) return;
    if (!slidingInputView.classList.contains('dynamic-bar-active')) return;

    if (collapsed) {
      slidingInputView.classList.add('actions-collapsed');
    } else {
      slidingInputView.classList.remove('actions-collapsed');
    }
  }

  function updateCollapseLogic() {
    if (!taskTitle || !slidingInputView) return;
    if (!slidingInputView.classList.contains('dynamic-bar-active')) return;
    // When in voice recording mode, keep mic at the far left and never collapse to chevron
    if (isVoiceRecording) return;

    const hasText = taskTitle.value.trim().length > 0;
    const isFocused = document.activeElement === taskTitle;

    if (isManualExpanded) {
      // User tapped [ > ] to reveal actions manually
      setCollapsedState(false);
      return;
    }

    if (hasText || isFocused) {
      setCollapsedState(true);
    } else {
      setCollapsedState(false);
    }
  }

  // --- Template Strip Quick Toggler ---
  function updateTemplateStripBtnState(isEnabled) {
    if (!btnToggleTemplateStrip) return;
    if (isEnabled) {
      btnToggleTemplateStrip.classList.add('active');
      btnToggleTemplateStrip.title = 'Hide Template Strip';
    } else {
      btnToggleTemplateStrip.classList.remove('active');
      btnToggleTemplateStrip.title = 'Show Template Strip';
    }
  }

  function handleTemplateStripToggle() {
    const isCurrentlyEnabled = typeof window.isSlidingTemplatesEnabled === 'function'
      ? window.isSlidingTemplatesEnabled()
      : false;
    const newEnabled = !isCurrentlyEnabled;

    if (typeof window.setSlidingTemplatesState === 'function') {
      window.setSlidingTemplatesState(newEnabled);
    } else {
      const appSettings = JSON.parse(localStorage.getItem('appSettings')) || {};
      appSettings['sliding-templates'] = newEnabled;
      if (!newEnabled) {
        appSettings['sliding-templates-peek'] = false;
      }
      localStorage.setItem('appSettings', JSON.stringify(appSettings));

      const hamburgerToggle = document.getElementById('sliding-templates-toggle');
      if (hamburgerToggle) hamburgerToggle.checked = newEnabled;

      const peekToggle = document.getElementById('sliding-templates-peek-toggle');
      if (peekToggle && !newEnabled) peekToggle.checked = false;

      if (typeof window.applySlidingTemplatesRowState === 'function') {
        window.applySlidingTemplatesRowState(newEnabled);
      }
      updateTemplateStripBtnState(newEnabled);
    }
  }

  // --- Mode Switching (Classic vs. Dynamic) ---
  function applyInputBarMode(isDynamic) {
    cacheDomElements();
    if (!slidingInputView) return;

    if (isDynamic) {
      // 1. Move left tools into dynamicCollapsibleTools in user order:
      // counter (selectedTaskCounter), template (btnToggleTemplateStrip), voice (btnVoiceInput), add (addTaskWrapper)
      if (dynamicCollapsibleTools) {
        if (selectedTaskCounter) dynamicCollapsibleTools.appendChild(selectedTaskCounter);
        if (btnToggleTemplateStrip) dynamicCollapsibleTools.appendChild(btnToggleTemplateStrip);
        if (btnVoiceInput) dynamicCollapsibleTools.appendChild(btnVoiceInput);
        if (addTaskWrapper) dynamicCollapsibleTools.appendChild(addTaskWrapper);
      }

      // 2. Ensure emoji picker is inside the pill (titleSubmitContainer)
      if (btnEmojiPicker && titleSubmitContainer) {
        if (btnEmojiPicker.parentNode !== titleSubmitContainer) {
          titleSubmitContainer.appendChild(btnEmojiPicker);
        }
      }

      // 3. Move submitTask OUTSIDE the pill to the far right of templateTitleSubmitContainer
      if (submitTask && templateTitleSubmitContainer) {
        if (submitTask.parentNode !== templateTitleSubmitContainer) {
          templateTitleSubmitContainer.appendChild(submitTask);
        }
      }

      slidingInputView.classList.add('dynamic-bar-active');

      // Sync template strip button state
      const isTemplatesEnabled = typeof window.isSlidingTemplatesEnabled === 'function'
        ? window.isSlidingTemplatesEnabled()
        : false;
      updateTemplateStripBtnState(isTemplatesEnabled);
      if (typeof window.applySlidingTemplatesRowState === 'function') {
        window.applySlidingTemplatesRowState(isTemplatesEnabled);
      }

      isManualExpanded = false;
      autoResizeTextarea();
      updateCollapseLogic();
    } else {
      // 1. Revert elements to Classic layout
      slidingInputView.classList.remove('dynamic-bar-active');
      slidingInputView.classList.remove('actions-collapsed');

      const isTemplatesEnabled = typeof window.isSlidingTemplatesEnabled === 'function'
        ? window.isSlidingTemplatesEnabled()
        : false;
      if (typeof window.applySlidingTemplatesRowState === 'function') {
        window.applySlidingTemplatesRowState(isTemplatesEnabled);
      }

      if (templateTitleSubmitContainer && selectedTaskCounter) {
        if (selectedTaskCounter.parentNode !== templateTitleSubmitContainer) {
          templateTitleSubmitContainer.insertBefore(selectedTaskCounter, titleSubmitContainer);
        }
      }

      if (titleSubmitContainer) {
        if (addTaskWrapper && addTaskWrapper.parentNode !== titleSubmitContainer) {
          if (flowerContainer) {
            titleSubmitContainer.insertBefore(addTaskWrapper, flowerContainer);
          } else {
            titleSubmitContainer.prepend(addTaskWrapper);
          }
        }
        if (submitTask && submitTask.parentNode !== titleSubmitContainer) {
          titleSubmitContainer.appendChild(submitTask);
        }
      }

      closeEmojiTray();
      stopSpeechRecognition();
      if (taskTitle) taskTitle.style.height = '';
    }
  }

  // --- Event Bindings ---
  let isEventsBound = false;
  function bindEvents() {
    if (isEventsBound) return;
    isEventsBound = true;
    if (btnCollapseActions) {
      btnCollapseActions.addEventListener('click', (e) => {
        e.stopPropagation();
        isManualExpanded = true;
        setCollapsedState(false);
      });
    }

    if (btnToggleTemplateStrip) {
      btnToggleTemplateStrip.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      btnToggleTemplateStrip.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTemplateStripToggle();
      });
    }

    if (btnVoiceInput) {
      btnVoiceInput.addEventListener('mousedown', (e) => {
        // Prevent button click from unfocusing taskTitle and clearing cursor position
        e.preventDefault();
        updateSavedCursor();
      });
      btnVoiceInput.addEventListener('touchstart', () => {
        updateSavedCursor();
      }, { passive: true });
      btnVoiceInput.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSpeechRecognition();
      });
    }

    if (btnEmojiPicker) {
      btnEmojiPicker.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      btnEmojiPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiTray();
      });
    }

    // Tapping flower paw or submit button returns to color view
    if (flowerContainer) {
      flowerContainer.addEventListener('click', () => {
        if (isEmojiTrayOpen) closeEmojiTray();
      });
    }

    if (submitTask) {
      submitTask.addEventListener('click', () => {
        if (isEmojiTrayOpen) closeEmojiTray();
        if (isVoiceRecording) stopSpeechRecognition();
      });
    }

    // Close emoji tray on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isEmojiTrayOpen) {
        closeEmojiTray();
      }
    });

    if (taskTitle) {
      ['keyup', 'mouseup', 'touchend', 'select', 'input', 'focus'].forEach((evt) => {
        taskTitle.addEventListener(evt, updateSavedCursor);
      });

      taskTitle.addEventListener('focus', () => {
        isManualExpanded = false;
        autoResizeTextarea();
        updateCollapseLogic();
      });

      taskTitle.addEventListener('blur', () => {
        isManualExpanded = false;
        // Snap back to compact single line when unfocused unless emoji tray or voice recording is active
        if (!isEmojiTrayOpen && !isVoiceRecording) {
          collapseTextareaToSingleLine();
        }
        // Delay slightly in case user clicked on an action button
        setTimeout(updateCollapseLogic, 180);
      });

      taskTitle.addEventListener('input', () => {
        isManualExpanded = false;
        autoResizeTextarea();
        updateCollapseLogic();
      });
    }

    document.addEventListener('selectionchange', () => {
      if (document.activeElement === taskTitle) {
        updateSavedCursor();
      }
    });

    // Automatically turn off voice recording if the drawer is closed or hidden
    if (slidingInputView) {
      const drawerObserver = new MutationObserver(() => {
        if (!slidingInputView.classList.contains('show')) {
          if (isVoiceRecording) {
            stopSpeechRecognition();
          }
          if (isEmojiTrayOpen) {
            closeEmojiTray();
          }
        }
      });
      drawerObserver.observe(slidingInputView, { attributes: true, attributeFilter: ['class'] });
    }

    const floatingAddBtn = document.getElementById('floatingAddBtn');
    if (floatingAddBtn) {
      floatingAddBtn.addEventListener('click', () => {
        if (slidingInputView && slidingInputView.classList.contains('show') && isVoiceRecording) {
          stopSpeechRecognition();
        }
      });
    }

    // Turn off voice recording if app is in background, minimized, or closed
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isVoiceRecording) {
        stopSpeechRecognition();
      }
    });

    window.addEventListener('pagehide', () => {
      if (isVoiceRecording) {
        stopSpeechRecognition();
      }
    });

    window.addEventListener('beforeunload', () => {
      if (isVoiceRecording) {
        stopSpeechRecognition();
      }
    });
  }

  // --- Initialization ---
  function init() {
    cacheDomElements();
    bindEvents();

    const appSettings = JSON.parse(localStorage.getItem('appSettings')) || {};
    const isDynamic = Boolean(appSettings['dynamic-input-bar']);

    applyInputBarMode(isDynamic);
  }

  // Expose to window for hamburger.js and other scripts
  window.applyInputBarMode = applyInputBarMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
