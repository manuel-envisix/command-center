import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyGithubError, GithubApiError } from "./github-errors.js";
import { listGithubRepositories } from "./github.js";

describe("friendlyGithubError", () => {
  it("maps API status codes", () => {
    expect(friendlyGithubError(new GithubApiError(404, "{}"), "manuel-envisix")).toContain(
      "nicht gefunden",
    );
    expect(friendlyGithubError(new GithubApiError(401, "{}"), "x")).toContain("Token");
  });
});

describe("listGithubRepositories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back from org to user repos", async () => {
    const fetchMock = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes("/orgs/manuel-envisix/repos")) {
        return {
          ok: false,
          status: 404,
          text: async () => '{"message":"Not Found"}',
        } as Response;
      }
      if (url.includes("/user/repos")) {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => [
            {
              name: "command-center",
              html_url: "https://github.com/manuel-envisix/command-center",
              owner: { login: "manuel-envisix" },
              default_branch: "main",
            },
          ],
        } as Response;
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { repos, resolvedOwner } = await listGithubRepositories("token", "manuel-envisix");
    expect(resolvedOwner).toBe("manuel-envisix");
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe("command-center");
    expect(fetchMock).toHaveBeenCalled();
  });
});
