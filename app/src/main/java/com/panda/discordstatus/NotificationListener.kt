package com.panda.discordstatus

import android.app.Notification
import android.content.Intent
import android.media.session.MediaController
import android.media.session.PlaybackState
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class NotificationListener : NotificationListenerService() {

    private val musicPackages = setOf(
        "com.spotify.music",
        "com.google.android.apps.youtube.music",
        "com.google.android.music",
        "com.soundcloud.android",
        "deezer.android.app",
        "com.nikhil.yt",
        "org.videolan.vlc",
        "com.dywx.larkplayer"
    )

    private var lastTitle: String? = null
    private var lastPackage: String? = null
    private var lastPaused: Boolean? = null

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in musicPackages) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: return
        val artist = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""

        // Read playback state (playing/paused) from the notification's attached MediaSession token
        var isPaused = false
        val mediaSessionToken = extras.getParcelable<android.media.session.MediaSession.Token>(
            Notification.EXTRA_MEDIA_SESSION
        )
        if (mediaSessionToken != null) {
            try {
                val controller = MediaController(this, mediaSessionToken)
                isPaused = controller.playbackState?.state != PlaybackState.STATE_PLAYING
            } catch (e: Exception) {
                // If we can't read playback state, default to "not paused" rather than guessing wrong
                isPaused = false
            }
        }

        // Re-broadcast if the song changed OR if just the pause state changed
        if (title == lastTitle && sbn.packageName == lastPackage && isPaused == lastPaused) return
        lastTitle = title
        lastPackage = sbn.packageName
        lastPaused = isPaused

        val intent = Intent("MUSIC_UPDATED").apply {
            putExtra("title", title)
            putExtra("artist", artist)
            putExtra("isPaused", isPaused)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (sbn.packageName in musicPackages) {
            lastTitle = null
            lastPackage = null
            lastPaused = null
            LocalBroadcastManager.getInstance(this).sendBroadcast(Intent("MUSIC_STOPPED"))
        }
    }
}