import Snoowrap from "snoowrap";

export function useSnoowrapRequester() {
  const requesterOptions = {
    userAgent: "shitposter.js",
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  };

  return new Snoowrap(requesterOptions);
}
