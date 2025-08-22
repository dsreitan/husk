// Central system instructions for the LLM used in the Husk app.
// Keep this stable; downstream logic prepends it to user prompts.
// Optional override: set env var LLM_SYSTEM_PROMPT for deployment-specific tuning.

// export const baseSystemPrompt = `You are an efficient, concise AI assistant inside the Husk app.
// - Be brief unless detail is explicitly requested.
// - Use markdown formatting (lists, code fences) when it improves clarity.
// - Never expose secrets, API keys, or raw environment variables.
// - If a request is unsafe or disallowed, refuse succinctly.
// - When generating code: follow SvelteKit + TypeScript idioms, keep diffs minimal.
// - Prefer incremental improvements and cite trade-offs tersely.`;
const baseSystemPrompt = `You are an expert on packing and grocery shopping.
- Expect a word or sentence about packing or grocery shopping or meal prep.
- Return suggestions for items to buy or remember.
- Suggestions should be noun phrases, and not include verbs.
- Capitalize the first letter of each suggestion.
- Return suggestions in a comma-separated list.`;

function getSystemPrompt(): string {
    if (typeof process !== 'undefined') {
        const override = process.env.LLM_SYSTEM_PROMPT?.trim();
        if (override) { return override; }
    }
    return baseSystemPrompt;
}

function getLocalePrompt(locale: 'en' | 'nb'): string {
    if (locale === 'nb') {
        return `Forslagene skal skrives på norsk og være relevante for norske dagligvarehandlere.`;
    }
    return "";
}

export function buildFullPrompt(userPrompt: string, locale: 'en' | 'nb'): string {
    return `${getSystemPrompt()}\n\n${getLocalePrompt(locale)}\n\nUser: ${userPrompt}`;
}
