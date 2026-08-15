# تطبيق أندرويد (WebView)

تطبيق أندرويد بسيط (Kotlin) يعرض الموقع المنشور على GitHub Pages داخل WebView،
بحيث يمكن تحويله إلى APK/AAB ونشره على متجر Google Play أو توزيعه مباشرة.

الرابط المستخدم مضبوط في [app/src/main/res/values/strings.xml](app/src/main/res/values/strings.xml)
(`app_url`) ويشير حاليًا إلى:

```
https://mekosindi99.github.io/quran-tracker/
```

## المتطلبات
- Android Studio (أحدث إصدار) أو JDK 17 + Android SDK لو أردت البناء من سطر الأوامر.
- ملاحظة: ملفات `gradlew` / `gradlew.bat` غير مضمّنة، عند فتح المشروع في Android Studio
  سيقوم تلقائيًا بإصلاح/إنشاء الـ Gradle Wrapper (Sync سيطلب ذلك من نفسه).

## الفتح والبناء
1. افتح مجلد `android/` هذا كمشروع في Android Studio (File > Open).
2. اتركه يزامن Gradle تلقائيًا.
3. لتشغيله على جهاز/محاكي: اضغط Run.
4. لبناء APK للتوزيع: Build > Generate Signed Bundle / APK.

أو من سطر الأوامر داخل هذا المجلد:

```bash
./gradlew assembleRelease
```

الناتج يكون في `app/build/outputs/apk/release/`.

## ملاحظات
- التطبيق يحمّل نفس موقع الويب المنشور، فأي تحديث تنشره عبر `npm run deploy`
  في المشروع الرئيسي يظهر تلقائيًا للمستخدمين دون الحاجة لإصدار تحديث للتطبيق.
- تسجيل الدخول Email/Password يعمل داخل الـ WebView مباشرة.
- زر الرجوع في أندرويد يرجع في تاريخ تصفح الصفحة قبل إغلاق التطبيق.
- الأيقونة الحالية مؤقتة (بسيطة)، يمكن استبدالها لاحقًا عبر Android Studio > Image Asset.
