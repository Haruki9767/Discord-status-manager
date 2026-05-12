# Keep WebView JS interface if any
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
