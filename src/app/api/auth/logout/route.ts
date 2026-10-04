import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { destroySession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(publicUrl(request, "/"), 303);
}
