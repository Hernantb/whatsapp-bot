import { NextResponse } from "next/server"

export async function GET() {
  // Simulate logout without depending on Supabase
  console.log("Simulated logout in API")

  // Redirect user to login page
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
}

