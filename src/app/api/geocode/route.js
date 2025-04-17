import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  if (!address) {
    return NextResponse.json(
      { success: false, message: "Missing address parameter" },
      { status: 400 }
    );
  }

  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}`
  );
  const geoData = await geoRes.json();
  if (geoData.length > 0) {
    const { lat, lon } = geoData[0];
    return NextResponse.json({ success: true, lat, lon });
  } else {
    return NextResponse.json(
      { success: false, message: "No results found" },
      { status: 404 }
    );
  }
}
