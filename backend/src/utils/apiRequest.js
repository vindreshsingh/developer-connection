/**
 * Minimal HTTPS GET helper.
 *
 * Uses `node:https` so nock intercepts it in tests.
 * Used by the enrichment services — do not add session/cookie logic here.
 *
 * @param {string} hostname  e.g. 'api.github.com'
 * @param {string} path      e.g. '/user/repos?sort=stars&per_page=6'
 * @param {Record<string, string>} headers
 * @returns {Promise<unknown>} Parsed JSON body
 * @throws  If the status code is ≥ 400 or the body is not valid JSON.
 */
import { request } from 'node:https';

export function apiGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'GET', headers };

    const req = request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();

        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode} from ${hostname}${path}`);
          err.statusCode = res.statusCode;
          err.responseBody = body;
          return reject(err);
        }

        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Non-JSON response from ${hostname}${path}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
