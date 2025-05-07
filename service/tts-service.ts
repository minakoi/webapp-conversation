export const textToSpeech = async (text: string): Promise<ArrayBuffer> => {
    try {
        // Call our secure server endpoint instead of OpenAI directly
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        // Get the audio data from our server
        const arrayBuffer = await response.arrayBuffer();
        return arrayBuffer;
    } catch (error) {
        console.error('Error generating speech:', error);
        throw error;
    }
};