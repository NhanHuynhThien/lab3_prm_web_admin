import App from "../../App";
import { notFound, permanentRedirect } from "next/navigation";
import { retiredSections, sectionPath, sections } from "../../sections";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const [name] = section;
  if (name !== undefined && Object.hasOwn(retiredSections, name))
    permanentRedirect(sectionPath(retiredSections[name]));
  if (name !== undefined && !(sections as readonly string[]).includes(name))
    notFound();
  return <App />;
}
