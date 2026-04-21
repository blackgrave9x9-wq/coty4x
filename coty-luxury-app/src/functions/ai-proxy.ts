// functions/ai-proxy.ts
export const onRequest: PagesFunction = async (context) => {
  // Ruhusu POST pekee
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Pata body kutoka frontend
    const requestBody = await context.request.json();

    // Omba DeepSeek API (streaming mode ikiwa imewekwa)
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    // Ikiwa DeepSeek imerudi kosa, rudisha ujumbe wake
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      return new Response(errorText, { status: deepseekResponse.status });
    }

    // Rudisha stream au JSON moja kwa moja (kwa kuwa tunatumia streaming)
    // Tumia headers sahihi kwa SSE
    return new Response(deepseekResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
