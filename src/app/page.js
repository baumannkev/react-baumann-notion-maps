"use client";

import dynamic from "next/dynamic";

// This ensures the heavy Leaflet/DOM logic never SSRs
const NotionMaps = dynamic(() => import("../components/NotionMaps"), {
  ssr: false,
});

export default function Page() {
  return <NotionMaps />;
}
