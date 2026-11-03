import IsolaApp from "@/components/isola-app";
import { demoWorld } from "@/domain/world";

export default function Home() {
  return <IsolaApp initialWorld={demoWorld()} />;
}
