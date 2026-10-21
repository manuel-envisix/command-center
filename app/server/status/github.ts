import type { AppConfig } from "../config.js";
import { GithubApiError, friendlyGithubError } from "./github-errors.js";

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

type GhRepo = {
  name: string;
  html_url: string;
  default_branch?: string;
  owner?: { login?: string };
  full_name?: string;
};

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
    throw new GithubApiError(res.status, text);
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

function repoOwnerLogin(repo: GhRepo, fallback: string): string {
  return repo.owner?.login ?? repo.full_name?.split("/")[0] ?? fallback;
}

export async function listGithubRepositories(
  token: string,
  owner: string,
): Promise<{ repos: GhRepo[]; resolvedOwner: string }> {
  try {
    const repos = (await ghFetch(
      token,
      `/orgs/${encodeURIComponent(owner)}/repos?per_page=30&sort=updated`,
    )) as GhRepo[];
    return { repos, resolvedOwner: owner };
  } catch (err) {
    if (!(err instanceof GithubApiError) || err.status !== 404) {
      throw err;
    }
  }

  try {
    const repos = (await ghFetch(
      token,
      `/user/repos?affiliation=owner&per_page=30&sort=updated`,
    )) as GhRepo[];
    const filtered = repos.filter((r) => repoOwnerLogin(r, owner) === owner);
    if (filtered.length > 0) {
      return { repos: filtered, resolvedOwner: owner };
    }
    if (repos.length > 0) {
      const login = repoOwnerLogin(repos[0], owner);
      return { repos, resolvedOwner: login };
    }
  } catch (err) {
    if (!(err instanceof GithubApiError) || (err.status !== 404 && err.status !== 403)) {
      throw err;
    }
  }

  const repos = (await ghFetch(
    token,
    `/users/${encodeURIComponent(owner)}/repos?per_page=30&sort=updated`,
  )) as GhRepo[];
  return { repos, resolvedOwner: owner };
}

export async function fetchGithubStatus(config: AppConfig): Promise<GithubStatusSummary> {
  const token = config.github?.token;
  const org = config.github?.org ?? "manuel-envisix";
  if (!token) {
    return { configured: false, org: null, totalOpenPrs: 0, repos: [] };
  }

  try {
    const { repos, resolvedOwner } = await listGithubRepositories(token, org);
    const limited = repos.slice(0, 12);
    const repoStatuses: GithubRepoStatus[] = [];
    let totalOpenPrs = 0;

    for (const repo of limited) {
      const ownerLogin = repoOwnerLogin(repo, resolvedOwner);
      const openPrs = await countOpenPulls(token, ownerLogin, repo.name);
      totalOpenPrs += openPrs;

      let ciStatus: GithubRepoStatus["ciStatus"] = "none";
      try {
        const branch = repo.default_branch ?? "main";
        const runs = (await ghFetch(
          token,
          `/repos/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(repo.name)}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`,
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
      org: resolvedOwner,
      totalOpenPrs,
      repos: repoStatuses,
    };
  } catch (err) {
    return {
      configured: true,
      org,
      totalOpenPrs: 0,
      repos: [],
      error: friendlyGithubError(err, org),
    };
  }
}

async function countOpenPulls(token: string, owner: string, repo: string): Promise<number> {
  const search = (await ghFetch(
    token,
    `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} is:pr is:open`)}&per_page=1`,
  )) as { total_count?: number };
  return search.total_count ?? 0;
}
