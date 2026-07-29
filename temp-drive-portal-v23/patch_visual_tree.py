from pathlib import Path

path = Path('temp-drive-portal-v23/app/src/main/java/com/unityglobal/unity_drive_access/MainActivity.java')
source = path.read_text(encoding='utf-8')

start = source.index('    private View buildFolderMap(')
end = source.index('    private void showFile(', start)

replacement = r'''    private View buildFolderMap(PortalItem folder, List<PortalItem> children) {
        LinearLayout card = card();
        card.setPadding(dp(14), dp(14), dp(14), dp(14));

        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);

        TextView icon = text("⌘", 23, BLUE, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(Color.rgb(234, 242, 255), Color.TRANSPARENT, 12, 0));
        header.addView(icon, new LinearLayout.LayoutParams(dp(40), dp(40)));

        LinearLayout titles = vertical();
        titles.addView(text("폴더 구조 지도", 17, TEXT, true), wrap());
        titles.addView(text("전체 구조 · 현재 경로 · 하위 폴더", 10, MUTED, false), topMargin(wrap(), 2));
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleLp.leftMargin = dp(11);
        header.addView(titles, titleLp);

        TextView refresh = treeActionButton("↻");
        refresh.setOnClickListener(v -> showFolder(folder, new ArrayList<>(path)));
        header.addView(refresh, new LinearLayout.LayoutParams(dp(40), dp(40)));
        card.addView(header, matchWrap());

        LinearLayout mapBox = vertical();
        mapBox.setPadding(dp(10), dp(9), dp(10), dp(9));
        mapBox.setBackground(round(Color.rgb(248, 251, 255), Color.rgb(218, 228, 240), 14, 1));
        card.addView(mapBox, topMargin(matchWrap(), 10));

        LinearLayout overviewTitle = horizontal();
        overviewTitle.setGravity(Gravity.CENTER_VERTICAL);
        overviewTitle.addView(text("전체 카테고리", 10, Color.rgb(71, 85, 105), true),
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        overviewTitle.addView(text(rootItems.size() + "개", 9, Color.rgb(123, 135, 151), false), wrap());
        mapBox.addView(overviewTitle, matchWrap());

        LinearLayout categoryRail = horizontal();
        categoryRail.setGravity(Gravity.CENTER_VERTICAL);
        String activeRootId = path.isEmpty() ? "" : path.get(0).id;
        for (PortalItem rootItem : rootItems) {
            boolean active = rootItem.id.equals(activeRootId);
            TextView node = treeMiniNode(shortFolderCode(rootItem.name), active);
            node.setContentDescription(rootItem.name);
            node.setOnClickListener(v -> {
                ArrayList<PortalItem> target = new ArrayList<>();
                target.add(rootItem);
                showFolder(rootItem, target);
            });
            categoryRail.addView(node, rightMargin(new LinearLayout.LayoutParams(dp(36), dp(28)), 5));
        }
        mapBox.addView(horizontalScroller(categoryRail, dp(30)), topMargin(matchHeight(dp(30)), 5));

        LinearLayout routeTitle = horizontal();
        routeTitle.setGravity(Gravity.CENTER_VERTICAL);
        routeTitle.addView(text("현재 경로", 10, Color.rgb(71, 85, 105), true),
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        routeTitle.addView(text("금색 = 현재 위치", 9, Color.rgb(156, 96, 0), false), wrap());
        mapBox.addView(routeTitle, topMargin(matchWrap(), 7));

        HorizontalScrollView routeScroll = new HorizontalScrollView(this);
        routeScroll.setHorizontalScrollBarEnabled(false);
        routeScroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        LinearLayout routeRow = horizontal();
        routeRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView home = treeRouteNode("⌂ 문서", false, false);
        home.setOnClickListener(v -> showHome());
        routeRow.addView(home, new LinearLayout.LayoutParams(dp(76), dp(38)));

        for (int i = 0; i < path.size(); i++) {
            final int index = i;
            final PortalItem pathItem = path.get(i);
            routeRow.addView(treeHorizontalLine(), new LinearLayout.LayoutParams(dp(20), dp(2)));
            boolean current = i == path.size() - 1;
            TextView node = treeRouteNode(pathItem.name, !current, current);
            node.setOnClickListener(v -> {
                if (index == path.size() - 1) return;
                ArrayList<PortalItem> target = new ArrayList<>(path.subList(0, index + 1));
                showFolder(pathItem, target);
            });
            routeRow.addView(node, new LinearLayout.LayoutParams(dp(current ? 148 : 126), dp(38)));
        }

        routeScroll.addView(routeRow, wrap());
        mapBox.addView(routeScroll, topMargin(matchHeight(dp(42)), 4));
        routeScroll.post(() -> routeScroll.fullScroll(View.FOCUS_RIGHT));

        if (children.isEmpty()) {
            LinearLayout leaf = horizontal();
            leaf.setGravity(Gravity.CENTER);
            leaf.addView(text("│", 13, Color.rgb(148, 163, 184), false), wrap());
            leaf.addView(text("  하위 폴더 없음", 9, Color.rgb(123, 135, 151), false), wrap());
            mapBox.addView(leaf, topMargin(matchHeight(dp(24)), 3));
        } else {
            FrameLayout branch = new FrameLayout(this);
            View verticalLine = treeVerticalLine();
            FrameLayout.LayoutParams verticalLp = new FrameLayout.LayoutParams(dp(2), dp(12), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
            branch.addView(verticalLine, verticalLp);
            View horizontalLine = new View(this);
            horizontalLine.setBackgroundColor(Color.rgb(180, 193, 208));
            FrameLayout.LayoutParams horizontalLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(2), Gravity.BOTTOM);
            horizontalLp.leftMargin = dp(24);
            horizontalLp.rightMargin = dp(24);
            branch.addView(horizontalLine, horizontalLp);
            mapBox.addView(branch, topMargin(matchHeight(dp(14)), 1));

            LinearLayout childRow = horizontal();
            childRow.setGravity(Gravity.CENTER_VERTICAL);
            int shown = 0;
            for (PortalItem child : children) {
                if (shown >= 5) break;
                TextView childNode = treeChildNode(child.name);
                childNode.setOnClickListener(v -> {
                    ArrayList<PortalItem> next = new ArrayList<>(path);
                    next.add(child);
                    showFolder(child, next);
                });
                childRow.addView(childNode, rightMargin(new LinearLayout.LayoutParams(dp(116), dp(36)), 7));
                shown++;
            }
            if (children.size() > shown) {
                TextView more = treeChildNode("+" + (children.size() - shown) + "개");
                childRow.addView(more, new LinearLayout.LayoutParams(dp(66), dp(36)));
            }
            mapBox.addView(horizontalScroller(childRow, dp(38)), matchHeight(dp(38)));
        }

        return card;
    }

    private TextView treeActionButton(String label) {
        TextView view = text(label, 18, Color.rgb(71, 85, 105), false);
        view.setGravity(Gravity.CENTER);
        view.setBackground(round(Color.rgb(248, 250, 252), Color.rgb(209, 218, 230), 11, 1));
        return view;
    }

    private TextView treeMiniNode(String label, boolean active) {
        TextView view = text(label, 9, active ? Color.rgb(126, 73, 0) : Color.rgb(100, 116, 139), true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setBackground(round(active ? Color.rgb(255, 239, 202) : Color.WHITE,
                active ? GOLD : Color.rgb(203, 213, 225), 8, active ? 2 : 1));
        return view;
    }

    private TextView treeRouteNode(String label, boolean active, boolean current) {
        int foreground = current ? Color.rgb(126, 73, 0) : active ? Color.rgb(20, 82, 168) : Color.rgb(71, 85, 105);
        int background = current ? Color.rgb(255, 239, 202) : active ? Color.rgb(232, 242, 255) : Color.WHITE;
        int stroke = current ? GOLD : active ? BLUE : Color.rgb(203, 213, 225);
        TextView view = text(label, 10, foreground, true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setEllipsize(android.text.TextUtils.TruncateAt.END);
        view.setPadding(dp(8), 0, dp(8), 0);
        view.setBackground(round(background, stroke, 10, current ? 2 : 1));
        if (current) startBlink(view);
        return view;
    }

    private TextView treeChildNode(String label) {
        TextView view = text("▣ " + label, 9, Color.rgb(71, 85, 105), true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setEllipsize(android.text.TextUtils.TruncateAt.END);
        view.setPadding(dp(7), 0, dp(7), 0);
        view.setBackground(round(Color.WHITE, Color.rgb(203, 213, 225), 9, 1));
        return view;
    }

    private View treeHorizontalLine() {
        View line = new View(this);
        line.setBackgroundColor(BLUE);
        return line;
    }

    private View treeVerticalLine() {
        View line = new View(this);
        line.setBackgroundColor(GOLD);
        return line;
    }

    private String shortFolderCode(String name) {
        if (name == null || name.isEmpty()) return "·";
        int underscore = name.indexOf('_');
        if (underscore > 0 && underscore <= 3) return name.substring(0, underscore);
        return name.length() <= 3 ? name : name.substring(0, 3);
    }

'''

source = source[:start] + replacement + source[end:]
path.write_text(source, encoding='utf-8')
