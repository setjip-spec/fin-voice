export async function onRequestPost(context) {
  try {
    const appsScriptUrl = context.env.APPS_SCRIPT_URL;
    const secret = context.env.VOICE_SHARED_SECRET;

    if (!appsScriptUrl) {
      return json({ ok: false, error: 'APPS_SCRIPT_URL is missing' }, 500);
    }
    if (!secret) {
      return json({ ok: false, error: 'VOICE_SHARED_SECRET is missing' }, 500);
    }

    const body = await context.request.json();
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

    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);

  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}