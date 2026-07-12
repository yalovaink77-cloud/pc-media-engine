import { normalizeSeoText } from './text.js';

/** FAQ entry extracted from Markdown content. */
export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
  readonly normalizedQuestion: string;
  readonly lineNumber: number;
}

const FAQ_QUESTION_PATTERN = /^\*\*Q:\s*(.+?)\*\*\s*$/i;
const FAQ_ANSWER_PATTERN = /^A:\s*(.+)\s*$/i;

/** Extract FAQ question/answer pairs from Markdown FAQ sections. */
export function extractMarkdownFaqEntries(markdown: string): readonly FaqEntry[] {
  const lines = markdown.split('\n');
  const entries: FaqEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const questionMatch = lines[index]?.match(FAQ_QUESTION_PATTERN);
    if (!questionMatch) {
      continue;
    }

    const question = (questionMatch[1] ?? '').trim();
    const answerLine = lines[index + 1] ?? '';
    const answerMatch = answerLine.match(FAQ_ANSWER_PATTERN);
    const answer = answerMatch ? (answerMatch[1] ?? '').trim() : '';

    entries.push(
      Object.freeze({
        question,
        answer,
        normalizedQuestion: normalizeSeoText(question),
        lineNumber: index + 1,
      }),
    );
  }

  return Object.freeze(entries);
}
