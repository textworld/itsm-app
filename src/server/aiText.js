export function extractChatCompletionText(completion) {
  const choices = Array.isArray(completion?.choices) ? completion.choices : [];
  const candidates = [
    completion?.output_text,
    ...choices.flatMap((choice) => [choice?.message?.content, choice?.text])
  ];

  return normalizeText(candidates.map(extractTextValue).filter(Boolean).join('\n'));
}

export async function collectChatCompletionStreamText(stream) {
  let text = '';

  for await (const chunk of stream) {
    const choices = Array.isArray(chunk?.choices) ? chunk.choices : [];
    const chunkText = choices
      .flatMap((choice) => [choice?.delta?.content, choice?.message?.content, choice?.text])
      .map(extractTextValue)
      .filter(Boolean)
      .join('');
    text += chunkText;
  }

  return normalizeText(text);
}

function extractTextValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(extractTextValue).filter(Boolean).join('\n');
  }
  if (typeof value !== 'object') return '';

  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (typeof value.value === 'string') return value.value;
  if (value.text && typeof value.text.value === 'string') return value.text.value;
  if (value.content) return extractTextValue(value.content);

  return '';
}

function normalizeText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
