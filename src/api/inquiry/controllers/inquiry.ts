import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 获取用户询价列表
  async getInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      ctx.send({
        success: true,
        data: (websiteUser as any).inquiryItems || [],
        user: {
          id: websiteUser.id,
          email: websiteUser.email,
          name: websiteUser.name,
        },
      });
    } catch (error) {
      console.error('Get inquiries error:', error);
      return ctx.internalServerError('Failed to get inquiries');
    }
  },

  // 添加商品到询价列表
  async addToInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { productId } = ctx.request.body;

      if (!productId) {
        return ctx.badRequest('Product ID is required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证产品是否存在
      const product = await strapi.entityService.findOne('api::product.product', productId);
      if (!product) {
        return ctx.badRequest('Product not found');
      }

      // 检查产品是否已在询价列表中
      const currentInquiryItems = (websiteUser as any).inquiryItems || [];
      const isAlreadyInInquiry = currentInquiryItems.some(item => item.id === productId);

      if (!isAlreadyInInquiry) {
        // 添加产品到询价列表
        const updatedInquiryItems = [...currentInquiryItems.map(item => item.id), productId];
        
        await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
          data: {
            inquiryItems: updatedInquiryItems as any
          }
        });
      }

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      ctx.send({
        success: true,
        message: 'Product added to inquiry list successfully',
        data: (updatedUser as any).inquiryItems || []
      });
    } catch (error) {
      console.error('Add to inquiry error:', error);
      return ctx.internalServerError('Failed to add product to inquiry list');
    }
  },

  // 从询价列表移除商品
  async removeFromInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { productId } = ctx.params;

      if (!productId) {
        return ctx.badRequest('Product ID is required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 从询价列表中移除产品
      const currentInquiryItems = (websiteUser as any).inquiryItems || [];
      const updatedInquiryItems = currentInquiryItems
        .filter(item => item.id !== parseInt(productId))
        .map(item => item.id);

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiryItems: updatedInquiryItems }
      });

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      ctx.send({
        success: true,
        message: 'Product removed from inquiry list successfully',
        data: (updatedUser as any).inquiryItems || []
      });
    } catch (error) {
      console.error('Remove from inquiry error:', error);
      return ctx.internalServerError('Failed to remove product from inquiry list');
    }
  },

  // 清空询价列表
  async clearInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 清空询价列表
        await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
         data: { 
           inquiryItems: [] as any
         }
        });

      ctx.send({
        success: true,
        message: 'Inquiry list cleared successfully',
        data: []
      });
    } catch (error) {
      console.error('Clear inquiries error:', error);
      return ctx.internalServerError('Failed to clear inquiry list');
    }
  },

  // 同步本地询价列表到后端
  async syncInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { inquirySlugs } = ctx.request.body;
      console.log('🔄 [Inquiry Sync] Received inquiry slugs:', inquirySlugs);

      if (!Array.isArray(inquirySlugs)) {
        return ctx.badRequest('Inquiry slugs must be an array');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 根据slug查找产品并获取其ID
      const validProductIds = [];
      for (const slug of inquirySlugs) {
        if (!slug) {
          console.warn('⚠️ [Inquiry Sync] Empty slug found, skipping');
          continue;
        }
        
        const products = await strapi.entityService.findMany('api::product.product', {
          filters: { slug: slug }
        });
        
        if (products && products.length > 0) {
          validProductIds.push(products[0].id);
          console.log(`✅ [Inquiry Sync] Found product for slug ${slug}: ID ${products[0].id}`);
        } else {
          console.warn(`⚠️ [Inquiry Sync] Product not found for slug: ${slug}`);
        }
      }

      console.log('📋 [Inquiry Sync] Valid product IDs:', validProductIds);

      // 合并本地询价列表和后端询价列表
      const currentInquiryItems = (websiteUser as any).inquiryItems || [];
      const currentProductIds = currentInquiryItems.map(item => item.id);
      
      // 合并去重
      const mergedProductIds = [...new Set([...currentProductIds, ...validProductIds])];

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { 
          inquiryItems: mergedProductIds as any
        }
      });

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          inquiryItems: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
          }
        }
      });

      ctx.send({
        success: true,
        message: 'Inquiry list synced successfully',
        data: (updatedUser as any).inquiryItems || []
      });
    } catch (error) {
      console.error('Sync inquiries error:', error);
      return ctx.internalServerError('Failed to sync inquiry list');
    }
  },

  // 提交询价请求
  async submitInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { 
        email, 
        firstName, 
        lastName, 
        phone, 
        message, 
        productIds 
      } = ctx.request.body;

      if (!email || !firstName || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return ctx.badRequest('Email, first name, and product IDs are required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证所有产品是否存在
      const products = [];
      for (const productId of productIds) {
        const product = await strapi.entityService.findOne('api::product.product', productId, {
          populate: {
            main_image: {
              populate: '*'
            }
          }
        });
        if (!product) {
          return ctx.badRequest(`Product with ID ${productId} not found`);
        }
        products.push(product);
      }

      // 这里可以发送邮件通知或保存到数据库
      // 暂时只返回成功响应
      console.log('Inquiry submitted:', {
        user: {
          id: websiteUser.id,
          email: websiteUser.email
        },
        inquiry: {
          email,
          firstName,
          lastName,
          phone,
          message,
          products: products.map(p => ({ id: p.id, name: p.name }))
        }
      });

      // 将当前询价保存到历史记录，并清空当前询价列表
      const currentInquiries = (websiteUser.inquiries as any[]) || [];
      const newInquiryRecord = {
        submittedAt: new Date().toISOString(),
        customerInfo: {
          email,
          firstName,
          lastName,
          phone,
          message
        },
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug
        }))
      };
      
      await strapi.entityService.update('api::website-user.website-user', websiteUser.id, {
          data: { 
            inquiries: [...currentInquiries, newInquiryRecord],
            inquiryItems: [] as any // 清空当前询价列表
          }
        });

      ctx.send({
        success: true,
        message: 'Inquiry submitted successfully',
        data: {
          submittedAt: new Date().toISOString(),
          productCount: products.length
        }
      });
    } catch (error) {
      console.error('Submit inquiry error:', error);
      return ctx.internalServerError('Failed to submit inquiry');
    }
  },

  // 处理 "Enquire Similar" 请求
  async enquireSimilar(ctx) {
    try {
      const { email, message, productName, productUrl } = ctx.request.body;

      if (!email || !message || !productName) {
        return ctx.badRequest('Email, message, and productName are required');
      }

      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_DEFAULT_FROM || 'hello@ambelie.com';

      // 发送给管理员/客服的邮件
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Enquire Similar Request</h2>
          <p>A customer is inquiring about a product similar to a sold-out item.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #d32f2f;">
            <p><strong>Customer Email:</strong> ${email}</p>
            <p><strong>Reference Product:</strong> ${productName}</p>
            <p><strong>Product URL:</strong> <a href="${productUrl}">${productUrl}</a></p>
          </div>
          
          <h3 style="font-size: 16px;">Customer Message:</h3>
          <p style="background-color: #fff; padding: 15px; border: 1px solid #ddd; white-space: pre-wrap;">${message}</p>
          
          <p>Please reply directly to the customer's email.</p>
        </div>
      `;

      // 发送给客户的确认邮件
      const customerEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Inquiry Received - AMBELIE</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Solena-Regular', 'Poppins', 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #333; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 1.8rem; font-family: 'Solena-Regular', 'Times New Roman', 'Georgia', serif; font-weight: 400; color: #ffffff;">Inquiry Received</h1>
            <div style="margin: 15px 0 0 0; text-align: center;">
              <img src="https://www.ambelie.com/assets/vi/Ambelie_whitelogo.png" alt="AMBELIE Logo" style="height: 35px; margin: 0 auto;" />
            </div>
          </div>

          <div style="background-color: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; margin-bottom: 20px; color: #333;">Thank you for reaching out to Ambelie.</p>
            <p style="color: #333;">We have received your inquiry regarding a product similar to <strong>${productName}</strong>.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #666;">
              <h3 style="margin: 0 0 15px 0; color: #333; font-family: 'Solena-Regular', 'Times New Roman', 'Georgia', serif; font-weight: 400;">Your Message:</h3>
              <p style="margin: 0; color: #555; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p style="color: #333;">Our team will review your request and get back to you shortly.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.ambelie.com/" style="display: inline-block; background-color: #555; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: 500; font-family: 'Poppins', 'Arial', sans-serif;">Visit Our Website</a>
            </div>
            
            <p style="margin-top: 30px; color: #333;">Warm regards,<br><strong>The Ambelie Team</strong></p>
            
            <!-- Email Signature -->
            <div style="margin-top: 30px; padding: 25px; background-color: #f8f8f8; border-radius: 8px;">
              <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <img src="https://www.ambelie.com/assets/vi/Ambelie_VI_Logos.png" alt="AMBELIE Logo" style="height: 40px; margin-right: 15px;" />
                </div>
                <p style="margin: 0 0 5px 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">NO.21 KANGPING ROAD</p>
                <p style="margin: 0 0 5px 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">SHANGHAI</p>
                <p style="margin: 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">
                  <a href="https://www.instagram.com/ambelie_gallery" style="color: #666; text-decoration: underline; font-weight: 500;">@AMBELIE</a>
                </p>
              </div>
              <div style="border-top: 1px solid #ddd; padding-top: 15px; text-align: center;">
                <p style="margin: 0; font-size: 0.85rem; color: #999; font-family: 'Poppins', 'Arial', sans-serif;">This is an automated confirmation email. Please do not reply to this message.</p>
                <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #999; font-family: 'Poppins', 'Arial', sans-serif;">© ${new Date().getFullYear()} AMBELIE. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        // 1. 发送给客户
        await strapi.plugin('email').service('email').send({
          to: email,
          subject: `Ambelie - Inquiry Received for ${productName}`,
          html: customerEmailHtml,
        });

        // 2. 发送给管理员/客服
        await strapi.plugin('email').service('email').send({
          to: adminEmail,
          replyTo: email, // 让管理员可以直接回复客户
          subject: `[INQUIRY] Similar Product Request - ${productName}`,
          html: adminEmailHtml,
        });

        strapi.log.info(`Enquire similar email sent successfully for ${productName}`);
      } catch (emailError) {
        strapi.log.error('Failed to send enquire similar email:', emailError);
        return ctx.internalServerError('Failed to send email. Please try again later.');
      }

      return ctx.send({
        success: true,
        message: 'Enquiry sent successfully',
      });
    } catch (error) {
      strapi.log.error('Enquire similar error:', error);
      return ctx.internalServerError('Failed to process enquiry');
    }
  }
}));