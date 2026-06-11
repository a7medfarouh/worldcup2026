# 🏆 كأس العالم 2026 - Prediction Game

## 🚀 طريقة التشغيل

### المتطلبات
- Node.js (تحميل من https://nodejs.org)

### التثبيت لأول مرة
```bash
cd worldcup2026
npm install
```

### التشغيل
**Mac/Linux:**
```bash
bash start.sh
```

**Windows:**
```
start.bat
```

أو مباشرة:
```bash
node server.js
```

---

## 🌐 فتح الموقع

- **على جهازك:** http://localhost:3000
- **على الموبايل أو أجهزة تانية على نفس الواي فاي:**
  http://[IP-الجهاز]:3000
  
  عشان تعرف الـ IP:
  - **Windows:** `ipconfig` في CMD
  - **Mac:** `ifconfig | grep inet`
  - **Linux:** `hostname -I`

---

## 📋 نظام النقاط

| الحالة | النقاط |
|--------|--------|
| توقع النتيجة بالضبط | 3 نقاط |
| توقع نتيجة الماتش (فوز/تعادل) | 1 نقطة |
| توقع غلط | 0 نقاط |
| دوبل (مرة واحدة لكل جولة) | × 2 |
| توقع بطل كأس العالم ✅ | 15 نقطة |
| توقع الثمانية الكبار (6 صح) | +5 نقاط |
| توقع الثمانية الكبار (7 صح) | +5 نقاط |
| توقع الثمانية الكبار (8 صح) | +10 نقاط |

---

## ⚙️ لوحة الإدارة

1. سجّل حساب عادي أولاً
2. روح على صفحة "الإدارة"
3. ادخل كلمة السر: `worldcup2026admin`
4. هتقدر تحدّث نتائج المباريات وتحسب النقاط

---

## 📧 إعداد الإيميلات (اختياري)

في الـ `server.js` أو عن طريق Environment Variables:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
APP_URL=http://your-domain.com
```

**ملاحظة:** لو مش عايز تستخدم إيميل، رابط التفعيل بيظهر في صفحة التسجيل مباشرة (demo mode).

---

## 🗄️ قاعدة البيانات

الداتا بيز بتُحفظ في `data/worldcup2026.db` (SQLite)

بيانات كأس العالم 2026 جاهزة:
- ✅ 48 منتخب مقسّمين على 12 مجموعة
- ✅ 72 ماتش (3 جولات × 24 ماتش)
- ✅ تواريخ وأماكن المباريات

---

## 🏗️ التقنيات المستخدمة

- **Backend:** Node.js + Express
- **Database:** SQLite (sql.js)
- **Frontend:** HTML/CSS/JavaScript (Angular-style SPA)
- **Auth:** JWT + bcrypt
- **Email:** Nodemailer
