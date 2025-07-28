import { S3Service } from "./s3";
import { callGeminiAPI } from "./gemini"; // you’ll write this
import { extractAudioOrFrames } from "./videoProcessor"; // optional, if needed

export async function checkIfEducational(videoUrl: string, s3Key: string) {
  try {
    const transcript = await extractAudioOrFrames(videoUrl); // Or skip if you want Gemini to directly classify video

    const prompt = `
      Given the following transcript or video context, determine whether this is educational content.
      If yes, respond with: YES.
      If not, respond with: NO.

      Content: """${transcript}"""
    `;

    const result = await callGeminiAPI(prompt);

    if (result.toUpperCase().includes("NO")) {
      console.log("❌ Not educational. Deleting from S3.");
      await S3Service.deleteVideo(s3Key);
    } else {
      console.log("✅ Educational. Keeping in S3.");
    }
  } catch (err) {
    console.error("❌ Error in educational check:", err);
  }
}
