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

    CURATED_EMOJIS.forEach((emoji) => {
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
    dynamicEmojiTray.classList.remove('hidden');
    slidingInputView.classList.add('emoji-tray-active');
    if (btnEmojiPicker) btnEmojiPicker.classList.add('active');
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

  let measureCanvas = null;
  function getTextWidth(text) {
    if (!text) return 0;
    if (!measureCanvas) {
      measureCanvas = document.createElement('canvas');
    }
    const ctx = measureCanvas.getContext('2d');
    const computedFont = taskTitle ? window.getComputedStyle(taskTitle).font : '';
    ctx.font = computedFont || '15.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    return ctx.measureText(text).width;
  }

  function getAvailableTextareaWidth() {
    if (!templateTitleSubmitContainer) return 200;
    const totalRowWidth = templateTitleSubmitContainer.clientWidth;
    if (totalRowWidth <= 0) return 200;

    const isCollapsed = slidingInputView && slidingInputView.classList.contains('actions-collapsed');
    // In collapsed state: chevron (30px) + submit (34px) + row gap (6px) + pill padding/icons/gaps (~80px) = ~150px
    const collapsedDeduction = 150;

    if (isCollapsed) {
      return Math.max(totalRowWidth - collapsedDeduction, 100);
    } else {
      const toolsWidth = dynamicCollapsibleTools ? dynamicCollapsibleTools.offsetWidth : 110;
      return Math.max(totalRowWidth - collapsedDeduction - toolsWidth, 80);
    }
  }

  // --- Auto-Resize Textarea (Max 3 lines, strictly content-dependent) ---
  function autoResizeTextarea() {
    if (!taskTitle) return;
    if (!slidingInputView || !slidingInputView.classList.contains('dynamic-bar-active')) return;

    const val = taskTitle.value || '';
    if (val.length === 0) {
      taskTitle.style.height = '22px';
      taskTitle.style.overflowY = 'hidden';
      if (typeof window.syncTaskToolbarWithDrawer === 'function') {
        window.syncTaskToolbarWithDrawer();
      }
      return;
    }

    // If there are no newlines and the text fits within the available width,
    // the content can be held by one line — keep it strictly single-line (22px)!
    const hasNewlines = val.includes('\n');
    const availableWidth = Math.max(taskTitle.clientWidth, getAvailableTextareaWidth());
    const textWidth = getTextWidth(val);

    if (!hasNewlines && textWidth <= availableWidth) {
      taskTitle.style.height = '22px';
      taskTitle.style.overflowY = 'hidden';
      if (typeof window.syncTaskToolbarWithDrawer === 'function') {
        window.syncTaskToolbarWithDrawer();
      }
      return;
    }

    // Text exceeds one line or contains newlines: step accurately
    taskTitle.style.height = '22px';
    const scrollH = taskTitle.scrollHeight;

    // Stepped line heights: 22px (1 line), 44px (2 lines), 66px (3 lines max)
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

    // Allow emoji picker button and emoji tray interactions
    if (btnEmojiPicker && btnEmojiPicker.contains(e.target)) return;
    if (dynamicEmojiTray && dynamicEmojiTray.contains(e.target)) return;

    // For any other interaction anywhere on the screen (colors, calendar, toolbar, counter, add task, chevron, etc.):
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
  }

  // --- Event Bindings ---
  let isEventsBound = false;
  function bindEvents() {
    if (isEventsBound) return;
    isEventsBound = true;
    if (btnCollapseActions) {
      btnCollapseActions.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
        }
        if (isEmojiTrayOpen) {
          closeEmojiTray();
        }
        isManualTextareaExpanded = false;
        updateCollapseLogic();
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
      submitTask.addEventListener('click', () => {
        if (isEmojiTrayOpen) closeEmojiTray();
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
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

    // Direct listener on color options container for instant response
    const colorOptionsContainer = document.querySelector('.color-button-options');
    if (colorOptionsContainer) {
      const handleColorInteraction = () => {
        if (document.activeElement === taskTitle) {
          taskTitle.blur();
        }
        if (isEmojiTrayOpen) {
          closeEmojiTray();
        }
        isManualTextareaExpanded = false;
        updateCollapseLogic();
      };
      colorOptionsContainer.addEventListener('pointerdown', handleColorInteraction, true);
      colorOptionsContainer.addEventListener('click', handleColorInteraction, true);
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
        if (e && e.isEmojiInsert) {
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
