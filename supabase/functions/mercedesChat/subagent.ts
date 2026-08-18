// Sub-agents. Mercedes delegates a chunk of work to a focused worker that has
// its own context, does its own digging, and reports back one answer.
// Ported from platform-os-ver-2.5's subagent.ts — same design, same
// constraints, only the persona text and tool names are tenant-generic here.
//
// Why this earns its keep: some questions need thirty lookups and produce one
// sentence ("which overdue accounts are worth chasing this week"). Doing that
// in Mercedes' own context buries the conversation in raw rows and blows her
// window. A worker eats the mess and hands her the conclusion.
//
// The constraints are the whole design:
//   READ-ONLY   — workers cannot change anything. Every write goes through
//                 Mercedes, in front of the owner, where they can see it happen.
//   NO NESTING  — a worker cannot spawn a worker. One level, always. This is
//                 the difference between delegation and a fork bomb on the
//                 org's API bill.
//   CAPPED      — a hard ceiling on workers per message and hops per worker.
//   SONNET      — workers grind through rows; they don't need Opus to do it.
//                 Mercedes stays on Opus because judgement is her job.
//   SCOPED      — a worker inherits the caller's org_id and role. It can never
//                 see another tenant's data, and a staff-login worker gets the
//                 same staff-level gate as a staff-login Mercedes.

import { runAgent, type ToolRunner } from './agent.ts';

export const WORKER_MODEL = 'claude-sonnet-5';
export const MAX_WORKERS_PER_MESSAGE = 4;
export const WORKER_MAX_HOPS = 10;

// Workers get eyes, never hands. No update_job, no create_invoice.
export const WORKER_TOOL_NAMES = ['get_floor', 'get_job', 'get_accounts', 'find_stock', 'get_customer', 'get_staff', 'recall'];

export function buildWorkerSystem(bizName: string): string {
  return `You are a research worker for Mercedes, who runs operations at ${bizName}.

She has handed you one task. Do it thoroughly and report back.

HOW YOU WORK
Use your tools as many times as it takes. Chase the detail. You exist so Mercedes doesn't have to wade through raw rows, so do the wading.
You are read-only. You cannot change anything. If the task asks you to change something, say so in your report and do the analysis instead.

HOW YOU REPORT
You are writing to Mercedes, not to a customer. No preamble, no pleasantries, no "I hope this helps".
Lead with the answer. Then the evidence: specific numbers, job numbers, invoice numbers, names.
State what you checked and what you could not find. If the data is thin, say it's thin — she will pass your limits on to the owner, so hiding them makes her wrong in front of them.
Never invent a figure. If a sell price is missing it is missing. Nothing is a real answer when it is the true one.`;
}

export const SPAWN_TOOL = {
  name: 'spawn_agent',
  description:
    "Hand a self-contained research job to a worker with its own context. Use when a question needs a lot of digging and boils down to a short answer — 'go through every overdue account and tell me who to chase', 'work out which unpriced parts are costing us most'. Give one clear task per worker; you can spawn several at once and they run together. Workers are read-only and cannot spawn their own workers. Don't use one for a single lookup you can do yourself in one call.",
  input_schema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description:
          'The full task, self-contained. The worker cannot see your conversation, so include every detail it needs and say exactly what to report back.',
      },
      label: { type: 'string', description: 'Two or three words naming the job, for the log. e.g. "overdue accounts".' },
    },
    required: ['task'],
  },
};

export async function runWorker(opts: {
  apiKey: string;
  bizName: string;
  task: string;
  label?: string;
  tools: unknown[];
  runTool: ToolRunner;
}): Promise<unknown> {
  const task = String(opts.task || '').trim();
  if (!task) return { error: 'task is required' };

  const result = await runAgent({
    apiKey: opts.apiKey,
    model: WORKER_MODEL,
    system: buildWorkerSystem(opts.bizName),
    tools: opts.tools,
    messages: [{ role: 'user', content: task }],
    maxHops: WORKER_MAX_HOPS,
    runTool: opts.runTool,
  });

  if (result.stopped === 'max_hops') {
    return {
      label: opts.label,
      incomplete: true,
      note: `Worker hit its ${WORKER_MAX_HOPS}-step limit without finishing. Narrow the task and try again.`,
      tools_used: result.toolsUsed,
    };
  }
  return { label: opts.label, report: result.content, tools_used: result.toolsUsed };
}
