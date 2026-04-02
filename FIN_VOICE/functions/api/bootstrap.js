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
        raw: rawText.substring(0, 800)
      }, 500);
    }

    return json(data, res.ok ? 200 : res.status);

  } catch (e) {
    return json({
      ok: false,
      error: String(e && e.message ? e.message : e)
    }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
