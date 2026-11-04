import App from "../../App";
import { notFound } from "next/navigation";
import { sections } from "../../sections";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  if (
    section.length > 1 ||
    (section.length === 1 &&
      !(sections as readonly string[]).includes(section[0]))
  )
    notFound();
  return <App />;
}
