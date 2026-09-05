package com.panda.discordstatus

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONObject
import java.io.IOException

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExportJson: String? = null
    private val createDocumentRequestCode = 1001
    private val openDocumentRequestCode = 1002
    private val externalDomains = listOf("discord.gg", "discord-activity.cc.cd")

    private fun isExternalLink(url: String) = externalDomains.any { url.contains(it) }
    private fun openInBrowser(url: String) = startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    private val musicReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                "MUSIC_UPDATED" -> {
                    val title = intent.getStringExtra("title") ?: return
                    val artist = intent.getStringExtra("artist") ?: ""
                    val isPaused = intent.getBooleanExtra("isPaused", false)
                    webView.evaluateJavascript(
                        "applyMusicAsActivity(${JSONObject.quote(title)}, ${JSONObject.quote(artist)}, $isPaused);",
                        null,
                    )
                }
                "MUSIC_STOPPED" -> webView.evaluateJavascript(
                    "if(typeof onMusicNotificationCleared==='function'){onMusicNotificationCleared();}",
                    null,
                )
            }
        }
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun requestNotificationAccess() = runOnUiThread {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        @JavascriptInterface
        fun exportPresets(json: String) = runOnUiThread {
            pendingExportJson = json
            startActivityForResult(
                Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, "discord-presets.json")
                },
                createDocumentRequestCode,
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
        }
        webView.addJavascriptInterface(NativeBridge(), "NativeBridge")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (isExternalLink(url)) {
                    openInBrowser(url)
                    return true
                }
                return false
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    startActivityForResult(
                        fileChooserParams.createIntent().apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "text/plain"))
                        },
                        openDocumentRequestCode,
                    )
                    true
                } catch (_: Exception) {
                    filePathCallback = null
                    false
                }
            }

            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val tempWebView = WebView(view.context)
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(tv: WebView, request: WebResourceRequest): Boolean {
                        openInBrowser(request.url.toString())
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = tempWebView
                resultMsg.sendToTarget()
                return true
            }
        }
        webView.loadUrl("file:///android_asset/index.html")
        LocalBroadcastManager.getInstance(this).registerReceiver(
            musicReceiver,
            IntentFilter().apply {
                addAction("MUSIC_UPDATED")
                addAction("MUSIC_STOPPED")
            },
        )
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == createDocumentRequestCode) {
            val json = pendingExportJson
            pendingExportJson = null
            if (resultCode == RESULT_OK && data?.data != null && json != null) {
                try {
                    contentResolver.openOutputStream(data.data!!)?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                        ?: throw IOException("Could not open destination")
                    webView.evaluateJavascript("if(typeof nativeExportComplete==='function'){nativeExportComplete(true);}", null)
                } catch (_: Exception) {
                    webView.evaluateJavascript("if(typeof nativeExportComplete==='function'){nativeExportComplete(false);}", null)
                }
            }
            return
        }
        if (requestCode == openDocumentRequestCode) {
            val callback = filePathCallback
            filePathCallback = null
            callback?.onReceiveValue(if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null)
        }
    }

    override fun onResume() {
        super.onResume()
        val enabled = isNotificationServiceEnabled()
        webView.evaluateJavascript("if(typeof updateNotifAccessStatus==='function'){updateNotifAccessStatus($enabled);}", null)
    }

    private fun isNotificationServiceEnabled(): Boolean {
        val enabledListeners = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return enabledListeners?.contains(packageName) == true
    }

    override fun onDestroy() {
        LocalBroadcastManager.getInstance(this).unregisterReceiver(musicReceiver)
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
