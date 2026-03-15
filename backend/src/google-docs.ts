import { google } from 'googleapis';
import { config } from './config.js';
import { markdownToDocsContent, buildFormatRequests } from './markdown-to-docs.js';

function getOAuth2Client() {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for built-in Google');
  }
  const redirectUri =
    config.googleRedirectUri || `http://localhost:${config.port}/auth/google/callback`;
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    redirectUri
  );
}

export async function createGoogleDoc(
  credentialsJson: string,
  title: string,
  content: string
): Promise<string> {
  const cred = JSON.parse(credentialsJson) as { refresh_token?: string };
  const refreshToken = cred.refresh_token;
  if (!refreshToken) {
    throw new Error('Invalid Google credentials');
  }
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const docs = google.docs({ version: 'v1', auth: oauth2 });
  const createRes = await docs.documents.create({
    requestBody: { title: title || 'Untitled' },
  });
  const documentId = createRes.data.documentId;
  if (!documentId) {
    throw new Error('Failed to create document');
  }
  const trimmed = content?.trim();
  if (trimmed) {
    const { plainText, ops } = markdownToDocsContent(trimmed);
    const formatRequests = buildFormatRequests(ops);
    const requests: object[] = [
      {
        insertText: {
          location: { index: 1 },
          text: plainText,
        },
      },
      ...formatRequests,
    ];
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }
  const link = `https://docs.google.com/document/d/${documentId}/edit`;
  return `Document created: "${title}". View: ${link}`;
}
