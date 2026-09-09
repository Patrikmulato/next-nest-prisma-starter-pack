import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

const DOCS_PATH = '/api/docs';
const DOCS_JSON_PATH = '/api/docs-json';

// Pinned to the swagger-ui-dist version this project's @nestjs/swagger
// resolves (backend/node_modules/.../swagger-ui-dist/package.json). Bump this
// alongside any @nestjs/swagger upgrade that changes it.
const SWAGGER_UI_VERSION = '5.32.8';
const SWAGGER_UI_CDN_BASE = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

function buildSwaggerUiHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>GeoGuessr Helper API Docs</title>
<link rel="stylesheet" href="${SWAGGER_UI_CDN_BASE}/swagger-ui.css" />
</head>
<body style="margin:0">
<div id="swagger-ui"></div>
<script src="${SWAGGER_UI_CDN_BASE}/swagger-ui-bundle.js"></script>
<script src="${SWAGGER_UI_CDN_BASE}/swagger-ui-standalone-preset.js"></script>
<script>
  window.onload = function () {
    window.ui = SwaggerUIBundle({
      url: '${DOCS_JSON_PATH}',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
    });
  };
</script>
</body>
</html>`;
}

export function setupSwagger(app: INestApplication): void {
  // API docs expose the full schema surface (auth, users, saved filters)
  // across environments.

  const config = new DocumentBuilder()
    .setTitle('GeoGuessr Helper API')
    .setDescription('Backend API for map data, authentication, saved filters, and users.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ui: false skips Nest's default Swagger UI HTML + local static-asset
  // serving (@fastify/static pointed at swagger-ui-dist on disk). Vercel's
  // serverless function bundler does not reliably include those on-disk
  // assets, so the default setup 404s on swagger-ui-bundle.js/swagger-ui.css
  // in production despite working locally. Instead we keep only the
  // dynamically-generated OpenAPI JSON route (raw: ['json'], zero filesystem
  // dependency) and render our own HTML shell below that loads swagger-ui
  // from a public CDN.
  SwaggerModule.setup('api/docs', app, document, { ui: false, raw: ['json'] });

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(DOCS_PATH, (_req: FastifyRequest, res: FastifyReply) => {
    res.type('text/html').send(buildSwaggerUiHtml());
  });
}
