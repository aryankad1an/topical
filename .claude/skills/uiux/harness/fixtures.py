"""Deterministic API fixtures for the UI regression harness (project-specific)."""
import re

T0 = "2026-09-20T10:00:00Z"
T1 = "2026-09-28T16:30:00Z"

USER = {
    "id": "u_alice", "email": "alice@example.test", "given_name": "Alice", "family_name": "Moreau",
    "picture": None, "username": "alice", "bio": "Writes about systems and the history of computing.",
    "avatarUrl": None, "roles": ["user"],
}

MDX = """# Dynamic programming

Dynamic programming solves a problem once per distinct subproblem and reuses the answer whenever it appears again.

## Overlapping subproblems

A naive recursion for **Fibonacci** recomputes the same values exponentially often. Memoising turns it linear.

```python
def fib(n, memo={}):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]
```

## Optimal substructure

| Problem | Subproblem | Time |
|---|---|---|
| Knapsack | items × capacity | O(nW) |
| LCS | prefixes | O(nm) |
| Edit distance | prefixes | O(nm) |

The recurrence is $T(n) = T(n-1) + T(n-2)$, with closed form $$F_n = \\frac{\\varphi^n - \\psi^n}{\\sqrt 5}$$

### Tabulation

- Fill the table bottom-up.
- Keep only the last row when memory matters.

> A problem has optimal substructure when an optimal solution contains optimal solutions to its subproblems.

## Further reading
"""

LATEX = r"""\section{Introduction}
Graph colouring assigns a colour to each vertex so that no edge joins two vertices of the same colour.

\subsection{Chromatic number}
The smallest such $k$ is $\chi(G)$. For a complete graph, $\chi(K_n) = n$.

\begin{itemize}
  \item Bipartite graphs have $\chi(G) \le 2$.
  \item Planar graphs have $\chi(G) \le 4$.
\end{itemize}

\section{Algorithms}
Greedy colouring uses at most $\Delta(G) + 1$ colours.
"""


def plan(pid, name, main, content, public=False, co=None):
    return {
        "id": pid, "userId": "u_alice", "name": name, "mainTopic": main,
        "topics": [{"topic": name, "mdxContent": content, "isSubtopic": False}],
        "coAuthors": co or [], "authorUsername": "alice",
        "coAuthorUsernames": ["bruno"] if co else [],
        "isPublic": public, "createdAt": T0, "updatedAt": T1,
    }


# Served by id only, never listed: the preview's empty state.
BLANK = plan(104, "Untitled", "Untitled", "")

PLANS = [
    plan(101, "Dynamic programming", "Dynamic programming", MDX, public=True, co=["u_bruno"]),
    plan(102, "Graph colouring", "latex:Graph colouring", LATEX),
    plan(103, "The Bretton Woods system", "The Bretton Woods system",
         "# The Bretton Woods system\n\n## Origins\n\nFixed exchange rates pegged to the dollar.\n\n## Collapse\n"),
    plan(104, "CRISPR gene editing", "CRISPR gene editing", ""),
]

POSTS = [
    {"id": 1, "userId": "u_bruno", "authorName": "Bruno Silva", "title": "How do you structure a survey document?",
     "body": "I keep ending up with sections that overlap. Does anyone outline before generating, or refine after?",
     "lessonPlanId": 101, "lessonPlanName": "Dynamic programming", "upvotes": 12, "downvotes": 1,
     "commentCount": 2, "createdAt": T0},
    {"id": 2, "userId": "u_alice", "authorName": "Alice Moreau", "title": "LaTeX export tips",
     "body": "Numbered sections and a preamble go a long way.", "lessonPlanId": None, "lessonPlanName": None,
     "upvotes": 4, "downvotes": 0, "commentCount": 0, "createdAt": T1},
]

COMMENTS = [
    {"id": 1, "postId": 1, "userId": "u_alice", "authorName": "Alice Moreau",
     "body": "Outline first, then refine the outline before writing anything.", "createdAt": T1},
    {"id": 2, "postId": 1, "userId": "u_carla", "authorName": "Carla Ng", "body": "Same here.", "createdAt": T1},
]

PEOPLE = [
    {"id": "u_alice", "username": "alice", "givenName": "Alice", "familyName": "Moreau",
     "bio": USER["bio"], "avatarUrl": None, "createdAt": T0},
    {"id": "u_bruno", "username": "bruno", "givenName": "Bruno", "familyName": "Silva",
     "bio": None, "avatarUrl": None, "createdAt": T0},
]


def respond(path, method, variant, authed):
    """Return (status, body) for an /api path."""
    p = path.split("?")[0][len("/api"):]
    empty = variant == "empty"
    if p == "/me":
        return 200, {"user": USER if authed else None, "isNewUser": False}
    if p == "/lessonPlans" and method == "GET":
        return 200, {"lessonPlans": [] if empty else PLANS}
    if p == "/lessonPlans/public":
        return 200, {"lessonPlans": [] if empty else [PLANS[0]]}
    m = re.fullmatch(r"/lessonPlans/(\d+)/shared", p)
    if m:
        pid = int(m.group(1))
        for pl in PLANS + [BLANK]:
            if pl["id"] == pid:
                return 200, {"plan": pl, "access": "owner" if authed else "reader"}
        return 404, {"error": "That document is not available"}
    if p == "/posts":
        return 200, {"posts": [] if empty else POSTS}
    m = re.fullmatch(r"/posts/(\d+)", p)
    if m:
        post = next((x for x in POSTS if x["id"] == int(m.group(1))), POSTS[0])
        return 200, {"post": post, "comments": COMMENTS if post["id"] == 1 else []}
    if p == "/people":
        return 200, {"people": [] if empty else PEOPLE}
    m = re.fullmatch(r"/people/(\w+)", p)
    if m:
        person = next((x for x in PEOPLE if x["username"] == m.group(1)), None)
        if not person:
            return 404, {"error": "Profile not found"}
        return 200, {"person": person, "published": [] if empty else [
            {"id": 101, "name": "Dynamic programming", "mainTopic": "Dynamic programming", "createdAt": T0, "updatedAt": T1}]}
    m = re.fullmatch(r"/user/(\w+)", p)
    if m:
        uid = m.group(1)
        pr = next((x for x in PEOPLE if x["id"] == uid), PEOPLE[0])
        return 200, {"user": {"id": uid, "given_name": pr["givenName"], "family_name": pr["familyName"],
                              "username": pr["username"], "avatar_url": None}}
    if p == "/search/username":
        return 200, {"users": []}
    return 200, {}
