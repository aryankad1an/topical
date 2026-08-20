/** Community API helpers */

export type SortMode = 'latest' | 'top';

export interface Post {
  id: number;
  userId: string;
  authorName: string;
  title: string;
  body: string;
  lessonPlanId: number | null;
  lessonPlanName: string | null;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string | null;
}

export interface Comment {
  id: number;
  postId: number;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string | null;
}

async function postJson(url: string, body: unknown, errorMessage: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(errorMessage);
  return res.json();
}

export async function fetchPosts(sort: SortMode = 'latest'): Promise<Post[]> {
  const res = await fetch(`/api/posts?sort=${sort}`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  const data = await res.json();
  return data.posts ?? [];
}

export async function fetchPostDetail(id: number): Promise<{ post: Post; comments: Comment[] }> {
  const res = await fetch(`/api/posts/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export async function createPost(payload: {
  title: string; body: string; lessonPlanId?: number; lessonPlanName?: string;
}): Promise<Post> {
  const data = await postJson('/api/posts', payload, 'Failed to create post');
  return data.post;
}

export async function votePost(id: number, vote: 1 | -1): Promise<Post> {
  const data = await postJson(`/api/posts/${id}/vote`, { vote }, 'Vote failed');
  return data.post;
}

export async function addComment(postId: number, body: string): Promise<Comment> {
  const data = await postJson(`/api/posts/${postId}/comments`, { body }, 'Comment failed');
  return data.comment;
}

/** Surface the server's reason (e.g. "You can only delete your own posts"). */
async function del(url: string, fallback: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || fallback);
  }
}

export async function deletePost(id: number): Promise<void> {
  await del(`/api/posts/${id}`, 'Failed to delete post');
}

export async function deleteComment(postId: number, commentId: number): Promise<void> {
  await del(`/api/posts/${postId}/comments/${commentId}`, 'Failed to delete comment');
}
