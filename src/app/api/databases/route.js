import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_KEY });

export async function GET() {
  try {
    const response = await notion.search({
      filter: { property: "object", value: "database" },
    });
    let dbs = response.results.filter((db) => !db.archived);
    // dedupe by id
    const seen = new Set();
    dbs = dbs.filter((db) => {
      if (seen.has(db.id)) return false;
      seen.add(db.id);
      return true;
    });
    return NextResponse.json({ success: true, results: dbs });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
