const fillButton = document.querySelector('#fillButton');
const statusEl = document.querySelector('#status');

function setStatus(message) {
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

fillButton.addEventListener('click', async () => {
  fillButton.disabled = true;
  setStatus('入力を開始しています...');

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith('https://teamspirit-8860--teamspirit.vf.force.com/apex/AtkWorkTimeView')) {
      throw new Error('TeamSpirit の勤務表ページを開いてから実行してください。');
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    if (result?.status === 'cancelled') {
      setStatus('既存入力があるためキャンセルしました。');
      return;
    }

    if (result?.status === 'completed') {
      setStatus(`${result.month}: ${result.completedCount} 日分を入力しました。`);
      return;
    }

    setStatus('処理結果を取得できませんでした。ページを確認してください。');
  } catch (error) {
    setStatus(error?.message || String(error));
  } finally {
    fillButton.disabled = false;
  }
});
