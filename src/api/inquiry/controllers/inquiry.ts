/**
 * inquiry controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::inquiry.inquiry', ({ strapi }) => ({
  async similar(ctx) {
    try {
      const { email, message, productName } = ctx.request.body;

      if (!email || !message || !productName) {
        return ctx.badRequest('Missing required fields');
      }

      // Save to database
      const inquiry = await strapi.entityService.create('api::inquiry.inquiry', {
        data: {
          email,
          message,
          productName,
          status: 'pending',
          type: 'similar_product',
          publishedAt: new Date(),
        },
      });

      // Try to send email notification
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_DEFAULT_FROM || 'hello@ambelie.com';
        
        const adminEmailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">New Similar Product Inquiry</h2>
            <p>A customer is looking for a product similar to a sold-out item.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #1a1a1a;">
              <p><strong>Sold Out Product:</strong> ${productName}</p>
              <p><strong>Customer Email:</strong> ${email}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
            
            <p>Please log in to the Strapi Admin Panel to manage this inquiry.</p>
          </div>
        `;

        await strapi.plugin('email').service('email').send({
          to: adminEmail,
          replyTo: email,
          subject: `[Similar Product Request] ${productName}`,
          html: adminEmailHtml,
        });

      } catch (emailError) {
        strapi.log.error('Failed to send similar product inquiry email:', emailError);
      }

      return ctx.send({ success: true, data: inquiry });
    } catch (err) {
      strapi.log.error('Error processing similar product inquiry:', err);
      return ctx.internalServerError('An error occurred while processing your request');
    }
  }
}));