import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import db from './server-database.js';

const app = express();
app.use(express.json());

const JWT_SECRET = 'super-secret-key-for-demo';
const RECORD_REPORT_MODEL = 'gemini-2.5-flash';
const SIMULATION_SESSION_TOKEN_COST = 10;
const AI_REPORT_TOKEN_COST = 15;
const DEFAULT_TAG_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444'];
const reportJobs = new Set();
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function parseJson(rawValue, fallback) {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function normalizeHexColor(color) {
  if (typeof color !== 'string') return DEFAULT_TAG_COLORS[0];
  const trimmed = color.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : DEFAULT_TAG_COLORS[0];
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag, index) => {
      if (typeof tag === 'string') {
        return {
          label: tag.trim(),
          color: DEFAULT_TAG_COLORS[index % DEFAULT_TAG_COLORS.length],
        };
      }

      if (tag && typeof tag === 'object' && typeof tag.label === 'string') {
        return {
          label: tag.label.trim(),
          color: normalizeHexColor(tag.color),
        };
      }

      return null;
    })
    .filter(tag => tag && tag.label);
}

function normalizeTranscriptEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      if (entry.role !== 'user' && entry.role !== 'ai') return null;
      if (typeof entry.text !== 'string' || !entry.text.trim()) return null;

      return {
        role: entry.role,
        text: entry.text.trim(),
        time: typeof entry.time === 'number' ? entry.time : undefined,
      };
    })
    .filter(Boolean);
}

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function resolveElapsedSeconds({ elapsedSeconds, startedAt, endedAt }) {
  if (typeof elapsedSeconds === 'number' && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0) {
    return Math.max(0, Math.round(elapsedSeconds));
  }

  if (!startedAt || !endedAt) {
    return null;
  }

  const startedMs = new Date(startedAt).getTime();
  const endedMs = new Date(endedAt).getTime();

  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs) {
    return null;
  }

  return Math.max(0, Math.round((endedMs - startedMs) / 1000));
}

function getUserById(userId) {
  return db.prepare('SELECT id, username, balance, email, phone, plan, nextRefresh FROM users WHERE id = ?').get(userId);
}

function consumeUserTokens(userId, amount) {
  const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
  const user = getUserById(userId);
  if (!user) {
    return { ok: false, status: 404, error: 'User not found' };
  }

  if (normalizedAmount <= 0) {
    return { ok: true, balance: user.balance, deducted: 0, user };
  }

  if (user.balance < normalizedAmount) {
    return {
      ok: false,
      status: 402,
      error: `Not enough tokens. This action requires ${normalizedAmount} tokens, but you only have ${user.balance}.`,
      balance: user.balance,
    };
  }

  const nextBalance = user.balance - normalizedAmount;
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(nextBalance, userId);

  return {
    ok: true,
    balance: nextBalance,
    deducted: normalizedAmount,
    user: { ...user, balance: nextBalance },
  };
}

function formatRecordRow(row) {
  const parsedTags = normalizeTags(parseJson(row.tags, []));
  const transcriptEntries = normalizeTranscriptEntries(parseJson(row.transcriptEntries, []));
  const aiReport = parseJson(row.aiReport, null);
  const resolvedElapsedSeconds = resolveElapsedSeconds({
    elapsedSeconds: row.elapsedSeconds == null ? null : Number(row.elapsedSeconds),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  });

  return {
    ...row,
    elapsedSeconds: resolvedElapsedSeconds,
    tags: parsedTags,
    transcriptEntries,
    aiReportStatus: row.aiReportStatus || 'not_requested',
    aiReport,
  };
}

function buildFallbackEvaluation(record) {
  const userEntries = record.transcriptEntries.filter(entry => entry.role === 'user');
  const aiEntries = record.transcriptEntries.filter(entry => entry.role === 'ai');
  const userWordCount = userEntries.reduce((total, entry) => total + entry.text.split(/\s+/).filter(Boolean).length, 0);
  const answerCount = userEntries.length;
  const technicalKnowledge = clampScore(55 + Math.min(25, userWordCount / 14));
  const communication = clampScore(52 + Math.min(28, userEntries.length * 6));
  const problemSolving = clampScore(50 + Math.min(30, answerCount * 7));
  const confidence = clampScore(48 + Math.min(24, userWordCount / 18));
  const clarity = clampScore(54 + Math.min(22, userEntries.length * 5));
  const overallScore = clampScore((technicalKnowledge + communication + problemSolving + confidence + clarity) / 5);

  return {
    score: overallScore,
    report: {
      summary: `This interview covered ${Math.max(aiEntries.length, answerCount)} conversational turns and shows a ${record.status === 'Completed' ? 'complete' : 'partial'} mock interview record. The overall performance suggests a solid baseline with the most room for improvement in answer depth and precision.`,
      strengths: [
        'You maintained the interview flow and responded to each prompt without stalling.',
        'Your communication was structured enough for the interviewer to continue the session naturally.',
        'The transcript shows consistent participation across the interview rounds.',
      ],
      improvementAreas: [
        'Add more technical specificity and concrete examples in each answer.',
        'Tighten answers so the key point lands earlier and more clearly.',
        'Use a clearer problem-solving structure when answering scenario questions.',
      ],
      actionItems: [
        'Practice answering one technical question per day with a 60 to 90 second structure.',
        'Prepare two or three project examples that demonstrate tradeoffs, ownership, and results.',
        'Review the transcript and rewrite weaker responses with clearer technical detail.',
      ],
      categoryScores: {
        technicalKnowledge,
        communication,
        problemSolving,
        confidence,
        clarity,
      },
      roundBreakdown: userEntries.slice(0, 5).map((entry, index) => ({
        title: `Round ${index + 1}`,
        score: clampScore(overallScore - index * 2, overallScore),
        feedback: `Response ${index + 1} showed ${entry.text.split(/\s+/).filter(Boolean).length > 25 ? 'reasonable detail' : 'a need for more depth'} and can be improved with stronger examples and clearer prioritization.`,
      })),
      notableMoments: [
        'You stayed engaged through the full transcript.',
        'The strongest answers were the ones with more specific wording and examples.',
        'The next improvement step is increasing technical precision under time pressure.',
      ],
    },
  };
}

function extractJsonObject(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

async function generateEvaluationReport(record) {
  const fallback = buildFallbackEvaluation(record);
  const transcriptText = record.transcriptEntries.length
    ? record.transcriptEntries
      .map((entry, index) => `${index + 1}. ${entry.role === 'user' ? 'Candidate' : 'Interviewer'}: ${entry.text}`)
      .join('\n')
    : record.transcript;

  if (!ai || !transcriptText.trim()) {
    return fallback;
  }

  try {
    const prompt = `You are an expert technical interview evaluator.

Analyze the interview transcript and return JSON only in this exact shape:
{
  "overallScore": number,
  "summary": string,
  "strengths": string[],
  "improvementAreas": string[],
  "actionItems": string[],
  "categoryScores": {
    "technicalKnowledge": number,
    "communication": number,
    "problemSolving": number,
    "confidence": number,
    "clarity": number
  },
  "roundBreakdown": [
    { "title": string, "score": number, "feedback": string }
  ],
  "notableMoments": string[]
}

Rules:
- Scores must be integers from 0 to 100.
- Strengths, improvementAreas, actionItems, and notableMoments should each contain 3 concise items.
- roundBreakdown should contain 3 to 6 items.
- Base the score only on the transcript and interview status.
- Be direct, constructive, and specific.

Interview status: ${record.status}
Interview role: ${record.role || 'General'}
Duration: ${record.duration || 'Unknown'}

Transcript:
${transcriptText}`;

    const response = await ai.models.generateContent({
      model: RECORD_REPORT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(extractJsonObject(response.text || '{}'));
    const report = {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.report.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean).slice(0, 3) : fallback.report.strengths,
      improvementAreas: Array.isArray(parsed.improvementAreas) ? parsed.improvementAreas.filter(Boolean).slice(0, 3) : fallback.report.improvementAreas,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter(Boolean).slice(0, 3) : fallback.report.actionItems,
      categoryScores: {
        technicalKnowledge: clampScore(parsed?.categoryScores?.technicalKnowledge, fallback.report.categoryScores.technicalKnowledge),
        communication: clampScore(parsed?.categoryScores?.communication, fallback.report.categoryScores.communication),
        problemSolving: clampScore(parsed?.categoryScores?.problemSolving, fallback.report.categoryScores.problemSolving),
        confidence: clampScore(parsed?.categoryScores?.confidence, fallback.report.categoryScores.confidence),
        clarity: clampScore(parsed?.categoryScores?.clarity, fallback.report.categoryScores.clarity),
      },
      roundBreakdown: Array.isArray(parsed.roundBreakdown) && parsed.roundBreakdown.length
        ? parsed.roundBreakdown.slice(0, 6).map((item, index) => ({
          title: typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : `Round ${index + 1}`,
          score: clampScore(item?.score, fallback.score),
          feedback: typeof item?.feedback === 'string' && item.feedback.trim()
            ? item.feedback.trim()
            : fallback.report.roundBreakdown[index % fallback.report.roundBreakdown.length]?.feedback || fallback.report.summary,
        }))
        : fallback.report.roundBreakdown,
      notableMoments: Array.isArray(parsed.notableMoments) ? parsed.notableMoments.filter(Boolean).slice(0, 3) : fallback.report.notableMoments,
    };

    const overallScore = clampScore(parsed.overallScore, Math.round(
      (
        report.categoryScores.technicalKnowledge +
        report.categoryScores.communication +
        report.categoryScores.problemSolving +
        report.categoryScores.confidence +
        report.categoryScores.clarity
      ) / 5
    ));

    return { score: overallScore, report };
  } catch (error) {
    console.error('AI record evaluation failed, using fallback report:', error);
    return fallback;
  }
}

async function queueRecordEvaluation(recordId, userId) {
  const jobKey = `${userId}:${recordId}`;
  if (reportJobs.has(jobKey)) return;

  reportJobs.add(jobKey);

  try {
    db.prepare('UPDATE records SET aiReportStatus = ? WHERE id = ? AND userId = ?').run('processing', recordId, userId);
    const row = db.prepare('SELECT * FROM records WHERE id = ? AND userId = ?').get(recordId, userId);
    if (!row) return;

    const record = formatRecordRow(row);
    const evaluation = await generateEvaluationReport(record);
    const generatedAt = new Date().toISOString();

    db.prepare(`
      UPDATE records
      SET score = ?, aiReport = ?, aiReportStatus = ?, aiReportGeneratedAt = ?
      WHERE id = ? AND userId = ?
    `).run(
      evaluation.score,
      JSON.stringify(evaluation.report),
      'completed',
      generatedAt,
      recordId,
      userId
    );
  } catch (error) {
    console.error('Failed to queue record evaluation:', error);
    db.prepare('UPDATE records SET aiReportStatus = ? WHERE id = ? AND userId = ?').run('failed', recordId, userId);
  } finally {
    reportJobs.delete(jobKey);
  }
}

// Helper: get the 1st day of next month at 00:00 UTC
function getFirstOfNextMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)).toISOString();
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// User Registration
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const defaultRefresh = getFirstOfNextMonth();
    const insertStmt = db.prepare("INSERT INTO users (username, password, balance, plan, nextRefresh) VALUES (?, ?, 50, 'Free', ?)");
    const info = insertStmt.run(username, hashedPassword, defaultRefresh);
    res.json({ message: 'User created successfully', userId: info.lastInsertRowid });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// User Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, id: user.id, username: user.username, balance: user.balance, email: user.email, phone: user.phone, plan: user.plan, nextRefresh: user.nextRefresh });
});

// Get current user info
app.get('/api/me', authenticateToken, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/interviews/start', authenticateToken, (req, res) => {
  const result = consumeUserTokens(req.user.id, SIMULATION_SESSION_TOKEN_COST);
  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      balance: result.balance,
      requiredTokens: SIMULATION_SESSION_TOKEN_COST,
    });
  }

  res.json({
    message: 'Interview session started',
    balance: result.balance,
    deductedTokens: SIMULATION_SESSION_TOKEN_COST,
  });
});

// Recharge / Buy credits & Plan
app.post('/api/recharge', authenticateToken, (req, res) => {
  const { amount, planTitle } = req.body;
  
  const currentStmt = db.prepare('SELECT balance, plan, nextRefresh FROM users WHERE id = ?');
  const user = currentStmt.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let newBalance = user.balance;
  let newPlan = user.plan;
  let newRefresh = user.nextRefresh;

  if (planTitle && typeof planTitle === 'string') {
    newPlan = planTitle;
    newRefresh = getFirstOfNextMonth();
    if (amount && typeof amount === 'number' && amount > 0) {
      newBalance = amount; // Reset quota instead of accumulating
    }
  } else if (amount && typeof amount === 'number' && amount > 0) {
    newBalance += amount;
  }

  const updateStmt = db.prepare('UPDATE users SET balance = ?, plan = ?, nextRefresh = ? WHERE id = ?');
  updateStmt.run(newBalance, newPlan, newRefresh, req.user.id);

  res.json({ message: 'Purchase successful', balance: newBalance, plan: newPlan, nextRefresh: newRefresh });
});

// Update Profile API
app.put('/api/profile', authenticateToken, (req, res) => {
  const { email, phone } = req.body;
  const updateStmt = db.prepare('UPDATE users SET email = ?, phone = ? WHERE id = ?');
  updateStmt.run(email || null, phone || null, req.user.id);
  res.json({ message: 'Profile updated successfully' });
});

// Update Password API
app.put('/api/password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });

  const stmt = db.prepare('SELECT password FROM users WHERE id = ?');
  const user = stmt.get(req.user.id);
  
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Incorrect current password' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
  
  res.json({ message: 'Password updated successfully' });
});

// Get Resume
app.get('/api/resume', authenticateToken, (req, res) => {
  const stmt = db.prepare('SELECT data, updatedAt FROM resumes WHERE userId = ?');
  const row = stmt.get(req.user.id);
  if (!row) return res.json({ data: null });
  try {
    res.json({ data: JSON.parse(row.data), updatedAt: row.updatedAt });
  } catch {
    res.json({ data: null });
  }
});

// Save Resume
app.put('/api/resume', authenticateToken, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Resume data is required' });

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM resumes WHERE userId = ?').get(req.user.id);

  if (existing) {
    db.prepare('UPDATE resumes SET data = ?, updatedAt = ? WHERE userId = ?').run(JSON.stringify(data), now, req.user.id);
  } else {
    db.prepare('INSERT INTO resumes (userId, data, updatedAt) VALUES (?, ?, ?)').run(req.user.id, JSON.stringify(data), now);
  }

  res.json({ message: 'Resume saved successfully', updatedAt: now });
});

// Get Records
app.get('/api/records', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT * FROM records WHERE userId = ? ORDER BY createdAt DESC').all(req.user.id);
  const formatted = rows.map(formatRecordRow);
  res.json({ data: formatted });
});

// Get Record Details
app.get('/api/records/:id', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM records WHERE id = ? AND userId = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });

  const formatted = formatRecordRow(row);
  res.json({ data: formatted });
});

app.post('/api/records/:id/generate-report', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM records WHERE id = ? AND userId = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });

  const record = formatRecordRow(row);

  if (!record.transcript.trim() && !record.transcriptEntries.length) {
    return res.status(400).json({ error: 'This record does not have enough transcript data to generate a report.' });
  }

  if (record.aiReportStatus === 'completed' && record.aiReport) {
    return res.json({
      message: 'AI evaluation report has already been generated.',
      balance: getUserById(req.user.id)?.balance ?? null,
      aiReportStatus: record.aiReportStatus,
      alreadyGenerated: true,
    });
  }

  if (record.aiReportStatus === 'processing' || record.aiReportStatus === 'pending') {
    return res.status(409).json({
      error: 'AI evaluation report is already being generated.',
      balance: getUserById(req.user.id)?.balance ?? null,
      aiReportStatus: record.aiReportStatus,
    });
  }

  const tokenResult = consumeUserTokens(req.user.id, AI_REPORT_TOKEN_COST);
  if (!tokenResult.ok) {
    return res.status(tokenResult.status).json({
      error: tokenResult.error,
      balance: tokenResult.balance,
      requiredTokens: AI_REPORT_TOKEN_COST,
    });
  }

  db.prepare(`
    UPDATE records
    SET score = NULL, aiReport = NULL, aiReportGeneratedAt = NULL, aiReportStatus = ?
    WHERE id = ? AND userId = ?
  `).run('pending', record.id, req.user.id);

  void queueRecordEvaluation(record.id, req.user.id);

  res.json({
    message: 'AI evaluation report generation has started.',
    balance: tokenResult.balance,
    deductedTokens: AI_REPORT_TOKEN_COST,
    aiReportStatus: 'pending',
  });
});

// Create Record
app.post('/api/records', authenticateToken, (req, res) => {
  const {
    name,
    role,
    duration,
    elapsedSeconds,
    score,
    status,
    transcript,
    transcriptEntries,
    tags,
    startedAt,
    endedAt,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Record name is required' });

  const now = new Date().toISOString();
  const normalizedTags = normalizeTags(tags);
  const normalizedTranscriptEntries = normalizeTranscriptEntries(transcriptEntries);
  const resolvedElapsedSeconds = resolveElapsedSeconds({
    elapsedSeconds,
    startedAt,
    endedAt,
  });
  const initialReportStatus = transcript || normalizedTranscriptEntries.length ? 'not_requested' : 'failed';
  const info = db.prepare(`
    INSERT INTO records (
      userId, name, role, duration, elapsedSeconds, score, status, transcript,
      transcriptEntries, tags, startedAt, endedAt, aiReportStatus, createdAt
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    name,
    role || null,
    resolvedElapsedSeconds == null ? null : `${Math.floor(resolvedElapsedSeconds / 3600)}h ${Math.floor((resolvedElapsedSeconds % 3600) / 60)}m ${Math.floor(resolvedElapsedSeconds % 60)}s`,
    resolvedElapsedSeconds,
    score || null,
    status || 'Completed',
    transcript || '',
    JSON.stringify(normalizedTranscriptEntries),
    JSON.stringify(normalizedTags),
    startedAt || null,
    endedAt || null,
    initialReportStatus,
    now
  );

  res.json({ message: 'Record saved', recordId: info.lastInsertRowid });
});

// Update Record
app.put('/api/records/:id', authenticateToken, (req, res) => {
  const recordId = req.params.id;
  const { name, tags } = req.body;
  
  const existing = db.prepare('SELECT id FROM records WHERE id = ? AND userId = ?').get(recordId, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  db.prepare('UPDATE records SET name = ?, tags = ? WHERE id = ?').run(
    name,
    JSON.stringify(normalizeTags(tags)),
    recordId
  );
  res.json({ message: 'Record updated' });
});

// Batch Delete Records
app.post('/api/records/batch-delete', authenticateToken, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const normalizedIds = [...new Set(
    ids
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!normalizedIds.length) {
    return res.status(400).json({ error: 'At least one valid record ID is required' });
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const existingRows = db.prepare(
    `SELECT id FROM records WHERE userId = ? AND id IN (${placeholders})`
  ).all(req.user.id, ...normalizedIds);

  if (!existingRows.length) {
    return res.status(404).json({ error: 'No matching records found' });
  }

  const info = db.prepare(
    `DELETE FROM records WHERE userId = ? AND id IN (${placeholders})`
  ).run(req.user.id, ...normalizedIds);

  res.json({ message: 'Records deleted', deletedCount: info.changes });
});

// Delete Record
app.delete('/api/records/:id', authenticateToken, (req, res) => {
  const recordId = req.params.id;
  const existing = db.prepare('SELECT id FROM records WHERE id = ? AND userId = ?').get(recordId, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Record not found' });

  db.prepare('DELETE FROM records WHERE id = ?').run(recordId);
  res.json({ message: 'Record deleted' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
