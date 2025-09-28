const { google } = require("googleapis");
const creds = JSON.parse(process.env.SERVICE_CREDENTIALS);

const SPREADSHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "Sheet1";

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function appendPlaceToSheet(place) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:K`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: place,
    },
  });
}

module.exports = { appendPlaceToSheet };
