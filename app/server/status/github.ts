import type { AppConfig } from "../config.js";

export interface GithubRepoStatus {
  name: string;
  openPrs: number;
  ciStatus: "success" | "failure" | "pending" | "unknown" | "none";
  url: string;
}

export interface GithubStatusSummary {
  configured: boolean;
  org: string | null;
  totalOpenPrs: number;
  repos: GithubRepoStatus[];
  error?: string;
}

async function ghFetch(token: string, path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "command-center-dashboard",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function mapCi(conclusion: string | null, status: string): GithubRepoStatus["ciStatus"] {
  if (status === "queued" || status === "in_progress" || status === "waiting") {
    return "pending";
  }
  if (conclusion === "success") return "success";
  if (conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out") {
    return "failure";
  }
  if (!conclusion && status === "completed") return "unknown";
  return "none";
}

export async function fetchGithubStatus(config: AppConfig): Promise<GithubStatusSummary> {
  const token = config.github?.token;
  const org = config.github?.org ?? "manuel-envisix";
  if (!token) {
    return { configured: false, org: null, totalOpenPrs: 0, repos: [] };
  }

  try {
    const repos = (await ghFetch(
      token,
      `/orgs/${encodeURIComponent(org)}/repos?per_page=30&sort=updated`,
    )) as Array<{ name: string; html_url: string; default_branch?: string }>;

    const limited = repos.slice(0, 12);
    const repoStatuses: GithubRepoStatus[] = [];
    let totalOpenPrs = 0;

    for (const repo of limited) {
      const openPrs = await countOpenPulls(token, org, repo.name);
      totalOpenPrs += openPrs;

      let ciStatus: GithubRepoStatus["ciStatus"] = "none";
      try {
        const branch = repo.default_branch ?? "main";
        const runs = (await ghFetch(
          token,
          `/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo.name)}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
        )) as { workflow_runs?: Array<{ status: string; conclusion: string | null }> };
        const run = runs.workflow_runs?.[0];
        if (run) {
          ciStatus = mapCi(run.conclusion, run.status);
        }
      } catch {
        ciStatus = "unknown";
      }

      repoStatuses.push({
        name: repo.name,
        openPrs,
        ciStatus,
        url: repo.html_url,
      });
    }

    return {
      configured: true,
      org,
      totalOpenPrs,
      repos: repoStatuses,
    };
  } catch (err) {
    return {
      configured: true,
      org,
      totalOpenPrs: 0,
      repos: [],
      error: err instanceof Error ? err.message : "GitHub-Fehler",
    };
  }
}

async function countOpenPulls(token: string, org: string, repo: string): Promise<number> {
  const search = (await ghFetch(
    token,
    `/search/issues?q=${encodeURIComponent(`repo:${org}/${repo} is:pr is:open`)}&per_page=1`,
  )) as { total_count?: number };
  return search.total_count ?? 0;
}
