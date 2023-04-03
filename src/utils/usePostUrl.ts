import { useSnoowrapRequester } from "./useSnoowrapRequester";

export async function usePostUrl(postId: string) {
  const r = useSnoowrapRequester();
  const post = r.getSubmission(postId);

  return post.fetch().then((post) => post.url);
}
