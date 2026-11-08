// Plain module so the server route and the client shell share one list.
export const sections = ["overview", "crashlytics"] as const;
export type Section = (typeof sections)[number];

/** Retired pages kept as redirects so old links keep working. */
export const retiredSections: Readonly<Record<string, Section>> = {
  system: "overview",
};

/** URL of a section; the overview lives at the root. */
export const sectionPath = (section: Section) =>
  section === "overview" ? "/" : `/${section}`;
