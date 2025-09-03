'use strict';

module.exports = {
  async beforeCreate(event) {
    const data = event.params.data || {};
    if (data.city && typeof data.city === 'string') {
      const normalized = data.city.toLowerCase();
      if (normalized === 'shanghai') data.city = 'Shanghai';
      if (normalized === 'hangzhou') data.city = 'Hangzhou';
    }
  },
};