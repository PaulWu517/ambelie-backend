'use strict';

/**
 * showroom service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::showroom.showroom');