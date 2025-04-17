// src/app/api/databases/[id]/pages/route.js
import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_KEY });

export async function GET(request, { params }) {
  // params is now a Promise-like object in the new App Router—await it first!
  const { id } = await params;

  try {
    const response = await notion.databases.query({ database_id: id });
    return NextResponse.json({ success: true, results: response.results });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
