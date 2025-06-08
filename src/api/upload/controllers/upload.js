const fs = require('fs');
const path = require('path');

module.exports = {
  async serveFile(ctx) {
    const { path: filePath } = ctx.params;
    
    // Construct the full file path
    const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath);
    
    try {
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        ctx.status = 404;
        ctx.body = { error: 'File not found' };
        return;
      }

      // Get file stats
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        ctx.status = 404;
        ctx.body = { error: 'Not a file' };
        return;
      }

      // Set appropriate headers
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      };

      ctx.type = mimeTypes[ext] || 'application/octet-stream';
      ctx.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      
      // Stream the file
      ctx.body = fs.createReadStream(fullPath);
    } catch (error) {
      console.error('Error serving file:', error);
      ctx.status = 500;
      ctx.body = { error: 'Internal server error' };
    }
  },
}; 