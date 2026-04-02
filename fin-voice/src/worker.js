/* FILE: src/worker.js */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/api/bootstrap' && request.method === 'POST') {
        return await handleBootstrap(request, env);
      }

      if (path === '/api/save' && request.method === 'POST') {
        return await handleSave(request, env);
      }

      if (path === '/api/transcribe' && request.method === 'POST') {
        return await handleTranscribe(request, env);
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({
        ok: false,
        error: String(e && e.message ? e.message : e)
      }, 500);
    }
  }
};

async function handleBootstrap(request, env) {
  const appsScriptUrl = String(env.APPS_SCRIPT_URL || '').trim();
  const secret = String(env.VOICE_SHARED_SECRET || '').trim();

  if (!appsScriptUrl) {
    return json({ ok: false, error: 'APPS_SCRIPT_URL is missing' }, 500);
  }

  if (!secret) {
    return json({ ok: false, error: 'VOICE_SHARED_SECRET is missing' }, 500);
  }

  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'bootstrap',
      secret: secret
    })
  });

  const rawText = await res.text();

  if (!rawText || !rawText.trim()) {
    return json({
      ok: false,
      error: 'Apps Script вернул пустой ответ в bootstrap'
    }, 500);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return json({
      ok: false,
      error: 'Apps Script вернул не JSON в bootstrap',
      raw: rawText.substring(0, 1000)
    }, 500);
  }

  return json(data, res.ok ? 200 : res.status);
}

async function handleSave(request, env) {
  const appsScriptUrl = String(env.APPS_SCRIPT_URL || '').trim();
  const secret = String(env.VOICE_SHARED_SECRET || '').trim();

  if (!appsScriptUrl) {
    return json({ ok: false, error: 'APPS_SCRIPT_URL is missing' }, 500);
  }

  if (!secret) {
    return json({ ok: false, error: 'VOICE_SHARED_SECRET is missing' }, 500);
  }

  const body = await request.json();
  const mode = String(body && body.mode ? body.mode : '').trim();

  let action = '';
  if (mode === 'diary') action = 'addDiary';
  if (mode === 'thought') action = 'addThought';

  if (!action) {
    return json({ ok: false, error: 'Unknown mode' }, 400);
  }

  const payload = Object.assign({}, body, {
    action: action,
    secret: secret
  });

  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();

  if (!rawText || !rawText.trim()) {
    return json({
      ok: false,
      error: 'Apps Script вернул пустой ответ в save'
    }, 500);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return json({
      ok: false,
      error: 'Apps Script вернул не JSON в save',
      raw: rawText.substring(0, 1000)
    }, 500);
  }

  return json(data, res.ok ? 200 : res.status);
}

async function handleTranscribe(request, env) {
  const openaiKey = String(env.OPENAI_API_KEY || '').trim();

  if (!openaiKey) {
    return json({ ok: false, error: 'OPENAI_API_KEY is missing' }, 500);
  }

  const form = await request.formData();
  const audio = form.get('audio');
  const language = String(form.get('language') || 'ru').trim();

  if (!audio) {
    return json({ ok: false, error: 'Audio file is missing' }, 400);
  }

  const forward = new FormData();
  forward.append('file', audio, audio.name || 'voice.webm');
  forward.append('model', 'gpt-4o-mini-transcribe');
  forward.append('response_format', 'json');
  forward.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`
    },
    body: forward
  });

  const rawText = await res.text();

  if (!rawText || !rawText.trim()) {
    return json({
      ok: false,
      error: 'OpenAI вернул пустой ответ'
    }, 500);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return json({
      ok: false,
      error: 'OpenAI вернул не JSON',
      raw: rawText.substring(0, 1000)
    }, 500);
  }

  if (!res.ok) {
    return json({
      ok: false,
      error: (data && data.error && data.error.message)
        ? data.error.message
        : `OpenAI HTTP ${res.status}`,
      raw: rawText.substring(0, 1000)
    }, res.status);
  }

  return json({
    ok: true,
    text: String(data.text || '').trim()
  }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}