import axios from "axios";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY secret.");
  process.exit(1);
}

// 1. Get PR diff (base...HEAD shows only what this PR changed)
const diff = execSync("git diff origin/main...HEAD").toString();

if (!diff.trim()) {
  console.log("No changes against origin/main — nothing to reviewwww.");
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
  // Surface the real reason instead of a generic stack trace
  console.error("❌ Gemini API call failed.");
  console.error("Status:", err.response?.status);
  console.error("Body:", JSON.stringify(err.response?.data ?? err.message, null, 2));
  process.exit(1);
}

// 4. Extract AI response defensively
const review =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
  "No review was generated.";

console.log("\n🤖 GEMINI PR REVIEW:\n");
console.log(review);

// 5. Post comment to the PR via gh CLI (uses GITHUB_TOKEN from env)
const prNumber = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//)?.[1];
if (!prNumber) {
  console.log("Could not determine PR number; skipping comment.");
  process.exit(0);
}

// Write to a file to avoid shell-escaping issues with backticks/$/newlines
writeFileSync("review.md", `🤖 **Gemini PR Review**\n\n${review}`);
execSync(`gh pr comment ${prNumber} --body-file review.md`, { stdio: "inherit" });
