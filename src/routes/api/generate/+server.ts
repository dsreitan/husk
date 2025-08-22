import type { RequestHandler } from '@sveltejs/kit';
import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';
import { buildFullPrompt } from '$lib/ai/systemPrompt';

export const GET: RequestHandler = async ({ request, locals }) => {
    const url = new URL(request.url);
    const prompt = url.searchParams.get('prompt');

    if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const ai = genkit({
        plugins: [googleAI()],
        model: gemini('gemini-1.5-flash'),
    });

    const res = await ai.generate(buildFullPrompt(prompt, locals.locale || 'nb'));

    return new Response(JSON.stringify({ title: res.text }), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
