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
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
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
    const slider = document.querySelector(`#empWorkSlider${index} [role="slider"]`);
    const valueInput = document.querySelector(`input[name="empWorkSlider${index}"]`);
    const progress = document.querySelector(`#empWorkSlider${index} .dijitSliderProgressBar`);
    const remaining = document.querySelector(`#empWorkSlider${index} .dijitSliderRemainingBar`);
    const label = document.querySelector(`#empTimeLabel${index}`);
    const percentRadio = document.querySelector(`#btnPercent${index}`);

    if (percentRadio && !percentRadio.checked) clickElement(percentRadio);
    if (valueInput) {
      valueInput.value = '1000';
      valueInput.dispatchEvent(new Event('input', { bubbles: true }));
      valueInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (slider) {
      slider.setAttribute('aria-valuenow', '1000');
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      slider.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
    }
    if (progress) progress.style.width = '100%';
    if (remaining) remaining.style.width = '0%';
    if (label) label.textContent = '100%';
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
    await sleep(WAIT_MS);
    clickElement(await waitFor('#empWorkOk'));
    await waitUntilClosed('#dialogWorkBalance');
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
