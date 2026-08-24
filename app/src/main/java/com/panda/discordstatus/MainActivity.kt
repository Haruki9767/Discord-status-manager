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
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

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
                    val js = "applyMusicAsActivity(${JSONObject.quote(title)}, ${JSONObject.quote(artist)}, $isPaused);"
                    webView.evaluateJavascript(js, null)
                }
                "MUSIC_STOPPED" -> {
                    webView.evaluateJavascript(
                        "if(typeof musicDismissed!=='undefined'){musicDismissed=true;}",
                        null
                    )
                }
            }
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
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message
            ): Boolean {
                val tempWebView = WebView(view.context)
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(tv: WebView, request: WebResourceRequest): Boolean {
                        openInBrowser(request.url.toString())
                        return true
                    }
                }
                val transport = resultMsg.obj as WebView.WebViewTransport
                transport.webView = tempWebView
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
            }
        )

        if (!isNotificationServiceEnabled()) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    override fun onResume() {
        super.onResume()
        val enabled = isNotificationServiceEnabled()
        val js = "if(typeof updateNotifAccessStatus==='function'){updateNotifAccessStatus($enabled);}"
        webView.evaluateJavascript(js, null)
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
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}