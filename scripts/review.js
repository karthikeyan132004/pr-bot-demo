import axios from "axios";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

// --- Helper: post a comment on the current PR ---
function postComment(body) {
  const prNumber = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//)?.[1];
  if (!prNumber) {
    console.log("Could not determine PR number; skipping comment.");
    return;
  }
  // Write to a file to avoid shell-escaping issues with backticks/$/newlines
  writeFileSync("review.md", body);
  execSync(`gh pr comment ${prNumber} --body-file review.md`, { stdio: "inherit" });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY secret.");
  postComment("🤖 **PR Bot error:** `GEMINI_API_KEY` secret is not set on this repository.");
  process.exit(1);
}

// 1. Get PR diff (base...HEAD shows only what this PR changed)
const diff = execSync("git diff origin/main...HEAD").toString();

if (!diff.trim()) {
  console.log("No changes against origin/main — nothing to review.");
  process.exit(0);
}

// 2. Limit diff size to keep the request small and cheap
const trimmedDiff = diff.slice(0, 12000);

// 3. Call Gemini
let response;
try {
  response = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      contents: [
        {
          parts: [
            {
              text: `You are a senior software engineer performing a strict pull request review.

Rules:
- Be precise.
- Call out bugs, risks, and concrete improvements.
- If the code is good, say so.
- Keep the response structured and short.

PR DIFF:
${trimmedDiff}`,
            },
          ],
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
    }
  );
} catch (err) {
  // Surface the real reason — both in the log AND as a PR comment
  const status = err.response?.status ?? "(no status)";
  const bodyText = JSON.stringify(err.response?.data ?? err.message, null, 2);
  console.error("❌ Gemini API call failed.");
  console.error("Status:", status);
  console.error("Body:", bodyText);
  postComment(
    `🤖 **PR Bot error — Gemini API call failed**\n\n` +
      `**Status:** \`${status}\`\n\n` +
      "```json\n" +
      bodyText +
      "\n```"
  );
  process.exit(1);
}

// 4. Extract AI response defensively
const review =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
  "No review was generated.";

console.log("\n🤖 GEMINI PR REVIEW:\n");
console.log(review);

// 5. Post the review as a comment on the PR
postComment(`🤖 **Gemini PR Review**\n\n${review}`);
