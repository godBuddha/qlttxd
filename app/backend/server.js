require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const { TokenBlocklist } = require('./token-blocklist');

const { secret } = require('./utils/helpers');
const { makeAuthenticate, authenticate, authorize } = require('./utils/middleware');

// Route modules
const authRoutes = require('./routes/auth');
const danhMucRoutes = require('./routes/danh-muc');
const baoCaoRoutes = require('./routes/bao-cao');
const hoSoRoutes = require('./routes/ho-so');
const thongKeRoutes = require('./routes/thong-ke');
const adminUsersRoutes = require('./routes/admin-users');
const adminLocationsRoutes = require('./routes/admin-locations');
const adminCatalogsRoutes = require('./routes/admin-catalogs');
const thongBaoRoutes = require('./routes/thong-bao');
const banDoRoutes = require('./routes/ban-do');

function buildApp({ pool }) {
  if (!secret() || secret().length < 32) throw new Error('JWT_SECRET phải được cấu hình tối thiểu 32 ký tự');
  const tokenBlocklist = new TokenBlocklist({ pool });
  const authenticateWithBlocklist = makeAuthenticate(tokenBlocklist);
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;
  app.use((req, res, next) => {
    const requestId = req.get('X-Request-Id') || (require('node:crypto').randomUUID)();
    req.requestId = requestId;
    res.set({ 'X-Request-Id': requestId });
    next();
  });
  app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((x) => x.trim()), methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] } : { origin: false }));
  app.use(express.json({ limit: '1mb' }));

  // Security headers via helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", "https://*.tile.openstreetmap.org", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true }
  }));

  // Shared deps for route modules
  const deps = {
    pool,
    tokenBlocklist,
    authenticate: authenticateWithBlocklist,
    authorize,
  };

  // Register route modules
  app.use(authRoutes(deps));
  app.use(danhMucRoutes(deps));
  app.use(baoCaoRoutes(deps));
  app.use(hoSoRoutes(deps));
  app.use(thongKeRoutes(deps));
  app.use(adminUsersRoutes(deps));
  app.use(adminLocationsRoutes(deps));
  app.use(adminCatalogsRoutes(deps));
  app.use(thongBaoRoutes(deps));
  app.use(banDoRoutes(deps));

  app.use((error,_req,res,_next)=>{if(error instanceof (require('multer').MulterError))return res.status(400).json({error:`Tải tệp thất bại: ${error.message}`}); console.error(error); return res.status(500).json({error:'Lỗi máy chủ nội bộ'});});
  return app;
}

function createPool() { return new Pool({ host: process.env.PGHOST, port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined }); }
if (require.main === module) { const pool=createPool(); const port=Number(process.env.PORT||3000); const host=process.env.HOST||'0.0.0.0'; buildApp({pool}).listen(port,host,()=>console.log(`QLTTXD API đang nghe tại http://${host}:${port}`)); }
module.exports={buildApp,createPool,authenticate,authorize,coordinate:require('./utils/helpers').coordinate,TokenBlocklist};
