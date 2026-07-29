from pathlib import Path

path = Path('temp-drive-portal-v23/app/src/main/java/com/unityglobal/unity_drive_access/MainActivity.java')
source = path.read_text(encoding='utf-8')

start = source.index('    private View buildFolderMap(')
end = source.index('    private void showFile(', start)

replacement = r'''    private View buildFolderMap(PortalItem folder, List<PortalItem> children) {
        LinearLayout card = card();
        card.setPadding(dp(18), dp(18), dp(18), dp(20));

        LinearLayout header = horizontal();
        TextView icon = text("⌘", 28, BLUE, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(round(Color.rgb(234, 242, 255), Color.TRANSPARENT, 14, 0));
        header.addView(icon, new LinearLayout.LayoutParams(dp(46), dp(46)));

        LinearLayout titles = vertical();
        titles.addView(text("폴더 구조 지도", 20, TEXT, true), wrap());
        TextView sub = text("연결선을 따라 전체 구조와 현재 위치를 확인합니다. 좌우로 밀어 이동하십시오.", 12, Color.rgb(104, 118, 137), false);
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

        ArrayList<VisualFolderTreeView.Node> rootNodes = new ArrayList<>();
        for (PortalItem rootItem : rootItems) {
            rootNodes.add(new VisualFolderTreeView.Node(rootItem.id, rootItem.name, () -> {
                ArrayList<PortalItem> target = new ArrayList<>();
                target.add(rootItem);
                showFolder(rootItem, target);
            }));
        }

        ArrayList<VisualFolderTreeView.Node> pathNodes = new ArrayList<>();
        for (int i = 0; i < path.size(); i++) {
            final int index = i;
            final PortalItem pathItem = path.get(i);
            pathNodes.add(new VisualFolderTreeView.Node(pathItem.id, pathItem.name, () -> {
                ArrayList<PortalItem> target = new ArrayList<>(path.subList(0, index + 1));
                showFolder(pathItem, target);
            }));
        }

        ArrayList<VisualFolderTreeView.Node> childNodes = new ArrayList<>();
        for (PortalItem child : children) {
            childNodes.add(new VisualFolderTreeView.Node(child.id, child.name, () -> {
                ArrayList<PortalItem> target = new ArrayList<>(path);
                target.add(child);
                showFolder(child, target);
            }));
        }

        VisualFolderTreeView mapView = new VisualFolderTreeView(this, rootNodes, pathNodes, childNodes);
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setFillViewport(false);
        scroll.setOverScrollMode(View.OVER_SCROLL_NEVER);
        scroll.setBackground(round(Color.rgb(248, 251, 255), Color.rgb(222, 231, 242), 16, 1));
        scroll.addView(mapView, new HorizontalScrollView.LayoutParams(mapView.getMapWidth(), mapView.getMapHeight()));
        card.addView(scroll, topMargin(matchHeight(mapView.getMapHeight()), 16));

        scroll.post(() -> {
            int target = Math.max(0, mapView.getFocusX() - scroll.getWidth() / 2);
            scroll.scrollTo(target, 0);
        });

        LinearLayout legend = horizontal();
        legend.setGravity(Gravity.CENTER_VERTICAL);
        legend.addView(text("● 현재 위치", 11, GOLD, true), rightMargin(wrap(), 16));
        legend.addView(text("■ 현재 경로", 11, BLUE, true), rightMargin(wrap(), 16));
        legend.addView(text("□ 다른 폴더", 11, Color.rgb(100, 116, 139), false), wrap());
        card.addView(legend, topMargin(matchWrap(), 13));

        TextView guide = text("폴더 노드를 누르면 해당 위치로 바로 이동합니다.", 11, Color.rgb(123, 135, 151), false);
        card.addView(guide, topMargin(matchWrap(), 8));
        return card;
    }

'''

source = source[:start] + replacement + source[end:]
path.write_text(source, encoding='utf-8')
