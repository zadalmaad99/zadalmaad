# تطبيق مراقبة حفظ وقراءة القرآن الكريم

تطبيق ويب (يعمل على الجوال والكمبيوتر) لأدمن يراقب حفظ وقراءة الطلاب للقرآن الكريم، مبني بـ React + Firebase.

## الأقسام
- **الطلاب**: إضافة/تعديل/حذف الطلاب.
- **حفظ القرآن يوميًا**: تسجيل ما يحفظه كل طالب (السورة + من آية - إلى آية) يوميًا.
- **قراءة القرآن**: تسجيل قراءة الطالب اليومية.
- **مراجعة حفظ القرآن**: تسجيل مراجعة المحفوظ.

كل قسم يدعم: إضافة، تعديل، حذف. اختيار السورة من قائمة السور الـ114 مع تحديد نطاق الآيات حسب عدد آيات كل سورة تلقائيًا.

## الإعداد

### 1. إنشاء مشروع Firebase
1. اذهب إلى https://console.firebase.google.com وأنشئ مشروعًا جديدًا.
2. فعّل **Authentication > Email/Password** وأنشئ حساب الأدمن (بريد + كلمة مرور).
3. فعّل **Firestore Database** (ابدأ في وضع production).
4. من **Project settings > General > Your apps**، أضف تطبيق ويب وانسخ إعدادات `firebaseConfig`.

### 2. ربط الإعدادات
افتح [src/firebase.js](src/firebase.js) وضع قيم مشروعك بدلاً من `YOUR_...`.

### 3. نشر قواعد الحماية
```bash
firebase deploy --only firestore:rules,storage
```
(أو انسخ محتوى [firestore.rules](firestore.rules) و [storage.rules](storage.rules) يدويًا في Firebase Console > Firestore/Storage > Rules)

بديل بدون Firebase CLI: `node server/scripts/deploy-firestore-rules.cjs` (يستخدم `server/serviceAccountKey.json` لنشر قواعد Firestore وStorage مباشرة عبر Admin SDK).

ملف خطة الدراسة (PDF) يُرفع عبر Firebase Storage — يتطلب تفعيل **Storage** من Firebase Console (Build > Storage > Get started)، وقد يتطلب ترقية المشروع لخطة **Blaze** (الدفع حسب الاستخدام) حسب سياسة Google الحالية لمشاريع Storage الجديدة.

### 4. التشغيل محليًا
```bash
npm install
npm run dev
```

### 5. النشر (اختياري)
```bash
npm run build
firebase deploy --only hosting
```

## البنية التقنية
- React + Vite
- React Router (تسجيل الدخول محمي بـ ProtectedRoute)
- Firebase Auth (تسجيل دخول الأدمن)
- Firestore (مجموعتان: `students` و `records` بحقل `type` يميز بين hifz/qiraah/murajaah)
- تصميم متجاوب (يعمل على الجوال والكمبيوتر) بدون الحاجة لتطبيق موبايل منفصل
