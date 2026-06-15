/**
 * Slack notification helper
 *
 * Posts a rich Slack Block Kit message to a webhook URL when an audit run
 * completes. Disabled when SLACK_WEBHOOK_URL is not set.
 *
 * Message includes:
 *  - Run URL, project ID, audited page URL
 *  - Severity breakdown (critical / high / medium / low / info)
 *  - Top 3 findings with rule ID and description
 *  - "View Report" button linking to the web app
 */

import pino from "pino";

const slackLogger = pino({ level: "warn" });

export interface SlackFindingSummary {
  severity: string;
  title: string;
  ruleId: string;
  description: string;
}

export interface SlackRunSummary {
  runId: string;
  projectId: string;
  url: string;
  status: string;
  findings: SlackFindingSummary[];
  webBaseUrl?: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function buildSlackBlocks(summary: SlackRunSummary): object[] {
  const { runId, url, status, findings, webBaseUrl = "http://localhost:3000" } = summary;
  const reportUrl = `${webBaseUrl}/runs/${runId}`;

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  const severityLine = ["critical", "high", "medium", "low", "info"]
    .filter((s) => counts[s])
    .map((s) => `${SEVERITY_EMOJI[s] ?? "•"} ${counts[s]} ${s}`)
    .join("   ");

  const statusEmoji = status === "failed" ? "❌" : "✅";
  const topFindings = findings
    .filter((f) => ["critical", "high", "medium"].includes(f.severity))
    .slice(0, 3);

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${statusEmoji} OpenDesign QA — Audit Complete`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Page URL*\n<${url}|${url}>` },
        { type: "mrkdwn", text: `*Status*\n${status}` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: findings.length === 0
          ? "✅ *No findings detected.*"
          : `*${findings.length} finding${findings.length === 1 ? "" : "s"} detected*\n${severityLine}`,
      },
    },
  ];

  if (topFindings.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Top findings*" },
    });
    for (const finding of topFindings) {
      const emoji = SEVERITY_EMOJI[finding.severity] ?? "•";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${finding.title}*\n\`${finding.ruleId}\` — ${finding.description.slice(0, 150)}${finding.description.length > 150 ? "…" : ""}`,
        },
      });
    }
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View Full Report", emoji: true },
        url: reportUrl,
        style: "primary",
      },
    ],
  });

  return blocks;
}

/**
 * Send an audit-complete notification to Slack.
 * No-ops silently when SLACK_WEBHOOK_URL is not configured.
 */
export async function notifySlack(summary: SlackRunSummary): Promise<void> {
  const webhookUrl = process.env["SLACK_WEBHOOK_URL"];
  if (!webhookUrl) return;

  const payload = { blocks: buildSlackBlocks(summary) };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      slackLogger.warn({ status: res.status, runId: summary.runId }, "Slack notification failed");
    }
  } catch (err) {
    slackLogger.warn({ err, runId: summary.runId }, "Slack notification threw an error");
  }
}
