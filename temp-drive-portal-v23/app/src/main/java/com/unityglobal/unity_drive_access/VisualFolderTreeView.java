package com.unityglobal.unity_drive_access;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

final class VisualFolderTreeView extends View {
    static final class Node {
        final String id;
        final String name;
        final Runnable action;

        Node(String id, String name, Runnable action) {
            this.id = id == null ? "" : id;
            this.name = name == null ? "이름 없음" : name;
            this.action = action;
        }
    }

    private static final int BLUE = Color.rgb(23, 105, 224);
    private static final int GOLD = Color.rgb(240, 160, 0);
    private static final int NAVY = Color.rgb(7, 26, 46);
    private static final int MUTED = Color.rgb(100, 116, 139);
    private static final int LINE = Color.rgb(180, 193, 208);

    private final List<Node> roots;
    private final List<Node> path;
    private final List<Node> children;
    private final List<Hit> hits = new ArrayList<>();

    private final Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint subPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private final int nodeWidth;
    private final int nodeHeight;
    private final int rootSpacing;
    private final int childSpacing;
    private final int mapWidth;
    private final int mapHeight;
    private final int focusX;

    private boolean pulseStrong = true;
    private final Runnable pulse = new Runnable() {
        @Override
        public void run() {
            pulseStrong = !pulseStrong;
            invalidate();
            postDelayed(this, 650);
        }
    };

    VisualFolderTreeView(Context context, List<Node> roots, List<Node> path, List<Node> children) {
        super(context);
        this.roots = new ArrayList<>(roots);
        this.path = new ArrayList<>(path);
        this.children = new ArrayList<>(children);

        nodeWidth = dp(158);
        nodeHeight = dp(64);
        rootSpacing = dp(178);
        childSpacing = dp(192);

        int rootSpan = Math.max(1, this.roots.size() - 1) * rootSpacing + nodeWidth;
        int childSpan = Math.max(1, this.children.size() - 1) * childSpacing + nodeWidth;
        int screenMin = getResources().getDisplayMetrics().widthPixels - dp(72);
        mapWidth = Math.max(screenMin, Math.max(rootSpan, childSpan) + dp(104));

        int activeRoot = 0;
        if (!this.path.isEmpty()) {
            for (int i = 0; i < this.roots.size(); i++) {
                if (this.roots.get(i).id.equals(this.path.get(0).id)) {
                    activeRoot = i;
                    break;
                }
            }
        }
        int rootStart = (mapWidth - Math.max(0, this.roots.size() - 1) * rootSpacing) / 2;
        focusX = this.roots.isEmpty() ? mapWidth / 2 : rootStart + activeRoot * rootSpacing;

        int extraPath = Math.max(0, this.path.size() - 1);
        mapHeight = dp(250) + extraPath * dp(94) + (this.children.isEmpty() ? dp(74) : dp(184));

        setLayerType(LAYER_TYPE_SOFTWARE, null);
        setClickable(true);

        linePaint.setStyle(Paint.Style.STROKE);
        linePaint.setStrokeCap(Paint.Cap.ROUND);

        strokePaint.setStyle(Paint.Style.STROKE);

        titlePaint.setTypeface(Typeface.create("sans", Typeface.BOLD));
        titlePaint.setTextAlign(Paint.Align.LEFT);
        titlePaint.setTextSize(sp(11));

        subPaint.setTypeface(Typeface.create("sans", Typeface.NORMAL));
        subPaint.setTextAlign(Paint.Align.CENTER);
        subPaint.setTextSize(sp(9));
    }

    int getMapWidth() {
        return mapWidth;
    }

    int getMapHeight() {
        return mapHeight;
    }

    int getFocusX() {
        return focusX;
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        removeCallbacks(pulse);
        postDelayed(pulse, 650);
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(pulse);
        super.onDetachedFromWindow();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        hits.clear();
        canvas.drawColor(Color.rgb(248, 251, 255));

        int center = mapWidth / 2;
        int rootTop = dp(24);
        RectF rootRect = rectFor(center, rootTop);
        drawNode(canvas, rootRect, "문서 카테고리", false, false, () -> {
            if (!path.isEmpty() && path.get(0).action != null) {
                // Root itself is handled by the external home button; this keeps touch semantics stable.
            }
        });

        subPaint.setColor(MUTED);
        subPaint.setTextSize(sp(9));
        canvas.drawText("UNITY GLOBAL DOCUMENT TREE", center, dp(16), subPaint);

        int categoryTop = dp(120);
        int trunkY = dp(98);
        int rootStart = roots.isEmpty() ? center : (mapWidth - Math.max(0, roots.size() - 1) * rootSpacing) / 2;
        String activeRootId = path.isEmpty() ? "" : path.get(0).id;

        if (!roots.isEmpty()) {
            int firstX = rootStart;
            int lastX = rootStart + (roots.size() - 1) * rootSpacing;
            drawLine(canvas, center, rootRect.bottom, center, trunkY, LINE, dp(2));
            drawLine(canvas, firstX, trunkY, lastX, trunkY, LINE, dp(2));

            for (int i = 0; i < roots.size(); i++) {
                Node node = roots.get(i);
                int x = rootStart + i * rootSpacing;
                boolean active = node.id.equals(activeRootId);
                boolean current = active && path.size() == 1;
                drawLine(canvas, x, trunkY, x, categoryTop, active ? BLUE : LINE, active ? dp(3) : dp(2));
                drawNode(canvas, rectFor(x, categoryTop), node.name, active, current, node.action);
            }
        }

        int previousBottom = categoryTop + nodeHeight;
        for (int i = 1; i < path.size(); i++) {
            Node node = path.get(i);
            int top = categoryTop + i * dp(94);
            int middle = previousBottom + (top - previousBottom) / 2;
            drawLine(canvas, focusX, previousBottom, focusX, top, BLUE, dp(3));
            drawDot(canvas, focusX, middle, BLUE);
            boolean current = i == path.size() - 1;
            drawNode(canvas, rectFor(focusX, top), node.name, true, current, node.action);
            previousBottom = top + nodeHeight;
        }

        if (children.isEmpty()) {
            subPaint.setColor(MUTED);
            subPaint.setTextSize(sp(10));
            canvas.drawText("현재 폴더 아래에 하위 폴더가 없습니다.", focusX, previousBottom + dp(54), subPaint);
            return;
        }

        int childTop = previousBottom + dp(94);
        int childTrunk = previousBottom + dp(49);
        int span = (children.size() - 1) * childSpacing;
        int start = focusX - span / 2;
        int minStart = dp(52) + nodeWidth / 2;
        int maxStart = mapWidth - dp(52) - nodeWidth / 2 - span;
        start = Math.max(minStart, Math.min(start, maxStart));

        int firstChildX = start;
        int lastChildX = start + span;
        drawLine(canvas, focusX, previousBottom, focusX, childTrunk, GOLD, dp(3));
        drawLine(canvas, firstChildX, childTrunk, lastChildX, childTrunk, LINE, dp(2));
        drawDot(canvas, focusX, childTrunk, GOLD);

        for (int i = 0; i < children.size(); i++) {
            Node node = children.get(i);
            int x = start + i * childSpacing;
            drawLine(canvas, x, childTrunk, x, childTop, LINE, dp(2));
            drawNode(canvas, rectFor(x, childTop), node.name, false, false, node.action);
        }
    }

    private RectF rectFor(int centerX, int top) {
        return new RectF(centerX - nodeWidth / 2f, top, centerX + nodeWidth / 2f, top + nodeHeight);
    }

    private void drawNode(Canvas canvas, RectF rect, String label, boolean active, boolean current, Runnable action) {
        int fill;
        int stroke;
        int textColor;

        if (current) {
            fill = pulseStrong ? Color.rgb(255, 235, 186) : Color.rgb(255, 247, 224);
            stroke = GOLD;
            textColor = Color.rgb(119, 69, 0);

            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setColor(pulseStrong ? Color.argb(62, 240, 160, 0) : Color.argb(24, 240, 160, 0));
            fillPaint.setShadowLayer(pulseStrong ? dp(16) : dp(7), 0, 0, Color.argb(145, 240, 160, 0));
            RectF glow = new RectF(rect.left - dp(6), rect.top - dp(6), rect.right + dp(6), rect.bottom + dp(6));
            canvas.drawRoundRect(glow, dp(18), dp(18), fillPaint);
            fillPaint.clearShadowLayer();
        } else if (active) {
            fill = Color.rgb(232, 242, 255);
            stroke = BLUE;
            textColor = Color.rgb(18, 82, 170);
        } else {
            fill = Color.WHITE;
            stroke = Color.rgb(203, 213, 225);
            textColor = Color.rgb(51, 65, 85);
        }

        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(fill);
        canvas.drawRoundRect(rect, dp(15), dp(15), fillPaint);

        strokePaint.setColor(stroke);
        strokePaint.setStrokeWidth(current ? dp(3) : active ? dp(2) : dp(1));
        canvas.drawRoundRect(rect, dp(15), dp(15), strokePaint);

        drawFolder(canvas, rect.left + dp(19), rect.centerY(), current ? GOLD : active ? BLUE : MUTED);

        titlePaint.setColor(textColor);
        titlePaint.setTextSize(sp(11));
        float textX = rect.left + dp(41);
        String[] lines = splitLabel(label, 18);
        if (lines[1].isEmpty()) {
            canvas.drawText(lines[0], textX, rect.centerY() + dp(4), titlePaint);
        } else {
            canvas.drawText(lines[0], textX, rect.centerY() - dp(4), titlePaint);
            Paint second = new Paint(titlePaint);
            second.setTextSize(sp(9));
            canvas.drawText(lines[1], textX, rect.centerY() + dp(12), second);
        }

        if (current) {
            subPaint.setColor(Color.rgb(145, 84, 0));
            subPaint.setTypeface(Typeface.create("sans", Typeface.BOLD));
            subPaint.setTextSize(sp(8));
            canvas.drawText("현재 위치", rect.centerX(), rect.bottom - dp(5), subPaint);
            subPaint.setTypeface(Typeface.create("sans", Typeface.NORMAL));
        }

        if (action != null) hits.add(new Hit(new RectF(rect), action));
    }

    private void drawFolder(Canvas canvas, float x, float cy, int color) {
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(color);
        canvas.drawRoundRect(new RectF(x - dp(8), cy - dp(11), x + dp(2), cy - dp(5)), dp(2), dp(2), fillPaint);
        canvas.drawRoundRect(new RectF(x - dp(8), cy - dp(8), x + dp(11), cy + dp(9)), dp(3), dp(3), fillPaint);
    }

    private void drawLine(Canvas canvas, float x1, float y1, float x2, float y2, int color, float width) {
        linePaint.setColor(color);
        linePaint.setStrokeWidth(width);
        canvas.drawLine(x1, y1, x2, y2, linePaint);
    }

    private void drawDot(Canvas canvas, float x, float y, int color) {
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(color);
        canvas.drawCircle(x, y, dp(4), fillPaint);
        fillPaint.setColor(Color.WHITE);
        canvas.drawCircle(x, y, dp(2), fillPaint);
    }

    private String[] splitLabel(String value, int max) {
        String clean = value == null ? "" : value.trim();
        if (clean.length() <= max) return new String[]{clean, ""};
        int split = -1;
        for (int i = Math.min(max, clean.length() - 1); i >= Math.max(5, max - 7); i--) {
            char c = clean.charAt(i);
            if (c == '_' || c == ' ' || c == '-') {
                split = i;
                break;
            }
        }
        if (split < 1) return new String[]{clean.substring(0, max - 1) + "…", ""};
        String first = clean.substring(0, split);
        int next = split + 1;
        while (next < clean.length()) {
            char c = clean.charAt(next);
            if (c == '_' || c == ' ' || c == '-') next++;
            else break;
        }
        String second = clean.substring(next);
        if (second.length() > max) second = second.substring(0, max - 1) + "…";
        return new String[]{first, second};
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_UP) {
            for (Hit hit : hits) {
                if (hit.rect.contains(event.getX(), event.getY())) {
                    performClick();
                    hit.action.run();
                    return true;
                }
            }
        }
        return true;
    }

    @Override
    public boolean performClick() {
        super.performClick();
        return true;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private float sp(float value) {
        return value * getResources().getDisplayMetrics().scaledDensity;
    }

    private static final class Hit {
        final RectF rect;
        final Runnable action;

        Hit(RectF rect, Runnable action) {
            this.rect = rect;
            this.action = action;
        }
    }
}
