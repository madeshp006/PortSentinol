import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail({
  to,
  subject,
  text,
  html,
}) {
  try {
    const result = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "onboarding@resend.dev",
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", result);

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