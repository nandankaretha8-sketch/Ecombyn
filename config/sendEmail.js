import { Resend } from 'resend';
import dotenv from 'dotenv'
dotenv.config()

if(!process.env.RESEND_API){
    // Log warning for debugging (remove in production)
    // console.warn('RESEND_API not found in environment variables');
}

const resend = new Resend(process.env.RESEND_API);

const sendEmail = async({sendTo, subject, html, from = null })=>{
    try {
        // Validate inputs
        if (!sendTo || !subject || !html) {
            // Log error for debugging (remove in production)
            // console.error('Missing required email parameters:', { sendTo, subject, html });
            return { success: false, error: 'Missing required email parameters' };
        }

        // Check if Resend is configured
        if (!process.env.RESEND_API) {
            // Log error for debugging (remove in production)
            // console.error('RESEND_API not configured');
            return { success: false, error: 'Email service not configured' };
        }

        const { data, error } = await resend.emails.send({
            from: from || 'Akshar Art <onboarding@resend.dev>',
            to: sendTo,
            subject: subject,
            html: html,
        });

        if (error) {
            // Log error for debugging (remove in production)
            // console.error('Resend API Error:', error);
            return { success: false, error: error.message };
        }

        // Log success for debugging (remove in production)
        // console.log('Email sent successfully to:', sendTo);
        return { success: true, data };
    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
}

export default sendEmail

