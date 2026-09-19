/**
 * dynamic-input-bar.js
 * Messenger-style Mobile Input Bar for Scheduler
 * Features:
 * - Dynamic Messenger expand/collapse transitions
 * - Curated nurse & Canadian lifestyle/outdoors emoji palette (0 KB weight, 100% offline)
 * - Template strip quick toggler
 * - Seamless Classic vs. Dynamic mode switching
 */

(function () {
  'use strict';

  // --- Curated Emojis tailored for Nurse in Canada (Health, Outdoors, Home, Errands, Church, Social, Work) ---
  const CURATED_EMOJIS = [
    '💩',
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

  const SETTINGS_KEY = 'appSettings';
  const RECENT_EMOJIS_KEY = 'recent-emojis';
  const MAX_RECENT_EMOJIS = 10;

  function getRecentEmojis() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return [];
      const settings = JSON.parse(raw);
      const list = settings[RECENT_EMOJIS_KEY] || settings['recentEmojis'];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function recordRecentEmoji(emoji) {
    if (!emoji) return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      let recents = settings[RECENT_EMOJIS_KEY] || settings['recentEmojis'];
      if (!Array.isArray(recents)) {
        recents = [];
      }
      // Remove if already present so it moves to slot 1
      recents = recents.filter((item) => item !== emoji);
      // Prepend to slot 1 (index 0)
      recents.unshift(emoji);
      // Retain max 10
      if (recents.length > MAX_RECENT_EMOJIS) {
        recents = recents.slice(0, MAX_RECENT_EMOJIS);
      }
      settings[RECENT_EMOJIS_KEY] = recents;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      // Keep in-memory appSettings in sync if defined
      if (typeof window !== 'undefined' && window.appSettings) {
        window.appSettings[RECENT_EMOJIS_KEY] = recents;
      }
      if (typeof appSettings !== 'undefined' && appSettings) {
        appSettings[RECENT_EMOJIS_KEY] = recents;
      }
    } catch (err) {
      console.warn('Failed to save recent emoji to appSettings:', err);
    }
  }

  function getDisplayEmojis() {
    const recents = getRecentEmojis().slice(0, MAX_RECENT_EMOJIS);
    const recentSet = new Set(recents);
    const remaining = CURATED_EMOJIS.filter((emoji) => !recentSet.has(emoji));
    return [...recents, ...remaining];
  }

  let isManualTextareaExpanded = false;
  let isEmojiTrayOpen = false;
  let savedSelectionStart = null;
  let savedSelectionEnd = null;
  let wasExpandedBeforeEmoji = false;

  function updateSavedSelection() {
    if (taskTitle && typeof taskTitle.selectionStart === 'number') {
      savedSelectionStart = taskTitle.selectionStart;
      savedSelectionEnd = taskTitle.selectionEnd;
    }
  }

  // Touch gesture tracking for swipe-to-expand without keyboard
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isHorizontalSwipe = false;
  let justSwiped = false;

  // DOM Elements
  let slidingInputView = null;
  let templateTitleSubmitContainer = null;
  let dynamicLeftCluster = null;
  let dynamicCollapsibleTools = null;
  let btnCollapseActions = null;
  let btnToggleTemplateStrip = null;
  let btnEmojiPicker = null;
  let dynamicEmojiTray = null;
  let emojiGridContainer = null;
  let btnEmojiBackspace = null;
  let isPointerDownOnBackspace = false;
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
    btnEmojiPicker = document.getElementById('btnEmojiPicker');
    dynamicEmojiTray = document.getElementById('dynamicEmojiTray');
    emojiGridContainer = document.getElementById('emojiGridContainer');
    btnEmojiBackspace = document.getElementById('btnEmojiBackspace');
    titleSubmitContainer = document.getElementById('titleSubmitContainer');
    taskTitle = document.getElementById('taskTitle');
    flowerContainer = document.querySelector('.flower-container');
    submitTask = document.getElementById('submitTask');
    selectedTaskCounter = document.querySelector('.selected-task');
    addTaskWrapper = document.querySelector('.add-task-wrapper');
  }

  // --- Curated Emoji Picker Rendering & Insertion ---
  function renderEmojiGrid() {
    if (!emojiGridContainer) return;
    emojiGridContainer.innerHTML = '';

    const displayEmojis = getDisplayEmojis();

    displayEmojis.forEach((emoji) => {
      const emojiBtn = document.createElement('button');
      emojiBtn.type = 'button';
      emojiBtn.className = 'emoji-item-btn';
      emojiBtn.textContent = emoji;
      emojiBtn.title = `Insert ${emoji}`;
      emojiBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      emojiBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        updateSavedSelection();
      });
      emojiBtn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        updateSavedSelection();
      }, { passive: true });
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertEmoji(emoji);
      });
      emojiGridContainer.appendChild(emojiBtn);
    });
  }

  function insertEmoji(emoji) {
    if (!taskTitle) return;

    // Record as recently used in appSettings
    recordRecentEmoji(emoji);

    // Track whether keyboard is currently active (taskTitle focused)
    const wasFocused = (document.activeElement === taskTitle);
    updateSavedSelection();

    const val = taskTitle.value || '';
    let start = (typeof savedSelectionStart === 'number' && savedSelectionStart >= 0 && savedSelectionStart <= val.length)
      ? savedSelectionStart
      : (typeof taskTitle.selectionStart === 'number' && taskTitle.selectionStart >= 0 && taskTitle.selectionStart <= val.length
        ? taskTitle.selectionStart
        : val.length);

    let end = (typeof savedSelectionEnd === 'number' && savedSelectionEnd >= 0 && savedSelectionEnd <= val.length)
      ? savedSelectionEnd
      : (typeof taskTitle.selectionEnd === 'number' && taskTitle.selectionEnd >= 0 && taskTitle.selectionEnd <= val.length
        ? taskTitle.selectionEnd
        : val.length);

    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    let insertText = emoji;
    // If inserting at the very end of existing text, add a space after words
    if (start === val.length && val.length > 0) {
      const endsWithSpace = /\s$/.test(val);
      let endsWithEmoji = false;
      try {
        endsWithEmoji = /\p{Extended_Pictographic}$/u.test(val);
      } catch (_) {
        endsWithEmoji = false;
      }
      if (!endsWithSpace && !endsWithEmoji) {
        insertText = ' ' + emoji;
      }
    }

    const before = val.substring(0, start);
    const after = val.substring(end);
    taskTitle.value = before + insertText + after;

    const newPos = start + insertText.length;
    taskTitle.selectionStart = taskTitle.selectionEnd = newPos;
    savedSelectionStart = savedSelectionEnd = newPos;

    // If keyboard was already on, ensure focus remains so keyboard is NOT hidden
    if (wasFocused && document.activeElement !== taskTitle) {
      taskTitle.focus({ preventScroll: true });
    }

    // Preserve expanded vs. closed state:
    // If textarea was expanded (or focused), keep it expanded with autoResizeTextarea().
    // If it was closed/single-line, do nothing to expand it — keep it closed and single-line.
    const isExpanded = wasFocused || isManualTextareaExpanded || (slidingInputView && slidingInputView.classList.contains('actions-collapsed'));

    if (isExpanded) {
      isManualTextareaExpanded = true;
      setCollapsedState(true);
      autoResizeTextarea();
    } else {
      isManualTextareaExpanded = false;
      setCollapsedState(false);
      collapseTextareaToSingleLine();
      taskTitle.scrollLeft = taskTitle.scrollWidth;
    }

    // Dispatch input event marked with isEmojiInsert
    const inputEvt = new Event('input', { bubbles: true });
    inputEvt.isEmojiInsert = true;
    taskTitle.dispatchEvent(inputEvt);

    updateEmojiBackspaceVisibility();
  }

  function updateEmojiBackspaceVisibility() {
    if (!btnEmojiBackspace) return;
    if (isPointerDownOnBackspace) return;
    const hasText = Boolean(taskTitle && taskTitle.value && taskTitle.value.length > 0);
    if (isEmojiTrayOpen && hasText) {
      btnEmojiBackspace.classList.remove('hidden');
    } else {
      btnEmojiBackspace.classList.add('hidden');
    }
  }

  function performBackspace() {
    if (!taskTitle) return;

    const val = taskTitle.value || '';
    if (val.length === 0) {
      updateEmojiBackspaceVisibility();
      return;
    }

    const wasFocused = (document.activeElement === taskTitle);
    updateSavedSelection();

    let start = (typeof savedSelectionStart === 'number' && savedSelectionStart >= 0 && savedSelectionStart <= val.length)
      ? savedSelectionStart
      : (typeof taskTitle.selectionStart === 'number' && taskTitle.selectionStart >= 0 && taskTitle.selectionStart <= val.length
        ? taskTitle.selectionStart
        : val.length);

    let end = (typeof savedSelectionEnd === 'number' && savedSelectionEnd >= 0 && savedSelectionEnd <= val.length)
      ? savedSelectionEnd
      : (typeof taskTitle.selectionEnd === 'number' && taskTitle.selectionEnd >= 0 && taskTitle.selectionEnd <= val.length
        ? taskTitle.selectionEnd
        : val.length);

    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    let newPos = start;
    if (start !== end) {
      // Delete highlighted selection range
      const before = val.substring(0, start);
      const after = val.substring(end);
      taskTitle.value = before + after;
      newPos = start;
    } else if (start > 0) {
      // Delete one grapheme cluster (regular char or full multi-byte emoji) before caret
      const textBefore = val.substring(0, start);
      let deleteLen = 1;

      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
          const segments = Array.from(segmenter.segment(textBefore));
          if (segments.length > 0) {
            deleteLen = segments[segments.length - 1].segment.length;
          }
        } catch (_) {
          deleteLen = 1;
        }
      } else if (start >= 2) {
        // Fallback for surrogate pairs
        const prevChar = val.charCodeAt(start - 1);
        const prevPrevChar = val.charCodeAt(start - 2);
        if (prevChar >= 0xDC00 && prevChar <= 0xDFFF && prevPrevChar >= 0xD800 && prevPrevChar <= 0xDBFF) {
          deleteLen = 2;
        }
      }

      const before = val.substring(0, start - deleteLen);
      const after = val.substring(end);
      taskTitle.value = before + after;
      newPos = start - deleteLen;
    } else {
      return;
    }

    taskTitle.selectionStart = taskTitle.selectionEnd = newPos;
    savedSelectionStart = savedSelectionEnd = newPos;

    if (wasFocused && document.activeElement !== taskTitle) {
      taskTitle.focus({ preventScroll: true });
    }

    const isExpanded = wasFocused || isManualTextareaExpanded || (slidingInputView && slidingInputView.classList.contains('actions-collapsed'));
    if (isExpanded) {
      isManualTextareaExpanded = true;
      setCollapsedState(true);
      autoResizeTextarea();
    } else {
      isManualTextareaExpanded = false;
      setCollapsedState(false);
      collapseTextareaToSingleLine();
    }

    const inputEvt = new Event('input', { bubbles: true });
    inputEvt.isBackspace = true;
    taskTitle.dispatchEvent(inputEvt);

    updateEmojiBackspaceVisibility();
  }

  function openEmojiTray() {
    if (!dynamicEmojiTray || !slidingInputView) return;

    updateSavedSelection();

    const wasExpanded = wasExpandedBeforeEmoji ||
                        (document.activeElement === taskTitle) ||
                        isManualTextareaExpanded ||
                        (slidingInputView && slidingInputView.classList.contains('actions-collapsed'));

    // Do NOT blur taskTitle: keep keyboard on if it was active, or keep it hidden if inactive

    if (wasExpanded) {
      isManualTextareaExpanded = true;
      setCollapsedState(true);
      autoResizeTextarea();
    } else {
      isManualTextareaExpanded = false;
      setCollapsedState(false);
      collapseTextareaToSingleLine();
    }

    isEmojiTrayOpen = true;
    renderEmojiGrid();
    if (emojiGridContainer) {
      emojiGridContainer.scrollLeft = 0;
    }
    dynamicEmojiTray.classList.remove('hidden');
    slidingInputView.classList.add('emoji-tray-active');
    if (btnEmojiPicker) btnEmojiPicker.classList.add('active');
    updateEmojiBackspaceVisibility();
    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
  }

  function closeEmojiTray() {
    if (!dynamicEmojiTray || !slidingInputView) return;
    isEmojiTrayOpen = false;
    wasExpandedBeforeEmoji = false;
    dynamicEmojiTray.classList.add('hidden');
    slidingInputView.classList.remove('emoji-tray-active');
    if (btnEmojiPicker) btnEmojiPicker.classList.remove('active');
    updateEmojiBackspaceVisibility();

    // If closing tray and textarea is not actively focused, return to resting state
    if (document.activeElement !== taskTitle) {
      isManualTextareaExpanded = false;
      updateCollapseLogic();
    }

    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
  }

  function toggleEmojiTray() {
    if (isEmojiTrayOpen) {
      closeEmojiTray();
    } else {
      openEmojiTray();
    }
  }

  let textareaRuler = null;
  function getPredictedScrollHeight(text, targetWidth) {
    if (!textareaRuler) {
      textareaRuler = document.createElement('div');
      textareaRuler.style.cssText = [
        'position: fixed',
        'top: -9999px',
        'left: -9999px',
        'visibility: hidden',
        'pointer-events: none',
        'white-space: pre-wrap',
        'word-break: break-word',
        'box-sizing: border-box',
        'padding: 0',
        'margin: 0',
        'border: none',
        'overflow: hidden'
      ].join(';');
      document.body.appendChild(textareaRuler);
    }

    if (taskTitle) {
      const computed = window.getComputedStyle(taskTitle);
      textareaRuler.style.fontFamily = computed.fontFamily;
      textareaRuler.style.fontSize = computed.fontSize;
      textareaRuler.style.fontWeight = computed.fontWeight;
      textareaRuler.style.letterSpacing = computed.letterSpacing;
      textareaRuler.style.lineHeight = computed.lineHeight;
    }

    textareaRuler.style.width = `${Math.max(50, Math.round(targetWidth))}px`;
    textareaRuler.textContent = text.endsWith('\n') ? (text + ' ') : text;
    return textareaRuler.scrollHeight;
  }

  // --- Auto-Resize Textarea (Max 3 lines: 22px, 44px, 66px) ---
  function autoResizeTextarea() {
    if (!taskTitle) return;
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;

    const val = taskTitle.value || '';
    if (val.length === 0) {
      taskTitle.style.height = '22px';
      taskTitle.scrollTop = 0;
      taskTitle.scrollLeft = 0;
      taskTitle.style.overflowY = 'hidden';
      if (typeof window.syncTaskToolbarWithDrawer === 'function') {
        window.syncTaskToolbarWithDrawer();
      }
      return;
    }

    // Determine target width: during expansion transition (actions-collapsed),
    // dynamicCollapsibleTools is transitioning to 0 width.
    // Calculate the true full expanded width so 1-liners are never measured as wrapped 2-liners:
    let targetWidth = taskTitle.clientWidth;
    if (slidingInputView.classList.contains('actions-collapsed')) {
      if (templateTitleSubmitContainer) {
        const containerW = templateTitleSubmitContainer.clientWidth;
        const submitW = (submitTask && submitTask.offsetWidth > 0) ? submitTask.offsetWidth : 34;
        // Non-textarea items: 30px chevron + 16px outer gaps + submitW + 18px pill padding + 20px flower + 26px emoji + 14px inner gaps = 124px + submitW
        const nonTextareaW = 30 + 16 + submitW + 18 + 20 + 26 + 14;
        const expandedW = containerW - nonTextareaW;
        if (expandedW > targetWidth) {
          targetWidth = expandedW;
        }
      }
    }

    const scrollH = getPredictedScrollHeight(val, targetWidth);

    // Stepped line heights based on real DOM content wrapping:
    // 1 line:  scrollH <= 28px -> 22px
    // 2 lines: scrollH > 28px && scrollH <= 50px -> 44px
    // 3 lines: scrollH > 50px -> 66px
    let newHeight = 22;
    if (scrollH > 50) {
      newHeight = 66;
    } else if (scrollH > 28) {
      newHeight = 44;
    } else {
      newHeight = 22;
    }

    taskTitle.style.height = `${newHeight}px`;
    taskTitle.style.overflowY = scrollH > 50 ? 'auto' : 'hidden';

    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
  }

  function collapseTextareaToSingleLine() {
    if (!taskTitle) return;
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    taskTitle.style.height = '22px';
    taskTitle.scrollTop = 0;
    taskTitle.style.overflowY = 'hidden';
    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
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

    // The textarea should ONLY be extended for two actions: focused and swipe left
    const isFocused = document.activeElement === taskTitle;
    const shouldExtend = isFocused || isManualTextareaExpanded;

    if (shouldExtend) {
      setCollapsedState(true);
      autoResizeTextarea();
    } else {
      setCollapsedState(false);
      collapseTextareaToSingleLine();
    }

    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
  }

  // --- Horizontal Swipe Detection on Textarea / Pill (Preview text without Virtual Keyboard) ---
  function handleTouchStart(e) {
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    if (e._handledDynamicSwipe) return;
    e._handledDynamicSwipe = true;

    // If taskTitle is currently focused, do not intercept touches.
    // Preserves native caret positioning, text selection, and vertical scrolling while editing.
    if (document.activeElement === taskTitle) {
      isHorizontalSwipe = false;
      return;
    }

    // Ignore touches on the emoji trigger or flower container
    if (btnEmojiPicker && btnEmojiPicker.contains(e.target)) return;
    if (flowerContainer && flowerContainer.contains(e.target)) return;

    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isHorizontalSwipe = false;
  }

  function handleTouchMove(e) {
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    if (e._handledDynamicSwipe) return;
    e._handledDynamicSwipe = true;

    if (document.activeElement === taskTitle) return;
    if (e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;

    // Detect if horizontal displacement is clearly dominant
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      isHorizontalSwipe = true;
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  }

  function handleTouchEnd(e) {
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;
    if (e._handledDynamicSwipe) return;
    e._handledDynamicSwipe = true;

    if (document.activeElement === taskTitle) return;

    const touchEndTime = Date.now();
    const duration = touchEndTime - touchStartTime;
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    const isValidSwipe = (isHorizontalSwipe && Math.abs(dx) >= 25) ||
                         (Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy) * 1.2 && duration < 600);

    if (isValidSwipe) {
      justSwiped = true;
      setTimeout(() => {
        justSwiped = false;
      }, 350);

      // Keep textarea blurred so virtual keyboard does NOT show up
      if (document.activeElement === taskTitle) {
        taskTitle.blur();
      }

      if (dx < -25) {
        // SWIPE LEFT (Action 2): Expand textarea without keyboard, collapse left tools
        isManualTextareaExpanded = true;
        updateCollapseLogic();
        setTimeout(autoResizeTextarea, 100);
        setTimeout(autoResizeTextarea, 280);
      } else if (dx > 25) {
        // SWIPE RIGHT: Uncollapse left tools, contract textarea to single line
        isManualTextareaExpanded = false;
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
        }
        updateCollapseLogic();
      }
    }

    isHorizontalSwipe = false;
  }

  function handleTouchCancel() {
    isHorizontalSwipe = false;
  }

  function handleOutsideInteraction(e) {
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;

    // Tapping directly on taskTitle allows native focus & typing to proceed (Action 1)
    if (e.target === taskTitle) return;

    // Allow submitTask button interactions (prevents premature blur & layout shifts while tapping submit)
    if (submitTask && submitTask.contains(e.target)) return;

    // Allow emoji picker button and emoji tray interactions
    if (btnEmojiPicker && btnEmojiPicker.contains(e.target)) return;
    if (dynamicEmojiTray && dynamicEmojiTray.contains(e.target)) return;

    // Allow chevron collapse button interactions (its own click handler manages collapse upon lifting)
    if (btnCollapseActions && btnCollapseActions.contains(e.target)) return;

    // Allow template strip pills and template container interactions
    const slidingTemplatesContainer = document.getElementById('slidingTemplatesContainer');
    if (slidingTemplatesContainer && slidingTemplatesContainer.contains(e.target)) return;

    // Allow tools inside dynamicCollapsibleTools (counter, template toggle, add task)
    if (dynamicCollapsibleTools && dynamicCollapsibleTools.contains(e.target)) return;

    // Allow color options container interactions (keyboard state stays as is: open stays open, closed stays closed)
    const colorOptionsContainer = document.querySelector('.color-button-options');
    if (colorOptionsContainer && colorOptionsContainer.contains(e.target)) return;

    // For any other interaction outside the input bar (calendar, year map, toolbar, background, etc.):
    // Neither action (focus or swipe-left) is active, so textarea MUST NOT be extended:
    if (document.activeElement === taskTitle) {
      taskTitle.blur();
    }
    if (isManualTextareaExpanded) {
      isManualTextareaExpanded = false;
    }
    wasExpandedBeforeEmoji = false;
    if (isEmojiTrayOpen) {
      closeEmojiTray();
    }
    updateCollapseLogic();
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
      // counter (selectedTaskCounter), template (btnToggleTemplateStrip), add (addTaskWrapper)
      if (dynamicCollapsibleTools) {
        if (selectedTaskCounter) dynamicCollapsibleTools.appendChild(selectedTaskCounter);
        if (btnToggleTemplateStrip) dynamicCollapsibleTools.appendChild(btnToggleTemplateStrip);
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

      isManualTextareaExpanded = false;
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
      isManualTextareaExpanded = false;
      if (taskTitle) taskTitle.style.height = '';
    }

    if (typeof window.syncTaskToolbarWithDrawer === 'function') {
      window.syncTaskToolbarWithDrawer();
    }
  }

  // --- Event Bindings ---
  let isEventsBound = false;
  function bindEvents() {
    if (isEventsBound) return;
    isEventsBound = true;
    if (btnCollapseActions) {
      btnCollapseActions.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      btnCollapseActions.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      btnCollapseActions.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });

      btnCollapseActions.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
        }
        if (isEmojiTrayOpen) {
          closeEmojiTray();
        }
        isManualTextareaExpanded = false;

        // Prevent accidental click-through / double-tap reaching counter tools during the collapse transition
        if (dynamicCollapsibleTools) {
          dynamicCollapsibleTools.style.pointerEvents = 'none';
          setTimeout(() => {
            if (dynamicCollapsibleTools) dynamicCollapsibleTools.style.pointerEvents = '';
          }, 260);
        }

        updateCollapseLogic();
      });
      btnCollapseActions.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }

    if (btnToggleTemplateStrip) {
      btnToggleTemplateStrip.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      btnToggleTemplateStrip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
      btnToggleTemplateStrip.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTemplateStripToggle();
      });
    }

    if (btnEmojiPicker) {
      const captureExpandState = () => {
        updateSavedSelection();
        wasExpandedBeforeEmoji = (document.activeElement === taskTitle) ||
                                 isManualTextareaExpanded ||
                                 (slidingInputView && slidingInputView.classList.contains('actions-collapsed'));
      };
      btnEmojiPicker.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        captureExpandState();
      });
      btnEmojiPicker.addEventListener('touchstart', () => {
        captureExpandState();
      }, { passive: true });
      btnEmojiPicker.addEventListener('mousedown', (e) => {
        e.preventDefault();
        captureExpandState();
      });
      btnEmojiPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiTray();
      });
    }

    if (emojiGridContainer) {
      emojiGridContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          emojiGridContainer.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    if (btnEmojiBackspace) {
      let backspaceTimer = null;
      let backspaceInterval = null;
      let pointerHandled = false;

      const stopRepeat = () => {
        if (backspaceTimer) {
          clearTimeout(backspaceTimer);
          backspaceTimer = null;
        }
        if (backspaceInterval) {
          clearInterval(backspaceInterval);
          backspaceInterval = null;
        }
      };

      const finishBackspaceInteraction = () => {
        stopRepeat();
        if (isPointerDownOnBackspace) {
          isPointerDownOnBackspace = false;
          setTimeout(() => {
            updateEmojiBackspaceVisibility();
          }, 0);
        }
      };

      const startRepeat = (e) => {
        e.stopPropagation();
        e.preventDefault();
        pointerHandled = true;
        isPointerDownOnBackspace = true;
        try {
          if (e.pointerId && btnEmojiBackspace.setPointerCapture) {
            btnEmojiBackspace.setPointerCapture(e.pointerId);
          }
        } catch (_) {}

        updateSavedSelection();
        performBackspace();

        stopRepeat();
        backspaceTimer = setTimeout(() => {
          backspaceInterval = setInterval(() => {
            if (!taskTitle || !taskTitle.value || taskTitle.value.length === 0) {
              stopRepeat();
              return;
            }
            performBackspace();
          }, 75);
        }, 400);
      };

      btnEmojiBackspace.addEventListener('pointerdown', startRepeat);
      btnEmojiBackspace.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          if (e.pointerId && btnEmojiBackspace.hasPointerCapture && btnEmojiBackspace.hasPointerCapture(e.pointerId)) {
            btnEmojiBackspace.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        finishBackspaceInteraction();
      });
      btnEmojiBackspace.addEventListener('pointercancel', (e) => {
        e.stopPropagation();
        try {
          if (e.pointerId && btnEmojiBackspace.hasPointerCapture && btnEmojiBackspace.hasPointerCapture(e.pointerId)) {
            btnEmojiBackspace.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        finishBackspaceInteraction();
      });
      btnEmojiBackspace.addEventListener('pointerleave', (e) => {
        if (isPointerDownOnBackspace) {
          finishBackspaceInteraction();
        }
      });

      btnEmojiBackspace.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      btnEmojiBackspace.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        stopRepeat();
        if (!pointerHandled) {
          performBackspace();
        }
        setTimeout(() => {
          pointerHandled = false;
        }, 50);
        finishBackspaceInteraction();
      });

      btnEmojiBackspace.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }

    // Tapping flower paw or submit button returns to color view and uncollapses
    if (flowerContainer) {
      flowerContainer.addEventListener('click', () => {
        if (isEmojiTrayOpen) closeEmojiTray();
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
        }
        isManualTextareaExpanded = false;
        wasExpandedBeforeEmoji = false;
        savedSelectionStart = null;
        savedSelectionEnd = null;
        updateCollapseLogic();
      });
    }

    if (submitTask) {
      submitTask.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      submitTask.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      submitTask.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });

      submitTask.addEventListener('click', (e) => {
        if (isEmojiTrayOpen) closeEmojiTray();
        const wasInputActive = (document.activeElement === taskTitle);
        if (wasInputActive) {
          taskTitle.blur();
          // Shield the calendar grid temporarily during the keyboard collapse animation
          // to prevent mobile ghost clicks from selecting any underlying task div
          const yearContainer = document.getElementById('year-container');
          if (yearContainer) {
            yearContainer.style.pointerEvents = 'none';
            setTimeout(() => {
              yearContainer.style.pointerEvents = '';
            }, 320);
          }
        }
        isManualTextareaExpanded = false;
        wasExpandedBeforeEmoji = false;
        savedSelectionStart = null;
        savedSelectionEnd = null;
        setTimeout(updateCollapseLogic, 50);
      });
    }

    // Close emoji tray or exit preview on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isEmojiTrayOpen) closeEmojiTray();
        if (isManualTextareaExpanded) {
          isManualTextareaExpanded = false;
          updateCollapseLogic();
        }
      }
    });

    // Global capture listener: Any interaction outside taskTitle (colors, calendar, toolbar, counter, etc.)
    // guarantees tools immediately uncollapse and textarea contracts
    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    document.addEventListener('touchstart', handleOutsideInteraction, { capture: true, passive: true });
    document.addEventListener('click', handleOutsideInteraction, true);

    // Color options container: Allow color changes without changing textarea focus
    const colorOptionsContainer = document.querySelector('.color-button-options');
    if (colorOptionsContainer) {
      colorOptionsContainer.addEventListener('pointerdown', (e) => {
        // When real user taps a color button while typing, prevent the browser from blurring the textarea
        if (document.activeElement === taskTitle && e.target.closest('button, .color-option, .palette-button, .dropdown-option, .shade-color-btn')) {
          e.preventDefault();
        }
      });

      colorOptionsContainer.addEventListener('mousedown', (e) => {
        // Prevent default mousedown focus shifting on desktop
        if (document.activeElement === taskTitle) {
          e.preventDefault();
        }
      });

      colorOptionsContainer.addEventListener('click', () => {
        if (isEmojiTrayOpen) {
          closeEmojiTray();
        }
        // Never call taskTitle.focus() here — only direct clicks on taskTitle should focus it
      });
    }

    if (taskTitle) {
      // Suppress synthetic click/focus after a swipe gesture
      taskTitle.addEventListener('click', (e) => {
        if (justSwiped) {
          e.preventDefault();
          e.stopPropagation();
          taskTitle.blur();
          return;
        }
        updateSavedSelection();
      }, true);

      taskTitle.addEventListener('focus', () => {
        if (justSwiped) {
          taskTitle.blur();
          return;
        }
        isManualTextareaExpanded = false;
        autoResizeTextarea();
        updateCollapseLogic();
        updateSavedSelection();
      });

      taskTitle.addEventListener('blur', () => {
        updateSavedSelection();
        setTimeout(() => {
          // If emoji tray is open and was kept expanded, don't collapse on blur
          if (isEmojiTrayOpen && isManualTextareaExpanded) {
            return;
          }
          updateCollapseLogic();
        }, 50);
      });

      taskTitle.addEventListener('keyup', updateSavedSelection);
      taskTitle.addEventListener('select', updateSavedSelection);

      taskTitle.addEventListener('input', (e) => {
        updateEmojiBackspaceVisibility();
        if (e && (e.isEmojiInsert || e.isBackspace)) {
          return;
        }
        updateSavedSelection();
        isManualTextareaExpanded = false;
        autoResizeTextarea();
        updateCollapseLogic();
      });

      taskTitle.addEventListener('touchstart', handleTouchStart, { passive: true });
      taskTitle.addEventListener('touchmove', handleTouchMove, { passive: false });
      taskTitle.addEventListener('touchend', (e) => {
        handleTouchEnd(e);
        setTimeout(updateSavedSelection, 50);
      }, { passive: true });
      taskTitle.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    }

    if (titleSubmitContainer) {
      titleSubmitContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
      titleSubmitContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
      titleSubmitContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
      titleSubmitContainer.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    }

    // Automatically close emoji tray if the drawer is closed or hidden
    if (slidingInputView) {
      const drawerObserver = new MutationObserver(() => {
        if (!slidingInputView.classList.contains('show')) {
          if (isEmojiTrayOpen) {
            closeEmojiTray();
          }
        }
      });
      drawerObserver.observe(slidingInputView, { attributes: true, attributeFilter: ['class'] });
    }

    if (dynamicCollapsibleTools) {
      dynamicCollapsibleTools.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'max-width') {
          autoResizeTextarea();
        }
      });
    }

    if (taskTitle && typeof ResizeObserver !== 'undefined') {
      let prevObservedWidth = 0;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (w > 0 && Math.abs(w - prevObservedWidth) > 3) {
            prevObservedWidth = w;
            autoResizeTextarea();
          }
        }
      });
      ro.observe(taskTitle);
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
