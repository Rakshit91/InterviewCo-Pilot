const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// Structured response schema for candidate resume analysis (Stage 1)
const resumeAnalysisSchema = {
  description: "Candidate resume analysis and interview probing plan",
  type: SchemaType.OBJECT,
  properties: {
    candidateName: {
      type: SchemaType.STRING,
      description: "Candidate's full name if found on the resume, or 'Candidate' if not specified"
    },
    yearsOfExperience: {
      type: SchemaType.STRING,
      description: "Estimated total years of professional experience (e.g. '5+ years')"
    },
    summary: {
      type: SchemaType.STRING,
      description: "A concise 2-sentence executive summary of the candidate profile"
    },
    skills: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING
      },
      description: "Key technical skills, frameworks, languages, and tools"
    },
    notableProjects: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "Project or role initiative title" },
          description: { type: SchemaType.STRING, description: "Brief highlight of contribution and impact" },
          technologies: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Key technologies used"
          }
        },
        required: ["title", "description"]
      },
      description: "Notable projects, initiatives, or system designs from their career"
    },
    knowledgeGapsAndProbingAreas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: { type: SchemaType.STRING, description: "Domain, architecture, or skill area to probe" },
          reasonToProbe: { type: SchemaType.STRING, description: "Why this area should be verified for this seniority level" },
          suggestedQuestion: { type: SchemaType.STRING, description: "Specific interview question to test depth" }
        },
        required: ["topic", "reasonToProbe", "suggestedQuestion"]
      },
      description: "3-4 likely knowledge gaps, buzzword claims, or critical areas worth deep-probing"
    }
  },
  required: [
    "candidateName",
    "yearsOfExperience",
    "summary",
    "skills",
    "notableProjects",
    "knowledgeGapsAndProbingAreas"
  ]
};

// Structured response schema for Question Bank (Stage 2: 8-10 questions grouped by category)
const questionBankSchema = {
  description: "8 to 10 tailored interview questions categorized by topic and calibrated by seniority",
  type: SchemaType.OBJECT,
  properties: {
    totalQuestions: {
      type: SchemaType.INTEGER,
      description: "Total number of generated questions (8 to 10)"
    },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "Unique question ID like q1, q2, etc."
          },
          category: {
            type: SchemaType.STRING,
            description: "Topic category (e.g. 'System Design', 'Past Project Deep-Dive', 'Core Language Knowledge', 'Architecture & Scalability', 'Behavioral & Leadership')"
          },
          question: {
            type: SchemaType.STRING,
            description: "Specific, high-signal interview question tailored to candidate's background"
          },
          whatToLookFor: {
            type: SchemaType.STRING,
            description: "Key evaluation criteria, expected technical depth, and positive/negative signals"
          },
          difficulty: {
            type: SchemaType.STRING,
            description: "Target difficulty aligned with seniority (e.g. 'Junior', 'Mid', 'Senior', 'Staff+')"
          }
        },
        required: ["id", "category", "question", "whatToLookFor", "difficulty"]
      },
      description: "Array of 8 to 10 tailored interview questions"
    }
  },
  required: ["totalQuestions", "questions"]
};

/**
 * Check if an error represents a rate limit / quota exhaustion
 */
function isRateLimitError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.status === 429 ||
    err.statusCode === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

/**
 * Helper to call Gemini with fallback models
 */
async function callGeminiStructured({ genAI, prompt, schema }) {
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest'
  ].filter(Boolean);

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini Service] Structured request using model: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.25
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return JSON.parse(text);
    } catch (err) {
      console.warn(`[Gemini Service] Model ${modelName} call warning:`, err.message);
      lastError = err;

      if (isRateLimitError(err)) {
        const rateLimitErr = new Error('Gemini API free-tier rate limit reached. Please try again in a moment.');
        rateLimitErr.status = 429;
        rateLimitErr.code = 'RATE_LIMIT_EXCEEDED';
        throw rateLimitErr;
      }

      if (err.message && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('unreachable') || err.message.includes('503'))) {
        continue;
      }
    }
  }

  if (isRateLimitError(lastError)) {
    const rateLimitErr = new Error('Gemini API free-tier rate limit reached. Please try again in a moment.');
    rateLimitErr.status = 429;
    throw rateLimitErr;
  }

  throw new Error(`Gemini request failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Stage 1: Analyze candidate resume text with Google Gemini API
 */
async function analyzeResume({ resumeText, seniority = 'Mid', jobDescription = '' }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY or API_KEY in server/.env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
You are an expert technical interviewer and talent assessor assisting an interviewer before a live interview.
Carefully analyze the candidate's resume text below for a **${seniority}** engineering level position.

${jobDescription ? `### Target Job Description:\n${jobDescription}\n` : ''}

### Candidate Resume Content:
${resumeText}

### Instructions:
1. Extract candidate's full name, estimated years of experience, and a concise 2-sentence summary.
2. List the candidate's verified core technical skills and tools.
3. Identify 2-3 notable projects or work highlights with real technical scope.
4. Critically identify 3 to 4 likely knowledge gaps, resume buzzwords without architectural depth, missing fundamentals, or areas especially critical to probe deeply for a ${seniority} level role.
5. Provide actionable, high-signal suggested questions for each probing area.
`;

  return await callGeminiStructured({
    genAI,
    prompt,
    schema: resumeAnalysisSchema
  });
}

/**
 * Stage 2: Generate 8-10 candidate-specific interview questions grouped by topic
 */
async function generateQuestionBank({ candidateAnalysis, seniority = 'Mid', jobDescription = '' }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY or API_KEY in server/.env');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const skillsStr = (candidateAnalysis.skills || []).join(', ');
  const projectsStr = (candidateAnalysis.notableProjects || [])
    .map(p => `- ${p.title}: ${p.description}`)
    .join('\n');
  const gapsStr = (candidateAnalysis.knowledgeGapsAndProbingAreas || [])
    .map(g => `- ${g.topic}: ${g.reasonToProbe}`)
    .join('\n');

  const prompt = `
You are a senior tech lead conducting a technical interview for a **${seniority}** candidate named ${candidateAnalysis.candidateName || 'the candidate'}.

### Candidate Context:
- **Seniority Level**: ${seniority}
- **Experience**: ${candidateAnalysis.yearsOfExperience || 'N/A'}
- **Core Skills**: ${skillsStr}
- **Notable Projects**:
${projectsStr || 'None listed'}
- **Identified Areas Worth Probing / Knowledge Gaps**:
${gapsStr || 'None listed'}
${jobDescription ? `\n### Target Role / Job Description:\n${jobDescription}\n` : ''}

### Task:
Generate a curated Question Bank of **exactly 8 to 10 tailored interview questions** specifically customized to this candidate's background and calibrated strictly to the **${seniority}** seniority level.

Group the 8-10 questions into relevant topics, for example:
- "System Design & Architecture"
- "Past Project Deep-Dive"
- "Core Language & Backend Fundamentals"
- "Architecture, Concurrency & Failure Modes"
- "Team Leadership & Trade-offs" (for Senior/Staff+)

For each question:
1. Make the question concrete and specific, referencing specific technologies or claims from their background.
2. Provide a clear "whatToLookFor" explanation detailing strong signals vs. red flags expected from a ${seniority} candidate.
3. Assign an incremental ID (e.g. q1, q2, ... q8/q10).
`;

  return await callGeminiStructured({
    genAI,
    prompt,
    schema: questionBankSchema
  });
}

module.exports = {
  analyzeResume,
  generateQuestionBank,
  isRateLimitError
};
