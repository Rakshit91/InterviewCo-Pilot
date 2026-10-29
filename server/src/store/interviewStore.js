const db = require('../db/database');

/**
 * SQLite-backed Interview Store
 */
class InterviewStore {
  /**
   * Save newly analyzed interview session to SQLite
   */
  saveInterview(id, data) {
    const now = new Date().toISOString();
    const candidateName = data.analysis?.candidateName || 'Candidate';
    const seniority = data.seniority || data.metadata?.seniority || 'Mid';

    const insertStmt = db.prepare(`
      INSERT INTO interviews (
        id, candidate_name, seniority, filename, job_description,
        resume_text, analysis_json, question_bank_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        analysis_json = excluded.analysis_json,
        question_bank_json = excluded.question_bank_json,
        updated_at = excluded.updated_at
    `);

    insertStmt.run(
      id,
      candidateName,
      seniority,
      data.filename || 'resume.pdf',
      data.jobDescription || '',
      data.resumeText || '',
      JSON.stringify(data.analysis || {}),
      JSON.stringify(data.questionBank || {}),
      'CREATED',
      now,
      now
    );

    return this.getInterview(id);
  }

  /**
   * Get an interview by ID with analysis and question bank parsed
   */
  getInterview(id) {
    const stmt = db.prepare(`SELECT * FROM interviews WHERE id = ?`);
    const row = stmt.get(id);

    if (!row) return null;

    let analysis = {};
    let questionBank = {};

    try { analysis = JSON.parse(row.analysis_json || '{}'); } catch (e) {}
    try { questionBank = JSON.parse(row.question_bank_json || '{}'); } catch (e) {}

    return {
      interviewId: row.id,
      id: row.id,
      filename: row.filename,
      seniority: row.seniority,
      jobDescription: row.job_description,
      resumeText: row.resume_text,
      analysis,
      questionBank,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: {
        filename: row.filename,
        seniority: row.seniority,
        hasJobDescription: Boolean(row.job_description),
        createdAt: row.created_at
      }
    };
  }

  /**
   * List all stored interviews
   */
  listInterviews() {
    const stmt = db.prepare(`
      SELECT id, candidate_name, seniority, filename, status, created_at, updated_at
      FROM interviews
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  /**
   * Add a finalized transcript turn to SQLite
   */
  addTranscriptTurn(interviewId, { speaker = 'Candidate', text, language = 'English', source = 'GEMINI_VAD_SIGNAL', timestamp }) {
    if (!text || !text.trim()) return;

    const time = timestamp || new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO transcripts (interview_id, speaker, text, language, source, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(interviewId, speaker, text.trim(), language, source, time);
  }

  /**
   * Get all transcripts for an interview
   */
  getTranscripts(interviewId) {
    const stmt = db.prepare(`
      SELECT id, speaker, text, language, source, timestamp
      FROM transcripts
      WHERE interview_id = ?
      ORDER BY id ASC
    `);
    return stmt.all(interviewId);
  }

  /**
   * Add an asked question to SQLite
   */
  addAskedQuestion(interviewId, { question, reasoning = '', source = 'AI_SUGGESTED', timestamp }) {
    if (!question || !question.trim()) return;

    const time = timestamp || new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO asked_questions (interview_id, question, reasoning, source, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    return stmt.run(interviewId, question.trim(), reasoning, source, time);
  }

  /**
   * Get all asked questions for an interview
   */
  getAskedQuestions(interviewId) {
    const stmt = db.prepare(`
      SELECT id, question, reasoning, source, timestamp
      FROM asked_questions
      WHERE interview_id = ?
      ORDER BY id ASC
    `);
    return stmt.all(interviewId);
  }

  /**
   * Log consent confirmation
   */
  logConsent({ id, interviewId, candidateName, seniority, timestamp, action = 'CANDIDATE_TRANSCRIPTION_CONSENT_CONFIRMED' }) {
    const logId = id || Date.now().toString();
    const time = timestamp || new Date().toISOString();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO consent_logs (id, interview_id, candidate_name, seniority, timestamp, action, candidate_informed)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    return stmt.run(logId, interviewId || '', candidateName || 'Candidate', seniority || 'Senior', time, action);
  }

  /**
   * Get complete interview debrief
   */
  getInterviewDebrief(id) {
    const interview = this.getInterview(id);
    if (!interview) return null;

    const transcripts = this.getTranscripts(id);
    const askedQuestions = this.getAskedQuestions(id);

    return {
      interview,
      transcripts,
      askedQuestions,
      totalQuestionsAsked: askedQuestions.length,
      totalTranscriptTurns: transcripts.length
    };
  }

  /**
   * Generate Markdown Export (.md)
   */
  generateMarkdownExport(id) {
    const debrief = this.getInterviewDebrief(id);
    if (!debrief) return null;

    const { interview, transcripts, askedQuestions } = debrief;
    const analysis = interview.analysis || {};
    const candidateName = analysis.candidateName || 'Candidate';
    const seniority = interview.seniority || 'Senior';

    let md = `# Interview Debrief: ${candidateName}\n\n`;
    md += `**Date:** ${new Date(interview.createdAt).toLocaleDateString()} | **Seniority Level:** ${seniority} | **Session ID:** \`${interview.id}\`\n\n`;
    md += `---\n\n`;

    // 1. Candidate Overview
    md += `## 1. Candidate Overview & Profile\n\n`;
    md += `**Experience:** ${analysis.yearsOfExperience || 'Experienced'}\n\n`;
    md += `**Summary:** ${analysis.summary || 'N/A'}\n\n`;
    
    if (Array.isArray(analysis.skills) && analysis.skills.length > 0) {
      md += `**Core Skills:** ${analysis.skills.join(', ')}\n\n`;
    }

    if (Array.isArray(analysis.knowledgeGapsAndProbingAreas) && analysis.knowledgeGapsAndProbingAreas.length > 0) {
      md += `### Knowledge Gaps & Probing Areas Identified:\n`;
      analysis.knowledgeGapsAndProbingAreas.forEach((gap, idx) => {
        md += `${idx + 1}. **${gap.topic}:** ${gap.reasonToProbe}\n   - *Suggested Question:* "${gap.suggestedQuestion}"\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;

    // 2. Questions Asked During Interview
    md += `## 2. Questions Asked During Interview (${askedQuestions.length})\n\n`;
    if (askedQuestions.length === 0) {
      md += `*No questions were recorded as asked during this session.*\n\n`;
    } else {
      askedQuestions.forEach((q, idx) => {
        const timeStr = q.timestamp ? new Date(q.timestamp).toLocaleTimeString() : '';
        md += `### Question ${idx + 1} ${timeStr ? `[${timeStr}]` : ''} (${q.source || 'AI Suggested'})\n`;
        md += `> **"${q.question}"**\n\n`;
        if (q.reasoning) {
          md += `*Why this follows:* ${q.reasoning}\n\n`;
        }
      });
    }

    md += `---\n\n`;

    // 3. Full Conversation Transcript
    md += `## 3. Full Conversation Transcript (${transcripts.length} Turns)\n\n`;
    if (transcripts.length === 0) {
      md += `*No live audio transcript turns recorded.*\n\n`;
    } else {
      transcripts.forEach((turn, idx) => {
        const timeStr = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : '';
        md += `**[${timeStr}] ${turn.speaker} (${turn.source || 'Live'}):**\n`;
        md += `${turn.text}\n\n`;
      });
    }

    md += `---\n*Generated by InterviewCo-Pilot AI • Gemini 3.5 Live & Flash*`;

    return md;
  }

  /**
   * Generate Plain Text Export (.txt)
   */
  generateTextExport(id) {
    const debrief = this.getInterviewDebrief(id);
    if (!debrief) return null;

    const { interview, transcripts, askedQuestions } = debrief;
    const analysis = interview.analysis || {};
    const candidateName = analysis.candidateName || 'Candidate';

    let txt = `=====================================================\n`;
    txt += `INTERVIEW DEBRIEF: ${candidateName.toUpperCase()}\n`;
    txt += `Seniority: ${interview.seniority} | Session: ${interview.id}\n`;
    txt += `Date: ${new Date(interview.createdAt).toLocaleString()}\n`;
    txt += `=====================================================\n\n`;

    txt += `1. CANDIDATE PROFILE\n`;
    txt += `--------------------\n`;
    txt += `Summary: ${analysis.summary || 'N/A'}\n`;
    txt += `Skills: ${(analysis.skills || []).join(', ')}\n\n`;

    txt += `2. QUESTIONS ASKED (${askedQuestions.length})\n`;
    txt += `--------------------\n`;
    askedQuestions.forEach((q, idx) => {
      txt += `${idx + 1}. [${q.source || 'AI'}] "${q.question}"\n`;
      if (q.reasoning) txt += `   Reasoning: ${q.reasoning}\n`;
    });
    txt += `\n`;

    txt += `3. FULL CONVERSATION TRANSCRIPT (${transcripts.length} Turns)\n`;
    txt += `------------------------------------\n`;
    transcripts.forEach((turn) => {
      const timeStr = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : '';
      txt += `[${timeStr}] ${turn.speaker}: ${turn.text}\n\n`;
    });

    return txt;
  }
}

module.exports = new InterviewStore();
