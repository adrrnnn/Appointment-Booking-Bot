const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "Appointment Booking Bot - User Manual.pdf");
const doc = new PDFDocument({ margin: 50, size: "A4" });
doc.pipe(fs.createWriteStream(OUT));

const FONT_NORMAL = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const BLACK = "#111111";
const GRAY = "#555555";
const LIGHT = "#888888";

function h1(text) {
  doc.font(FONT_BOLD).fontSize(16).fillColor(BLACK).text(text).moveDown(0.4);
}

function h2(text) {
  doc.font(FONT_BOLD).fontSize(12).fillColor(BLACK).text(text).moveDown(0.3);
}

function p(text) {
  doc.font(FONT_NORMAL).fontSize(10).fillColor(GRAY).text(text, { lineGap: 3 }).moveDown(0.4);
}

function bullet(text) {
  doc.font(FONT_NORMAL).fontSize(10).fillColor(GRAY)
    .text("- " + text, { indent: 12, lineGap: 2 });
}

function step(n, text) {
  const label = n === null ? "-" : n + ".";
  doc.font(FONT_NORMAL).fontSize(10).fillColor(GRAY)
    .text(label + " " + text, { indent: 12, lineGap: 2 });
}

function divider() {
  doc.moveDown(0.5)
    .moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#dddddd").stroke()
    .moveDown(0.5);
}

// Cover
doc.font(FONT_BOLD).fontSize(22).fillColor(BLACK).text("Appointment Booking Bot", { align: "center" });
doc.moveDown(0.6);
divider();

// Overview
h1("Overview");
p("Appointment Booking Bot is a Windows desktop application that automates appointment booking on the Fasah platform. It searches for available slots and submits booking requests using your provided tokens.");
p("Version 2.0 supports running up to 4 independent sessions from a single window, each with their own drivers, tokens, and bot processes running simultaneously.");
divider();

// Installation
h1("Installation");
step(1, "Download the installer: Appointment Bot Setup 1.0.0.exe from the provided link.");
step(2, "Run the installer. If Windows shows a SmartScreen warning, click More info then Run anyway.");
step(3, "The app installs and opens automatically. A shortcut is added to the Start Menu.");
doc.moveDown(0.5);
divider();

// Sessions
h1("Sessions");
p("Sessions let you run multiple independent bots at the same time. Each session is completely separate.");
h2("Adding a Session");
step(1, "Click the + button in the title bar to open a new session (up to 4).");
step(2, "Each session tab shows its name (Session 1, Session 2, etc.).");
step(3, "Click a session tab to switch to it. The other sessions keep running in the background.");
step(4, "Click the x on a session tab to close it.");
doc.moveDown(0.5);
divider();

// Search Token
h1("Search Token");
p("The search token is used to poll Fasah for available appointment slots. It is required before starting the bot.");
step(1, "Copy your Bearer token from Fasah (from browser dev tools or network inspector).");
step(2, "Paste it into the Search Token field at the top.");
step(3, "Select your port from the Port dropdown.");
step(4, "Click Validate to confirm the token is active.");
step(5, "Click Clear Session to reset the token and logs.");
doc.moveDown(0.3);
p("Tokens expire after approximately 6 hours. You will need to paste a fresh token each session.");
divider();

// Drivers
h1("Driver Management");
p("Each session supports up to 4 drivers. Each driver has their own booking token and vehicle details.");
h2("Adding a Driver");
step(1, "Go to the Drivers tab.");
step(2, "Fill in the driver details: name, booking token(s), license number, declaration number, plate info, and countries.");
step(3, "To add another driver, click the + tab button at the top of the driver panel.");
step(4, "To remove a driver, click the x next to their tab.");
doc.moveDown(0.3);
h2("Saving a Preset");
step(1, "Fill in the driver details.");
step(2, "Click Save Preset and give it a name.");
step(3, "Saved presets appear in the Scheduling tab and can be loaded at any time.");
divider();

// Console
h1("Running the Bot");
step(1, "Go to the Console tab.");
step(2, "Confirm the search token is valid (green indicator at the top).");
step(3, "Click START. The bot begins searching for slots immediately.");
step(4, "Live logs appear in real time showing each request and response.");
step(5, "Click STOP at any time to halt the bot.");
doc.moveDown(0.3);
p("When a slot is found, the bot attempts to book it for all configured drivers simultaneously. Results appear in the Results tab.");
divider();

// Scheduling
h1("Scheduling");
p("Use the Scheduling tab to queue a bot run for a future time.");
h2("Creating a Scheduled Run");
step(1, "Save a driver preset first (from the Drivers tab).");
step(2, "In the Scheduling tab, select the preset, choose the driver slot, and set a date and time.");
step(3, "Click Queue to add it to the list.");
doc.moveDown(0.3);
h2("Token Refresh Prompt");
p("40 minutes before a scheduled run, the app will ask you to enter fresh tokens. This prevents token expiry from causing a failed run.");
step(1, "Enter a fresh search token and booking token(s) when prompted.");
step(2, "Click Confirm Tokens. The bot will start automatically at the scheduled time.");
step(null, "If you click Skip Task, the run is cancelled.");
doc.moveDown(0.3);
h2("Force Start");
p("If a scheduled run does not start automatically, click the Force Start button next to the task to launch it immediately.");
divider();

// Results
h1("Results");
p("After the bot finishes, go to the Results tab to see a summary.");
bullet("Booked entries show the driver name, appointment slot, and timestamp.");
bullet("Failed entries show the driver name and the reason for failure.");
bullet("Click Clear to reset the results list.");
divider();

// Multiple Instances
h1("Running Multiple Sessions");
p("To run bots for different sets of drivers at the same time:");
step(1, "Click + in the title bar to open a new session.");
step(2, "Configure drivers and tokens in the new session independently.");
step(3, "Click START in each session's Console tab.");
p("All sessions run simultaneously. Each session has its own logs, results, and saved presets stored separately.");
divider();

// Tips
h1("Tips");
bullet("Tokens last approximately 6 hours. Always paste a fresh token at the start of each session.");
bullet("Use presets to avoid re-entering driver details every time.");
bullet("The bot retries continuously until a slot is found or you stop it.");
bullet("Each booking token can only book one appointment. Use multiple booking tokens per driver to increase success rate.");
bullet("Run multiple sessions to cover more drivers simultaneously.");

doc.end();
console.log("PDF written to: " + OUT);
