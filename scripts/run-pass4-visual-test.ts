import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runPass4 } from "../src/lib/hackathon-analysis/passes/pass4-visual";

async function main() {
  const urls = process.argv.slice(2).filter(Boolean);
  if (urls.length === 0) {
    console.error("Usage: npx tsx scripts/run-pass4-visual-test.ts <screenshot-url> [more-urls...]");
    process.exit(1);
  }

  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const rl = createInterface({ input, output });
    apiKey = await rl.question("Paste Anthropic API key: ");
    rl.close();
  }

  if (!apiKey?.startsWith("sk-ant-")) {
    console.error("ANTHROPIC_API_KEY is missing or does not look like an Anthropic key.");
    process.exit(1);
  }

  const result = await runPass4(new Anthropic({ apiKey }), urls, {
    teamName: process.env.TEST_PROJECT_NAME ?? "Security auditor",
    repoUrl: process.env.TEST_REPO_URL ?? "https://github.com/neweraintelligence/Codebase-security-auditor",
    pitchText: process.env.TEST_PROJECT_DESCRIPTION ?? "Security audit assistant for codebases.",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
