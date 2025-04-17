"use client";

import { useParams } from "next/navigation";
import NotionMaps from "../../../components/NotionMaps";

export default function MapPage() {
  const { id: embedDbId } = useParams();

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <NotionMaps embedDbId={embedDbId} />
    </div>
  );
}
