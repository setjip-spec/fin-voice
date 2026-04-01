export async function onRequestPost(context) {
  try {
    const openaiKey = context.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return json({ ok: false, error: 'OPENAI_API_KEY is missing' }, 500);
    }

    const form = await context.request.formData();
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

    const data = await res.json();

    if (!res.ok) {
      return json({
        ok: false,
        error: (data && data.error && data.error.message) ? data.error.message : `OpenAI HTTP ${res.status}`
      }, res.status);
    }

    return json({
      ok: true,
      text: String(data.text || '').trim()
    }, 200);

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