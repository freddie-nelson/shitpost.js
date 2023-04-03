import { useSnoowrapRequester } from "./useSnoowrapRequester";

export async function usePostTitle(postId: string) {
  const r = useSnoowrapRequester();
  const post = r.getSubmission(postId);

  return post.fetch().then((post) => post.title);
}
