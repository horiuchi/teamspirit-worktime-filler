(async () => {
  const START_TIME = '10:00';
  const END_TIME = '18:30';
  const DEV_LABEL = 'Dev';
  const WAIT_MS = 250;
  const TIMEOUT_MS = 20000;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function visible(element) {
    return !!element && !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  async function waitFor(selector, timeoutMs = TIMEOUT_MS) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const element = document.querySelector(selector);
      if (visible(element)) return element;
      await sleep(WAIT_MS);
    }
    throw new Error(`${selector} が表示されませんでした。`);
  }

  async function waitUntilClosed(selector, timeoutMs = TIMEOUT_MS) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (!visible(document.querySelector(selector))) return;
      await sleep(WAIT_MS);
    }
    throw new Error(`${selector} が閉じませんでした。`);
  }

  function inputValue(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  }

  function clickElement(element) {
    element.scrollIntoView?.({ block: 'center', inline: 'center' });
    element.focus?.();
    ['mousedown', 'mouseup'].forEach((type) => {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    if (element.click) {
      element.click();
    } else {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }

  function findVisibleButtonByText(container, text) {
    return Array.from(container.querySelectorAll('button, input[type="button"], .dijitButtonNode, [role="button"]'))
      .find((element) => {
        const label = element.value || element.innerText || element.textContent || '';
        return visible(element) && label.includes(text);
      });
  }

  async function clickAndWaitUntilClosed(buttonSelector, dialogSelector, label) {
    const dialog = await waitFor(dialogSelector);
    const button = document.querySelector(buttonSelector) || findVisibleButtonByText(dialog, label);
    if (!button || !visible(button)) {
      throw new Error(`${label} ボタンが表示されませんでした。`);
    }
    clickElement(button);
    await waitUntilClosed(dialogSelector);
  }

  function getDijitWidget(element) {
    const id = element?.id || element?.getAttribute?.('widgetid') || element?.closest?.('[widgetid]')?.getAttribute('widgetid');
    const dijit = window.dijit;
    if (!id || !dijit) return null;
    return dijit.byId?.(id) || dijit.registry?.byId?.(id) || null;
  }

  function dispatchValueEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getMonthLabel() {
    return document.querySelector('#yearMonthList option:checked')?.textContent?.trim() || '対象月';
  }

  function getRows() {
    return Array.from(document.querySelectorAll('tr[id^="dateRow"]'))
      .map((row) => {
        const date = row.id.replace('dateRow', '');
        return {
          date,
          row,
          week: row.cells?.[1]?.innerText.trim() || '',
          startCell: document.querySelector(`#ttvTimeSt${CSS.escape(date)}`),
          endCell: row.cells?.[5],
          workCell: document.querySelector(`#dailyWorkCell${CSS.escape(date)}`)
        };
      })
      .filter((item) => item.date && item.startCell && item.workCell && !['土', '日'].includes(item.week));
  }

  function hasExistingData(item) {
    return Boolean(
      item.startCell?.innerText.trim() ||
      item.endCell?.innerText.trim() ||
      item.workCell?.innerText.trim()
    );
  }

  async function fillTime(item) {
    clickElement(item.startCell);
    const startTime = await waitFor('#startTime');
    const endTime = await waitFor('#endTime');

    if (startTime.disabled || endTime.disabled || startTime.readOnly || endTime.readOnly) {
      const cancel = document.querySelector('#dlgInpTimeCancel');
      if (cancel) clickElement(cancel);
      await waitUntilClosed('#dialogInputTime');
      return false;
    }

    inputValue(startTime, START_TIME);
    inputValue(endTime, END_TIME);
    clickElement(await waitFor('#dlgInpTimeOk'));
    await waitUntilClosed('#dialogInputTime');
    await sleep(WAIT_MS);
    return true;
  }

  function getTaskRow(index) {
    return document.querySelector(`#empWorkSeq${index}`)?.closest('tr');
  }

  function findDevIndex() {
    for (let index = 0; index < 50; index += 1) {
      const row = getTaskRow(index);
      if (!row) continue;
      const text = row.cells?.[0]?.innerText.replace(/\s+/g, ' ').trim() || '';
      const hidden = Array.from(row.querySelectorAll('input[type="hidden"]')).map((input) => input.value).join(' ');
      if (text.includes(DEV_LABEL) || /\|DEV\b/i.test(hidden)) return index;
    }
    return -1;
  }

  function setSliderToMax(index) {
    const sliderRoot = document.querySelector(`#empWorkSlider${index}`);
    const slider = document.querySelector(`#empWorkSlider${index} [role="slider"]`);
    const valueInput = document.querySelector(`input[name="empWorkSlider${index}"]`);
    const rootInputs = Array.from(sliderRoot?.querySelectorAll('input') || []);
    const progress = document.querySelector(`#empWorkSlider${index} .dijitSliderProgressBar`);
    const remaining = document.querySelector(`#empWorkSlider${index} .dijitSliderRemainingBar`);
    const label = document.querySelector(`#empTimeLabel${index}`);
    const percentRadio = document.querySelector(`#btnPercent${index}`);

    if (percentRadio) {
      if (!percentRadio.checked) clickElement(percentRadio);
      percentRadio.checked = true;
      dispatchValueEvents(percentRadio);
      const radioWidget = getDijitWidget(percentRadio);
      radioWidget?.set?.('checked', true);
      radioWidget?.setValue?.(true);
    }
    if (valueInput) {
      valueInput.value = '1000';
      dispatchValueEvents(valueInput);
    }
    rootInputs.forEach((input) => {
      input.value = '1000';
      dispatchValueEvents(input);
    });
    if (sliderRoot) {
      sliderRoot.value = '1000';
      dispatchValueEvents(sliderRoot);
    }
    const widget = getDijitWidget(sliderRoot) || getDijitWidget(slider);
    if (widget?.set) {
      widget.set('value', 1000);
      widget.onChange?.(1000);
    } else if (widget?.setValue) {
      widget.setValue(1000);
    }
    if (slider) {
      slider.focus?.();
      slider.setAttribute('aria-valuenow', '1000');
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      slider.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (progress) progress.style.width = '100%';
    if (remaining) remaining.style.width = '0%';
    if (label) label.textContent = '100%';
  }

  function getSliderValue(index) {
    const sliderRoot = document.querySelector(`#empWorkSlider${index}`);
    const slider = document.querySelector(`#empWorkSlider${index} [role="slider"]`);
    const valueInput = document.querySelector(`input[name="empWorkSlider${index}"]`);
    const widget = getDijitWidget(sliderRoot) || getDijitWidget(slider);
    const widgetValue = widget?.get?.('value') ?? widget?.value;
    const rawValue = widgetValue ?? valueInput?.value ?? slider?.getAttribute('aria-valuenow') ?? '0';
    return Number(rawValue);
  }

  async function waitForSliderValue(index, expectedValue) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 3000) {
      if (getSliderValue(index) === expectedValue) return;
      await sleep(WAIT_MS);
    }
    throw new Error(`Dev 100% が画面内部値に反映されませんでした。`);
  }

  async function fillDevWork(item) {
    clickElement(item.workCell);
    await waitFor('#dialogWorkBalance');
    const devIndex = findDevIndex();
    if (devIndex < 0) {
      clickElement(await waitFor('#empWorkCancel'));
      await waitUntilClosed('#dialogWorkBalance');
      throw new Error(`${item.date}: Dev タスクが見つかりません。`);
    }

    setSliderToMax(devIndex);
    await waitForSliderValue(devIndex, 1000);
    await clickAndWaitUntilClosed('#empWorkOk', '#dialogWorkBalance', '登録');
    await sleep(WAIT_MS);
  }

  async function run() {
    const rows = getRows();
    if (rows.length === 0) {
      throw new Error('入力対象の勤務日が見つかりませんでした。');
    }

    const existingRows = rows.filter(hasExistingData);
    if (existingRows.length > 0) {
      const dates = existingRows.map((item) => item.date).join(', ');
      const ok = window.confirm(`${getMonthLabel()} に既存入力があります。上書きして続行しますか？\n${dates}`);
      if (!ok) return { status: 'cancelled', month: getMonthLabel(), existingDates: existingRows.map((item) => item.date) };
    }

    const completed = [];
    const skipped = [];
    for (const row of rows) {
      const timeFilled = await fillTime(row);
      if (!timeFilled) {
        skipped.push(row.date);
        continue;
      }
      await fillDevWork(row);
      completed.push(row.date);
    }

    return {
      status: 'completed',
      month: getMonthLabel(),
      completedCount: completed.length,
      completedDates: completed,
      skippedDates: skipped
    };
  }

  return run();
})();
