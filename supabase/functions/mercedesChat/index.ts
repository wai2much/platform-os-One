import { serviceClient, requireUser } from '../_shared/client.ts';
import { json, handlePreflight } from '../_shared/cors.ts';
import { buildMercedesSystem, toAnthropicMessages } from './persona.ts';
import { TOOLS, runTool } from './tools.ts';
import { runAgent } from './agent.ts';
import { identityBlock, orgContextOf } from './identity.ts';
import { WEB_SEARCH_TOOL } from '../_shared/webSearch.ts';

// ============================================================================
// Mercedes — the Hyper Agent's brain. Claude, with eyes and hands scoped to
// the caller's own tenant.
//
// Ported from platform-os-ver-2.5's supabase/functions/mercedesChat, which
// runs a single-tenant version of this same agent for TyrePlus Thomastown.
// The agent loop is identical (agent.ts is copied verbatim); tools.ts and
// identity.ts are rewritten against Slim's multi-tenant schema — see each
// file's header for what changed and why.
//
// v1 scope: no spawn_agent/sub-agent delegation (v2.5 has it) — a
// straightforward follow-up once the core loop is proven live. Attachments
// ARE supported: a user turn may carry `files`, which persona.ts turns into
// image/document/text blocks.
// Contract: POST { messages: [{ from: 'user'|'bot', text, files? }] } -> { content }.
// Secret: ANTHROPIC_API_KEY.
// ============================================================================

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 2048;
const MAX_HOPS = 8;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    // Slim's Mercedes.jsx stores { from: 'user'|'bot', text } — normalise to
    // the { role, content } shape the Anthropic API and toAnthropicMessages expect.
    const rawMessages = Array.isArray(body.messages)
      ? body.messages.map((m: any) => ({
        role: m?.from === 'user' ? 'user' : m?.from === 'bot' ? 'assistant' : m?.role,
        content: m?.text ?? m?.content,
        // Whatever was clipped to this turn with the paperclip. Normalised
        // into content blocks by toAnthropicMessages.
        files: m?.files,
      }))
      : [];
    const messages = toAnthropicMessages(rawMessages);
    if (!messages.length) return json({ error: 'No messages provided' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({
        error: 'ANTHROPIC_API_KEY is not set. Add it in Supabase → Edge Functions → Secrets.',
      }, 500);
    }

    const svc = serviceClient();
    const ctx = await orgContextOf(user, svc);
    if (!ctx) return json({ error: 'No organization found for this account.' }, 403);

    const result = await runAgent({
      apiKey,
      model: MODEL,
      system: `${identityBlock(user, ctx)}\n\n${buildMercedesSystem({ name: ctx.orgName, vertical: ctx.vertical })}`,
      // Search goes FIRST so the ephemeral cache marker stays on the last of
      // our own tools and keeps caching the whole preamble.
      tools: [WEB_SEARCH_TOOL, ...TOOLS],
      messages,
      maxHops: MAX_HOPS,
      maxTokens: MAX_TOKENS,
      runTool: (name, input) => runTool(name, input, svc, ctx.orgId, ctx.role),
    });

    if (result.stopped === 'max_hops') {
      return json({
        error: `Mercedes kept looking things up and did not settle within ${MAX_HOPS} steps. Try a narrower question.`,
      }, 504);
    }

    let content = result.content;
    if (!content) return json({ error: 'Claude returned an empty reply' }, 502);
    if (content.length > 10000) content = content.slice(0, 9997) + '...';

    return json({ content, tools_used: result.toolsUsed });
  } catch (error) {
    console.error('mercedesChat error:', (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
