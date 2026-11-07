// Plain module so the server route and the client shell share one list.
export const sections = ["overview", "crashlytics", "system"] as const;
export type Section = (typeof sections)[number];
