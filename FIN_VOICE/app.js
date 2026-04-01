const state = {
  mode: 'diary',
  diaryCategories: [],
  thoughtCategories: [],
  mediaRecorder: null,
  mediaStream: null,
  chunks: []
};

function qs(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const box = qs('statusBox');
  if (box) box.textContent = text || '';
}

function todayValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function setMode(mode) {
  state.mode = mode;

  qs('btnModeDiary').classList.toggle('active', mode === 'diary');
  qs('btnModeThought').classList.toggle('active', mode === 'thought');

  qs('diaryForm').style.display = mode === 'diary' ? '' : 'none';
  qs('thoughtForm').style.display = mode === 'thought' ? '' : 'none';
}

function fillSelect(el, items, placeholder) {
  if (!el) return;
  el.innerHTML = '';

  const p = document.createElement('option');
  p.value = '';
  p.textContent = placeholder || 'Выбери';
  el.appendChild(p);

  (items || []).forEach(item => {
    const o = document.createElement('option');
    o.value = item.CATEGORY_ID || '';
    o.textContent = item.NAME || '';
    el.appendChild(o);
  });
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error((json && json.error) || `HTTP ${res.status}`);
  }
  return json;
}

async function loadBootstrap() {
  setStatus('Загружаю категории...');
  const json = await apiPost('/api/bootstrap', {});
  state.diaryCategories = json.data.diaryCategories || [];
  state.thoughtCategories = json.data.thoughtCategories || [];

  fillSelect(qs('diaryCategory'), state.diaryCategories, 'Выбери категорию');
  fillSelect(qs('thoughtCategory'), state.thoughtCategories, 'Выбери категорию');

  qs('diaryDate').value = todayValue();
  setStatus('Готово');
}

function updateDiaryTimeState() {
  const noTime = qs('diaryNoTime').checked;
  const time = qs('diaryTime');
  if (noTime) {
    time.value = '';
    time.disabled = true;
    time.style.opacity = '0.5';
  } else {
    time.disabled = false;
    time.style.opacity = '';
  }
}

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ];

  for (const t of types) {
    try {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    } catch (e) {}
  }

  return '';
}

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    throw new Error('Этот браузер не поддерживает запись аудио');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedMimeType();

  state.mediaStream = stream;
  state.chunks = [];

  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  state.mediaRecorder = recorder;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) state.chunks.push(e.data);
  };

  recorder.start();

  qs('btnRecord').disabled = true;
  qs('btnStop').disabled = false;

  setStatus('Идёт запись...');
}

async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!state.mediaRecorder) {
      reject(new Error('Нет активной записи'));
      return;
    }

    state.mediaRecorder.onstop = async () => {
      try {
        const mimeType = state.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(state.chunks, { type: mimeType });

        if (state.mediaStream) {
          state.mediaStream.getTracks().forEach(t => t.stop());
        }

        state.mediaRecorder = null;
        state.mediaStream = null;
        state.chunks = [];

        qs('btnRecord').disabled = false;
        qs('btnStop').disabled = true;

        resolve(blob);
      } catch (e) {
        reject(e);
      }
    };

    try {
      state.mediaRecorder.stop();
      setStatus('Останавливаю запись...');
    } catch (e) {
      reject(e);
    }
  });
}

async function transcribeBlob(blob) {
  setStatus('Отправляю аудио на распознавание...');

  const form = new FormData();
  form.append('audio', blob, blob.type.includes('mp4') ? 'voice.mp4' : 'voice.webm');
  form.append('language', 'ru');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: form
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error((json && json.error) || `HTTP ${res.status}`);
  }

  const txt = String(json.text || '').trim();
  if (!txt) throw new Error('Пустой результат распознавания');

  const textarea = qs('voiceText');
  const oldVal = String(textarea.value || '').trim();
  textarea.value = oldVal ? oldVal + '\n' + txt : txt;

  setStatus('Текст распознан');
}

async function saveToFinTable() {
  const text = String(qs('voiceText').value || '').trim();
  if (!text) {
    throw new Error('Нет текста для сохранения');
  }

  if (state.mode === 'diary') {
    const payload = {
      mode: 'diary',
      date: String(qs('diaryDate').value || '').trim(),
      categoryId: String(qs('diaryCategory').value || '').trim(),
      timeText: String(qs('diaryTime').value || '').trim(),
      isNoTime: !!qs('diaryNoTime').checked,
      text: text
    };

    if (!payload.date) throw new Error('Выбери дату');
    if (!payload.categoryId) throw new Error('Выбери категорию');
    if (!payload.isNoTime && !payload.timeText) throw new Error('Укажи время или выбери "Без времени"');

    await apiPost('/api/save', payload);
    qs('voiceText').value = '';
    setStatus('Запись ежедневника сохранена в FIN_TABLE');
    return;
  }

  const payloadThought = {
    mode: 'thought',
    categoryId: String(qs('thoughtCategory').value || '').trim(),
    title: String(qs('thoughtTitle').value || '').trim(),
    text: text
  };

  if (!payloadThought.categoryId) throw new Error('Выбери категорию');
  if (!payloadThought.title) throw new Error('Укажи заголовок');

  await apiPost('/api/save', payloadThought);
  qs('voiceText').value = '';
  qs('thoughtTitle').value = '';
  setStatus('Мысль сохранена в FIN_TABLE');
}

function bindUi() {
  qs('btnModeDiary').addEventListener('click', () => setMode('diary'));
  qs('btnModeThought').addEventListener('click', () => setMode('thought'));
  qs('diaryNoTime').addEventListener('change', updateDiaryTimeState);

  qs('btnRecord').addEventListener('click', async () => {
    try {
      await startRecording();
    } catch (e) {
      setStatus('Ошибка записи: ' + (e && e.message ? e.message : e));
      qs('btnRecord').disabled = false;
      qs('btnStop').disabled = true;
    }
  });

  qs('btnStop').addEventListener('click', async () => {
    try {
      const blob = await stopRecording();
      await transcribeBlob(blob);
    } catch (e) {
      setStatus('Ошибка остановки / распознавания: ' + (e && e.message ? e.message : e));
      qs('btnRecord').disabled = false;
      qs('btnStop').disabled = true;
    }
  });

  qs('btnClear').addEventListener('click', () => {
    qs('voiceText').value = '';
    setStatus('Очищено');
  });

  qs('btnSave').addEventListener('click', async () => {
    try {
      setStatus('Сохраняю в FIN_TABLE...');
      await saveToFinTable();
    } catch (e) {
      setStatus('Ошибка сохранения: ' + (e && e.message ? e.message : e));
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindUi();
  updateDiaryTimeState();

  try {
    await loadBootstrap();
  } catch (e) {
    setStatus('Ошибка загрузки: ' + (e && e.message ? e.message : e));
  }
});