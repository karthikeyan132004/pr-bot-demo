# pr-bot-demo

An AI pull-request reviewer built on GitHub Actions + Google Gemini.

## How it works

When a pull request is opened, updated, or reopened, the workflow in
[.github/workflows/pr-bot.yml](.github/workflows/pr-bot.yml):

1. Checks out the code (full history, so the diff is accurate).
2. Runs [scripts/review.js](scripts/review.js), which:
   - computes the PR diff (`git diff origin/main...HEAD`),
   - sends it to Gemini for review,
   - posts the review back as a comment on the PR.

## Setup

Add a repository secret named `GEMINI_API_KEY`
(Settings → Secrets and variables → Actions). `GITHUB_TOKEN` is provided
automatically by GitHub Actions.

## Trigger

The bot runs on **pull requests only** — not on direct pushes to `main`.
Open a PR to see it post a review.
