type TextContentBlock = {
  type: string;
  text?: string;
};

export function extractResponseText(response: { content: TextContentBlock[] }): string {
  return response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

export function parseJsonObject<T>(text: string, passName: string): T {
  let foundObject = false;
  let lastParseError: unknown;

  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const candidate = readBalancedObject(text, start);
    if (!candidate) continue;

    foundObject = true;
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastParseError = error;
    }
  }

  if (!foundObject) {
    throw new Error(`${passName} returned no JSON`);
  }

  const message = lastParseError instanceof Error ? lastParseError.message : String(lastParseError);
  throw new Error(`${passName} returned invalid JSON: ${message}`);
}

function readBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}
