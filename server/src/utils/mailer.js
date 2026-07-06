import { Resend } from "resend";

let resendInstance = null;

function getResend() {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("WARNING: RESEND_API_KEY is not defined. Resend operations will run in mockup sandbox mode.");
      return null;
    }
    try {
      resendInstance = new Resend(key);
    } catch (err) {
      console.error("Failed to construct Resend client:", err.message);
      return null;
    }
  }
  return resendInstance;
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}) {
  try {
    const resend = getResend();
    if (!resend) {
      console.log(`[Sandbox Mode] Email would be sent to: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body text snippet: ${(text || html || "").substring(0, 100)}...`);
      return {
        delivered: false,
        sandbox: true,
      };
    }

    const result = await resend.emails.send({
      from:
        process.env.MAIL_FROM ||
        process.env.EMAIL_FROM ||
        "onboarding@resend.dev",
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent successfully:", result);

    return {
      delivered: true,
    };
  } catch (error) {
    console.error(
      "Resend send error:",
      error
    );

    throw error;
  }
}