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

  // --- Voice-to-Text (Native Web Speech API with Real-Time Transcription) ---
  let voiceBaseText = '';
  let isExplicitlyStopped = false;
  let voiceRestartTimer = null;
  let originalTaskPlaceholder = '';

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

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (btnVoiceInput) {
        btnVoiceInput.title = 'Voice input not supported on this browser';
        btnVoiceInput.style.opacity = '0.5';
      }
      return null;
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
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + res[0].transcript.trim();
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        if (taskTitle) {
          let fullText = voiceBaseText;
          if (finalTranscript) {
            fullText += (fullText ? ' ' : '') + finalTranscript;
          }
          if (interimTranscript) {
            const separator = fullText && !fullText.endsWith(' ') ? ' ' : '';
            fullText += separator + interimTranscript.trimStart();
          }
          taskTitle.value = fullText;
          autoResizeTextarea();
          taskTitle.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };

      rec.onerror = (event) => {
        console.warn('SpeechRecognition event/error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access was not allowed. Please grant microphone permission in your browser settings.');
          stopSpeechRecognition();
        }
      };

      rec.onend = () => {
        // As long as user has NOT clicked mic off, keep recognition alive
        if (isVoiceRecording && !isExplicitlyStopped) {
          if (taskTitle) {
            voiceBaseText = taskTitle.value.trim();
          }
          clearTimeout(voiceRestartTimer);
          voiceRestartTimer = setTimeout(() => {
            if (isVoiceRecording && !isExplicitlyStopped) {
              try {
                rec.start();
              } catch (e) {
                // Ignore if already running
              }
            }
          }, 120);
        } else {
          stopSpeechRecognition();
        }
      };

      return rec;
    } catch (err) {
      console.warn('SpeechRecognition initialization error:', err);
      return null;
    }
  }

  function startSpeechRecognition() {
    if (!recognitionInstance) {
      recognitionInstance = setupSpeechRecognition();
    }
    if (!recognitionInstance) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    isExplicitlyStopped = false;
    isVoiceRecording = true;
    clearTimeout(voiceRestartTimer);

    if (taskTitle) {
      originalTaskPlaceholder = taskTitle.placeholder;
      taskTitle.placeholder = 'Listening... speak now';
      voiceBaseText = taskTitle.value ? taskTitle.value.trim() : '';
    }

    setVoiceRecordingMode(true);
    if (btnVoiceInput) {
      btnVoiceInput.classList.add('recording');
      btnVoiceInput.title = 'Listening... Tap mic to stop';
    }

    try {
      recognitionInstance.start();
    } catch (err) {
      console.warn('Recognition start caught:', err);
    }
  }

  function stopSpeechRecognition() {
    isExplicitlyStopped = true;
    isVoiceRecording = false;
    clearTimeout(voiceRestartTimer);

    if (btnVoiceInput) {
      btnVoiceInput.classList.remove('recording');
      btnVoiceInput.title = 'Voice to text';
    }

    if (taskTitle && originalTaskPlaceholder) {
      taskTitle.placeholder = originalTaskPlaceholder;
    }

    setVoiceRecordingMode(false);

    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (err) {
        // ignore
      }
    }

    if (taskTitle) {
      taskTitle.value = taskTitle.value.trim();
      autoResizeTextarea();
      taskTitle.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function toggleSpeechRecognition() {
    if (isVoiceRecording) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }

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
  function bindEvents() {
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
      taskTitle.addEventListener('focus', () => {
        isManualExpanded = false;
        autoResizeTextarea();
        updateCollapseLogic();
      });

      taskTitle.addEventListener('blur', () => {
        isManualExpanded = false;
        // Snap back to compact single line when unfocused unless emoji tray is open
        if (!isEmojiTrayOpen) {
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
