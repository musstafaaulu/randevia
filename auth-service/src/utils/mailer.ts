import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

// Created once and reused: nodemailer pools the underlying SMTP connection,
// and createTransport itself never connects eagerly, so this is safe even
// before a mail server (MailHog in development) is reachable.
let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

// Deliberately lets a send failure propagate: callers decide per flow
// whether that should fail the request (password reset, resend) or just be
// logged (the best-effort verification e-mail sent on register).
export async function sendMail(message: MailMessage): Promise<void> {
  await getTransporter().sendMail({ from: env.SMTP_FROM, ...message });
}
