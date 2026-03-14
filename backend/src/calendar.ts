import { google } from 'googleapis';
import { config } from './config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
];

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

export async function getAuthUrl(state: string): Promise<string> {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state,
    scope: SCOPES,
  });
}

export async function getCalendarClient(credentialsJson: string) {
  const cred = JSON.parse(credentialsJson) as { refresh_token?: string };
  if (!cred.refresh_token) throw new Error('Invalid Google credentials');
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: cred.refresh_token });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

function normalizeEventTimes(startTime: string, endTime: string, timeZone: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end.getTime() <= start.getTime()) end.setTime(start.getTime() + 3600000);
  const fmt = (d: Date) => {
    const y = d.toLocaleString('en-CA', { timeZone, year: 'numeric' });
    const m = d.toLocaleString('en-CA', { timeZone, month: '2-digit' });
    const day = d.toLocaleString('en-CA', { timeZone, day: '2-digit' });
    const h = d.toLocaleString('en-CA', { timeZone, hour: '2-digit', hour12: false });
    const min = d.toLocaleString('en-CA', { timeZone, minute: '2-digit' });
    const s = d.toLocaleString('en-CA', { timeZone, second: '2-digit' });
    return `${y}-${m}-${day}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

export async function createCalendarEvent(
  credentialsJson: string,
  summary: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string> {
  const calendar = await getCalendarClient(credentialsJson);
  const tz = config.calendarTimezone;
  const { start, end } = normalizeEventTimes(startTime, endTime, tz);
  const body: Record<string, unknown> = {
    summary,
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
  };
  if (description) body.description = description;
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: body,
  });
  const data = res.data;
  const link = data.htmlLink ?? '';
  return link ? `Event created: "${summary}". View: ${link}` : `Event created: "${summary}".`;
}

export async function listCalendarEvents(
  credentialsJson: string,
  maxResults = 10
): Promise<string> {
  const calendar = await getCalendarClient(credentialsJson);
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const items = res.data.items ?? [];
  if (items.length === 0) return 'No upcoming events.';
  const lines = items.map((e) => {
    const start = e.start?.dateTime ?? e.start?.date ?? '?';
    return `- ${e.summary ?? '(no title)'} (${start})`;
  });
  return 'Upcoming events:\n' + lines.join('\n');
}
