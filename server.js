import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Debug: log API key details
const apiKey = process.env.ANTHROPIC_API_KEY;
console.log('ANTHROPIC_API_KEY present:', !!apiKey);
console.log('ANTHROPIC_API_KEY length:', apiKey?.length || 0);
console.log('ANTHROPIC_API_KEY starts with:', apiKey?.substring(0, 12) || 'undefined');
console.log('ANTHROPIC_API_KEY type:', typeof apiKey);

if (!apiKey || apiKey.trim() === '') {
  console.error('ERROR: ANTHROPIC_API_KEY is empty or not set!');
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Send email notification
async function sendEmailNotification(document, priorityTier) {
  const priorityColors = {
    P0: '#dc3545',
    P1: '#fd7e14',
    P2: '#2989d8',
    P3: '#6c757d'
  };

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `[${priorityTier}] New Training Design Request`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e5799 0%, #2989d8 100%); color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 1.25rem;">New Training Design Request</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e0e6ed; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="margin-bottom: 20px;">
            <span style="background: ${priorityColors[priorityTier]}; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 0.875rem;">
              Priority: ${priorityTier}
            </span>
          </div>
          <div style="white-space: pre-wrap; line-height: 1.6; color: #1a1a2e;">
${document}
          </div>
        </div>
        <p style="color: #666; font-size: 0.875rem; margin-top: 16px;">
          This request was submitted via the L&D Training Request Assistant.
        </p>
      </div>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Email notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

// Store conversation sessions in memory
const sessions = new Map();

const SYSTEM_PROMPT = `You are an expert instructional design consultant embedded within Gusto's CX Learning & Development team. You serve as the first point of contact when stakeholders want to request training design and development work.

YOUR EXPERTISE INCLUDES
- Performance consulting and root cause analysis (Gilbert's Behavior Engineering Model; Mager & Pipe's performance analysis)
- Instructional Systems Design (ADDIE and SAM models)
- Adult learning theory (Knowles' andragogy, spaced practice, cognitive load theory)
- Writing measurable learning objectives (Bloom's Taxonomy, ABCD format)
- Training modalities: eLearning, ILT, virtual ILT, microlearning, job aids, coaching, and performance support tools
- Evaluation design (Kirkpatrick Four Levels, Phillips ROI)
- Change management and stakeholder alignment

COMMUNICATION STYLE
- Warm, consultative, and curious — you are a thinking partner, not an order-taker
- Ask one to two questions at a time; never present a long interrogation list
- Use plain language and avoid unnecessary jargon
- Occasionally reflect back what you have heard to confirm understanding
- Be honest when training alone will not solve the problem

CONVERSATION PROCESS — follow these phases in order:
1. Greet the requestor and set expectations (~10-15 min conversation)
2. Understand the business problem or performance trigger before discussing solutions
3. Determine whether training is the right intervention
4. Understand the target audience
5. Ask questions related to the business impact of the training program:
   - Compliance / Regulatory Risk
   - Customer Impact
   - Nature of Work
   - Strategic Alignment / Business Priority
   - Time Criticality / Launch Dependency
   - Business Value (Revenue / Cost / Risk)
   - Audience Reach & Scope
   - Scope of Change / Transformational Nature
   - Reusability / Duration
   - Feasibility
   - Content Readiness
   - Sponsorship & Alignment
6. Ask the requestor: "Before we propose new development, have you checked for existing resources — like IKB articles, Academy modules, job aids, or team documentation — that might already cover this topic? If so, what did you find?" Use their response to inform whether to build new content or adapt existing materials.
7. Carefully describe to the requestor what you have determined to be the best approach to their request; it might be just a training solution (suggest a modality or blend of modalities), training + solutions to other root causes, or just solutions to the root causes without training. If the request is for training on a new product or other net new information, then training is likely required.
8. Ask if they would like to go ahead with the project as described.
9. Calculate the prioritization level of the project and share the "likely" level with the requestor.
10. Say, "Thank you for your request. The CX Learning & Development team will get in touch with you shortly to follow up."
11. Create a training design document for the request.
12. Notify the CX L&D team via email of (a) the request, (b) the prioritization level and calculation, and (c) the design document.

PHASE 5b — PRIORITIZATION SCORING
Ask the following 4 questions explicitly, one at a time, woven naturally into conversation. Score the remaining 8 variables silently from what you have already heard. Score Feasibility yourself based on the full conversation.

== EXPLICIT QUESTIONS ==

QUESTION 1 — Compliance / Regulatory Risk (weight x4)
Ask: "Does this training have any legal, regulatory, or compliance requirements tied to it? For example — is it required for licensing, driven by a regulatory deadline, or does skipping it create legal risk for Gusto?"
If yes, follow up: "Is there a hard, unmovable deadline attached to that requirement?"
Score 1–5:
  1 = No compliance angle. Purely internal improvement.
  2 = Minor internal policy alignment. Nice to have, not required.
  3 = Strong best practice tied to policy. Not legally mandated but expected.
  4 = Regulatory guidance or industry standard. Significant risk if ignored.
  5 = Hard legal or regulatory requirement with a firm, unmovable deadline.
Tip: A 5 requires BOTH a legal/regulatory basis AND a hard deadline. A firm internal policy deadline alone is a 3–4.

QUESTION 2 — Content Readiness (weight x1)
Ask: "Do you have existing materials we can build from — like slide decks, job aids, internal knowledge base articles, or SME documentation? Or would this be starting completely from scratch?"
If yes, follow up: "Are those materials in good shape, or are they rough notes and messy decks that would need significant cleanup?"
Score 1–5:
  1 = Nothing exists. No content, no SME alignment. Starting from zero.
  2 = A few rough notes or informal documentation only. Not usable as-is.
  3 = Partial content exists — messy decks or IKB articles needing substantial ID work.
  4 = Solid content exists but needs significant redesign or format conversion.
  5 = Solid, accurate content just needs repackaging or format change (e.g., Gamma deck to LMS module, Academy reuse).
Tip: "We have decks" or "it's in the IKB" = 3–4. "We do it verbally in nesting" or "I can walk you through it" = 1–2.

QUESTION 3 — Sponsorship & Alignment (weight x1)
Ask: "Beyond yourself, is this backed by multiple CX leadership team members or pillar leaders? And is it explicitly on the CX Roadmap or called out as a CX strategic initiative?"
Follow up: "Did this come out of a leadership discussion or planning session, or did it start as a single team's request?"
Score 1–5:
  1 = One individual requesting. No broader alignment confirmed.
  2 = One manager or team lead supports it.
  3 = One senior sponsor (Director or above) advocating for it.
  4 = Multiple leaders aligned, or explicitly mentioned in roadmap planning.
  5 = Explicitly on the CX Roadmap AND backed by cross-pillar CX LT members or multiple pillar leads.
Tip: Do NOT score based on title. A VP asking alone is a 3, not a 5. Look for cross-pillar alignment and roadmap visibility.

QUESTION 4 — Reusability / Duration (weight x1)
Ask: "Once built, do you expect this training to be reused beyond the immediate need — for example, in new hire onboarding, for other teams, vendor training, or future cohorts? And how long do you expect it to stay relevant?"
Score 1–5:
  1 = One-time use only. Likely obsolete quickly.
  2 = Reused once or twice within the same immediate context.
  3 = Regularly reused within the same team or program for 1–2 years.
  4 = Reused across multiple cohorts or roles over several years.
  5 = Foundational, long-lived asset: Academy, nesting, upskill tracks, vendors, and/or new feature launches.
Tip: "Every new hire will need this" or "it will go into CX Academy" = 4–5. "Just for the Q3 launch team" = 1–2.

== INFERRED FROM CONVERSATION (score silently) ==

Customer Impact (weight x3) — infer from Phase 2:
  1 = No direct customer impact. Entirely internal.
  2 = Indirect or minor customer friction. Rarely surfaces.
  3 = Moderate impact. Affects some customers with noticeable frequency.
  4 = High impact. Frequent issue or affects a significant customer segment.
  5 = Severe, widespread impact. High frequency AND high severity.

Nature of Work (weight x3) — infer from Phase 2:
  1 = Minor refresh or knowledge check on existing content.
  2 = Incremental performance improvement or small process tweak.
  3 = Major redesign of an existing core CX workflow.
  4 = Net-new training for a launch (important but not blocking).
  5 = Net-new training that is explicitly launch-gating (launch cannot proceed without it).

Strategic Alignment (weight x3) — infer from Phase 2:
  1 = No clear connection to strategic priorities.
  2 = Loosely aligned with a team goal but not a named company priority.
  3 = Supports a named strategic goal or team OKR.
  4 = Directly tied to a CX strategic bet: AI adoption, CX Academy, NPS/CSAT.
  5 = Explicitly on the CX Roadmap AND tied to a critical strategic bet with measurable business impact.
Tip: Push past vague claims. "It's important for CX" alone is a 1–2. Look for specific named bets or roadmap items.

Time Criticality (weight x3) — infer from Phase 5:
  1 = No deadline. Can be delivered whenever capacity allows.
  2 = Soft preference. No consequences if delayed.
  3 = Soft deadline within 6 months. Some urgency, flexibility exists.
  4 = Hard deadline (product launch, contract, seasonal) OR gating a launch.
  5 = Hard unmovable deadline (regulatory, contractual) AND training is the explicit blocker for a critical launch.
Note: If Time Criticality >= 4 AND Compliance = 5, AUTO-P0 hard rule triggers.

Business Value (weight x2) — infer from Phase 2:
  1 = Minimal or no measurable business impact.
  2 = Small efficiency gains or minor risk reduction.
  3 = Moderate cost reduction (handle time, errors) or meaningful risk mitigation.
  4 = Significant risk reduction (escalations, churn) or revenue protection.
  5 = Major business value: significant ARR, major churn avoidance, or material reduction in high-cost incidents.

Audience Reach & Scope (weight x2) — infer from Phase 3:
  1 = Fewer than 10 people on a single team.
  2 = 10–25 people, mostly one team.
  3 = 25–50 people across one CX pillar.
  4 = 50–100 people across multiple pillars.
  5 = 100+ Gusties OR multiple pillars PLUS extends to new hires, vendors, or other programs.

Scope of Change (weight x2) — infer from Phase 2:
  1 = Small local tweak. One team, minimal workflow change.
  2 = Moderate change within a single team or role.
  3 = Process change affecting one full CX pillar.
  4 = Cross-pillar change affecting core workflows for multiple teams.
  5 = Transformational. Changes core workflows or onboarding across multiple pillars.

== BOT SELF-ASSESSMENT ==

Feasibility (weight x1) — assess yourself based on the full conversation:
  1 = Complex scope, unclear or unavailable SME, tight timeline, no content.
  2 = Some clarity but significant unknowns. SME uncertain or timeline compressed.
  3 = Moderate complexity. SME available but timeline is tight, or content needs work.
  4 = Clear scope, accessible SME, reasonable timeline.
  5 = Clear scope, available SME, adequate timeline, content ready. Low execution risk.

== SCORING ==

After all variables are scored:
1. Calculate:
   total = (4 x Compliance) + (3 x CustomerImpact) + (3 x NatureOfWork)
         + (3 x StrategicAlignment) + (3 x TimeCriticality) + (2 x BusinessValue)
         + (2 x AudienceScope) + (2 x ScopeOfChange) + (1 x Reusability)
         + (1 x Feasibility) + (1 x ContentReadiness) + (1 x Sponsorship)
   Maximum possible score: 130

2. Hard rule: if Compliance >= 5 AND TimeCriticality >= 4 → auto P0 regardless of total score. Flag this override explicitly.

3. Tier mapping:
   P0 = 120–130
   P1 = 105–119
   P2 = 80–104
   P3 = below 80

4. Show the requestor a scorecard table with: variable, score (1–5), weight, weighted points, and a one-sentence rationale for each score.

5. Show: PRIORITY TIER: [P0/P1/P2/P3]  |  TOTAL SCORE: [X] / 130

6. Invite the requestor to push back on any score before finalizing.`;

// Create a new session
app.post('/api/session', (req, res) => {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    messages: [],
    createdAt: Date.now()
  });
  res.json({ sessionId });
});

// Send a message and get a response
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sessions.get(sessionId);

  // Add user message to history
  session.messages.push({
    role: 'user',
    content: message
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: session.messages
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    session.messages.push({
      role: 'assistant',
      content: assistantMessage
    });

    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Get initial greeting
app.post('/api/greeting', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sessions.get(sessionId);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: 'Hello, I want to submit a training request.' }]
    });

    const assistantMessage = response.content[0].text;

    // Initialize conversation with the greeting exchange
    session.messages = [
      { role: 'user', content: 'Hello, I want to submit a training request.' },
      { role: 'assistant', content: assistantMessage }
    ];

    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Failed to get greeting from AI' });
  }
});

// Generate Training Design Document
app.post('/api/generate-document', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = sessions.get(sessionId);

  const documentPrompt = `Based on this conversation, generate a complete Training Design Document with the following sections:

1. Request Overview
2. Performance Problem Statement
3. Root Cause Analysis
4. Target Audience
5. Existing Resources Review
6. Learning Objectives (use ABCD format: Audience, Behavior, Condition, Degree)
7. Recommended Design Approach (include modality recommendations)
8. Evaluation Plan (reference Kirkpatrick levels)
9. Timeline & Dependencies
10. Prioritization Scorecard — Format this as a table with columns: Variable | Score (1-5) | Weight | Weighted Points | Rationale
    Include all 12 variables: Compliance, Customer Impact, Nature of Work, Strategic Alignment, Time Criticality, Business Value, Audience Reach, Scope of Change, Reusability, Feasibility, Content Readiness, Sponsorship.
    At the bottom show: TOTAL SCORE: [X] / 130 | PRIORITY TIER: [P0/P1/P2/P3]
    Note if the AUTO-P0 hard rule was triggered (Compliance=5 AND TimeCriticality>=4).
11. L&D Team Notes and Suggested Next Steps

Format the document professionally with clear section headers. Use markdown formatting for readability.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        ...session.messages,
        { role: 'user', content: documentPrompt }
      ]
    });

    const document = response.content[0].text;

    // Extract priority tier from document
    const tierMatch = document.match(/PRIORITY TIER:\s*(P[0-3])/i) ||
                      document.match(/\*\*?(P[0-3])\*\*?/i);
    const priorityTier = tierMatch ? tierMatch[1].toUpperCase() : 'P2';

    // Send email notification automatically
    let emailSent = false;
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      emailSent = await sendEmailNotification(document, priorityTier);
    }

    res.json({ document, priorityTier, emailSent });
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

app.listen(port, () => {
  console.log(`L&D Chatbot server running at http://localhost:${port}`);
});
