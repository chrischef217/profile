from pathlib import Path

path = Path('temp-drive-portal-v23/app/src/main/java/com/unityglobal/unity_drive_access/MainActivity.java')
source = path.read_text(encoding='utf-8')


def replace_block(start_marker, end_marker, replacement):
    global source
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    source = source[:start] + replacement + source[end:]


source = source.replace(
    'import android.app.Activity;\n',
    'import android.app.Activity;\n'
    'import android.animation.AnimatorSet;\n'
    'import android.animation.ObjectAnimator;\n'
    'import android.animation.ValueAnimator;\n'
)
source = source.replace(
    'import android.view.animation.Animation;\n',
    'import android.view.animation.Animation;\n'
    'import android.view.animation.AccelerateDecelerateInterpolator;\n'
    'import android.view.animation.DecelerateInterpolator;\n'
)
source = source.replace(
    'import androidx.core.content.FileProvider;\n',
    'import androidx.core.content.FileProvider;\n\n'
    'import com.google.mlkit.common.model.DownloadConditions;\n'
    'import com.google.mlkit.nl.translate.TranslateLanguage;\n'
    'import com.google.mlkit.nl.translate.Translation;\n'
    'import com.google.mlkit.nl.translate.Translator;\n'
    'import com.google.mlkit.nl.translate.TranslatorOptions;\n'
)

source = source.replace(
'''    private static final int NAVY = Color.rgb(7, 26, 46);
    private static final int BLUE = Color.rgb(23, 105, 224);
    private static final int GOLD = Color.rgb(240, 160, 0);
    private static final int PAGE = Color.rgb(244, 247, 251);
    private static final int TEXT = Color.rgb(7, 26, 46);
    private static final int MUTED = Color.rgb(91, 104, 120);
    private static final int BORDER = Color.rgb(220, 228, 239);
''',
'''    private static final int NAVY = Color.WHITE;
    private static final int BLUE = Color.rgb(26, 115, 232);
    private static final int GOLD = Color.rgb(251, 188, 4);
    private static final int GOOGLE_RED = Color.rgb(234, 67, 53);
    private static final int GOOGLE_GREEN = Color.rgb(52, 168, 83);
    private static final int PAGE = Color.rgb(248, 250, 253);
    private static final int TEXT = Color.rgb(32, 33, 36);
    private static final int MUTED = Color.rgb(95, 99, 104);
    private static final int BORDER = Color.rgb(218, 220, 224);
    private static final int SOFT_BLUE = Color.rgb(232, 240, 254);
    private static final int SOFT_GREEN = Color.rgb(230, 244, 234);
    private static final int SOFT_YELLOW = Color.rgb(254, 247, 224);
    private static final int SOFT_RED = Color.rgb(252, 232, 230);
''')

source = source.replace(
    '    private String apiUrl = "";\n',
    '    private String apiUrl = "";\n'
    '    private String language = "ko";\n'
    '    private Translator koToThaiTranslator;\n'
)

source = source.replace(
'''        getWindow().setStatusBarColor(NAVY);
        getWindow().setNavigationBarColor(NAVY);
        apiUrl = loadSavedApiUrl();
        showPin();
''',
'''        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        apiUrl = loadSavedApiUrl();
        language = loadSavedLanguage();
        showPin();
''')

source = source.replace(
'''    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
''',
'''    protected void onDestroy() {
        executor.shutdownNow();
        if (koToThaiTranslator != null) koToThaiTranslator.close();
        super.onDestroy();
    }
''')

language_helpers = r'''    private String loadSavedLanguage() {
        String value = getSharedPreferences("UnityDrivePrefs", MODE_PRIVATE)
                .getString("ui_language", "ko");
        return "th".equals(value) ? "th" : "ko";
    }

    private void saveLanguage(String value) {
        language = "th".equals(value) ? "th" : "ko";
        getSharedPreferences("UnityDrivePrefs", MODE_PRIVATE)
                .edit().putString("ui_language", language).apply();
    }

    private boolean isThai() {
        return "th".equals(language);
    }

    private String t(String korean, String thai) {
        return isThai() ? thai : korean;
    }

    private String countText(int count) {
        return isThai() ? count + " รายการ" : count + "개";
    }

    private void changeLanguage(String next) {
        if (next.equals(language)) return;
        saveLanguage(next);
        refreshCurrentScreen();
    }

    private void refreshCurrentScreen() {
        if (screen == Screen.PIN) {
            showPin();
        } else if (screen == Screen.HOME) {
            showHome();
        } else if (screen == Screen.FOLDER && currentFolder != null) {
            showFolder(currentFolder, new ArrayList<>(path));
        } else if (screen == Screen.FILE && currentFile != null) {
            showFile(currentFile);
        } else if (screen == Screen.SETTINGS) {
            showSettings();
        } else {
            showHome();
        }
    }

    private LinearLayout languageSelector() {
        LinearLayout selector = horizontal();
        selector.setGravity(Gravity.CENTER);
        selector.setPadding(dp(3), dp(3), dp(3), dp(3));
        selector.setBackground(round(Color.rgb(241, 243, 244), Color.rgb(225, 228, 232), 18, 1));

        TextView ko = languageChoice("KO", !isThai());
        TextView th = languageChoice("ไทย", isThai());
        ko.setOnClickListener(v -> changeLanguage("ko"));
        th.setOnClickListener(v -> changeLanguage("th"));
        selector.addView(ko, new LinearLayout.LayoutParams(dp(42), dp(32)));
        selector.addView(th, new LinearLayout.LayoutParams(dp(48), dp(32)));
        return selector;
    }

    private TextView languageChoice(String label, boolean selected) {
        TextView view = text(label, 11, selected ? Color.WHITE : MUTED, true);
        view.setGravity(Gravity.CENTER);
        view.setBackground(round(selected ? BLUE : Color.TRANSPARENT, Color.TRANSPARENT, 15, 0));
        applyPressMotion(view);
        return view;
    }

    private void ensureTranslator() {
        if (koToThaiTranslator != null) return;
        TranslatorOptions options = new TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.KOREAN)
                .setTargetLanguage(TranslateLanguage.THAI)
                .build();
        koToThaiTranslator = Translation.getClient(options);
    }

    private void setLocalizedBody(TextView view, String original, String cacheIdentity) {
        if (!isThai() || original == null || original.trim().isEmpty()) {
            view.setText(original == null ? "" : original);
            return;
        }

        String cacheKey = "translation_th_" + Integer.toHexString((cacheIdentity + "|" + original).hashCode());
        SharedPreferences prefs = getSharedPreferences("UnityDriveTranslationCache", MODE_PRIVATE);
        String cached = prefs.getString(cacheKey, "");
        if (!cached.isEmpty()) {
            view.setText(cached);
            return;
        }

        view.setText("กำลังแปล…");
        ensureTranslator();
        DownloadConditions conditions = new DownloadConditions.Builder().build();
        koToThaiTranslator.downloadModelIfNeeded(conditions)
                .addOnSuccessListener(unused -> koToThaiTranslator.translate(original)
                        .addOnSuccessListener(translated -> {
                            prefs.edit().putString(cacheKey, translated).apply();
                            if (isThai()) crossFadeText(view, translated);
                        })
                        .addOnFailureListener(error -> view.setText(original)))
                .addOnFailureListener(error -> view.setText(original));
    }

'''
source = source.replace('    private String loadSavedApiUrl() {\n', language_helpers + '    private String loadSavedApiUrl() {\n')

show_pin = r'''    private void showPin() {
        screen = Screen.PIN;
        requestGeneration++;

        LinearLayout page = vertical();
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        page.setPadding(dp(20), dp(18), dp(20), dp(28));
        page.setBackgroundColor(PAGE);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(page, matchWrap());
        setContentView(scroll);
        animatePage(scroll);

        LinearLayout top = horizontal();
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView brand = text("UNITY GLOBAL", 15, TEXT, true);
        brand.setLetterSpacing(0.06f);
        top.addView(brand, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        top.addView(languageSelector(), wrap());
        page.addView(top, matchWrap());

        page.addView(buildMotionHero(
                t("회사 문서를 더 빠르고 선명하게", "เข้าถึงเอกสารบริษัทได้รวดเร็วและชัดเจน"),
                t("Google Drive 기반의 안전한 읽기 전용 포털", "พอร์ทัลแบบอ่านอย่างเดียวที่เชื่อมต่อกับ Google Drive")),
                topMargin(matchWrap(), 16));

        LinearLayout card = card();
        card.setPadding(dp(24), dp(24), dp(24), dp(22));
        page.addView(card, topMargin(matchWrap(), 16));
        animateCardIn(card, 120);

        card.addView(text(t("회사 문서 포털", "พอร์ทัลเอกสารบริษัท"), 24, TEXT, true), wrap());
        TextView note = text(t(
                "관리자 PIN을 입력하면 Unity Global 문서를 확인할 수 있습니다.",
                "กรอก PIN ผู้ดูแลเพื่อเข้าดูเอกสารของ Unity Global"), 14, MUTED, false);
        note.setLineSpacing(0, 1.35f);
        card.addView(note, topMargin(wrap(), 8));

        EditText pin = edit(t("4자리 PIN", "PIN 4 หลัก"));
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        pin.setSingleLine(true);
        card.addView(pin, topMargin(matchHeight(dp(56)), 20));

        Button open = primaryButton(t("포털 열기", "เปิดพอร์ทัล"));
        card.addView(open, topMargin(matchHeight(dp(52)), 14));
        open.setOnClickListener(v -> {
            if (PORTAL_PIN.equals(pin.getText().toString().trim())) {
                showHome();
            } else {
                pin.setText("");
                pin.setError(t("PIN이 일치하지 않습니다.", "PIN ไม่ถูกต้อง"));
            }
        });

        TextView readOnly = text(t(
                "읽기 전용 · 수정/삭제/업로드 불가",
                "อ่านอย่างเดียว · ไม่สามารถแก้ไข ลบ หรืออัปโหลด"), 12, MUTED, false);
        readOnly.setGravity(Gravity.CENTER);
        card.addView(readOnly, topMargin(matchWrap(), 16));
    }

'''
replace_block('    private void showPin() {', '    private void showHome() {', show_pin)

base_screen = r'''    private LinearLayout baseScreen(String title, boolean back, boolean settings) {
        LinearLayout page = vertical();
        page.setBackgroundColor(PAGE);

        LinearLayout toolbar = horizontal();
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(6), dp(10), dp(6));
        toolbar.setBackgroundColor(Color.WHITE);
        toolbar.setElevation(dp(4));

        if (back) {
            TextView backView = text("‹", 38, TEXT, false);
            backView.setGravity(Gravity.CENTER);
            backView.setOnClickListener(v -> handleBack());
            applyPressMotion(backView);
            toolbar.addView(backView, new LinearLayout.LayoutParams(dp(48), dp(54)));
        } else {
            View mark = new View(this);
            mark.setBackground(round(BLUE, Color.TRANSPARENT, 8, 0));
            LinearLayout.LayoutParams markLp = new LinearLayout.LayoutParams(dp(12), dp(12));
            markLp.leftMargin = dp(10);
            markLp.rightMargin = dp(12);
            toolbar.addView(mark, markLp);
            startPulse(mark);
        }

        TextView titleView = text(title, 18, TEXT, true);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleView.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(titleView, new LinearLayout.LayoutParams(0, dp(54), 1f));

        toolbar.addView(languageSelector(), rightMargin(wrap(), 6));

        if (settings) {
            TextView settingsView = text("⚙", 24, BLUE, false);
            settingsView.setGravity(Gravity.CENTER);
            settingsView.setOnClickListener(v -> showSettings());
            applyPressMotion(settingsView);
            toolbar.addView(settingsView, new LinearLayout.LayoutParams(dp(44), dp(54)));
        }
        page.addView(toolbar, matchHeight(dp(66)));

        LinearLayout content = vertical();
        content.setPadding(dp(16), dp(16), dp(16), dp(32));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(content, matchWrap());
        page.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(page);
        animatePage(page);
        return content;
    }

'''
replace_block('    private LinearLayout baseScreen(', '    private void addBrandHeader(', base_screen)

brand_header = r'''    private void addBrandHeader(LinearLayout content) {
        content.addView(buildMotionHero(
                t("Unity Global 문서 허브", "ศูนย์รวมเอกสาร Unity Global"),
                t("최신 Google Drive 자료를 한곳에서 확인하세요", "ดูข้อมูลล่าสุดจาก Google Drive ได้ในที่เดียว")),
                matchWrap());
    }

'''
replace_block('    private void addBrandHeader(', '    private View connectionCard()', brand_header)

connection_card = r'''    private View connectionCard() {
        LinearLayout card = horizontal();
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(15), dp(13), dp(15), dp(13));
        boolean live = !apiUrl.isEmpty();
        int color = live ? GOOGLE_GREEN : GOLD;
        int surface = live ? SOFT_GREEN : SOFT_YELLOW;
        card.setBackground(round(surface, withAlpha(color, 90), 18, 1));

        View dot = new View(this);
        dot.setBackground(round(color, Color.TRANSPARENT, 7, 0));
        card.addView(dot, new LinearLayout.LayoutParams(dp(12), dp(12)));
        if (live) startPulse(dot);

        LinearLayout copy = vertical();
        copy.addView(text(live
                ? t("Google Drive 최신 조회 연결됨", "เชื่อมต่อ Google Drive ล่าสุดแล้ว")
                : t("Google Drive 연결 주소 없음", "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Google Drive"), 14, TEXT, true), wrap());
        copy.addView(text(live
                ? t("폴더와 파일을 열 때 최신 상태를 불러옵니다.", "ระบบจะดึงข้อมูลล่าสุดเมื่อเปิดโฟลเดอร์หรือไฟล์")
                : t("관리자 설정에서 Apps Script 주소를 저장하십시오.", "บันทึกที่อยู่ Apps Script ในการตั้งค่าผู้ดูแล"), 12, MUTED, false), topMargin(wrap(), 3));
        LinearLayout.LayoutParams copyLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        copyLp.leftMargin = dp(11);
        card.addView(copy, copyLp);
        return card;
    }

'''
replace_block('    private View connectionCard()', '    private void addSectionTitle(', connection_card)

folder_info = r'''    private View folderInfoCard(PortalItem folder) {
        LinearLayout card = card();
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        LinearLayout row = horizontal();
        TextView icon = text("▱", 34, BLUE, false);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(SOFT_BLUE, Color.TRANSPARENT, 16, 0));
        row.addView(icon, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout textColumn = vertical();
        textColumn.addView(text(folder.name, 19, TEXT, true), matchWrap());
        TextView desc = text("", 14, MUTED, false);
        desc.setLineSpacing(0, 1.4f);
        setLocalizedBody(desc, folder.description, "folder:" + folder.id + ":" + folder.modifiedTime);
        textColumn.addView(desc, topMargin(matchWrap(), 7));
        LinearLayout.LayoutParams textLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        textLp.leftMargin = dp(13);
        row.addView(textColumn, textLp);
        card.addView(row, matchWrap());
        return card;
    }

'''
replace_block('    private View folderInfoCard(', '    private void renderItemList(', folder_info)

render_item_list = r'''    private void renderItemList(LinearLayout list, List<PortalItem> items, ItemClick click) {
        list.removeAllViews();
        if (items.isEmpty()) {
            list.addView(emptyCard(t("표시할 폴더나 파일이 없습니다.", "ไม่มีโฟลเดอร์หรือไฟล์ที่จะแสดง")), matchWrap());
            return;
        }
        int index = 0;
        for (PortalItem item : items) {
            View itemView = itemCard(item, () -> click.run(item));
            list.addView(itemView, bottomMargin(matchWrap(), 10));
            animateCardIn(itemView, Math.min(360, index * 45L));
            index++;
        }
    }

'''
replace_block('    private void renderItemList(', '    private interface ItemClick', render_item_list)

item_card = r'''    private View itemCard(PortalItem item, Runnable action) {
        LinearLayout card = card();
        card.setPadding(dp(15), dp(15), dp(12), dp(15));
        card.setOnClickListener(v -> action.run());
        card.setClickable(true);
        card.setFocusable(true);
        applyPressMotion(card);

        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        int accent = item.isFolder ? GOOGLE_YELLOW_COLOR() : BLUE;
        TextView icon = text(item.isFolder ? "▱" : "▤", 28, accent, false);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(item.isFolder ? SOFT_YELLOW : SOFT_BLUE, Color.TRANSPARENT, 15, 0));
        row.addView(icon, new LinearLayout.LayoutParams(dp(50), dp(50)));

        LinearLayout column = vertical();
        TextView name = text(item.name, 16, TEXT, true);
        name.setMaxLines(2);
        column.addView(name, matchWrap());
        TextView desc = text("", 13, MUTED, false);
        desc.setMaxLines(3);
        desc.setEllipsize(android.text.TextUtils.TruncateAt.END);
        desc.setLineSpacing(0, 1.35f);
        setLocalizedBody(desc, item.description, "item:" + item.id + ":" + item.modifiedTime);
        column.addView(desc, topMargin(matchWrap(), 5));
        if (!item.modifiedTime.isEmpty()) {
            column.addView(text(t("수정 ", "แก้ไข ") + prettyDate(item.modifiedTime), 11, Color.rgb(128, 134, 139), false), topMargin(wrap(), 7));
        }
        LinearLayout.LayoutParams columnLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        columnLp.leftMargin = dp(13);
        row.addView(column, columnLp);
        TextView arrow = text("›", 28, Color.rgb(154, 160, 166), false);
        row.addView(arrow, new LinearLayout.LayoutParams(dp(28), dp(45)));
        card.addView(row, matchWrap());
        return card;
    }

    private int GOOGLE_YELLOW_COLOR() {
        return Color.rgb(245, 166, 35);
    }

'''
replace_block('    private View itemCard(', '    private TextView chip(', item_card)

# General bilingual replacements after compact-map patch has run.
replacements = {
    'edit("폴더 또는 파일 검색")': 'edit(t("폴더 또는 파일 검색", "ค้นหาโฟลเดอร์หรือไฟล์"))',
    'compactButton("검색")': 'compactButton(t("검색", "ค้นหา"))',
    'addSectionTitle(content, "문서 카테고리", "")': 'addSectionTitle(content, t("문서 카테고리", "หมวดหมู่เอกสาร"), "")',
    'errorCard("Google Apps Script 주소가 없습니다. 관리자 설정에서 주소를 저장하십시오.")': 'errorCard(t("Google Apps Script 주소가 없습니다. 관리자 설정에서 주소를 저장하십시오.", "ยังไม่มีที่อยู่ Google Apps Script กรุณาบันทึกในการตั้งค่าผู้ดูแล"))',
    'outlineButton("관리자 설정 열기")': 'outlineButton(t("관리자 설정 열기", "เปิดการตั้งค่าผู้ดูแล"))',
    'baseScreen("검색 결과", true, false)': 'baseScreen(t("검색 결과", "ผลการค้นหา"), true, false)',
    'addSectionTitle(content, "‘" + query + "’ 검색 결과", "")': 'addSectionTitle(content, t("‘" + query + "’ 검색 결과", "ผลการค้นหา ‘" + query + "’"), "")',
    'addSectionTitle(content, "하위 자료", items.size() + "개")': 'addSectionTitle(content, t("하위 자료", "รายการภายใน"), countText(items.size()))',
    'emptyCard("현재 폴더에 하위 자료가 없습니다.")': 'emptyCard(t("현재 폴더에 하위 자료가 없습니다.", "ไม่มีรายการภายในโฟลเดอร์นี้"))',
    'baseScreen("파일 정보", true, false)': 'baseScreen(t("파일 정보", "ข้อมูลไฟล์"), true, false)',
    'text(item.isFolder ? "폴더" : "문서", 13, BLUE, true)': 'text(item.isFolder ? t("폴더", "โฟลเดอร์") : t("문서", "เอกสาร"), 13, BLUE, true)',
    'text("용도", 13, TEXT, true)': 'text(t("용도", "วัตถุประสงค์"), 13, TEXT, true)',
    'text("최근 수정: " + prettyDate(item.modifiedTime)': 'text(t("최근 수정: ", "แก้ไขล่าสุด: ") + prettyDate(item.modifiedTime)',
    'primaryButton("앱에서 열기")': 'primaryButton(t("앱에서 열기", "เปิดในแอป"))',
    'outlineButton("Google 원본 링크 열기")': 'outlineButton(t("Google 원본 링크 열기", "เปิดลิงก์ต้นฉบับ Google"))',
    'toast("원본 링크를 열 수 없습니다.")': 'toast(t("원본 링크를 열 수 없습니다.", "ไม่สามารถเปิดลิงก์ต้นฉบับได้"))',
    'button.setText("불러오는 중...")': 'button.setText(t("불러오는 중...", "กำลังโหลด..."))',
    'button.setText("앱에서 열기")': 'button.setText(t("앱에서 열기", "เปิดในแอป"))',
    'throw new Exception("파일 데이터를 받지 못했습니다.")': 'throw new Exception(t("파일 데이터를 받지 못했습니다.", "ไม่ได้รับข้อมูลไฟล์"))',
    'throw new Exception("임시 저장 폴더를 만들 수 없습니다.")': 'throw new Exception(t("임시 저장 폴더를 만들 수 없습니다.", "ไม่สามารถสร้างโฟลเดอร์ชั่วคราวได้"))',
    'toast("이 파일 형식을 열 수 있는 앱이 없습니다.")': 'toast(t("이 파일 형식을 열 수 있는 앱이 없습니다.", "ไม่มีแอปที่รองรับไฟล์ประเภทนี้"))',
    'baseScreen("관리자 설정", true, false)': 'baseScreen(t("관리자 설정", "การตั้งค่าผู้ดูแล"), true, false)',
    'text("Google Drive 연결", 20, TEXT, true)': 'text(t("Google Drive 연결", "การเชื่อมต่อ Google Drive"), 20, TEXT, true)',
    'text("기존 Google Apps Script 웹앱 주소를 사용합니다. 폴더 지도 때문에 Apps Script를 다시 수정할 필요는 없습니다.", 13, MUTED, false)': 'text(t("기존 Google Apps Script 웹앱 주소를 사용합니다. Apps Script를 다시 수정할 필요는 없습니다.", "ใช้ที่อยู่เว็บแอป Google Apps Script เดิม โดยไม่ต้องแก้ไข Apps Script เพิ่มเติม"), 13, MUTED, false)',
    'primaryButton("저장")': 'primaryButton(t("저장", "บันทึก"))',
    'toast("연결 주소를 저장했습니다.")': 'toast(t("연결 주소를 저장했습니다.", "บันทึกที่อยู่การเชื่อมต่อแล้ว"))',
    'outlineButton("연결 테스트")': 'outlineButton(t("연결 테스트", "ทดสอบการเชื่อมต่อ"))',
    'test.setText("확인 중...")': 'test.setText(t("확인 중...", "กำลังตรวจสอบ..."))',
    'test.setText("연결 테스트")': 'test.setText(t("연결 테스트", "ทดสอบการเชื่อมต่อ"))',
    'toast("연결 성공: 실제 Google Drive 목록을 사용할 수 있습니다.")': 'toast(t("연결 성공: 실제 Google Drive 목록을 사용할 수 있습니다.", "เชื่อมต่อสำเร็จ สามารถใช้รายการ Google Drive จริงได้"))',
    'infoCard("사용자 PIN: 1111\\n읽기 전용\\n수정·삭제·업로드 기능 없음\\nGoogle 계정 비밀번호를 앱에 저장하지 않음")': 'infoCard(t("사용자 PIN: 1111\\n읽기 전용\\n수정·삭제·업로드 기능 없음\\nGoogle 계정 비밀번호를 앱에 저장하지 않음", "PIN ผู้ใช้: 1111\\nอ่านอย่างเดียว\\nไม่มีการแก้ไข ลบ หรืออัปโหลด\\nแอปไม่บันทึกรหัสผ่านบัญชี Google"))',
    'text("불러오는 중...", 13, MUTED, false)': 'text(t("불러오는 중...", "กำลังโหลด..."), 13, MUTED, false)',
    'failure.run("Google Apps Script 주소가 비어 있습니다.")': 'failure.run(t("Google Apps Script 주소가 비어 있습니다.", "ที่อยู่ Google Apps Script ว่างอยู่"))',
    'throw new Exception("서버 오류 (" + code + ")")': 'throw new Exception(t("서버 오류 (", "ข้อผิดพลาดเซิร์ฟเวอร์ (") + code + ")")',
    'json.optString("message", "요청 실패")': 'json.optString("message", t("요청 실패", "คำขอล้มเหลว"))',
    'String message = "연결 실패: " + messageOf(e);': 'String message = t("연결 실패: ", "เชื่อมต่อล้มเหลว: ") + messageOf(e);',
    'text("폴더 구조 지도", 17, TEXT, true)': 'text(t("폴더 구조 지도", "แผนผังโฟลเดอร์"), 17, TEXT, true)',
    'text("전체 구조 · 현재 경로 · 하위 폴더", 10, MUTED, false)': 'text(t("전체 구조 · 현재 경로 · 하위 폴더", "โครงสร้างทั้งหมด · เส้นทางปัจจุบัน · โฟลเดอร์ย่อย"), 10, MUTED, false)',
    'text("전체 카테고리", 10, Color.rgb(71, 85, 105), true)': 'text(t("전체 카테고리", "หมวดหมู่ทั้งหมด"), 10, Color.rgb(71, 85, 105), true)',
    'text(rootItems.size() + "개", 9, Color.rgb(123, 135, 151), false)': 'text(countText(rootItems.size()), 9, Color.rgb(123, 135, 151), false)',
    'text("현재 경로", 10, Color.rgb(71, 85, 105), true)': 'text(t("현재 경로", "เส้นทางปัจจุบัน"), 10, Color.rgb(71, 85, 105), true)',
    'text("금색 = 현재 위치", 9, Color.rgb(156, 96, 0), false)': 'text(t("금색 = 현재 위치", "สีทอง = ตำแหน่งปัจจุบัน"), 9, Color.rgb(156, 96, 0), false)',
    'treeRouteNode("⌂ 문서", false, false)': 'treeRouteNode(t("⌂ 문서", "⌂ เอกสาร"), false, false)',
    'text("  하위 폴더 없음", 9, Color.rgb(123, 135, 151), false)': 'text(t("  하위 폴더 없음", "  ไม่มีโฟลเดอร์ย่อย"), 9, Color.rgb(123, 135, 151), false)',
    'treeChildNode("+" + (children.size() - shown) + "개")': 'treeChildNode("+" + (children.size() - shown) + (isThai() ? "" : "개"))',
}
for old, new in replacements.items():
    source = source.replace(old, new)

# Translate the file detail description asynchronously.
source = source.replace(
'''        TextView desc = text(item.description, 14, MUTED, false);
        desc.setLineSpacing(0, 1.45f);
        card.addView(desc, topMargin(matchWrap(), 6));
''',
'''        TextView desc = text("", 14, MUTED, false);
        desc.setLineSpacing(0, 1.45f);
        setLocalizedBody(desc, item.description, "detail:" + item.id + ":" + item.modifiedTime);
        card.addView(desc, topMargin(matchWrap(), 6));
''')

# Stagger folder content cards.
source = source.replace(
'''        content.addView(buildFolderMap(folder, childFolders), matchWrap());
        content.addView(folderInfoCard(folder), topMargin(matchWrap(), 18));
''',
'''        View mapView = buildFolderMap(folder, childFolders);
        content.addView(mapView, matchWrap());
        animateCardIn(mapView, 20);
        View infoView = folderInfoCard(folder);
        content.addView(infoView, topMargin(matchWrap(), 14));
        animateCardIn(infoView, 90);
''')
source = source.replace(
'''        for (PortalItem item : items) {
            content.addView(itemCard(item, () -> {
''',
'''        int animatedIndex = 0;
        for (PortalItem item : items) {
            View rowView = itemCard(item, () -> {
''')
source = source.replace(
'''                }
            }), bottomMargin(matchWrap(), 10));
        }
    }

    private View buildFolderMap''',
'''                }
            });
            content.addView(rowView, bottomMargin(matchWrap(), 10));
            animateCardIn(rowView, 150 + Math.min(320, animatedIndex * 42L));
            animatedIndex++;
        }
    }

    private View buildFolderMap''')

# Bright Google style controls.
source = source.replace(
'''    private LinearLayout card() {
        LinearLayout card = vertical();
        card.setBackground(round(Color.WHITE, BORDER, 18, 1));
        card.setElevation(dp(1));
        return card;
    }
''',
'''    private LinearLayout card() {
        LinearLayout card = vertical();
        card.setBackground(round(Color.WHITE, Color.rgb(230, 232, 236), 24, 1));
        card.setElevation(dp(4));
        return card;
    }
''')
source = source.replace(
'''        edit.setBackground(round(Color.WHITE, Color.rgb(200, 210, 223), 13, 1));
''',
'''        edit.setBackground(round(Color.rgb(248, 250, 253), Color.rgb(210, 214, 220), 18, 1));
''')
source = source.replace(
'''        button.setBackground(round(BLUE, BLUE, 14, 1));
        return button;
''',
'''        button.setBackground(round(BLUE, BLUE, 22, 1));
        button.setElevation(dp(2));
        applyPressMotion(button);
        return button;
''', 1)
source = source.replace(
'''        button.setBackground(round(Color.WHITE, Color.rgb(142, 151, 165), 14, 1));
        return button;
''',
'''        button.setBackground(round(Color.WHITE, Color.rgb(190, 201, 218), 22, 1));
        button.setElevation(dp(1));
        applyPressMotion(button);
        return button;
''', 1)

motion_helpers = r'''    private View buildMotionHero(String headline, String subtitle) {
        FrameLayout hero = new FrameLayout(this);
        hero.setClipChildren(false);
        hero.setBackground(round(Color.rgb(245, 249, 255), Color.rgb(220, 230, 246), 26, 1));
        hero.setElevation(dp(2));

        View blueOrb = motionOrb(BLUE, 58);
        View redOrb = motionOrb(GOOGLE_RED, 34);
        View greenOrb = motionOrb(GOOGLE_GREEN, 44);
        View yellowOrb = motionOrb(GOLD, 30);
        addOrb(hero, blueOrb, 255, -12, 58);
        addOrb(hero, redOrb, 25, 8, 34);
        addOrb(hero, greenOrb, 292, 72, 44);
        addOrb(hero, yellowOrb, 210, 82, 30);
        startFloatingMotion(blueOrb, -18f, 12f, 0);
        startFloatingMotion(redOrb, 16f, 10f, 180);
        startFloatingMotion(greenOrb, -13f, -12f, 320);
        startFloatingMotion(yellowOrb, 12f, -10f, 480);

        LinearLayout copy = vertical();
        copy.setPadding(dp(20), dp(22), dp(68), dp(20));
        copy.addView(text(headline, 21, TEXT, true), wrap());
        TextView sub = text(subtitle, 13, MUTED, false);
        sub.setLineSpacing(0, 1.35f);
        copy.addView(sub, topMargin(matchWrap(), 7));
        TextView badge = text("●  LIVE DRIVE", 10, GOOGLE_GREEN, true);
        badge.setPadding(dp(10), dp(5), dp(10), dp(5));
        badge.setBackground(round(SOFT_GREEN, Color.rgb(183, 225, 195), 14, 1));
        copy.addView(badge, topMargin(wrap(), 13));
        startPulse(badge);
        hero.addView(copy, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(122)));
        return hero;
    }

    private View motionOrb(int color, int sizeDp) {
        View orb = new View(this);
        orb.setAlpha(0.22f);
        orb.setBackground(round(color, Color.TRANSPARENT, sizeDp, 0));
        return orb;
    }

    private void addOrb(FrameLayout parent, View orb, int left, int top, int size) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(size), dp(size));
        lp.leftMargin = dp(left);
        lp.topMargin = dp(top);
        parent.addView(orb, lp);
    }

    private void startFloatingMotion(View view, float x, float y, long delay) {
        ObjectAnimator moveX = ObjectAnimator.ofFloat(view, View.TRANSLATION_X, 0f, dp((int) x));
        ObjectAnimator moveY = ObjectAnimator.ofFloat(view, View.TRANSLATION_Y, 0f, dp((int) y));
        moveX.setRepeatCount(ValueAnimator.INFINITE);
        moveY.setRepeatCount(ValueAnimator.INFINITE);
        moveX.setRepeatMode(ValueAnimator.REVERSE);
        moveY.setRepeatMode(ValueAnimator.REVERSE);
        moveX.setDuration(2600);
        moveY.setDuration(3100);
        moveX.setStartDelay(delay);
        moveY.setStartDelay(delay + 140);
        moveX.setInterpolator(new AccelerateDecelerateInterpolator());
        moveY.setInterpolator(new AccelerateDecelerateInterpolator());
        AnimatorSet set = new AnimatorSet();
        set.playTogether(moveX, moveY);
        set.start();
    }

    private void startPulse(View view) {
        ObjectAnimator sx = ObjectAnimator.ofFloat(view, View.SCALE_X, 0.92f, 1.05f);
        ObjectAnimator sy = ObjectAnimator.ofFloat(view, View.SCALE_Y, 0.92f, 1.05f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(view, View.ALPHA, 0.62f, 1f);
        for (ObjectAnimator animator : new ObjectAnimator[]{sx, sy, alpha}) {
            animator.setDuration(900);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setRepeatMode(ValueAnimator.REVERSE);
            animator.setInterpolator(new AccelerateDecelerateInterpolator());
        }
        AnimatorSet set = new AnimatorSet();
        set.playTogether(sx, sy, alpha);
        set.start();
    }

    private void animatePage(View view) {
        view.setAlpha(0f);
        view.setTranslationY(dp(10));
        view.animate().alpha(1f).translationY(0f).setDuration(330)
                .setInterpolator(new DecelerateInterpolator()).start();
    }

    private void animateCardIn(View view, long delay) {
        view.setAlpha(0f);
        view.setTranslationY(dp(18));
        view.setScaleX(0.985f);
        view.setScaleY(0.985f);
        view.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
                .setStartDelay(delay).setDuration(360)
                .setInterpolator(new DecelerateInterpolator()).start();
    }

    private void applyPressMotion(View view) {
        view.setOnTouchListener((v, event) -> {
            if (event.getAction() == android.view.MotionEvent.ACTION_DOWN) {
                v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(90).start();
            } else if (event.getAction() == android.view.MotionEvent.ACTION_UP ||
                    event.getAction() == android.view.MotionEvent.ACTION_CANCEL) {
                v.animate().scaleX(1f).scaleY(1f).setDuration(150).start();
            }
            return false;
        });
    }

    private void crossFadeText(TextView view, String value) {
        view.animate().alpha(0f).setDuration(100).withEndAction(() -> {
            view.setText(value);
            view.animate().alpha(1f).setDuration(180).start();
        }).start();
    }

'''
source = source.replace('    private LinearLayout vertical() {\n', motion_helpers + '    private LinearLayout vertical() {\n')

# Modern loading indicator with animated Google dots.
loading_start = source.index('    private void addLoading(')
loading_end = source.index('    private void requestAsync(', loading_start)
loading = r'''    private void addLoading(LinearLayout parent) {
        parent.removeAllViews();
        LinearLayout dots = horizontal();
        dots.setGravity(Gravity.CENTER);
        int[] colors = {BLUE, GOOGLE_RED, GOLD, GOOGLE_GREEN};
        for (int i = 0; i < colors.length; i++) {
            View dot = new View(this);
            dot.setBackground(round(colors[i], Color.TRANSPARENT, 8, 0));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(12), dp(12));
            if (i > 0) lp.leftMargin = dp(9);
            dots.addView(dot, lp);
            ObjectAnimator bounce = ObjectAnimator.ofFloat(dot, View.TRANSLATION_Y, 0f, -dp(8), 0f);
            bounce.setDuration(820);
            bounce.setStartDelay(i * 110L);
            bounce.setRepeatCount(ValueAnimator.INFINITE);
            bounce.setInterpolator(new AccelerateDecelerateInterpolator());
            bounce.start();
        }
        LinearLayout.LayoutParams dotsLp = wrap();
        dotsLp.gravity = Gravity.CENTER_HORIZONTAL;
        dotsLp.topMargin = dp(32);
        parent.addView(dots, dotsLp);
        TextView loadingText = text(t("불러오는 중...", "กำลังโหลด..."), 13, MUTED, false);
        loadingText.setGravity(Gravity.CENTER);
        parent.addView(loadingText, topMargin(matchWrap(), 12));
    }

'''
source = source[:loading_start] + loading + source[loading_end:]

path.write_text(source, encoding='utf-8')
