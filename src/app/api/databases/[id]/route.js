import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_KEY });

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const db = await notion.databases.retrieve({ database_id: id });
    return NextResponse.json({ success: true, properties: db.properties });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
