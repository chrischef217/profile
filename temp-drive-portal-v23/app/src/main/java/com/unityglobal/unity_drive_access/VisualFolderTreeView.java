package com.unityglobal.unity_drive_access;

/**
 * Legacy canvas-based folder map retained only so previous temporary build history remains reproducible.
 * Unity Global Drive Portal v2.5 no longer instantiates this class.
 * The active compact map is built entirely with native Android Views in MainActivity.
 */
final class VisualFolderTreeView {
    private VisualFolderTreeView() {
        throw new AssertionError("Legacy map is disabled");
    }
}
