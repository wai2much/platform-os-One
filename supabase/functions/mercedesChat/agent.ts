// The agent loop Mercedes runs on. Kept generic — a system prompt, a tool
// list and a tool runner in, a settled reply or a tool-loop timeout out.

import { hasWebSearch, looksLikeWebSearchRejection, withoutWebSearch } from '../_shared/webSearch.ts';

export type Block = { type: string; id?: string; name?: string; input?: any; text?: string };
export type ToolRunner = (name: string, input: Record<string, any>) => Promise<unknown>;

export type AgentResult = {
  content: string;
  toolsUsed: string[];
  hops: number;
  stopped?: 'max_hops';
};

export async function runAgent(opts: {
  apiKey: string;
  model: string;
  system: string;
  tools: unknown[];
  messages: Array<{ role: string; content: unknown }>;
  maxHops: number;
  maxTokens?: number;
  runTool: ToolRunner;
  cache?: boolean;
}): Promise<AgentResult> {
  const convo = [...opts.messages];
  const toolsUsed: string[] = [];

  // Flipped once if the API rejects the server-side search tool, so we stop
  // sending it for the rest of this turn instead of failing every hop.
  let searchDisabled = false;

  const post = async (tools: unknown[]) =>
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 2048,
        // Persona and tool schemas are identical on every hop — cache them so a
        // long tool loop doesn't re-bill the whole preamble each time.
        system: opts.cache === false
          ? opts.system
          : [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
        tools: opts.cache === false
          ? tools
          : tools.map((t: any, i) =>
            i === tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
          ),
        messages: convo,
        // No temperature: recent Claude models reject it on some endpoints —
        // "`temperature` is deprecated for this model" → 400 on every call.
      }),
    });

  for (let hop = 0; hop < opts.maxHops; hop++) {
    const tools = searchDisabled ? withoutWebSearch(opts.tools) : opts.tools;
    let res = await post(tools);

    // Losing web search is a worse answer. A hard 400 on every message is a
    // dead assistant, and from the floor those look identical — so if the
    // search tool is what it objected to, drop it and carry on without.
    if (!res.ok && res.status === 400 && hasWebSearch(tools)) {
      const body = await res.text();
      if (looksLikeWebSearchRejection(body)) {
        console.error('web search rejected, continuing without it:', body.slice(0, 200));
        searchDisabled = true;
        res = await post(withoutWebSearch(opts.tools));
      } else {
        throw new Error(`Claude API error (400): ${body.slice(0, 300)}`);
      }
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error (${res.status}): ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    const blocks: Block[] = data.content || [];

    // 'pause_turn' means she stopped mid-answer to run a server-side search.
    // Hand the partial turn straight back so she can finish the sentence —
    // treating it as "done" is what cuts an answer off halfway.
    if (data.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (data.stop_reason !== 'tool_use') {
      const content = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();
      return { content, toolsUsed, hops: hop + 1 };
    }

    convo.push({ role: 'assistant', content: blocks });

    const results = [];
    for (const b of blocks.filter((x) => x.type === 'tool_use')) {
      toolsUsed.push(b.name || '?');
      let out: unknown;
      try {
        out = await opts.runTool(b.name || '', b.input || {});
      } catch (e) {
        // Hand the failure back rather than throwing — the agent can report a
        // failed lookup, which beats the whole chat dying.
        out = { error: (e as Error).message };
      }
      results.push({
        type: 'tool_result',
        tool_use_id: b.id,
        content: JSON.stringify(out).slice(0, 20000),
      });
    }
    convo.push({ role: 'user', content: results });
  }

  return {
    content: '',
    toolsUsed,
    hops: opts.maxHops,
    stopped: 'max_hops',
  };
}
