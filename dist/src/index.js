"use strict";
// import type { Core } from '@strapi/strapi';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register( /* { strapi }: { strapi: Core.Strapi } */) { },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    async bootstrap({ strapi }) {
        // Set upload permissions for public role
        try {
            const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
                where: { type: 'public' },
            });
            if (publicRole) {
                await strapi.query('plugin::users-permissions.permission').updateMany({
                    where: {
                        role: publicRole.id,
                        action: 'plugin::upload.content-api.find',
                    },
                    data: { enabled: true },
                });
                await strapi.query('plugin::users-permissions.permission').updateMany({
                    where: {
                        role: publicRole.id,
                        action: 'plugin::upload.content-api.findOne',
                    },
                    data: { enabled: true },
                });
                console.log('✅ Upload permissions set for public role');
            }
        }
        catch (error) {
            console.error('❌ Error setting upload permissions:', error);
        }
    },
};
