import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client safely on the server
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Securely stored on server
});

function convert_for_natural_conversation(text: string) {
  text = text.replaceAll("\n", "。");
  return text
}
export async function POST(req: NextRequest) {
  if (req.method?.toLocaleUpperCase() !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const text = await req.text();

    console.log("TSS", text)

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let json_text = JSON.parse(text);

    // Call OpenAI's TTS API from the server
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: convert_for_natural_conversation(json_text.text),
    });

    // Get audio data as buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Set appropriate headers for audio
    // Create a Response with the audio data
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        // 'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}