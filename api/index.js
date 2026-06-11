const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'worldcup2026_secret_key';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ─── SCHEMA INIT ──────────────────────────────────────────────────────────────
async function initDB() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    activation_token TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    flag TEXT NOT NULL,
    group_name TEXT NOT NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    round INTEGER NOT NULL,
    round_name TEXT NOT NULL,
    match_number INTEGER NOT NULL,
    home_team_id TEXT,
    away_team_id TEXT,
    match_date TEXT,
    venue TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled'
  )`);

  await query(`CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    is_double INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    submitted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, match_id)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS champion_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    team_id TEXT NOT NULL,
    points INTEGER DEFAULT 0
  )`);

  await query(`CREATE TABLE IF NOT EXISTS top8_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    points INTEGER DEFAULT 0
  )`);

  await query(`CREATE TABLE IF NOT EXISTS leagues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS league_members (
    league_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY(league_id, user_id)
  )`);

  await seedData();
  console.log('✅ Database ready');
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
async function seedData() {
  const existing = await queryOne('SELECT COUNT(*) as c FROM teams');
  if (parseInt(existing?.c) > 0) return;

  const teams = [
    { id: 'usa', name: 'United States', name_ar: 'الولايات المتحدة', flag: '🇺🇸', group_name: 'A' },
    { id: 'mex', name: 'Mexico', name_ar: 'المكسيك', flag: '🇲🇽', group_name: 'A' },
    { id: 'can', name: 'Canada', name_ar: 'كندا', flag: '🇨🇦', group_name: 'A' },
    { id: 'ury', name: 'Uruguay', name_ar: 'أوروغواي', flag: '🇺🇾', group_name: 'A' },
    { id: 'arg', name: 'Argentina', name_ar: 'الأرجنتين', flag: '🇦🇷', group_name: 'B' },
    { id: 'chl', name: 'Chile', name_ar: 'تشيلي', flag: '🇨🇱', group_name: 'B' },
    { id: 'per', name: 'Peru', name_ar: 'بيرو', flag: '🇵🇪', group_name: 'B' },
    { id: 'aus', name: 'Australia', name_ar: 'أستراليا', flag: '🇦🇺', group_name: 'B' },
    { id: 'bra', name: 'Brazil', name_ar: 'البرازيل', flag: '🇧🇷', group_name: 'C' },
    { id: 'col', name: 'Colombia', name_ar: 'كولومبيا', flag: '🇨🇴', group_name: 'C' },
    { id: 'ecu', name: 'Ecuador', name_ar: 'الإكوادور', flag: '🇪🇨', group_name: 'C' },
    { id: 'vcr', name: 'Costa Rica', name_ar: 'كوستا ريكا', flag: '🇨🇷', group_name: 'C' },
    { id: 'fra', name: 'France', name_ar: 'فرنسا', flag: '🇫🇷', group_name: 'D' },
    { id: 'bel', name: 'Belgium', name_ar: 'بلجيكا', flag: '🇧🇪', group_name: 'D' },
    { id: 'zaf', name: 'South Africa', name_ar: 'جنوب أفريقيا', flag: '🇿🇦', group_name: 'D' },
    { id: 'nzl', name: 'New Zealand', name_ar: 'نيوزيلندا', flag: '🇳🇿', group_name: 'D' },
    { id: 'esp', name: 'Spain', name_ar: 'إسبانيا', flag: '🇪🇸', group_name: 'E' },
    { id: 'por', name: 'Portugal', name_ar: 'البرتغال', flag: '🇵🇹', group_name: 'E' },
    { id: 'mar', name: 'Morocco', name_ar: 'المغرب', flag: '🇲🇦', group_name: 'E' },
    { id: 'civ', name: 'Ivory Coast', name_ar: 'ساحل العاج', flag: '🇨🇮', group_name: 'E' },
    { id: 'ger', name: 'Germany', name_ar: 'ألمانيا', flag: '🇩🇪', group_name: 'F' },
    { id: 'jpn', name: 'Japan', name_ar: 'اليابان', flag: '🇯🇵', group_name: 'F' },
    { id: 'eng', name: 'England', name_ar: 'إنجلترا', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group_name: 'F' },
    { id: 'tun', name: 'Tunisia', name_ar: 'تونس', flag: '🇹🇳', group_name: 'F' },
    { id: 'ned', name: 'Netherlands', name_ar: 'هولندا', flag: '🇳🇱', group_name: 'G' },
    { id: 'tur', name: 'Turkey', name_ar: 'تركيا', flag: '🇹🇷', group_name: 'G' },
    { id: 'rou', name: 'Romania', name_ar: 'رومانيا', flag: '🇷🇴', group_name: 'G' },
    { id: 'alg', name: 'Algeria', name_ar: 'الجزائر', flag: '🇩🇿', group_name: 'G' },
    { id: 'cro', name: 'Croatia', name_ar: 'كرواتيا', flag: '🇭🇷', group_name: 'H' },
    { id: 'sen', name: 'Senegal', name_ar: 'السنغال', flag: '🇸🇳', group_name: 'H' },
    { id: 'iri', name: 'IR Iran', name_ar: 'إيران', flag: '🇮🇷', group_name: 'H' },
    { id: 'ukr', name: 'Ukraine', name_ar: 'أوكرانيا', flag: '🇺🇦', group_name: 'H' },
    { id: 'ita', name: 'Italy', name_ar: 'إيطاليا', flag: '🇮🇹', group_name: 'I' },
    { id: 'srb', name: 'Serbia', name_ar: 'صربيا', flag: '🇷🇸', group_name: 'I' },
    { id: 'nga', name: 'Nigeria', name_ar: 'نيجيريا', flag: '🇳🇬', group_name: 'I' },
    { id: 'cmr', name: 'Cameroon', name_ar: 'الكاميرون', flag: '🇨🇲', group_name: 'I' },
    { id: 'den', name: 'Denmark', name_ar: 'الدنمارك', flag: '🇩🇰', group_name: 'J' },
    { id: 'pol', name: 'Poland', name_ar: 'بولندا', flag: '🇵🇱', group_name: 'J' },
    { id: 'sco', name: 'Scotland', name_ar: 'اسكتلندا', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group_name: 'J' },
    { id: 'ken', name: 'Kenya', name_ar: 'كينيا', flag: '🇰🇪', group_name: 'J' },
    { id: 'ksa', name: 'Saudi Arabia', name_ar: 'السعودية', flag: '🇸🇦', group_name: 'K' },
    { id: 'swe', name: 'Sweden', name_ar: 'السويد', flag: '🇸🇪', group_name: 'K' },
    { id: 'pan', name: 'Panama', name_ar: 'بنما', flag: '🇵🇦', group_name: 'K' },
    { id: 'kwt', name: 'Kuwait', name_ar: 'الكويت', flag: '🇰🇼', group_name: 'K' },
    { id: 'kor', name: 'South Korea', name_ar: 'كوريا الجنوبية', flag: '🇰🇷', group_name: 'L' },
    { id: 'nig', name: 'Niger', name_ar: 'النيجر', flag: '🇳🇪', group_name: 'L' },
    { id: 'aut', name: 'Austria', name_ar: 'النمسا', flag: '🇦🇹', group_name: 'L' },
    { id: 'mor', name: 'Morocco B', name_ar: 'المغرب ب', flag: '🇲🇦', group_name: 'L' },
  ];

  for (const t of teams) {
    await query('INSERT INTO teams (id,name,name_ar,flag,group_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [t.id, t.name, t.name_ar, t.flag, t.group_name]);
  }

  const round1 = [
    { id: 'r1m1', home: 'usa', away: 'ury', date: '2026-06-11', venue: 'MetLife Stadium', num: 1 },
    { id: 'r1m2', home: 'mex', away: 'can', date: '2026-06-11', venue: 'AT&T Stadium', num: 2 },
    { id: 'r1m3', home: 'arg', away: 'aus', date: '2026-06-12', venue: 'Hard Rock Stadium', num: 3 },
    { id: 'r1m4', home: 'chl', away: 'per', date: '2026-06-12', venue: 'Rose Bowl', num: 4 },
    { id: 'r1m5', home: 'bra', away: 'vcr', date: '2026-06-12', venue: 'SoFi Stadium', num: 5 },
    { id: 'r1m6', home: 'col', away: 'ecu', date: '2026-06-12', venue: "Levi's Stadium", num: 6 },
    { id: 'r1m7', home: 'fra', away: 'nzl', date: '2026-06-13', venue: 'Gillette Stadium', num: 7 },
    { id: 'r1m8', home: 'bel', away: 'zaf', date: '2026-06-13', venue: 'Lincoln Financial Field', num: 8 },
    { id: 'r1m9', home: 'esp', away: 'civ', date: '2026-06-13', venue: 'Mercedes-Benz Stadium', num: 9 },
    { id: 'r1m10', home: 'por', away: 'mar', date: '2026-06-13', venue: 'NRG Stadium', num: 10 },
    { id: 'r1m11', home: 'ger', away: 'tun', date: '2026-06-14', venue: 'Estadio Azteca', num: 11 },
    { id: 'r1m12', home: 'eng', away: 'jpn', date: '2026-06-14', venue: 'BC Place Stadium', num: 12 },
    { id: 'r1m13', home: 'ned', away: 'alg', date: '2026-06-14', venue: 'BMO Field', num: 13 },
    { id: 'r1m14', home: 'tur', away: 'rou', date: '2026-06-14', venue: 'Estadio BBVA', num: 14 },
    { id: 'r1m15', home: 'cro', away: 'iri', date: '2026-06-15', venue: 'MetLife Stadium', num: 15 },
    { id: 'r1m16', home: 'sen', away: 'ukr', date: '2026-06-15', venue: 'AT&T Stadium', num: 16 },
    { id: 'r1m17', home: 'ita', away: 'kwt', date: '2026-06-15', venue: 'Hard Rock Stadium', num: 17 },
    { id: 'r1m18', home: 'srb', away: 'nga', date: '2026-06-15', venue: 'Rose Bowl', num: 18 },
    { id: 'r1m19', home: 'den', away: 'ken', date: '2026-06-16', venue: 'SoFi Stadium', num: 19 },
    { id: 'r1m20', home: 'pol', away: 'sco', date: '2026-06-16', venue: "Levi's Stadium", num: 20 },
    { id: 'r1m21', home: 'ksa', away: 'pan', date: '2026-06-16', venue: 'Gillette Stadium', num: 21 },
    { id: 'r1m22', home: 'swe', away: 'cmr', date: '2026-06-16', venue: 'Lincoln Financial Field', num: 22 },
    { id: 'r1m23', home: 'kor', away: 'aut', date: '2026-06-17', venue: 'Mercedes-Benz Stadium', num: 23 },
    { id: 'r1m24', home: 'nig', away: 'mor', date: '2026-06-17', venue: 'NRG Stadium', num: 24 },
  ];
  const round2 = [
    { id: 'r2m1', home: 'ury', away: 'mex', date: '2026-06-20', venue: 'MetLife Stadium', num: 1 },
    { id: 'r2m2', home: 'can', away: 'usa', date: '2026-06-20', venue: 'AT&T Stadium', num: 2 },
    { id: 'r2m3', home: 'aus', away: 'chl', date: '2026-06-21', venue: 'Hard Rock Stadium', num: 3 },
    { id: 'r2m4', home: 'per', away: 'arg', date: '2026-06-21', venue: 'Rose Bowl', num: 4 },
    { id: 'r2m5', home: 'vcr', away: 'col', date: '2026-06-21', venue: 'SoFi Stadium', num: 5 },
    { id: 'r2m6', home: 'ecu', away: 'bra', date: '2026-06-21', venue: "Levi's Stadium", num: 6 },
    { id: 'r2m7', home: 'nzl', away: 'bel', date: '2026-06-22', venue: 'Gillette Stadium', num: 7 },
    { id: 'r2m8', home: 'zaf', away: 'fra', date: '2026-06-22', venue: 'Lincoln Financial Field', num: 8 },
    { id: 'r2m9', home: 'civ', away: 'por', date: '2026-06-22', venue: 'Mercedes-Benz Stadium', num: 9 },
    { id: 'r2m10', home: 'mar', away: 'esp', date: '2026-06-22', venue: 'NRG Stadium', num: 10 },
    { id: 'r2m11', home: 'tun', away: 'eng', date: '2026-06-23', venue: 'Estadio Azteca', num: 11 },
    { id: 'r2m12', home: 'jpn', away: 'ger', date: '2026-06-23', venue: 'BC Place Stadium', num: 12 },
    { id: 'r2m13', home: 'alg', away: 'tur', date: '2026-06-23', venue: 'BMO Field', num: 13 },
    { id: 'r2m14', home: 'rou', away: 'ned', date: '2026-06-23', venue: 'Estadio BBVA', num: 14 },
    { id: 'r2m15', home: 'iri', away: 'sen', date: '2026-06-24', venue: 'MetLife Stadium', num: 15 },
    { id: 'r2m16', home: 'ukr', away: 'cro', date: '2026-06-24', venue: 'AT&T Stadium', num: 16 },
    { id: 'r2m17', home: 'kwt', away: 'srb', date: '2026-06-24', venue: 'Hard Rock Stadium', num: 17 },
    { id: 'r2m18', home: 'nga', away: 'ita', date: '2026-06-24', venue: 'Rose Bowl', num: 18 },
    { id: 'r2m19', home: 'ken', away: 'pol', date: '2026-06-25', venue: 'SoFi Stadium', num: 19 },
    { id: 'r2m20', home: 'sco', away: 'den', date: '2026-06-25', venue: "Levi's Stadium", num: 20 },
    { id: 'r2m21', home: 'pan', away: 'swe', date: '2026-06-25', venue: 'Gillette Stadium', num: 21 },
    { id: 'r2m22', home: 'cmr', away: 'ksa', date: '2026-06-25', venue: 'Lincoln Financial Field', num: 22 },
    { id: 'r2m23', home: 'aut', away: 'nig', date: '2026-06-26', venue: 'Mercedes-Benz Stadium', num: 23 },
    { id: 'r2m24', home: 'mor', away: 'kor', date: '2026-06-26', venue: 'NRG Stadium', num: 24 },
  ];
  const round3 = [
    { id: 'r3m1', home: 'usa', away: 'mex', date: '2026-06-26', venue: 'MetLife Stadium', num: 1 },
    { id: 'r3m2', home: 'ury', away: 'can', date: '2026-06-26', venue: 'AT&T Stadium', num: 2 },
    { id: 'r3m3', home: 'arg', away: 'chl', date: '2026-06-27', venue: 'Hard Rock Stadium', num: 3 },
    { id: 'r3m4', home: 'aus', away: 'per', date: '2026-06-27', venue: 'Rose Bowl', num: 4 },
    { id: 'r3m5', home: 'bra', away: 'col', date: '2026-06-27', venue: 'SoFi Stadium', num: 5 },
    { id: 'r3m6', home: 'vcr', away: 'ecu', date: '2026-06-27', venue: "Levi's Stadium", num: 6 },
    { id: 'r3m7', home: 'fra', away: 'bel', date: '2026-06-28', venue: 'Gillette Stadium', num: 7 },
    { id: 'r3m8', home: 'nzl', away: 'zaf', date: '2026-06-28', venue: 'Lincoln Financial Field', num: 8 },
    { id: 'r3m9', home: 'esp', away: 'por', date: '2026-06-28', venue: 'Mercedes-Benz Stadium', num: 9 },
    { id: 'r3m10', home: 'civ', away: 'mar', date: '2026-06-28', venue: 'NRG Stadium', num: 10 },
    { id: 'r3m11', home: 'ger', away: 'eng', date: '2026-06-29', venue: 'Estadio Azteca', num: 11 },
    { id: 'r3m12', home: 'tun', away: 'jpn', date: '2026-06-29', venue: 'BC Place Stadium', num: 12 },
    { id: 'r3m13', home: 'ned', away: 'tur', date: '2026-06-29', venue: 'BMO Field', num: 13 },
    { id: 'r3m14', home: 'alg', away: 'rou', date: '2026-06-29', venue: 'Estadio BBVA', num: 14 },
    { id: 'r3m15', home: 'cro', away: 'sen', date: '2026-06-30', venue: 'MetLife Stadium', num: 15 },
    { id: 'r3m16', home: 'ukr', away: 'iri', date: '2026-06-30', venue: 'AT&T Stadium', num: 16 },
    { id: 'r3m17', home: 'ita', away: 'srb', date: '2026-06-30', venue: 'Hard Rock Stadium', num: 17 },
    { id: 'r3m18', home: 'kwt', away: 'nga', date: '2026-06-30', venue: 'Rose Bowl', num: 18 },
    { id: 'r3m19', home: 'den', away: 'pol', date: '2026-07-01', venue: 'SoFi Stadium', num: 19 },
    { id: 'r3m20', home: 'ken', away: 'sco', date: '2026-07-01', venue: "Levi's Stadium", num: 20 },
    { id: 'r3m21', home: 'ksa', away: 'swe', date: '2026-07-01', venue: 'Gillette Stadium', num: 21 },
    { id: 'r3m22', home: 'pan', away: 'cmr', date: '2026-07-01', venue: 'Lincoln Financial Field', num: 22 },
    { id: 'r3m23', home: 'kor', away: 'aut', date: '2026-07-02', venue: 'Mercedes-Benz Stadium', num: 23 },
    { id: 'r3m24', home: 'nig', away: 'mor', date: '2026-07-02', venue: 'NRG Stadium', num: 24 },
  ];

  for (const m of [...round1, ...round2, ...round3]) {
    const rn = round1.includes(m) ? 1 : round2.includes(m) ? 2 : 3;
    const roundName = `دور المجموعات - الجولة ${rn}`;
    await query(
      'INSERT INTO matches (id,round,round_name,match_number,home_team_id,away_team_id,match_date,venue,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING',
      [m.id, rn, roundName, m.num, m.home, m.away, m.date, m.venue, 'scheduled']
    );
  }
  console.log('✅ Seeded WC2026 data');
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

async function sendActivationEmail(email, name, token) {
  const link = `${APP_URL}/api/auth/activate/${token}`;
  if (!EMAIL_USER) { console.log('📧 [Demo] Activation link:', link); return; }
  try {
    await transporter.sendMail({
      from: `كأس العالم 2026 🏆 <${EMAIL_USER}>`,
      to: email,
      subject: 'تفعيل حسابك - كأس العالم 2026',
      html: `<div dir="rtl" style="font-family:Arial;background:#0a1628;color:#fff;padding:40px;border-radius:12px;max-width:500px;margin:auto">
        <h1 style="color:#f59e0b;text-align:center">🏆 كأس العالم 2026</h1>
        <h2 style="text-align:center">أهلاً ${name}!</h2>
        <p style="text-align:center">انقر على الزر لتفعيل حسابك</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${link}" style="background:#f59e0b;color:#000;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">تفعيل الحساب</a>
        </div>
      </div>`
    });
  } catch(e) { console.log('Email error:', e.message); }
}

async function sendThankYouEmail(email, name, points, round) {
  if (!EMAIL_USER) return;
  try {
    await transporter.sendMail({
      from: `كأس العالم 2026 🏆 <${EMAIL_USER}>`,
      to: email,
      subject: `🎉 أنت الأفضل في الجولة ${round}!`,
      html: `<div dir="rtl" style="font-family:Arial;background:#0a1628;color:#fff;padding:40px;border-radius:12px;max-width:500px;margin:auto">
        <h1 style="color:#f59e0b;text-align:center">🏆 تهانينا ${name}!</h1>
        <h2 style="text-align:center">أنت حققت أعلى نقاط في الجولة ${round}</h2>
        <div style="background:#1e3a5f;padding:20px;border-radius:8px;text-align:center;margin:20px 0">
          <p style="font-size:48px;margin:0">⭐</p>
          <p style="font-size:32px;color:#f59e0b;font-weight:bold">${points} نقطة</p>
        </div>
      </div>`
    });
  } catch(e) { console.log('Email error:', e.message); }
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function admin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    const existing = await queryOne('SELECT id FROM users WHERE email=$1', [email]);
    if (existing) return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    const token = uuidv4();
    await query('INSERT INTO users (id,name,email,password,activation_token) VALUES ($1,$2,$3,$4,$5)', [id, name, email, hash, token]);
    await sendActivationEmail(email, name, token);
    res.json({ message: 'تم إنشاء الحساب! تحقق من بريدك للتفعيل', demo_token: token });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/activate/:token', async (req, res) => {
  const user = await queryOne('SELECT * FROM users WHERE activation_token=$1', [req.params.token]);
  if (!user) return res.status(400).send('<h1 style="font-family:Arial;color:#ef4444;text-align:center;margin-top:100px">رابط غير صالح أو منتهي الصلاحية</h1>');
  await query('UPDATE users SET is_active=1, activation_token=NULL WHERE id=$1', [user.id]);
  res.redirect('/?activated=1');
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=$1', [email]);
    if (!user) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'بيانات غير صحيحة' });
    if (!user.is_active) return res.status(400).json({ error: 'يرجى تفعيل حسابك أولاً', need_activation: true });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/resend-activation', async (req, res) => {
  const { email } = req.body;
  const user = await queryOne('SELECT * FROM users WHERE email=$1', [email]);
  if (!user) return res.status(400).json({ error: 'البريد غير موجود' });
  if (user.is_active) return res.status(400).json({ error: 'الحساب مفعل بالفعل' });
  const token = uuidv4();
  await query('UPDATE users SET activation_token=$1 WHERE id=$2', [token, user.id]);
  await sendActivationEmail(email, user.name, token);
  res.json({ message: 'تم إرسال رابط التفعيل', demo_token: token });
});

// ─── TEAMS & MATCHES ─────────────────────────────────────────────────────────
app.get('/api/teams', async (req, res) => {
  try { res.json(await query('SELECT * FROM teams ORDER BY group_name, name_ar')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/matches', async (req, res) => {
  try {
    const round = req.query.round;
    const sql = `SELECT m.*, 
      ht.name as home_name, ht.name_ar as home_name_ar, ht.flag as home_flag,
      at.name as away_name, at.name_ar as away_name_ar, at.flag as away_flag
      FROM matches m
      LEFT JOIN teams ht ON m.home_team_id=ht.id
      LEFT JOIN teams at ON m.away_team_id=at.id
      ${round ? 'WHERE m.round=$1' : ''}
      ORDER BY m.round, m.match_number`;
    res.json(await query(sql, round ? [parseInt(round)] : []));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PREDICTIONS ──────────────────────────────────────────────────────────────
app.post('/api/predictions', auth, async (req, res) => {
  try {
    const { predictions, champion_team_id, top8_team_ids } = req.body;
    const userId = req.user.id;

    if (predictions?.length) {
      if (predictions.filter(p => p.is_double).length > 1)
        return res.status(400).json({ error: 'دوبل واحد فقط لكل جولة' });
      for (const p of predictions) {
        await query(
          `INSERT INTO predictions (id,user_id,match_id,home_score,away_score,is_double)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,match_id)
           DO UPDATE SET home_score=$4, away_score=$5, is_double=$6`,
          [uuidv4(), userId, p.match_id, p.home_score, p.away_score, p.is_double ? 1 : 0]
        );
      }
    }

    if (champion_team_id) {
      await query(
        `INSERT INTO champion_predictions (id,user_id,team_id) VALUES ($1,$2,$3)
         ON CONFLICT(user_id) DO NOTHING`,
        [uuidv4(), userId, champion_team_id]
      );
    }

    if (top8_team_ids?.length) {
      const existing = await query('SELECT id FROM top8_predictions WHERE user_id=$1', [userId]);
      if (!existing.length) {
        for (const tid of top8_team_ids) {
          await query('INSERT INTO top8_predictions (id,user_id,team_id) VALUES ($1,$2,$3)', [uuidv4(), userId, tid]);
        }
      }
    }
    res.json({ message: 'تم حفظ التوقعات' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/predictions/my', auth, async (req, res) => {
  try {
    const round = req.query.round;
    const userId = req.user.id;
    const sql = `SELECT p.*, m.round, m.home_score as actual_home, m.away_score as actual_away,
      ht.name as home_name, ht.flag as home_flag, at.name as away_name, at.flag as away_flag
      FROM predictions p JOIN matches m ON p.match_id=m.id
      LEFT JOIN teams ht ON m.home_team_id=ht.id
      LEFT JOIN teams at ON m.away_team_id=at.id
      WHERE p.user_id=$1 ${round ? 'AND m.round=$2' : ''} ORDER BY m.match_number`;
    const preds = await query(sql, round ? [userId, parseInt(round)] : [userId]);
    const champion = await queryOne(
      'SELECT cp.*, t.name, t.flag FROM champion_predictions cp JOIN teams t ON cp.team_id=t.id WHERE cp.user_id=$1', [userId]);
    const top8 = await query(
      'SELECT tp.*, t.name, t.flag FROM top8_predictions tp JOIN teams t ON tp.team_id=t.id WHERE tp.user_id=$1', [userId]);
    res.json({ predictions: preds, champion, top8 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const round = req.query.round;
    let sql, params = [];
    if (round) {
      sql = `SELECT u.id, u.name,
        COALESCE(SUM(p.points),0) as total_points,
        COUNT(CASE WHEN p.points>=3 THEN 1 END) as exact_count,
        COUNT(CASE WHEN p.points=1 THEN 1 END) as result_count
        FROM users u JOIN predictions p ON u.id=p.user_id
        JOIN matches m ON p.match_id=m.id
        WHERE m.round=$1 AND u.is_active=1 GROUP BY u.id ORDER BY total_points DESC`;
      params = [parseInt(round)];
    } else {
      sql = `SELECT u.id, u.name,
        COALESCE(SUM(p.points),0) + COALESCE(MAX(cp.points),0) as total_points,
        COUNT(CASE WHEN p.points>=3 THEN 1 END) as exact_count,
        COUNT(CASE WHEN p.points=1 THEN 1 END) as result_count
        FROM users u LEFT JOIN predictions p ON u.id=p.user_id
        LEFT JOIN champion_predictions cp ON u.id=cp.user_id
        WHERE u.is_active=1 GROUP BY u.id ORDER BY total_points DESC`;
    }
    res.json(await query(sql, params));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── LEAGUES ─────────────────────────────────────────────────────────────────
app.post('/api/leagues', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الليجا مطلوب' });
    const id = uuidv4();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await query('INSERT INTO leagues (id,name,invite_code,owner_id) VALUES ($1,$2,$3,$4)', [id, name, code, req.user.id]);
    await query('INSERT INTO league_members (league_id,user_id) VALUES ($1,$2)', [id, req.user.id]);
    res.json({ id, name, invite_code: code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/leagues/join', auth, async (req, res) => {
  try {
    const { invite_code } = req.body;
    const league = await queryOne('SELECT * FROM leagues WHERE invite_code=$1', [invite_code?.toUpperCase()]);
    if (!league) return res.status(400).json({ error: 'كود الدعوة غير صحيح' });
    const existing = await queryOne('SELECT * FROM league_members WHERE league_id=$1 AND user_id=$2', [league.id, req.user.id]);
    if (existing) return res.status(400).json({ error: 'أنت عضو في هذه الليجا بالفعل' });
    await query('INSERT INTO league_members (league_id,user_id) VALUES ($1,$2)', [league.id, req.user.id]);
    res.json({ message: 'تم الانضمام', league });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leagues/my', auth, async (req, res) => {
  try {
    const leagues = await query(`SELECT l.*, COUNT(DISTINCT lm2.user_id) as member_count,
      CASE WHEN l.owner_id=$1 THEN 1 ELSE 0 END as is_owner
      FROM leagues l JOIN league_members lm ON l.id=lm.league_id AND lm.user_id=$1
      JOIN league_members lm2 ON l.id=lm2.league_id GROUP BY l.id, l.name, l.invite_code, l.owner_id, l.created_at`, [req.user.id]);
    res.json(leagues);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leagues/:id/standings', auth, async (req, res) => {
  try {
    const member = await queryOne('SELECT * FROM league_members WHERE league_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!member) return res.status(403).json({ error: 'لست عضواً في هذه الليجا' });
    const league = await queryOne('SELECT * FROM leagues WHERE id=$1', [req.params.id]);
    const standings = await query(`SELECT u.id, u.name,
      COALESCE(SUM(p.points),0) + COALESCE(MAX(cp.points),0) as total_points,
      COUNT(CASE WHEN p.points>=3 THEN 1 END) as exact_count
      FROM league_members lm JOIN users u ON lm.user_id=u.id
      LEFT JOIN predictions p ON u.id=p.user_id
      LEFT JOIN champion_predictions cp ON u.id=cp.user_id
      WHERE lm.league_id=$1 GROUP BY u.id ORDER BY total_points DESC`, [req.params.id]);
    res.json({ league, standings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STATS ───────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const overall = await queryOne(`SELECT COUNT(p.id) as total_predictions,
      COUNT(CASE WHEN p.points>=3 THEN 1 END) as exact_total,
      COALESCE(SUM(p.points),0) as total_points
      FROM predictions p WHERE p.user_id=$1`, [userId]);
    const rankRows = await query(`SELECT u.id FROM users u
      LEFT JOIN predictions p ON u.id=p.user_id
      LEFT JOIN champion_predictions cp ON u.id=cp.user_id
      WHERE u.is_active=1 GROUP BY u.id
      ORDER BY (COALESCE(SUM(p.points),0)+COALESCE(MAX(cp.points),0)) DESC`);
    const myRank = rankRows.findIndex(r => r.id === userId) + 1;
    res.json({ overall, rank: myRank, total_users: rankRows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────
app.post('/api/admin/match-result', auth, admin, async (req, res) => {
  try {
    const { match_id, home_score, away_score } = req.body;
    await query('UPDATE matches SET home_score=$1, away_score=$2, status=$3 WHERE id=$4', [home_score, away_score, 'finished', match_id]);
    const preds = await query('SELECT * FROM predictions WHERE match_id=$1', [match_id]);
    let maxPoints = 0; let topUserId = null;
    for (const p of preds) {
      let pts = 0;
      const exact = parseInt(p.home_score) === home_score && parseInt(p.away_score) === away_score;
      const predR = p.home_score > p.away_score ? 'H' : p.home_score < p.away_score ? 'A' : 'D';
      const actR = home_score > away_score ? 'H' : home_score < away_score ? 'A' : 'D';
      if (exact) pts = 3;
      else if (predR === actR) pts = 1;
      if (p.is_double) pts *= 2;
      await query('UPDATE predictions SET points=$1 WHERE id=$2', [pts, p.id]);
      if (pts > maxPoints) { maxPoints = pts; topUserId = p.user_id; }
    }
    if (topUserId && maxPoints > 0) {
      const match = await queryOne('SELECT round FROM matches WHERE id=$1', [match_id]);
      const user = await queryOne('SELECT * FROM users WHERE id=$1', [topUserId]);
      if (user) await sendThankYouEmail(user.email, user.name, maxPoints, match.round);
    }
    res.json({ message: 'تم التحديث وحساب النقاط', updated: preds.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/champion-result', auth, admin, async (req, res) => {
  try {
    const { team_id } = req.body;
    await query('UPDATE champion_predictions SET points=15 WHERE team_id=$1', [team_id]);
    res.json({ message: 'تم تحديث توقعات البطل' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/match/:id/status', auth, admin, async (req, res) => {
  try {
    await query('UPDATE matches SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ message: 'تم التحديث' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users', auth, admin, async (req, res) => {
  try { res.json(await query('SELECT id,name,email,is_active,is_admin,created_at FROM users ORDER BY created_at DESC')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/make-admin', auth, async (req, res) => {
  if (req.body.secret !== 'worldcup2026admin') return res.status(403).json({ error: 'Forbidden' });
  await query('UPDATE users SET is_admin=1 WHERE id=$1', [req.user.id]);
  res.json({ message: 'تم الترقية' });
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    if (process.env.VERCEL) return; // Vercel handles the server
    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
  })
  .catch(console.error);

module.exports = app;
