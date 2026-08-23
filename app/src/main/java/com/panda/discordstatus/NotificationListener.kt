package com.panda.discordstatus

import android.app.Notification
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class NotificationListener : NotificationListenerService() {

    private val musicPackages = setOf(
        "com.spotify.music",
        "com.google.android.apps.youtube.music",
        "com.google.android.music",
        "com.soundcloud.android",
        "deezer.android.app"
    )

    private var lastTitle: String? = null
    private var lastPackage: String? = null

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in musicPackages) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: return
        val artist = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

        if (title == lastTitle && sbn.packageName == lastPackage) return
        lastTitle = title
        lastPackage = sbn.packageName

        val intent = Intent("MUSIC_UPDATED").apply {
            putExtra("title", title)
            putExtra("artist", artist)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (sbn.packageName in musicPackages) {
            lastTitle = null
            lastPackage = null
            LocalBroadcastManager.getInstance(this).sendBroadcast(Intent("MUSIC_STOPPED"))
        }
    }
}