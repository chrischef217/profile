package com.unityglobal.unity_drive_access;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String PORTAL_PIN = "1111";
    private static final String PORTAL_TOKEN = "UNITY_GLOBAL_DRIVE_PORTAL";

    private static final int NAVY = Color.rgb(7, 26, 46);
    private static final int BLUE = Color.rgb(23, 105, 224);
    private static final int GOLD = Color.rgb(240, 160, 0);
    private static final int PAGE = Color.rgb(244, 247, 251);
    private static final int TEXT = Color.rgb(7, 26, 46);
    private static final int MUTED = Color.rgb(91, 104, 120);
    private static final int BORDER = Color.rgb(220, 228, 239);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private String apiUrl = "";
    private final ArrayList<PortalItem> rootItems = new ArrayList<>();
    private final ArrayList<PortalItem> currentItems = new ArrayList<>();
    private final ArrayList<PortalItem> path = new ArrayList<>();

    private PortalItem currentFolder;
    private PortalItem currentFile;
    private Screen screen = Screen.PIN;
    private int requestGeneration = 0;

    private enum Screen { PIN, HOME, FOLDER, FILE, SETTINGS, SEARCH }

    private interface JsonSuccess { void run(JSONObject data) throws Exception; }
    private interface StringFailure { void run(String message); }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(NAVY);
        getWindow().setNavigationBarColor(NAVY);
        apiUrl = loadSavedApiUrl();
        showPin();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private String loadSavedApiUrl() {
        SharedPreferences own = getSharedPreferences("UnityDrivePrefs", MODE_PRIVATE);
        String value = own.getString("api_url", "");
        if (value != null && !value.trim().isEmpty()) return value.trim();

        SharedPreferences flutter = getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE);
        value = flutter.getString("flutter.portal_api_url", "");
        return value == null ? "" : value.trim();
    }

    private void saveApiUrl(String value) {
        apiUrl = value == null ? "" : value.trim();
        getSharedPreferences("UnityDrivePrefs", MODE_PRIVATE)
                .edit().putString("api_url", apiUrl).apply();
        getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
                .edit().putString("flutter.portal_api_url", apiUrl).apply();
    }

    private void showPin() {
        screen = Screen.PIN;
        requestGeneration++;

        LinearLayout page = vertical();
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        page.setPadding(dp(24), dp(34), dp(24), dp(24));
        page.setBackgroundColor(PAGE);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(page, matchWrap());
        setContentView(scroll);

        TextView brand = text("UNITY GLOBAL", 18, TEXT, true);
        brand.setLetterSpacing(0.08f);
        page.addView(brand, wrap());
        TextView sub = text("DRIVE PORTAL", 14, BLUE, true);
        page.addView(sub, topMargin(wrap(), 3));

        LinearLayout card = card();
        card.setPadding(dp(24), dp(28), dp(24), dp(26));
        LinearLayout.LayoutParams cardLp = matchWrap();
        cardLp.topMargin = dp(28);
        page.addView(card, cardLp);

        card.addView(text("회사 문서 포털", 25, TEXT, true), wrap());
        TextView note = text("관리자 PIN을 입력하면 Unity Global 문서를 확인할 수 있습니다.", 14, MUTED, false);
        note.setLineSpacing(0, 1.35f);
        card.addView(note, topMargin(wrap(), 9));

        EditText pin = edit("4자리 PIN");
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        pin.setSingleLine(true);
        card.addView(pin, topMargin(matchHeight(dp(54)), 22));

        Button open = primaryButton("포털 열기");
        card.addView(open, topMargin(matchHeight(dp(52)), 14));
        open.setOnClickListener(v -> {
            if (PORTAL_PIN.equals(pin.getText().toString().trim())) {
                showHome();
            } else {
                pin.setText("");
                pin.setError("PIN이 일치하지 않습니다.");
            }
        });

        TextView readOnly = text("읽기 전용 · 수정/삭제/업로드 불가", 12, Color.rgb(116, 129, 150), false);
        readOnly.setGravity(Gravity.CENTER);
        card.addView(readOnly, topMargin(matchWrap(), 17));
    }

    private void showHome() {
        screen = Screen.HOME;
        currentFolder = null;
        currentFile = null;
        path.clear();
        int generation = ++requestGeneration;

        LinearLayout content = baseScreen("UNITY GLOBAL DRIVE", false, true);
        addBrandHeader(content);

        LinearLayout searchRow = horizontal();
        EditText search = edit("폴더 또는 파일 검색");
        LinearLayout.LayoutParams searchLp = new LinearLayout.LayoutParams(0, dp(52), 1f);
        searchRow.addView(search, searchLp);
        Button go = compactButton("검색");
        LinearLayout.LayoutParams goLp = new LinearLayout.LayoutParams(dp(78), dp(52));
        goLp.leftMargin = dp(9);
        searchRow.addView(go, goLp);
        content.addView(searchRow, topMargin(matchWrap(), 18));
        go.setOnClickListener(v -> {
            String query = search.getText().toString().trim();
            if (!query.isEmpty()) showSearch(query);
        });

        content.addView(connectionCard(), topMargin(matchWrap(), 14));
        addSectionTitle(content, "문서 카테고리", "");

        LinearLayout list = vertical();
        content.addView(list, matchWrap());

        if (apiUrl.isEmpty()) {
            list.addView(errorCard("Google Apps Script 주소가 없습니다. 관리자 설정에서 주소를 저장하십시오."), matchWrap());
            Button settings = outlineButton("관리자 설정 열기");
            list.addView(settings, topMargin(matchHeight(dp(48)), 12));
            settings.setOnClickListener(v -> showSettings());
            return;
        }

        addLoading(list);
        requestAsync(params("action", "list", "folderId", "root"), data -> {
            if (generation != requestGeneration || screen != Screen.HOME) return;
            List<PortalItem> result = parseItems(data);
            rootItems.clear();
            for (PortalItem item : result) if (item.isFolder) rootItems.add(item);
            renderItemList(list, result, item -> {
                if (item.isFolder) {
                    ArrayList<PortalItem> nextPath = new ArrayList<>();
                    nextPath.add(item);
                    showFolder(item, nextPath);
                } else {
                    showFile(item);
                }
            });
        }, message -> {
            if (generation != requestGeneration || screen != Screen.HOME) return;
            list.removeAllViews();
            list.addView(errorCard(message), matchWrap());
        });
    }

    private void showSearch(String query) {
        screen = Screen.SEARCH;
        int generation = ++requestGeneration;
        LinearLayout content = baseScreen("검색 결과", true, false);
        addSectionTitle(content, "‘" + query + "’ 검색 결과", "");
        LinearLayout list = vertical();
        content.addView(list, matchWrap());
        addLoading(list);

        requestAsync(params("action", "search", "query", query), data -> {
            if (generation != requestGeneration || screen != Screen.SEARCH) return;
            List<PortalItem> result = parseItems(data);
            renderItemList(list, result, item -> {
                if (item.isFolder) {
                    ArrayList<PortalItem> nextPath = new ArrayList<>();
                    nextPath.add(item);
                    showFolder(item, nextPath);
                } else {
                    showFile(item);
                }
            });
        }, message -> {
            if (generation != requestGeneration || screen != Screen.SEARCH) return;
            list.removeAllViews();
            list.addView(errorCard(message), matchWrap());
        });
    }

    private void showFolder(PortalItem folder, ArrayList<PortalItem> nextPath) {
        screen = Screen.FOLDER;
        currentFolder = folder;
        currentFile = null;
        path.clear();
        path.addAll(nextPath);
        int generation = ++requestGeneration;

        LinearLayout content = baseScreen(folder.name, true, false);
        addLoading(content);

        requestAsync(params("action", "list", "folderId", folder.id), data -> {
            if (generation != requestGeneration || screen != Screen.FOLDER || currentFolder == null || !folder.id.equals(currentFolder.id)) return;
            List<PortalItem> result = parseItems(data);
            currentItems.clear();
            currentItems.addAll(result);
            renderFolder(content, folder, result);
        }, message -> {
            if (generation != requestGeneration || screen != Screen.FOLDER) return;
            content.removeAllViews();
            content.addView(buildFolderMap(folder, new ArrayList<>()), matchWrap());
            content.addView(errorCard(message), topMargin(matchWrap(), 14));
        });
    }

    private void renderFolder(LinearLayout content, PortalItem folder, List<PortalItem> items) {
        content.removeAllViews();
        ArrayList<PortalItem> childFolders = new ArrayList<>();
        for (PortalItem item : items) if (item.isFolder) childFolders.add(item);

        content.addView(buildFolderMap(folder, childFolders), matchWrap());
        content.addView(folderInfoCard(folder), topMargin(matchWrap(), 18));
        addSectionTitle(content, "하위 자료", items.size() + "개");

        if (items.isEmpty()) {
            content.addView(emptyCard("현재 폴더에 하위 자료가 없습니다."), matchWrap());
            return;
        }

        for (PortalItem item : items) {
            content.addView(itemCard(item, () -> {
                if (item.isFolder) {
                    ArrayList<PortalItem> next = new ArrayList<>(path);
                    next.add(item);
                    showFolder(item, next);
                } else {
                    showFile(item);
                }
            }), bottomMargin(matchWrap(), 10));
        }
    }

    private View buildFolderMap(PortalItem folder, List<PortalItem> children) {
        LinearLayout card = card();
        card.setPadding(dp(18), dp(18), dp(18), dp(20));

        LinearLayout header = horizontal();
        TextView icon = text("⌘", 28, BLUE, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(Color.rgb(234, 242, 255), Color.TRANSPARENT, 14, 0));
        header.addView(icon, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout titles = vertical();
        titles.addView(text("폴더 구조 지도", 20, TEXT, true), wrap());
        TextView sub = text("별도 지도 API 없이 현재 경로를 앱 내부에서 표시합니다.", 12, Color.rgb(104, 118, 137), false);
        sub.setLineSpacing(0, 1.3f);
        titles.addView(sub, topMargin(wrap(), 3));
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleLp.leftMargin = dp(13);
        header.addView(titles, titleLp);

        TextView refresh = chip("↻", false, false);
        refresh.setGravity(Gravity.CENTER);
        refresh.setOnClickListener(v -> showFolder(folder, new ArrayList<>(path)));
        header.addView(refresh, new LinearLayout.LayoutParams(dp(45), dp(45)));
        card.addView(header, matchWrap());

        card.addView(text("현재 위치", 13, Color.rgb(51, 65, 85), true), topMargin(wrap(), 18));
        LinearLayout breadcrumb = horizontal();
        TextView home = chip("⌂ 문서 카테고리", false, false);
        home.setOnClickListener(v -> showHome());
        breadcrumb.addView(home, wrap());
        for (int i = 0; i < path.size(); i++) {
            final int index = i;
            TextView arrow = text("›", 19, Color.rgb(148, 163, 184), false);
            arrow.setGravity(Gravity.CENTER);
            breadcrumb.addView(arrow, sideMargin(wrap(), 5));
            boolean current = i == path.size() - 1;
            TextView node = chip((current ? "◎ " : "▣ ") + path.get(i).name, !current, current);
            if (current) startBlink(node);
            node.setOnClickListener(v -> {
                if (index == path.size() - 1) return;
                ArrayList<PortalItem> targetPath = new ArrayList<>(path.subList(0, index + 1));
                showFolder(path.get(index), targetPath);
            });
            breadcrumb.addView(node, wrap());
        }
        card.addView(horizontalScroller(breadcrumb, dp(54)), topMargin(matchWrap(), 9));

        LinearLayout rootTitle = horizontal();
        TextView rootLabel = text("전체 문서 카테고리", 13, Color.rgb(51, 65, 85), true);
        rootTitle.addView(rootLabel, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        rootTitle.addView(text(rootItems.size() + "개", 12, Color.rgb(123, 135, 151), false), wrap());
        card.addView(rootTitle, topMargin(matchWrap(), 18));

        LinearLayout rootRow = horizontal();
        String activeRootId = path.isEmpty() ? "" : path.get(0).id;
        for (PortalItem rootItem : rootItems) {
            boolean active = rootItem.id.equals(activeRootId);
            TextView node = chip((active ? "★ " : "▣ ") + rootItem.name, active, false);
            node.setOnClickListener(v -> {
                ArrayList<PortalItem> targetPath = new ArrayList<>();
                targetPath.add(rootItem);
                showFolder(rootItem, targetPath);
            });
            rootRow.addView(node, rightMargin(wrap(), 8));
        }
        card.addView(horizontalScroller(rootRow, dp(54)), topMargin(matchWrap(), 9));

        LinearLayout childTitle = horizontal();
        childTitle.addView(text("현재 폴더의 하위 폴더", 13, Color.rgb(51, 65, 85), true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        childTitle.addView(text(children.size() + "개", 12, Color.rgb(123, 135, 151), false), wrap());
        card.addView(childTitle, topMargin(matchWrap(), 18));

        if (children.isEmpty()) {
            card.addView(text("현재 위치 아래에 하위 폴더가 없습니다.", 12, Color.rgb(123, 135, 151), false), topMargin(wrap(), 9));
        } else {
            LinearLayout childRow = horizontal();
            for (PortalItem child : children) {
                TextView node = chip("↳ " + child.name, false, false);
                node.setOnClickListener(v -> {
                    ArrayList<PortalItem> next = new ArrayList<>(path);
                    next.add(child);
                    showFolder(child, next);
                });
                childRow.addView(node, rightMargin(wrap(), 8));
            }
            card.addView(horizontalScroller(childRow, dp(54)), topMargin(matchWrap(), 9));
        }
        return card;
    }

    private void showFile(PortalItem item) {
        screen = Screen.FILE;
        currentFile = item;
        requestGeneration++;
        LinearLayout content = baseScreen("파일 정보", true, false);

        LinearLayout card = card();
        card.setPadding(dp(22), dp(22), dp(22), dp(22));
        card.addView(text(item.isFolder ? "폴더" : "문서", 13, BLUE, true), wrap());
        TextView name = text(item.name, 21, TEXT, true);
        name.setLineSpacing(0, 1.2f);
        card.addView(name, topMargin(matchWrap(), 10));
        card.addView(text("용도", 13, TEXT, true), topMargin(wrap(), 18));
        TextView desc = text(item.description, 14, MUTED, false);
        desc.setLineSpacing(0, 1.45f);
        card.addView(desc, topMargin(matchWrap(), 6));
        if (!item.modifiedTime.isEmpty()) card.addView(text("최근 수정: " + prettyDate(item.modifiedTime), 12, Color.rgb(116, 129, 150), false), topMargin(wrap(), 16));
        content.addView(card, matchWrap());

        Button open = primaryButton("앱에서 열기");
        content.addView(open, topMargin(matchHeight(dp(52)), 14));
        open.setOnClickListener(v -> downloadAndOpen(item, open));

        if (!item.webViewUrl.isEmpty()) {
            Button original = outlineButton("Google 원본 링크 열기");
            content.addView(original, topMargin(matchHeight(dp(52)), 10));
            original.setOnClickListener(v -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(item.webViewUrl)));
                } catch (Exception e) {
                    toast("원본 링크를 열 수 없습니다.");
                }
            });
        }
    }

    private void downloadAndOpen(PortalItem item, Button button) {
        button.setEnabled(false);
        button.setText("불러오는 중...");
        int generation = requestGeneration;
        requestAsync(params("action", "download", "fileId", item.id), data -> {
            if (generation != requestGeneration || screen != Screen.FILE) return;
            String base64 = data.optString("base64", "");
            if (base64.isEmpty()) throw new Exception("파일 데이터를 받지 못했습니다.");
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            String name = safeFileName(data.optString("fileName", item.name));
            String mime = data.optString("mimeType", item.mimeType);
            File dir = new File(getCacheDir(), "downloads");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("임시 저장 폴더를 만들 수 없습니다.");
            File file = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            main.post(() -> {
                button.setEnabled(true);
                button.setText("앱에서 열기");
                try {
                    Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(uri, mime == null || mime.isEmpty() ? "*/*" : mime);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    toast("이 파일 형식을 열 수 있는 앱이 없습니다.");
                }
            });
        }, message -> {
            if (generation != requestGeneration || screen != Screen.FILE) return;
            button.setEnabled(true);
            button.setText("앱에서 열기");
            toast(message);
        });
    }

    private void showSettings() {
        screen = Screen.SETTINGS;
        requestGeneration++;
        LinearLayout content = baseScreen("관리자 설정", true, false);

        LinearLayout card = card();
        card.setPadding(dp(20), dp(22), dp(20), dp(22));
        card.addView(text("Google Drive 연결", 20, TEXT, true), wrap());
        TextView note = text("기존 Google Apps Script 웹앱 주소를 사용합니다. 폴더 지도 때문에 Apps Script를 다시 수정할 필요는 없습니다.", 13, MUTED, false);
        note.setLineSpacing(0, 1.45f);
        card.addView(note, topMargin(matchWrap(), 8));

        EditText url = edit("https://script.google.com/macros/s/.../exec");
        url.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        url.setSingleLine(true);
        url.setText(apiUrl);
        card.addView(url, topMargin(matchHeight(dp(56)), 18));

        Button save = primaryButton("저장");
        card.addView(save, topMargin(matchHeight(dp(50)), 14));
        save.setOnClickListener(v -> {
            saveApiUrl(url.getText().toString());
            toast("연결 주소를 저장했습니다.");
        });

        Button test = outlineButton("연결 테스트");
        card.addView(test, topMargin(matchHeight(dp(50)), 9));
        test.setOnClickListener(v -> {
            saveApiUrl(url.getText().toString());
            test.setEnabled(false);
            test.setText("확인 중...");
            requestAsync(params("action", "ping"), data -> {
                if (screen != Screen.SETTINGS) return;
                test.setEnabled(true);
                test.setText("연결 테스트");
                toast("연결 성공: 실제 Google Drive 목록을 사용할 수 있습니다.");
            }, message -> {
                if (screen != Screen.SETTINGS) return;
                test.setEnabled(true);
                test.setText("연결 테스트");
                toast(message);
            });
        });

        content.addView(card, matchWrap());
        content.addView(infoCard("사용자 PIN: 1111\n읽기 전용\n수정·삭제·업로드 기능 없음\nGoogle 계정 비밀번호를 앱에 저장하지 않음"), topMargin(matchWrap(), 14));
    }

    private void handleBack() {
        if (screen == Screen.PIN) {
            finish();
            return;
        }
        if (screen == Screen.HOME) {
            showPin();
            return;
        }
        if (screen == Screen.FOLDER) {
            if (path.size() > 1) {
                ArrayList<PortalItem> parentPath = new ArrayList<>(path.subList(0, path.size() - 1));
                showFolder(parentPath.get(parentPath.size() - 1), parentPath);
            } else {
                showHome();
            }
            return;
        }
        if (screen == Screen.FILE && currentFolder != null) {
            showFolder(currentFolder, new ArrayList<>(path));
            return;
        }
        showHome();
    }

    private LinearLayout baseScreen(String title, boolean back, boolean settings) {
        LinearLayout page = vertical();
        page.setBackgroundColor(PAGE);

        LinearLayout toolbar = horizontal();
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(10), dp(8), dp(10), dp(8));
        toolbar.setBackgroundColor(NAVY);

        if (back) {
            TextView backView = text("‹", 39, Color.WHITE, false);
            backView.setGravity(Gravity.CENTER);
            backView.setOnClickListener(v -> handleBack());
            toolbar.addView(backView, new LinearLayout.LayoutParams(dp(52), dp(58)));
        } else {
            View spacer = new View(this);
            toolbar.addView(spacer, new LinearLayout.LayoutParams(dp(8), dp(58)));
        }

        TextView titleView = text(title, 20, Color.WHITE, false);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        toolbar.addView(titleView, new LinearLayout.LayoutParams(0, dp(58), 1f));
        titleView.setGravity(Gravity.CENTER_VERTICAL);

        if (settings) {
            TextView settingsView = text("⚙", 27, Color.WHITE, false);
            settingsView.setGravity(Gravity.CENTER);
            settingsView.setOnClickListener(v -> showSettings());
            toolbar.addView(settingsView, new LinearLayout.LayoutParams(dp(52), dp(58)));
        }
        page.addView(toolbar, matchHeight(dp(74)));

        LinearLayout content = vertical();
        content.setPadding(dp(18), dp(18), dp(18), dp(32));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(content, matchWrap());
        page.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(page);
        return content;
    }

    private void addBrandHeader(LinearLayout content) {
        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark = text("UG", 17, Color.WHITE, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(round(BLUE, Color.TRANSPARENT, 14, 0));
        row.addView(mark, new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout titles = vertical();
        titles.addView(text("UNITY GLOBAL", 15, TEXT, true), wrap());
        titles.addView(text("DRIVE PORTAL", 13, BLUE, true), topMargin(wrap(), 2));
        LinearLayout.LayoutParams lp = matchWrap();
        lp.leftMargin = dp(13);
        row.addView(titles, lp);
        content.addView(row, matchWrap());
    }

    private View connectionCard() {
        LinearLayout card = vertical();
        card.setPadding(dp(14), dp(13), dp(14), dp(13));
        boolean live = !apiUrl.isEmpty();
        int color = live ? Color.rgb(20, 128, 74) : Color.rgb(225, 138, 0);
        card.setBackground(round(withAlpha(color, 24), withAlpha(color, 80), 14, 1));
        card.addView(text(live ? "Google Drive 최신 조회 연결됨" : "Google Drive 연결 주소 없음", 14, color, true), wrap());
        card.addView(text(live ? "폴더와 파일을 조회할 때 최신 상태를 불러옵니다." : "관리자 설정에서 Apps Script 주소를 저장하십시오.", 12, MUTED, false), topMargin(wrap(), 4));
        return card;
    }

    private void addSectionTitle(LinearLayout content, String title, String count) {
        LinearLayout row = horizontal();
        TextView heading = text(title, 23, TEXT, true);
        row.addView(heading, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        if (!count.isEmpty()) row.addView(text(count, 12, Color.rgb(116, 129, 150), false), wrap());
        content.addView(row, topMargin(matchWrap(), 20));
        View gap = new View(this);
        content.addView(gap, matchHeight(dp(11)));
    }

    private View folderInfoCard(PortalItem folder) {
        LinearLayout card = card();
        card.setPadding(dp(20), dp(20), dp(20), dp(20));
        LinearLayout row = horizontal();
        TextView icon = text("□", 42, GOLD, false);
        icon.setGravity(Gravity.TOP);
        row.addView(icon, new LinearLayout.LayoutParams(dp(54), dp(58)));
        LinearLayout textColumn = vertical();
        textColumn.addView(text(folder.name, 20, TEXT, true), matchWrap());
        TextView desc = text(folder.description, 14, MUTED, false);
        desc.setLineSpacing(0, 1.45f);
        textColumn.addView(desc, topMargin(matchWrap(), 8));
        row.addView(textColumn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        card.addView(row, matchWrap());
        return card;
    }

    private void renderItemList(LinearLayout list, List<PortalItem> items, ItemClick click) {
        list.removeAllViews();
        if (items.isEmpty()) {
            list.addView(emptyCard("표시할 폴더나 파일이 없습니다."), matchWrap());
            return;
        }
        for (PortalItem item : items) {
            list.addView(itemCard(item, () -> click.run(item)), bottomMargin(matchWrap(), 10));
        }
    }

    private interface ItemClick { void run(PortalItem item); }

    private View itemCard(PortalItem item, Runnable action) {
        LinearLayout card = card();
        card.setPadding(dp(15), dp(15), dp(12), dp(15));
        card.setOnClickListener(v -> action.run());
        card.setClickable(true);
        card.setFocusable(true);

        LinearLayout row = horizontal();
        row.setGravity(Gravity.TOP);
        TextView icon = text(item.isFolder ? "□" : "▤", 31, item.isFolder ? GOLD : BLUE, false);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(item.isFolder ? Color.rgb(255, 247, 231) : Color.rgb(234, 242, 255), Color.TRANSPARENT, 13, 0));
        row.addView(icon, new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout column = vertical();
        TextView name = text(item.name, 16, TEXT, true);
        name.setMaxLines(2);
        column.addView(name, matchWrap());
        TextView desc = text(item.description, 13, MUTED, false);
        desc.setMaxLines(3);
        desc.setEllipsize(android.text.TextUtils.TruncateAt.END);
        desc.setLineSpacing(0, 1.35f);
        column.addView(desc, topMargin(matchWrap(), 5));
        if (!item.modifiedTime.isEmpty()) {
            column.addView(text("수정 " + prettyDate(item.modifiedTime), 11, Color.rgb(138, 150, 168), false), topMargin(wrap(), 7));
        }
        LinearLayout.LayoutParams columnLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        columnLp.leftMargin = dp(13);
        row.addView(column, columnLp);
        TextView arrow = text("›", 29, Color.rgb(154, 166, 181), false);
        row.addView(arrow, new LinearLayout.LayoutParams(dp(28), dp(45)));
        card.addView(row, matchWrap());
        return card;
    }

    private TextView chip(String label, boolean active, boolean current) {
        int fg = current ? Color.rgb(138, 81, 0) : active ? BLUE : Color.rgb(51, 65, 85);
        int bg = current ? Color.rgb(255, 241, 214) : active ? Color.rgb(234, 242, 255) : Color.rgb(248, 250, 252);
        int stroke = current ? GOLD : active ? Color.rgb(156, 194, 255) : Color.rgb(216, 224, 234);
        TextView view = text(label, 12, fg, true);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setSingleLine(true);
        view.setEllipsize(android.text.TextUtils.TruncateAt.END);
        view.setPadding(dp(12), 0, dp(12), 0);
        view.setBackground(round(bg, stroke, 12, current ? 2 : 1));
        view.setMinHeight(dp(44));
        view.setMaxWidth(dp(260));
        return view;
    }

    private void startBlink(View view) {
        AlphaAnimation animation = new AlphaAnimation(0.42f, 1f);
        animation.setDuration(720);
        animation.setRepeatMode(Animation.REVERSE);
        animation.setRepeatCount(Animation.INFINITE);
        view.startAnimation(animation);
    }

    private HorizontalScrollView horizontalScroller(View child, int minHeight) {
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setFillViewport(false);
        scroll.setMinimumHeight(minHeight);
        scroll.addView(child, wrap());
        return scroll;
    }

    private View infoCard(String value) {
        LinearLayout card = card();
        card.setPadding(dp(20), dp(18), dp(20), dp(18));
        TextView text = text(value, 13, Color.rgb(51, 65, 85), false);
        text.setLineSpacing(0, 1.5f);
        card.addView(text, matchWrap());
        return card;
    }

    private View errorCard(String message) {
        LinearLayout card = vertical();
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        card.setBackground(round(Color.rgb(255, 242, 240), Color.rgb(255, 200, 193), 14, 1));
        TextView value = text(message, 13, Color.rgb(192, 57, 43), false);
        value.setLineSpacing(0, 1.4f);
        card.addView(value, matchWrap());
        return card;
    }

    private View emptyCard(String message) {
        TextView value = text(message, 13, Color.rgb(123, 135, 151), false);
        value.setGravity(Gravity.CENTER);
        value.setPadding(dp(15), dp(38), dp(15), dp(38));
        return value;
    }

    private void addLoading(LinearLayout parent) {
        parent.removeAllViews();
        ProgressBar progress = new ProgressBar(this);
        LinearLayout.LayoutParams lp = wrap();
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        lp.topMargin = dp(34);
        parent.addView(progress, lp);
        TextView text = text("불러오는 중...", 13, MUTED, false);
        text.setGravity(Gravity.CENTER);
        parent.addView(text, topMargin(matchWrap(), 10));
    }

    private void requestAsync(Map<String, String> values, JsonSuccess success, StringFailure failure) {
        if (apiUrl == null || apiUrl.trim().isEmpty()) {
            failure.run("Google Apps Script 주소가 비어 있습니다.");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                StringBuilder builder = new StringBuilder(apiUrl.trim());
                builder.append(apiUrl.contains("?") ? '&' : '?');
                LinkedHashMap<String, String> params = new LinkedHashMap<>(values);
                params.put("pin", PORTAL_PIN);
                params.put("token", PORTAL_TOKEN);
                boolean first = true;
                for (Map.Entry<String, String> entry : params.entrySet()) {
                    if (!first) builder.append('&');
                    first = false;
                    builder.append(URLEncoder.encode(entry.getKey(), "UTF-8"));
                    builder.append('=');
                    builder.append(URLEncoder.encode(entry.getValue() == null ? "" : entry.getValue(), "UTF-8"));
                }

                connection = (HttpURLConnection) new URL(builder.toString()).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(150000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/json");

                int code = connection.getResponseCode();
                InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
                String body = readText(stream);
                if (code < 200 || code >= 300) throw new Exception("서버 오류 (" + code + ")");
                JSONObject json = new JSONObject(body);
                if (!json.optBoolean("ok", false)) throw new Exception(json.optString("message", "요청 실패"));
                main.post(() -> {
                    try {
                        success.run(json);
                    } catch (Exception e) {
                        failure.run(messageOf(e));
                    }
                });
            } catch (Exception e) {
                String message = "연결 실패: " + messageOf(e);
                main.post(() -> failure.run(message));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private List<PortalItem> parseItems(JSONObject data) {
        ArrayList<PortalItem> result = new ArrayList<>();
        JSONArray array = data.optJSONArray("items");
        if (array == null) return result;
        for (int i = 0; i < array.length(); i++) {
            JSONObject value = array.optJSONObject(i);
            if (value != null) result.add(PortalItem.fromJson(value));
        }
        return result;
    }

    private Map<String, String> params(String... values) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        for (int i = 0; i + 1 < values.length; i += 2) result.put(values[i], values[i + 1]);
        return result;
    }

    private String readText(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder value = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new BufferedInputStream(input), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) value.append(line);
        }
        return value.toString();
    }

    private String safeFileName(String value) {
        String cleaned = value == null ? "downloaded-file" : value.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isEmpty() ? "downloaded-file" : cleaned;
    }

    private String prettyDate(String value) {
        if (value == null || value.isEmpty()) return "-";
        return value.replace('T', ' ').replace(".000Z", "").replace("Z", "");
    }

    private String messageOf(Exception e) {
        String value = e.getMessage();
        return value == null || value.trim().isEmpty() ? e.getClass().getSimpleName() : value;
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private LinearLayout vertical() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout card() {
        LinearLayout card = vertical();
        card.setBackground(round(Color.WHITE, BORDER, 18, 1));
        card.setElevation(dp(1));
        return card;
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans", bold ? Typeface.BOLD : Typeface.NORMAL));
        return view;
    }

    private EditText edit(String hint) {
        EditText edit = new EditText(this);
        edit.setHint(hint);
        edit.setTextSize(14);
        edit.setTextColor(TEXT);
        edit.setHintTextColor(Color.rgb(138, 150, 168));
        edit.setPadding(dp(15), 0, dp(15), 0);
        edit.setBackground(round(Color.WHITE, Color.rgb(200, 210, 223), 13, 1));
        return edit;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(14);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackground(round(BLUE, BLUE, 14, 1));
        return button;
    }

    private Button outlineButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(14);
        button.setTextColor(Color.rgb(71, 94, 136));
        button.setAllCaps(false);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setBackground(round(Color.WHITE, Color.rgb(142, 151, 165), 14, 1));
        return button;
    }

    private Button compactButton(String label) {
        Button button = primaryButton(label);
        button.setPadding(dp(5), 0, dp(5), 0);
        return button;
    }

    private GradientDrawable round(int fill, int stroke, int radiusDp, int strokeDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0 && stroke != Color.TRANSPARENT) drawable.setStroke(dp(strokeDp), stroke);
        return drawable;
    }

    private int withAlpha(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchHeight(int height) {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height);
    }

    private LinearLayout.LayoutParams topMargin(LinearLayout.LayoutParams params, int margin) {
        params.topMargin = dp(margin);
        return params;
    }

    private LinearLayout.LayoutParams bottomMargin(LinearLayout.LayoutParams params, int margin) {
        params.bottomMargin = dp(margin);
        return params;
    }

    private LinearLayout.LayoutParams rightMargin(LinearLayout.LayoutParams params, int margin) {
        params.rightMargin = dp(margin);
        return params;
    }

    private LinearLayout.LayoutParams sideMargin(LinearLayout.LayoutParams params, int margin) {
        params.leftMargin = dp(margin);
        params.rightMargin = dp(margin);
        return params;
    }

    private static class PortalItem {
        String id = "";
        String name = "이름 없음";
        String mimeType = "application/octet-stream";
        boolean isFolder;
        String description = "Unity Global 업무 자료";
        String modifiedTime = "";
        String webViewUrl = "";

        static PortalItem fromJson(JSONObject json) {
            PortalItem item = new PortalItem();
            item.id = json.optString("id", "");
            item.name = json.optString("name", "이름 없음");
            item.mimeType = json.optString("mimeType", "application/octet-stream");
            item.isFolder = json.optBoolean("isFolder", false) || "application/vnd.google-apps.folder".equals(item.mimeType);
            item.description = json.optString("description", "Unity Global 업무 자료");
            item.modifiedTime = json.optString("modifiedTime", "");
            item.webViewUrl = json.optString("webViewUrl", "");
            return item;
        }
    }
}
