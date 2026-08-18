// Turning what someone clipped to a chat message into blocks Claude can read.
//
// The client (Mercedes.jsx) sends attachments alongside a message as
//
//   { from: 'user', text: '…', files: [{ name, type, size, data }] }
//
// where `data` is raw base64 with no `data:` URI prefix. This module is the
// only place that decides what each MIME type becomes on the wire, so
// mercedesChat and the v2 `mercedes` function stay in agreement — a file that
// works on one has to work on the other, or a cutover changes behaviour.
//
// Three outcomes per file:
//   image/*            -> an image block (she sees it)
//   application/pdf    -> a document block (she reads the pages, layout included)
//   text-ish           -> the decoded text, inlined and fenced with its filename
//   anything else      -> a one-line note saying it came through and was skipped
//
// Nothing here throws. A bad attachment degrades to a note in the transcript;
// it never takes the chat down.

export type IncomingFile = {
  name?: string;
  type?: string;
  size?: number;
  /** Base64, no `data:` prefix. */
  data?: string;
};

export type ContentBlock = Record<string, unknown>;

/** Claude's vision endpoint accepts these four and nothing else. */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/**
 * Extensions we inline as text when the browser gives us a useless MIME type.
 * Browsers routinely report '' or 'application/octet-stream' for .md, .log
 * and .csv, and the file is perfectly readable underneath.
 */
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|log|ya?ml|xml|html?|css|js|jsx|ts|tsx|sql|ini|conf|env)$/i;

/** Per-file ceilings. Anthropic rejects images over 5MB; the rest is our own
 *  restraint, so one 40MB PDF can't blow the Edge Function's memory. */
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024;
const MAX_PDF_BASE64 = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
/** How many attachments one message may carry. */
const MAX_FILES = 10;

function isTextual(type: string, name: string): boolean {
  if (type.startsWith('text/')) return true;
  if (type === 'application/json' || type === 'application/xml') return true;
  if (type === 'application/csv' || type === 'text/csv') return true;
  return TEXT_EXTENSIONS.test(name);
}

function decodeBase64Text(data: string): string {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function note(text: string): ContentBlock {
  return { type: 'text', text };
}

function kb(base64Length: number): string {
  // base64 is 4 chars per 3 bytes.
  return `${Math.round((base64Length * 3) / 4 / 1024)}KB`;
}

/**
 * Convert one message's attachments into Anthropic content blocks.
 *
 * Order is deliberate: images and documents first, the user's own words last.
 * Claude follows an instruction better when it comes after the thing it is
 * about, which is exactly how someone uses a paperclip — attach, then ask.
 */
export function attachmentBlocks(files: unknown): ContentBlock[] {
  if (!Array.isArray(files) || files.length === 0) return [];

  const blocks: ContentBlock[] = [];
  const list = files.slice(0, MAX_FILES) as IncomingFile[];

  if (files.length > MAX_FILES) {
    blocks.push(note(`[${files.length} files attached. Only the first ${MAX_FILES} were sent through.]`));
  }

  for (const file of list) {
    const name = String(file?.name ?? 'attachment').slice(0, 200);
    const type = String(file?.type ?? '').toLowerCase();
    // Tolerate a full data: URI in case a caller forgets to strip it.
    const data = String(file?.data ?? '').replace(/^data:[^;]*;base64,/, '').trim();

    if (!data) {
      blocks.push(note(`[Attached "${name}" arrived empty and was skipped.]`));
      continue;
    }

    if (IMAGE_TYPES.has(type)) {
      if (data.length > MAX_IMAGE_BASE64) {
        blocks.push(note(`[Attached image "${name}" is ${kb(data.length)}, over the 5MB limit. Skipped — resend it smaller.]`));
        continue;
      }
      blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data } });
      blocks.push(note(`[The image above is "${name}".]`));
      continue;
    }

    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      if (data.length > MAX_PDF_BASE64) {
        blocks.push(note(`[Attached PDF "${name}" is ${kb(data.length)}, too big to send. Skipped — split it or send the relevant pages.]`));
        continue;
      }
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
      blocks.push(note(`[The document above is "${name}".]`));
      continue;
    }

    if (isTextual(type, name)) {
      let text: string;
      try {
        text = decodeBase64Text(data);
      } catch {
        blocks.push(note(`[Attached "${name}" could not be decoded and was skipped.]`));
        continue;
      }
      const truncated = text.length > MAX_TEXT_CHARS;
      const body = truncated ? text.slice(0, MAX_TEXT_CHARS) : text;
      blocks.push(note(
        `[Attached file "${name}"${truncated ? ' — truncated, this is the first part only' : ''}]\n` +
          '```\n' + body + '\n```',
      ));
      continue;
    }

    blocks.push(note(`[Attached "${name}" (${type || 'unknown type'}). Not a format I can open — send it as an image, a PDF or plain text.]`));
  }

  return blocks;
}

/**
 * Flatten any message content — string, or a block array — down to the plain
 * text in it. Guardrails, checkpoint goals and log lines all want a string,
 * and none of them should silently become "[object Object]" the day someone
 * attaches a photo.
 */
export function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);
  return content
    .map((block) => {
      const b = block as Record<string, unknown>;
      if (typeof b?.text === 'string') return b.text;
      if (b?.type === 'image') return '[image]';
      if (b?.type === 'document') return '[document]';
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}
