const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isRateLimitError } = require('./geminiService');

/**
 * SuggestionQueueManager
 * Implements serial queuing and retry backoff for follow-up suggestions
 */
class SuggestionQueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.isProcessing = false;
      // Process next item after a minimal spacing to protect free-tier quota
      setTimeout(() => this.processNext(), 200);
    }
  }
}

const suggestionQueue = new SuggestionQueueManager();

/**
 * Generate ONE short, specific next follow-up question using streaming Gemini API
 * @param {Object} options
 * @param {string} options.lastAnswerTranscript - The finalized text of candidate's last answer
 * @param {Object} options.resumeSummary - Candidate analysis & metadata
 * @param {Object} options.questionBank - 8-10 prepared question bank
 * @param {Array<string>} options.alreadyAskedQuestions - Questions already asked
 * @param {Function} options.onChunk - Callback for token-by-token streaming
 * @returns {Promise<string>} Full generated response text
 */
async function generateNextQuestionStream({
  lastAnswerTranscript,
  resumeSummary = {},
  questionBank = {},
  alreadyAskedQuestions = [],
  onChunk
}) {
  return suggestionQueue.enqueue(() =>
    executeWithRetry({
      lastAnswerTranscript,
      resumeSummary,
      questionBank,
      alreadyAskedQuestions,
      onChunk
    })
  );
}

/**
 * Executes streaming call with single-retry backoff on 429
 */
async function executeWithRetry(params, attempt = 1) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is not configured in server/.env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const candidateName = params.resumeSummary?.candidateName || 'Candidate';
  const seniority = params.resumeSummary?.seniority || 'Senior';
  const skills = (params.resumeSummary?.skills || []).join(', ');
  const gaps = (params.resumeSummary?.knowledgeGapsAndProbingAreas || [])
    .map(g => `- ${g.topic}: ${g.reasonToProbe}`)
    .join('\n');
  const askedList = (params.alreadyAskedQuestions || [])
    .map((q, i) => `${i + 1}. ${q}`)
    .join('\n');

  const prompt = `
You are an elite technical interviewer conducting a live **${seniority}** engineering interview with **${candidateName}**.

### Candidate Context:
- **Seniority**: ${seniority}
- **Core Skills**: ${skills || 'General Technical'}
- **Known Knowledge Gaps / Probing Areas**:
${gaps || 'None listed'}

### Questions Already Asked in This Call (DO NOT REPEAT):
${askedList || 'None yet'}

### Candidate's Last Spoken Answer:
"${params.lastAnswerTranscript || 'Candidate gave a general overview of their experience.'}"

### Instructions:
Generate **EXACTLY ONE short, sharp, highly specific follow-up question** that directly interrogates the candidate's last answer.
- Drill into technical implementation details, architectural trade-offs, concurrency issues, failure modes, or ambiguities mentioned in their answer.
- Calibrate the depth strictly to the **${seniority}** level.
- DO NOT provide a list of questions. Output only ONE single question and a brief explanation.

### Required Output Format:
**Next Question:** <The single sharp follow-up question>

**Why this follows:** <1-2 sentences on what in their answer prompted this question and what signal/depth it probes for>
`;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest'
  ].filter(Boolean);

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Suggestion Service] Streaming next question using model: ${modelName} (Attempt ${attempt})`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300
        }
      });

      const result = await model.generateContentStream(prompt);
      let fullText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        if (typeof params.onChunk === 'function') {
          params.onChunk(chunkText);
        }
      }

      return fullText;
    } catch (err) {
      console.warn(`[Suggestion Service] Model ${modelName} stream warning:`, err.message);
      lastError = err;

      if (isRateLimitError(err) && attempt === 1) {
        console.log('[Suggestion Service] 429 Rate Limit encountered. Retrying once after 1500ms backoff...');
        await new Promise(r => setTimeout(r, 1500));
        return executeWithRetry(params, 2);
      }

      if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('unreachable'))) {
        continue;
      }
    }
  }

  if (isRateLimitError(lastError)) {
    const rateLimitErr = new Error('Gemini API free-tier rate limit reached. Please pick from your Question Bank.');
    rateLimitErr.status = 429;
    throw rateLimitErr;
  }

  throw new Error(`Failed to generate follow-up question: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
  generateNextQuestionStream
};
