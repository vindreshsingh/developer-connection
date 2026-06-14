/**
 * Transactional email sender — Phase 10.
 *
 * Extracted from the auth routes so it can be driven by the `email` BullMQ
 * queue handler (worker process) as well as the inline fallback. Routes build
 * the message (subject/html) and enqueue it; this module only knows how to
 * deliver one.
 */

import nodemailer from 'nodemailer';

let transporter;

// Lazily create a single transporter — reading env at call time (after dotenv)
// and reusing the connection pool across messages.
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password, not the account password
      },
    });
  }
  return transporter;
};

/** Send a single email. `{ to, subject, html }`. */
export const sendEmail = async ({ to, subject, html }) => {
  await getTransporter().sendMail({
    from: `"Developer Connection" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
