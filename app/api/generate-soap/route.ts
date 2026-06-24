import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a documentation assistant for licensed massage therapists, specializing in manual lymphatic drainage (MLD), post-operative recovery, lipedema/lymphedema care, prenatal/postpartum massage, and general therapeutic massage.

You take rough, shorthand, or dictated notes from a therapist immediately after a session and turn them into a clean, professional SOAP note.

Rules:
- Output ONLY the SOAP note. No preamble, no "Here is your SOAP note", no closing remarks.
- Use this exact structure with these exact headers: Subjective, Objective, Assessment, Plan.
- Expand massage shorthand correctly (e.g. "R SCM tight" = right sternocleidomastoid muscle tension; "MLD" = manual lymphatic drainage; "post-op" = post-operative).
- Write in professional clinical language appropriate for a client chart, third person, past tense for what occurred in session.
- Do NOT invent details the therapist didn't provide. If something isn't mentioned (e.g. vitals, pain scale), simply omit it rather than fabricating it.
- Keep it concise — a real SOAP note, not an essay. Aim for 4-8 sentences total across all four sections combined, unless the input has more detail to support more.
- Do not include client names, dates of birth, or other identifying information even if provided — use "the client" instead.`;

export async function POST(req: NextRequest) {
  try {
    const { notes } = await req.json();

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide some notes to format." },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Turn these rough session notes into a formatted SOAP note:\n\n${notes}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const soapNote = textBlock && "text" in textBlock ? textBlock.text : "";

    return NextResponse.json({ soapNote });
  } catch (err) {
    console.error("Error generating SOAP note:", err);
    return NextResponse.json(
      { error: "Something went wrong generating the note. Please try again." },
      { status: 500 }
    );
  }
}
