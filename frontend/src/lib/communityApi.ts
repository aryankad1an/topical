/** Community API helpers */
import { api } from '@/lib/api';

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
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create post');
  const data = await res.json();
  return data.post;
}

export async function votePost(id: number, vote: 1 | -1): Promise<Post> {
  const res = await fetch(`/api/posts/${id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote }),
  });
  if (!res.ok) throw new Error('Vote failed');
  const data = await res.json();
  return data.post;
}

export async function addComment(postId: number, body: string): Promise<Comment> {
  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error('Comment failed');
  const data = await res.json();
  return data.comment;
}
