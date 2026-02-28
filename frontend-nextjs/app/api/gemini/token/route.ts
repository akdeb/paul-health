import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY not set in environment");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const client = new GoogleGenAI({
      apiKey,
    });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 1 * 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: {
          apiVersion: "v1alpha",
        },
      },
    });

    return NextResponse.json({
      token: token.name,
      expiresAt: expireTime,
    });
  } catch (error) {
    console.error("[Token API] Error creating ephemeral token:", error);
    return NextResponse.json(
      {
        error: "Failed to create token",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
